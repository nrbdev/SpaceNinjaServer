import { RequestHandler } from "express";
import { getDict, getItemName, getString } from "@/src/services/itemDataService";
import {
    ExportArcanes,
    ExportGear,
    ExportRecipes,
    ExportResources,
    ExportUpgrades,
    ExportWarframes,
    ExportWeapons
} from "warframe-public-export-plus";
import archonCrystalUpgrades from "@/static/fixed_responses/webuiArchonCrystalUpgrades.json";

interface ListedItem {
    uniqueName: string;
    name: string;
    fusionLimit?: number;
}

const getItemListsController: RequestHandler = (req, response) => {
    const lang = getDict(typeof req.query.lang == "string" ? req.query.lang : "en");
    const res: Record<string, ListedItem[]> = {};
    res.LongGuns = [];
    res.Pistols = [];
    res.Melee = [];
    res.miscitems = [];
    for (const [uniqueName, item] of Object.entries(ExportWeapons)) {
        if (item.totalDamage !== 0) {
            if (
                item.productCategory == "LongGuns" ||
                item.productCategory == "Pistols" ||
                item.productCategory == "Melee"
            ) {
                res[item.productCategory].push({
                    uniqueName,
                    name: getString(item.name, lang)
                });
            }
        } else if (!item.excludeFromCodex) {
            res.miscitems.push({
                uniqueName: "MiscItems:" + uniqueName,
                name: getString(item.name, lang)
            });
        }
    }
    for (const [uniqueName, item] of Object.entries(ExportResources)) {
        let name = getString(item.name, lang);
        if ("dissectionParts" in item) {
            name = getString("/Lotus/Language/Fish/FishDisplayName", lang).split("|FISH_NAME|").join(name);
            if (uniqueName.indexOf("Large") != -1) {
                name = name.split("|FISH_SIZE|").join(getString("/Lotus/Language/Fish/FishSizeLargeAbbrev", lang));
            } else if (uniqueName.indexOf("Medium") != -1) {
                name = name.split("|FISH_SIZE|").join(getString("/Lotus/Language/Fish/FishSizeMediumAbbrev", lang));
            } else {
                name = name.split("|FISH_SIZE|").join(getString("/Lotus/Language/Fish/FishSizeSmallAbbrev", lang));
            }
        }
        res.miscitems.push({
            uniqueName: item.productCategory + ":" + uniqueName,
            name: name
        });
    }
    for (const [uniqueName, item] of Object.entries(ExportGear)) {
        res.miscitems.push({
            uniqueName: "Consumables:" + uniqueName,
            name: getString(item.name, lang)
        });
    }
    const recipeNameTemplate = getString("/Lotus/Language/Items/BlueprintAndItem", lang);
    for (const [uniqueName, item] of Object.entries(ExportRecipes)) {
        if (!item.hidden) {
            const resultName = getItemName(item.resultType);
            if (resultName) {
                res.miscitems.push({
                    uniqueName: "Recipes:" + uniqueName,
                    name: recipeNameTemplate.replace("|ITEM|", getString(resultName, lang))
                });
            }
        }
    }

    res.mods = [];
    const badItems: Record<string, boolean> = {};
    for (const [uniqueName, upgrade] of Object.entries(ExportUpgrades)) {
        res.mods.push({
            uniqueName,
            name: getString(upgrade.name, lang),
            fusionLimit: upgrade.fusionLimit
        });
        if (upgrade.isStarter || upgrade.isFrivolous || upgrade.upgradeEntries) {
            badItems[uniqueName] = true;
        }
    }
    for (const [uniqueName, arcane] of Object.entries(ExportArcanes)) {
        res.mods.push({
            uniqueName,
            name: getString(arcane.name, lang)
        });
        if (arcane.isFrivolous) {
            badItems[uniqueName] = true;
        }
    }

    response.json({
        warframes: Object.entries(ExportWarframes)
            .filter(([_uniqueName, warframe]) => warframe.productCategory == "Suits")
            .map(([uniqueName, warframe]) => {
                return {
                    uniqueName,
                    name: getString(warframe.name, lang),
                    exalted: warframe.exalted
                };
            }),
        badItems,
        archonCrystalUpgrades,
        ...res
    });
};

export { getItemListsController };
