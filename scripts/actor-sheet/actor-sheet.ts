import { Log, ModuleName, getFlag, getItemDisplayData } from "../core-config";
import { updateActorWithMnemosphereData } from "../mnemosphere-core";
import { Relations } from "../relation";
import { recomputeTechnosphereSheet } from "../technosphere-recompute";
import { bindActorDropZone } from "../ui-bindings";

// Helper functions for Mnemosphere equipment management
function getEquippedMnemospheres(actor: any): string[] {
    return actor.getFlag(ModuleName, "equipped-mnemospheres") || [];
}

function setEquippedMnemospheres(
    actor: any,
    equippedList: string[]
): Promise<any> {
    return actor.setFlag(ModuleName, "equipped-mnemospheres", equippedList);
}

function isMnemosphereEquipped(actor: any, itemUuid: string): boolean {
    const equipped = getEquippedMnemospheres(actor);
    return equipped.includes(itemUuid);
}

async function toggleMnemosphereEquipped(
    actor: any,
    itemUuid: string
): Promise<void> {
    const equipped = getEquippedMnemospheres(actor);
    const isCurrentlyEquipped = equipped.includes(itemUuid);

    let newEquipped: string[];
    if (isCurrentlyEquipped) {
        // Unequip - remove from list
        newEquipped = equipped.filter((uuid) => uuid !== itemUuid);
    } else {
        // Equip - add to list
        newEquipped = [...equipped, itemUuid];
    }

    await setEquippedMnemospheres(actor, newEquipped);

    // The mnemosphere core hooks will automatically trigger the update
    Log(
        `Mnemosphere ${
            isCurrentlyEquipped ? "unequipped" : "equipped"
        } for actor ${actor.name}`
    );
}

