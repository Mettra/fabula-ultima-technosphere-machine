declare global {
  interface FSystem extends System {
    resources : {
      zenit: {
        value : number
      }
    }
  }

  interface FUActor extends Actor {
    system : FSystem
  }
}

// this file is purely for its global types
export {};