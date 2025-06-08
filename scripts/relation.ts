
type ID = number & { readonly __brand: "ID" };
export type Skill_ID = UUID ;
export type Class_ID = UUID ;
export type Item_ID = UUID ;
export type HeroicSkill_ID = UUID ;
export type Memnosphere_ID = number & { readonly __brand: "Memnosphere" } ;

const Relations = {

        
        Item: {
            NextId: 0,

            GetNextId() : Item_ID {
                return this.NextId++ as any; 
            },


                memnosphere: {
                    tbl : {} as { [key: Item_ID]: Memnosphere_ID; },
                    define: function(id : Item_ID, value : Memnosphere_ID) { this.tbl[id] = value; },
                    get: function(id : Item_ID) : Memnosphere_ID|undefined { return this.tbl[id]; },
                    remove: function(id : Item_ID) { delete this.tbl[id]; },
                },

            /**
             * Clear all relations for a specific instance.
             * @param {Item_ID} id - The unique ID of the Item.
             */
            ClearRelations(id) {
                delete this.memnosphere.tbl[id];

            }
         },

        
        Memnosphere: {
            NextId: 0,

            GetNextId() : Memnosphere_ID {
                return this.NextId++ as any; 
            },


                class: {
                    tbl : {} as { [key: Memnosphere_ID]: UUID; },
                    define: function(id : Memnosphere_ID, value : UUID) { this.tbl[id] = value; },
                    get: function(id : Memnosphere_ID) : UUID|undefined { return this.tbl[id]; },
                    remove: function(id : Memnosphere_ID) { delete this.tbl[id]; },
                },

                skill: {
                    tbl : {} as { [key: Memnosphere_ID]: UUID[]; },

                    define: function(id : Memnosphere_ID, value : UUID) {
                        if (!this.tbl[id]) this.tbl[id] = [];
                        //if (this.tbl[id].length >= 5) RelationErrorHandler.notifyError('Limit exceeded');
                        this.tbl[id].push(value);
                    },

                    clear: function(id, value) {
                        delete this.tbl[id];
                    },

                    get: function(id : Memnosphere_ID) : UUID[]|undefined { return this.tbl[id]; },
                    remove: function(id : Memnosphere_ID) { delete this.tbl[id]; }
                },

                uuid: {
                    tbl : {} as { [key: Memnosphere_ID]: string[]; },

                    define: function(id : Memnosphere_ID, value : string) {
                        if (!this.tbl[id]) this.tbl[id] = [];
                        
                        this.tbl[id].push(value);
                    },

                    clear: function(id, value) {
                        delete this.tbl[id];
                    },

                    get: function(id : Memnosphere_ID) : string[]|undefined { return this.tbl[id]; },
                    remove: function(id : Memnosphere_ID) { delete this.tbl[id]; }
                },

                heroicskill: {
                    tbl : {} as { [key: Memnosphere_ID]: UUID; },
                    define: function(id : Memnosphere_ID, value : UUID) { this.tbl[id] = value; },
                    get: function(id : Memnosphere_ID) : UUID|undefined { return this.tbl[id]; },
                    remove: function(id : Memnosphere_ID) { delete this.tbl[id]; },
                },

            /**
             * Clear all relations for a specific instance.
             * @param {Memnosphere_ID} id - The unique ID of the Memnosphere.
             */
            ClearRelations(id) {
                delete this.class.tbl[id];
                delete this.skill.tbl[id];
                delete this.uuid.tbl[id];
                delete this.heroicskill.tbl[id];

            }
         },

    LogAll: function() {
        console.log("--- Logging All Relation Tables ---");
        console.log("Relations.Item.memnosphere.tbl:", this.Item.memnosphere.tbl);
        console.log("Relations.Memnosphere.class.tbl:", this.Memnosphere.class.tbl);
        console.log("Relations.Memnosphere.skill.tbl:", this.Memnosphere.skill.tbl);
        console.log("Relations.Memnosphere.uuid.tbl:", this.Memnosphere.uuid.tbl);
        console.log("Relations.Memnosphere.heroicskill.tbl:", this.Memnosphere.heroicskill.tbl);
        console.log("--- End of Relation Tables ---");
    },
}
/**
 * Centralized error-handling interface.
 */
const RelationErrorHandler = {
    /**
     * Logs an error message and optionally uses Foundry VTT's notification system.
     * @param {string} message - The error message to log.
     */
    notifyError: function(message) {
        console.error(message); // Log to console
        if (typeof ui !== 'undefined' && ui.notifications) {
            ui.notifications.error(message);
        }
    }
};

export { Relations };
