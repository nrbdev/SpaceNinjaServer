import { RequestHandler } from "express";
import { getAccountForRequest } from "@/src/services/loginService";
import { Inventory } from "@/src/models/inventoryModels/inventoryModel";
import { config } from "@/src/services/configService";
import allDialogue from "@/static/fixed_responses/allDialogue.json";
import { ILoadoutDatabase } from "@/src/types/saveLoadoutTypes";
import { IInventoryClient, IShipInventory, equipmentKeys } from "@/src/types/inventoryTypes/inventoryTypes";
import { IPolarity, ArtifactPolarity, EquipmentFeatures } from "@/src/types/inventoryTypes/commonInventoryTypes";
import {
    ExportCustoms,
    ExportFlavour,
    ExportKeys,
    ExportRegions,
    ExportResources,
    ExportVirtuals
} from "warframe-public-export-plus";
import { handleSubsumeCompletion } from "./infestedFoundryController";
import { allDailyAffiliationKeys } from "@/src/services/inventoryService";
import { toOid } from "@/src/helpers/inventoryHelpers";
import { Types } from "mongoose";

export const inventoryController: RequestHandler = async (request, response) => {
    const account = await getAccountForRequest(request);

    const inventory = await Inventory.findOne({ accountOwnerId: account._id.toString() });

    if (!inventory) {
        response.status(400).json({ error: "inventory was undefined" });
        return;
    }

    // Handle daily reset
    const today: number = Math.trunc(new Date().getTime() / 86400000);
    if (account.LastLoginDay != today) {
        account.LastLoginDay = today;
        await account.save();

        for (const key of allDailyAffiliationKeys) {
            inventory[key] = 16000 + inventory.PlayerLevel * 500;
        }
        inventory.DailyFocus = 250000 + inventory.PlayerLevel * 5000;
        await inventory.save();
    }

    if (
        inventory.InfestedFoundry &&
        inventory.InfestedFoundry.AbilityOverrideUnlockCooldown &&
        new Date() >= inventory.InfestedFoundry.AbilityOverrideUnlockCooldown
    ) {
        handleSubsumeCompletion(inventory);
        await inventory.save();
    }

    const inventoryWithLoadOutPresets = await inventory.populate<{ LoadOutPresets: ILoadoutDatabase }>(
        "LoadOutPresets"
    );
    const inventoryWithLoadOutPresetsAndShips = await inventoryWithLoadOutPresets.populate<{ Ships: IShipInventory }>(
        "Ships"
    );
    const inventoryResponse = inventoryWithLoadOutPresetsAndShips.toJSON<IInventoryClient>();

    if (config.infiniteCredits) {
        inventoryResponse.RegularCredits = 999999999;
    }
    if (config.infinitePlatinum) {
        inventoryResponse.PremiumCreditsFree = 999999999;
        inventoryResponse.PremiumCredits = 999999999;
    }
    if (config.infiniteEndo) {
        inventoryResponse.FusionPoints = 999999999;
    }
    if (config.infiniteRegalAya) {
        inventoryResponse.PrimeTokens = 999999999;
    }

    if (config.skipAllDialogue) {
        inventoryResponse.TauntHistory = [
            {
                node: "TreasureTutorial",
                state: "TS_COMPLETED"
            }
        ];
        for (const str of allDialogue) {
            addString(inventoryResponse.NodeIntrosCompleted, str);
        }
    }

    if (config.unlockAllMissions) {
        inventoryResponse.Missions = [];
        for (const tag of Object.keys(ExportRegions)) {
            inventoryResponse.Missions.push({
                Completes: 1,
                Tier: 1,
                Tag: tag
            });
        }
        addString(inventoryResponse.NodeIntrosCompleted, "TeshinHardModeUnlocked");
    }

    if (config.unlockAllQuests) {
        for (const [k, v] of Object.entries(ExportKeys)) {
            if ("chainStages" in v) {
                if (!inventoryResponse.QuestKeys.find(quest => quest.ItemType == k)) {
                    inventoryResponse.QuestKeys.push({ ItemType: k });
                }
            }
        }
    }
    if (config.completeAllQuests) {
        for (const quest of inventoryResponse.QuestKeys) {
            quest.unlock = true;
            quest.Completed = true;

            let numStages = 1;
            if (quest.ItemType in ExportKeys && "chainStages" in ExportKeys[quest.ItemType]) {
                numStages = ExportKeys[quest.ItemType].chainStages!.length;
            }
            quest.Progress = [];
            for (let i = 0; i != numStages; ++i) {
                quest.Progress.push({
                    c: 0,
                    i: false,
                    m: false,
                    b: []
                });
            }
        }

        inventoryResponse.ArchwingEnabled = true;
        inventoryResponse.ActiveQuest = ""; //TODO: might need to reconsider this if this does not work long term.

        // Skip "Watch The Maker"
        addString(inventoryResponse.NodeIntrosCompleted, "/Lotus/Levels/Cinematics/NewWarIntro/NewWarStageTwo.level");
    }

    if (config.unlockAllShipDecorations) {
        inventoryResponse.ShipDecorations = [];
        for (const [uniqueName, item] of Object.entries(ExportResources)) {
            if (item.productCategory == "ShipDecorations") {
                inventoryResponse.ShipDecorations.push({ ItemType: uniqueName, ItemCount: 1 });
            }
        }
    }

    if (config.unlockAllFlavourItems) {
        inventoryResponse.FlavourItems = [];
        for (const uniqueName in ExportFlavour) {
            inventoryResponse.FlavourItems.push({ ItemType: uniqueName });
        }
    }

    if (config.unlockAllSkins) {
        const missingWeaponSkins = new Set(Object.keys(ExportCustoms));
        inventoryResponse.WeaponSkins.forEach(x => missingWeaponSkins.delete(x.ItemType));
        for (const uniqueName of missingWeaponSkins) {
            inventoryResponse.WeaponSkins.push({
                ItemId: {
                    $oid: "ca70ca70ca70ca70" + catBreadHash(uniqueName).toString(16).padStart(8, "0")
                },
                ItemType: uniqueName
            });
        }
    }

    if (config.unlockAllCapturaScenes) {
        for (const uniqueName of Object.keys(ExportResources)) {
            if (resourceInheritsFrom(uniqueName, "/Lotus/Types/Items/MiscItems/PhotoboothTile")) {
                inventoryResponse.MiscItems.push({
                    ItemType: uniqueName,
                    ItemCount: 1
                });
            }
        }
    }

    if (typeof config.spoofMasteryRank === "number" && config.spoofMasteryRank >= 0) {
        inventoryResponse.PlayerLevel = config.spoofMasteryRank;
        if (!("xpBasedLevelCapDisabled" in request.query)) {
            // This client has not been patched to accept any mastery rank, need to fake the XP.
            inventoryResponse.XPInfo = [];
            let numFrames = getExpRequiredForMr(Math.min(config.spoofMasteryRank, 5030)) / 6000;
            while (numFrames-- > 0) {
                inventoryResponse.XPInfo.push({
                    ItemType: "/Lotus/Powersuits/Mag/Mag",
                    XP: 1_600_000
                });
            }
        }
    }

    if (config.universalPolarityEverywhere) {
        const Polarity: IPolarity[] = [];
        for (let i = 0; i != 10; ++i) {
            Polarity.push({
                Slot: i,
                Value: ArtifactPolarity.Any
            });
        }
        for (const key of equipmentKeys) {
            if (key in inventoryResponse) {
                for (const equipment of inventoryResponse[key]) {
                    equipment.Polarity = Polarity;
                }
            }
        }
    }

    if (config.unlockDoubleCapacityPotatoesEverywhere) {
        for (const key of equipmentKeys) {
            if (key in inventoryResponse) {
                for (const equipment of inventoryResponse[key]) {
                    equipment.Features ??= 0;
                    equipment.Features |= EquipmentFeatures.DOUBLE_CAPACITY;
                }
            }
        }
    }

    if (config.unlockExilusEverywhere) {
        for (const key of equipmentKeys) {
            if (key in inventoryResponse) {
                for (const equipment of inventoryResponse[key]) {
                    equipment.Features ??= 0;
                    equipment.Features |= EquipmentFeatures.UTILITY_SLOT;
                }
            }
        }
    }

    if (config.unlockArcanesEverywhere) {
        for (const key of equipmentKeys) {
            if (key in inventoryResponse) {
                for (const equipment of inventoryResponse[key]) {
                    equipment.Features ??= 0;
                    equipment.Features |= EquipmentFeatures.ARCANE_SLOT;
                }
            }
        }
    }

    if (config.noDailyStandingLimits) {
        for (const key of allDailyAffiliationKeys) {
            inventoryResponse[key] = 999_999;
        }
    }

    // Fix for #380
    inventoryResponse.NextRefill = { $date: { $numberLong: "9999999999999" } };

    // This determines if the "void fissures" tab is shown in navigation.
    inventoryResponse.HasOwnedVoidProjectionsPreviously = true;

    inventoryResponse.LastInventorySync = toOid(new Types.ObjectId());

    response.json(inventoryResponse);
};

const addString = (arr: string[], str: string): void => {
    if (!arr.find(x => x == str)) {
        arr.push(str);
    }
};

const getExpRequiredForMr = (rank: number): number => {
    if (rank <= 30) {
        return 2500 * rank * rank;
    }
    return 2_250_000 + 147_500 * (rank - 30);
};

const resourceInheritsFrom = (resourceName: string, targetName: string): boolean => {
    let parentName = resourceGetParent(resourceName);
    for (; parentName != undefined; parentName = resourceGetParent(parentName)) {
        if (parentName == targetName) {
            return true;
        }
    }
    return false;
};

const resourceGetParent = (resourceName: string): string | undefined => {
    if (resourceName in ExportResources) {
        return ExportResources[resourceName].parentName;
    }
    return ExportVirtuals[resourceName]?.parentName;
};

// This is FNV1a-32 except operating under modulus 2^31 because JavaScript is stinky and likes producing negative integers out of nowhere.
const catBreadHash = (name: string): number => {
    let hash = 2166136261;
    for (let i = 0; i != name.length; ++i) {
        hash = (hash ^ name.charCodeAt(i)) & 0x7fffffff;
        hash = (hash * 16777619) & 0x7fffffff;
    }
    return hash;
};
