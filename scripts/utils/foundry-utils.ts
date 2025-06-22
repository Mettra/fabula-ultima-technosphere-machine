import { ModuleName } from "../core-config";

export function getTSFlag<T>(doc: any, key: string): T | undefined {
    return doc.getFlag(ModuleName, key);
}

export async function setTSFlag(
    doc: any,
    key: string,
    value: any
): Promise<void> {
    await doc.setFlag(ModuleName, key, value);
}
