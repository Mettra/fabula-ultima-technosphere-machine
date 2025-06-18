/**
 * A unique identifier for a Mnemosphere.
 * @typedef {number} MnemosphereID
 */

// Refactored Mnemosphere Relation Tables
let Next_Mnemosphere_ID = 1;
function createMnemosphereID() {
    return Next_Mnemosphere_ID++;
}

const Relations = {
    Mnemosphere: {
        class: {
            tbl: {},
            /**
             * Defines a relationship between a Mnemosphere and a Class.
             * @param {MnemosphereID} id - The unique ID of the Mnemosphere.
             * @param {string} classUUID - The UUID of the Class.
             */
            define: function (id, classUUID) {
                if (!id || !classUUID) {
                    console.warn("Invalid Mnemosphere ID or Class UUID.");
                    return;
                }
                this.tbl[id] = classUUID;
            },
        },
        skill: {
            tbl: {},
            /**
             * Defines a relationship between a Mnemosphere and a Skill.
             * Enforces a maximum of 5 skills per Mnemosphere.
             * @param {MnemosphereID} id - The unique ID of the Mnemosphere.
             * @param {string} skillUUID - The UUID of the Skill.
             */
            define: function (id, skillUUID) {
                if (!id || !skillUUID) {
                    console.warn("Invalid Mnemosphere ID or Skill UUID.");
                    return;
                }

                if (!this.tbl[id]) {
                    this.tbl[id] = [];
                }

                const list = this.tbl[id];

                if (list.length >= 5) {
                    ErrorHandler.notifyError(
                        "A Mnemosphere can only have a max of 5 skills!"
                    );
                    return;
                }

                list.push(skillUUID);
            },
        },
        feature: {
            tbl: {},
            /**
             * Defines a relationship between a Mnemosphere and a Feature.
             * @param {MnemosphereID} id - The unique ID of the Mnemosphere.
             * @param {string} featureUUID - The UUID of the Feature.
             */
            define: function (id, featureUUID) {
                if (!id || !featureUUID) {
                    console.warn("Invalid Mnemosphere ID or Feature UUID.");
                    return;
                }

                if (!this.tbl[id]) {
                    this.tbl[id] = [];
                }

                this.tbl[id].push(featureUUID);
            },
        },
        /**
         * Removes all relationships for a given Mnemosphere.
         * @param {MnemosphereID} MnemosphereId - The unique ID of the Mnemosphere.
         */
        removeRelations: function (MnemosphereId) {
            if (!MnemosphereId) {
                console.warn("Invalid Mnemosphere ID.");
                return;
            }
            this.class.tbl[MnemosphereId] = null;
            this.skill.tbl[MnemosphereId] = null;
            this.feature.tbl[MnemosphereId] = null;
        },
    },
    Item: {
        Mnemosphere: {
            tbl: {},
            /**
             * Defines a relationship between an Item and a Mnemosphere.
             * @param {string} itemId - The unique ID of the Item.
             * @param {MnemosphereID} MnemosphereId - The unique ID of the Mnemosphere.
             */
            define: function (itemId, MnemosphereId) {
                if (!itemId || !MnemosphereId) {
                    console.warn("Invalid Item ID or Mnemosphere ID.");
                    return;
                }
                this.tbl[itemId] = MnemosphereId;
            },
        },
    },
};

// Centralized error-handling interface
const ErrorHandler = {
    notifyError: function (message) {
        console.error(message); // Log to console
        // If Foundry VTT's `ui.notifications` is available, use it
        if (typeof ui !== "undefined" && ui.notifications) {
            ui.notifications.error(message);
        }
    },
};
