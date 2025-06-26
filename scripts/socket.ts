import { Log } from "./core-config";

const MODULE_ID = "fabula-ultima-technosphere-machine";
const SOCKET_NAME = `module.${MODULE_ID}`;

type SyncAction = {
    gmFunction: (params: any) => any | false | Promise<any | false>;
    everyoneFn: (result: any) => void | Promise<void>;
};

// A map to hold the functions for different actions.
const syncActions = new Map<string, SyncAction>();
// A map to hold pending promises for synchronize calls.
const pendingPromises = new Map<
    string,
    { resolve: (result: any) => void; reject: (reason?: any) => void }
>();

export async function synchronize<Params, Result extends { success: boolean }>(
    name: string,
    params: Params,
    successFn: (result: Result) => any
) {
    const correlationId = foundry.utils.randomID();

    const promise = new Promise<Result>((resolve, reject) => {
        pendingPromises.set(correlationId, { resolve, reject });
    });

    const data = {
        type: "EXECUTE",
        name,
        params,
        correlationId,
    }

    // GM's can just run the function directly, everyone else needs to send it to a gm
    if (game.user.isGM) {
        handleEmit(data)
    }
    else {
        game.socket.emit(SOCKET_NAME, data);
    }


    let result = await promise;
    if (result.success) {
        successFn(result);
    }

    return promise;
}

/**
 * Registers the functions for a synchronized action.
 * This must be called on all clients (GM and players) during setup,
 * so they know how to handle the action and its result.
 *
 * @param name The unique name for the action.
 * @param gmFunction The function to run on the GM client. Should return `false` to indicate failure.
 */
export function RegisterSynchronization<Params, Result>(
    name: string,
    gmFunction: (params: Params) => Result | false | Promise<Result | false>,
    everyoneFn: (result: any) => void | Promise<void>
): void {
    syncActions.set(name, { gmFunction, everyoneFn });
}

async function handleEmit(data) {
    const { type, name, params, result, correlationId, reason } = data;
    Log("Emit - ", type, name, params, result, correlationId);

    const action = syncActions.get(name);
    if (type === "EXECUTE") {
        // Only the active GM should process the command
        if (!game.users.activeGM?.isSelf)
            return

        if (!action) {
            game.socket.emit(SOCKET_NAME, {
                type: "REJECT",
                name,
                correlationId,
                reason: `Action '${name}' is not registered on the GM.`,
            });
            return;
        }

        const gmResult = await action.gmFunction(params);
        let success =
            gmResult != false &&
            (gmResult.success === undefined || gmResult.success == true);

        if (success) {
            // On success, broadcast the result back to all clients, then yourself
            let data = {
                type: "BROADCAST",
                name,
                result: { success: true, ...gmResult },
                correlationId,
            };

            game.socket.emit(SOCKET_NAME, data);
            await handleEmit(data);
        } else {
            // On failure, broadcast a rejection
            game.socket.emit(SOCKET_NAME, {
                type: "REJECT",
                name,
                correlationId,
                result: { success: false, ...gmResult },
                reason: `GM function for action '${name}' returned false.`,
            });
        }
    } else if (type === "BROADCAST") {
        action.everyoneFn(result);

        // Resolve the promise on the originating client
        if (pendingPromises.has(correlationId)) {
            pendingPromises.get(correlationId)?.resolve(result);
            pendingPromises.delete(correlationId);
        }
    } else if (type === "REJECT") {
        // A client's promise is being rejected by the GM
        if (pendingPromises.has(correlationId)) {
            if (result.error) {
                ui.notifications.error(result.error);
            }

            pendingPromises.get(correlationId)?.reject(result);
            pendingPromises.delete(correlationId);
        }
    }
}

/**
 * Sets up the socket listeners. This should be called once during the 'setup' or 'ready' hook.
 */
export function SetupSockets(): void {
    game.socket.on(SOCKET_NAME, handleEmit);
}
