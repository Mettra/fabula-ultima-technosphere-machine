
declare global {
  type UUID = `Actor.${string}` | `Adventure.${string}` | `Cards.${string}` | `ChatMessage.${string}` | `Combat.${string}` | `FogExploration.${string}` | `Folder.${string}` | `Item.${string}` | `JournalEntry.${string}` | `Macro.${string}` | `Playlist.${string}` | `RollTable.${string}` | `Scene.${string}` | `Setting.${string}`
}

export {};