export function SetupActorSheetHooks() {
    Hooks.on(`renderFUStandardActorSheet`, async (sheet: any, html: any) => {
        const FLAG_BASESHEET = "technosphere-base-sheet"; // Add Technosphere settings
        let settings = html.find(`.settings`);
        settings.prepend(
            await renderTemplate(
                "modules/fabula-ultima-technosphere-machine/templates/inject/actor-sheet/technosphere-settings.hbs",
                {
                    baseSheet: getFlag(sheet, FLAG_BASESHEET),
                    isGM: game.user.isGM,
                }
            )
        );

        // Bind UI elements
        bindActorDropZone(sheet, html, "ts-baseSheet", FLAG_BASESHEET);

        // Handle Apply Technosphere button
        html.find(".technosphere-apply")
            .unbind("click")
            .bind("click", async (event) => {
                event.target.disabled = true;
                try {
                    const baseSheetActor = fromUuidSync(
                        getFlag(sheet, FLAG_BASESHEET)
                    );
                    if (!baseSheetActor) {
                        ui.notifications.error(
                            "Invalid Base Sheet UUID. Please ensure the UUID refers to an existing Actor."
                        );
                        return;
                    }
                    const currentActor = sheet.object;
                    await recomputeTechnosphereSheet(
                        currentActor,
                        baseSheetActor
                    );
                    ui.notifications.info(
                        `Technosphere recomputation applied to ${currentActor.name}.`
                    );
                } catch (error) {
                    console.error(
                        "Error applying Technosphere recomputation:",
                        error
                    );
                    ui.notifications.error(
                        "An error occurred during Technosphere recomputation. Check console for details."
                    );
                } finally {
                    event.target.disabled = false;
                    Log("Technosphere recomputation process finished.");
                }
            });

        // Handle Update Mnemosphere Skills button
        html.find(".mnemosphere-update")
            .unbind("click")
            .bind("click", async (event) => {
                event.target.disabled = true;
                try {
                    const currentActor = sheet.object;
                    await updateActorWithMnemosphereData(currentActor);
                    ui.notifications.info(
                        `Mnemosphere skills updated for ${currentActor.name}.`
                    );
                } catch (error) {
                    console.error("Error updating mnemosphere skills:", error);
                    ui.notifications.error(
                        "An error occurred while updating mnemosphere skills. Check console for details."
                    );
                } finally {
                    event.target.disabled = false;
                    Log("Mnemosphere skills update process finished.");
                }
            });

        // Get all treasure items and separate Mnemospheres from regular treasures
        const actor = sheet.object;
        const allTreasures = Array.from(actor.items).filter(
            (item: any) => item.type === "treasure"
        );
        const mnemospheres: any[] = [];
        const regularTreasures: any[] = [];

        allTreasures.forEach((treasure) => {
            const itemAny = treasure as any;
            const mnemosphereId = Relations.Item.mnemosphere.check(
                itemAny.uuid as UUID
            );
            if (mnemosphereId) {
                // This is a Mnemosphere - create a proper object with the necessary properties
                const isEquipped = isMnemosphereEquipped(actor, itemAny.uuid);
                const itemData = getItemDisplayData(itemAny);
                mnemospheres.push({
                    _id: itemAny._id,
                    uuid: itemAny.uuid,
                    name: itemAny.name,
                    img: itemAny.img,
                    type: itemAny.type,
                    system: itemAny.system,
                    quality: itemData ? itemData.qualityString : "",
                    enrichedHtml: itemAny.enrichedHtml,
                    isEquipped: isEquipped,
                });
            } else {
                // Regular treasure
                regularTreasures.push(itemAny);
            }
        });

        // Remove Mnemospheres from the existing treasure list
        const treasureSection = html
            .find('.tab[data-tab="items"] ol.items-list')
            .has('li .item-name:contains("Treasures")');
        if (treasureSection.length > 0) {
            // Remove Mnemosphere items from treasure section
            mnemospheres.forEach((mnemosphere) => {
                treasureSection
                    .find(`li[data-item-id="${mnemosphere._id}"]`)
                    .remove();
            });
        }

        // Add Mnemosphere section if there are any Mnemospheres
        if (mnemospheres.length > 0) {
            const mnemosphereSection = await renderTemplate(
                "modules/fabula-ultima-technosphere-machine/templates/inject/actor-sheet/mnemosphere-section.hbs",
                {
                    mnemospheres: mnemospheres,
                    actor: actor,
                    _expandedIds: sheet._expandedIds || [],
                }
            );

            // Insert the Mnemosphere section after the treasure section
            if (treasureSection.length > 0) {
                treasureSection.after(mnemosphereSection);
            } else {
                // If no treasure section exists, add it to the items tab
                const itemsTab = html.find('.tab[data-tab="items"]');
                itemsTab.append(mnemosphereSection);
            }
        }

        // Handle Mnemosphere equip/unequip button clicks
        html.find(".mnemosphere-equip-toggle")
            .unbind("click")
            .bind("click", async (event) => {
                event.preventDefault();
                event.stopPropagation();

                const button = $(event.currentTarget);
                const itemUuid = button.data("item-uuid");

                try {
                    await toggleMnemosphereEquipped(actor, itemUuid); // Update icon appearance to match standard equip pattern
                    const isNowEquipped = isMnemosphereEquipped(
                        actor,
                        itemUuid
                    );
                    const icon = button.find("i");
                    const tooltipText = isNowEquipped
                        ? "Unequip Mnemosphere"
                        : "Equip Mnemosphere";

                    button.attr("data-tooltip", tooltipText);

                    if (isNowEquipped) {
                        icon.removeClass("far").addClass("fas");
                    } else {
                        icon.removeClass("fas").addClass("far");
                    }
                } catch (error) {
                    console.error(
                        "Error toggling Mnemosphere equipment:",
                        error
                    );
                    ui.notifications.error(
                        "Failed to update Mnemosphere equipment status."
                    );
                }
            });

        // Handle Apply Technosphere button
        html.find(".technosphere-apply")
            .unbind("click")
            .bind("click", async (event) => {
                event.target.disabled = true;
                try {
                    const baseSheetActor = fromUuidSync(
                        getFlag(sheet, FLAG_BASESHEET)
                    );
                    if (!baseSheetActor) {
                        ui.notifications.error(
                            "Invalid Base Sheet UUID. Please ensure the UUID refers to an existing Actor."
                        );
                        return;
                    }
                    const currentActor = sheet.object;
                    await recomputeTechnosphereSheet(
                        currentActor,
                        baseSheetActor
                    );
                    ui.notifications.info(
                        `Technosphere recomputation applied to ${currentActor.name}.`
                    );
                } catch (error) {
                    console.error(
                        "Error applying Technosphere recomputation:",
                        error
                    );
                    ui.notifications.error(
                        "An error occurred during Technosphere recomputation. Check console for details."
                    );
                } finally {
                    event.target.disabled = false;
                    Log("Technosphere recomputation process finished.");
                }
            });
    });
}
