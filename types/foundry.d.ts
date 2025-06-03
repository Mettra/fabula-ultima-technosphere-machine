// Foundry's use of `Object.assign(globalThis) means many globally available objects are not read as such
// This declare global hopefully fixes that
declare global {
  readonly const ui: {
    activeWindow: Application|ApplicationV2,
    controls: SceneControls,
    hotbar: Hotbar,
    menu: MainMenu,
    nav: SceneNavigation,
    notifications: Notifications,
    pause: GamePause,
    players: Players,
    sidebar: Sidebar,
    windows: Record<string, Application>
    // it's possible we want to expand this to all actually-used options in CONFIG.ui
  }

  // not a real extension of course but simplest way for this to work with the intellisense.
  /**
   * A simple event framework used throughout Foundry Virtual Tabletop.
   * When key actions or events occur, a "hook" is defined where user-defined callback functions can execute.
   * This class manages the registration and execution of hooked callback functions.
   */
  class Hooks extends foundry.helpers.Hooks {}
  const fromUuid = foundry.utils.fromUuid;
  const fromUuidSync = foundry.utils.fromUuidSync;
  /**
   * The singleton game canvas
   */
  const canvas: Canvas;
}

export {};