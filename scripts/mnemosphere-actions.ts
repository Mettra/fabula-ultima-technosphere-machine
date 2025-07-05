import { RegisterSynchronization } from "./socket";

RegisterSynchronization(
    "level-up-mnemosphere",
    async (params) => {
        const { skillUUID, mnemosphereUUID } = params;

        const skill = await fromUuid(skillUUID);
        const mnemosphere = await fromUuid(mnemosphereUUID);

        if (!skill || !mnemosphere) {
            return false;
        }

        const skillLink = `@UUID[${skillUUID}]{${skill.name}}`;
        const newDescription = `${mnemosphere.system.description}<p>${skillLink}</p>`;

        await mnemosphere.update({
            "system.description": newDescription,
        });

        return true;
    },
    async (result) => {
        if (result) {
            ui.notifications.info("Mnemosphere leveled up!");
        } else {
            ui.notifications.error("Failed to level up Mnemosphere.");
        }
    }
);
