/**
 * A unique identifier for a Memnosphere.
 * @typedef {number} MemnosphereID
 */

// Refactored Memnosphere Relation Tables
let Next_Memnosphere_ID = 1;
function createMemnosphereID() {
    return Next_Memnosphere_ID++;
}

const Relations = {
    Memnosphere: {
        class: {
            tbl: {},
            /**
             * Defines a relationship between a Memnosphere and a Class.
             * @param {MemnosphereID} id - The unique ID of the Memnosphere.
             * @param {string} classUUID - The UUID of the Class.
             */
            define: function(id, classUUID) {
                if (!id || !classUUID) {
                    console.warn("Invalid Memnosphere ID or Class UUID.");
                    return;
                }
                this.tbl[id] = classUUID;
            }
        },
        skill: {
            tbl: {},
            /**
             * Defines a relationship between a Memnosphere and a Skill.
             * Enforces a maximum of 5 skills per Memnosphere.
             * @param {MemnosphereID} id - The unique ID of the Memnosphere.
             * @param {string} skillUUID - The UUID of the Skill.
             */
            define: function(id, skillUUID) {
                if (!id || !skillUUID) {
                    console.warn("Invalid Memnosphere ID or Skill UUID.");
                    return;
                }

                if (!this.tbl[id]) {
                    this.tbl[id] = [];
                }

                const list = this.tbl[id];

                if (list.length >= 5) {
                    ErrorHandler.notifyError("A Memnosphere can only have a max of 5 skills!");
                    return;
                }

                list.push(skillUUID);
            }
        },
        feature: {
            tbl: {},
            /**
             * Defines a relationship between a Memnosphere and a Feature.
             * @param {MemnosphereID} id - The unique ID of the Memnosphere.
             * @param {string} featureUUID - The UUID of the Feature.
             */
            define: function(id, featureUUID) {
                if (!id || !featureUUID) {
                    console.warn("Invalid Memnosphere ID or Feature UUID.");
                    return;
                }

                if (!this.tbl[id]) {
                    this.tbl[id] = [];
                }

                this.tbl[id].push(featureUUID);
            }
        },
        /**
         * Removes all relationships for a given Memnosphere.
         * @param {MemnosphereID} memnosphereId - The unique ID of the Memnosphere.
         */
        removeRelations: function(memnosphereId) {
            if (!memnosphereId) {
                console.warn("Invalid Memnosphere ID.");
                return;
            }
            this.class.tbl[memnosphereId] = null;
            this.skill.tbl[memnosphereId] = null;
            this.feature.tbl[memnosphereId] = null;
        }
    },
    Item: {
        memnosphere: {
            tbl: {},
            /**
             * Defines a relationship between an Item and a Memnosphere.
             * @param {string} itemId - The unique ID of the Item.
             * @param {MemnosphereID} memnosphereId - The unique ID of the Memnosphere.
             */
            define: function(itemId, memnosphereId) {
                if (!itemId || !memnosphereId) {
                    console.warn("Invalid Item ID or Memnosphere ID.");
                    return;
                }
                this.tbl[itemId] = memnosphereId;
            }
        }
    }
};

// Centralized error-handling interface
const ErrorHandler = {
    notifyError: function(message) {
        console.error(message); // Log to console
        // If Foundry VTT's `ui.notifications` is available, use it
        if (typeof ui !== 'undefined' && ui.notifications) {
            ui.notifications.error(message);
        }
    }
};