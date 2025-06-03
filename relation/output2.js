/**
 * A unique identifier for a concept.
 * @typedef {number} ID
 */

const Relations = {

        /**
         * A unique identifier for a Skill.
         * @typedef {string} Skill_ID
         */

        /**
         * Defines relationships for Skill.
         */
        Skill: {
            NextId: 0,

            GetNextId() {
                return this.NextId++; 
            },


            /**
             * Clear all relations for a specific instance.
             * @param {Skill_ID} id - The unique ID of the Skill.
             */
            ClearRelations(id) {

            }
         },

        /**
         * A unique identifier for a Class.
         * @typedef {string} Class_ID
         */

        /**
         * Defines relationships for Class.
         */
        Class: {
            NextId: 0,

            GetNextId() {
                return this.NextId++; 
            },


            /**
             * Clear all relations for a specific instance.
             * @param {Class_ID} id - The unique ID of the Class.
             */
            ClearRelations(id) {

            }
         },

        /**
         * A unique identifier for a Item.
         * @typedef {string} Item_ID
         */

        /**
         * Defines relationships for Item.
         */
        Item: {
            NextId: 0,

            GetNextId() {
                return this.NextId++; 
            },


                memnosphere: {
                    /**
                     * Stores the one-to-one relationships.
                     * @type {Object<Item_ID, ID>}
                     */
                    tbl: {},

                    /**
                     * Defines a one-to-one relationship from Item to Memnosphere.
                     * @param {Item_ID} id - The unique ID of the Item.
                     * @param {ID} value - The value to associate with the Memnosphere.
                     */
                    define: function(id, value) { this.tbl[id] = value; }
                },

            /**
             * Clear all relations for a specific instance.
             * @param {Item_ID} id - The unique ID of the Item.
             */
            ClearRelations(id) {
                this.memnosphere[id] = null;

            }
         },

        /**
         * A unique identifier for a Memnosphere.
         * @typedef {ID} Memnosphere_ID
         */

        /**
         * Defines relationships for Memnosphere.
         */
        Memnosphere: {
            NextId: 0,

            GetNextId() {
                return this.NextId++; 
            },


                class: {
                    /**
                     * Stores the one-to-one relationships.
                     * @type {Object<Memnosphere_ID, UUID>}
                     */
                    tbl: {},

                    /**
                     * Defines a one-to-one relationship from Memnosphere to Class.
                     * @param {Memnosphere_ID} id - The unique ID of the Memnosphere.
                     * @param {UUID} value - The value to associate with the Class.
                     */
                    define: function(id, value) { this.tbl[id] = value; }
                },

                skill: {
                    /**
                     * Stores the one-to-many relationships.
                     * @type {Object<Memnosphere_ID, Array<UUID>>}
                     */
                    tbl: {},

                    /**
                     * Defines a one-to-many relationship from Memnosphere to Skill.
                     * Enforces a maximum of 5 relations.
                     * @param {Memnosphere_ID} id - The unique ID of the Memnosphere.
                     * @param {UUID} value - The value to associate with the Skill.
                     */
                    define: function(id, value) {
                        if (!this.tbl[id]) this.tbl[id] = [];
                        if (this.tbl[id].length >= 5) RelationErrorHandler.notifyError('Limit exceeded');
                        this.tbl[id].push(value);
                    },

                    /**
                     * Clears the relationship from Memnosphere to Skill.
                     * @param {Memnosphere_ID} id - The unique ID of the Memnosphere.
                     * @param {UUID} value - The value to associate with the Skill.
                     */
                    clear: function(id, value) {
                        this.tbl[id] = null;
                    }
                },

                uuid: {
                    /**
                     * Stores the one-to-many relationships.
                     * @type {Object<Memnosphere_ID, Array<string>>}
                     */
                    tbl: {},

                    /**
                     * Defines a one-to-many relationship from Memnosphere to UUID.
                     * No limit on relations.
                     * @param {Memnosphere_ID} id - The unique ID of the Memnosphere.
                     * @param {string} value - The value to associate with the UUID.
                     */
                    define: function(id, value) {
                        if (!this.tbl[id]) this.tbl[id] = [];
                        
                        this.tbl[id].push(value);
                    },

                    /**
                     * Clears the relationship from Memnosphere to UUID.
                     * @param {Memnosphere_ID} id - The unique ID of the Memnosphere.
                     * @param {string} value - The value to associate with the UUID.
                     */
                    clear: function(id, value) {
                        this.tbl[id] = null;
                    }
                },

            /**
             * Clear all relations for a specific instance.
             * @param {Memnosphere_ID} id - The unique ID of the Memnosphere.
             */
            ClearRelations(id) {
                this.class[id] = null;
                this.skill[id] = null;
                this.uuid[id] = null;

            }
         },

    LogAll: function() {
        console.log("--- Logging All Relation Tables ---");
        console.log("Relations.Item.memnosphere.tbl:", this.Item.memnosphere.tbl);
        console.log("Relations.Memnosphere.class.tbl:", this.Memnosphere.class.tbl);
        console.log("Relations.Memnosphere.skill.tbl:", this.Memnosphere.skill.tbl);
        console.log("Relations.Memnosphere.uuid.tbl:", this.Memnosphere.uuid.tbl);
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
