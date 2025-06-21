type ID = number & { readonly __brand: "ID" };
export type Skill_ID = UUID;
export type Class_ID = UUID;
export type Item_ID = UUID;
export type Feature_ID = UUID;
export type Spell_ID = UUID;
export type HeroicSkill_ID = UUID;
export type Mnemosphere_ID = number & { readonly __brand: "Mnemosphere" };

const Relations = {
    Item: {
        NextId: 0,

        GetNextId(): Item_ID {
            return this.NextId++ as any;
        },

        mnemosphere: {
            tbl: {} as { [key: Item_ID]: Mnemosphere_ID },
            define: function (id: Item_ID, value: Mnemosphere_ID) {
                this.tbl[id] = value;
            },
            get: function (id: Item_ID): Mnemosphere_ID[] {
                let obj = this.tbl[id];
                if (obj) {
                    return [obj];
                } else {
                    return [];
                }
            },
            check: function (id: Item_ID): Mnemosphere_ID | undefined {
                return this.tbl[id];
            },
            expect: function (id: Item_ID): Mnemosphere_ID {
                let obj = this.tbl[id];
                if (obj) {
                    return obj;
                } else {
                    throw Error(
                        `Relation Error! Item ${id} does not have a mapping to Mnemosphere.`
                    );
                }
            },
            remove: function (id: Item_ID) {
                delete this.tbl[id];
            },
        },

        /**
         * Clear all relations for a specific instance.
         * @param {Item_ID} id - The unique ID of the Item.
         */
        ClearRelations(id) {
            delete this.mnemosphere.tbl[id];
        },
    },

    Mnemosphere: {
        NextId: 0,

        GetNextId(): Mnemosphere_ID {
            return this.NextId++ as any;
        },

        class: {
            tbl: {} as { [key: Mnemosphere_ID]: UUID },
            define: function (id: Mnemosphere_ID, value: UUID) {
                this.tbl[id] = value;
            },
            get: function (id: Mnemosphere_ID): UUID[] {
                let obj = this.tbl[id];
                if (obj) {
                    return [obj];
                } else {
                    return [];
                }
            },
            check: function (id: Mnemosphere_ID): UUID | undefined {
                return this.tbl[id];
            },
            expect: function (id: Mnemosphere_ID): UUID {
                let obj = this.tbl[id];
                if (obj) {
                    return obj;
                } else {
                    throw Error(
                        `Relation Error! Mnemosphere ${id} does not have a mapping to Class.`
                    );
                }
            },
            remove: function (id: Mnemosphere_ID) {
                delete this.tbl[id];
            },
        },

        skill: {
            tbl: {} as { [key: Mnemosphere_ID]: UUID[] },

            define: function (id: Mnemosphere_ID, value: UUID) {
                if (!this.tbl[id]) this.tbl[id] = [];
                if (this.tbl[id].length >= 5)
                    RelationErrorHandler.notifyError("Limit exceeded");
                this.tbl[id].push(value);
            },

            clear: function (id, value) {
                delete this.tbl[id];
            },

            get: function (id: Mnemosphere_ID): UUID[] {
                return this.tbl[id] || [];
            },
            remove: function (id: Mnemosphere_ID) {
                delete this.tbl[id];
            },
        },

        uuid: {
            tbl: {} as { [key: Mnemosphere_ID]: string[] },

            define: function (id: Mnemosphere_ID, value: string) {
                if (!this.tbl[id]) this.tbl[id] = [];

                this.tbl[id].push(value);
            },

            clear: function (id, value) {
                delete this.tbl[id];
            },

            get: function (id: Mnemosphere_ID): string[] {
                return this.tbl[id] || [];
            },
            remove: function (id: Mnemosphere_ID) {
                delete this.tbl[id];
            },
        },

        feature: {
            tbl: {} as { [key: Mnemosphere_ID]: UUID[] },

            define: function (id: Mnemosphere_ID, value: UUID) {
                if (!this.tbl[id]) this.tbl[id] = [];

                this.tbl[id].push(value);
            },

            clear: function (id, value) {
                delete this.tbl[id];
            },

            get: function (id: Mnemosphere_ID): UUID[] {
                return this.tbl[id] || [];
            },
            remove: function (id: Mnemosphere_ID) {
                delete this.tbl[id];
            },
        },

        spell: {
            tbl: {} as { [key: Mnemosphere_ID]: UUID[] },

            define: function (id: Mnemosphere_ID, value: UUID) {
                if (!this.tbl[id]) this.tbl[id] = [];

                this.tbl[id].push(value);
            },

            clear: function (id, value) {
                delete this.tbl[id];
            },

            get: function (id: Mnemosphere_ID): UUID[] {
                return this.tbl[id] || [];
            },
            remove: function (id: Mnemosphere_ID) {
                delete this.tbl[id];
            },
        },

        heroicskill: {
            tbl: {} as { [key: Mnemosphere_ID]: UUID },
            define: function (id: Mnemosphere_ID, value: UUID) {
                this.tbl[id] = value;
            },
            get: function (id: Mnemosphere_ID): UUID[] {
                let obj = this.tbl[id];
                if (obj) {
                    return [obj];
                } else {
                    return [];
                }
            },
            check: function (id: Mnemosphere_ID): UUID | undefined {
                return this.tbl[id];
            },
            expect: function (id: Mnemosphere_ID): UUID {
                let obj = this.tbl[id];
                if (obj) {
                    return obj;
                } else {
                    throw Error(
                        `Relation Error! Mnemosphere ${id} does not have a mapping to HeroicSkill.`
                    );
                }
            },
            remove: function (id: Mnemosphere_ID) {
                delete this.tbl[id];
            },
        },

        /**
         * Clear all relations for a specific instance.
         * @param {Mnemosphere_ID} id - The unique ID of the Mnemosphere.
         */
        ClearRelations(id) {
            delete this.class.tbl[id];
            delete this.skill.tbl[id];
            delete this.uuid.tbl[id];
            delete this.feature.tbl[id];
            delete this.spell.tbl[id];
            delete this.heroicskill.tbl[id];
        },
    },

    LogAll: function () {
        console.log("--- Logging All Relation Tables ---");
        console.log(
            "Relations.Item.mnemosphere.tbl:",
            this.Item.mnemosphere.tbl
        );
        console.log(
            "Relations.Mnemosphere.class.tbl:",
            this.Mnemosphere.class.tbl
        );
        console.log(
            "Relations.Mnemosphere.skill.tbl:",
            this.Mnemosphere.skill.tbl
        );
        console.log(
            "Relations.Mnemosphere.uuid.tbl:",
            this.Mnemosphere.uuid.tbl
        );
        console.log(
            "Relations.Mnemosphere.feature.tbl:",
            this.Mnemosphere.feature.tbl
        );
        console.log(
            "Relations.Mnemosphere.spell.tbl:",
            this.Mnemosphere.spell.tbl
        );
        console.log(
            "Relations.Mnemosphere.heroicskill.tbl:",
            this.Mnemosphere.heroicskill.tbl
        );
        console.log("--- End of Relation Tables ---");
    },
};
/**
 * Centralized error-handling interface.
 */
const RelationErrorHandler = {
    /**
     * Logs an error message and optionally uses Foundry VTT's notification system.
     * @param {string} message - The error message to log.
     */
    notifyError: function (message) {
        console.error(message); // Log to console
        if (typeof ui !== "undefined" && ui.notifications) {
            ui.notifications.error(message);
        }
    },
};

export { Relations };
