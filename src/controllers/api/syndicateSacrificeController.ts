import { getJSONfromString } from "@/src/helpers/stringHelpers";
import { RequestHandler } from "express";
import { getAccountIdForRequest } from "@/src/services/loginService";
import { ExportSyndicates, ISyndicateSacrifice } from "warframe-public-export-plus";
import { handleStoreItemAcquisition } from "@/src/services/purchaseService";
import { addMiscItems, combineInventoryChanges, getInventory, updateCurrency } from "@/src/services/inventoryService";
import { IInventoryChanges } from "@/src/types/purchaseTypes";

export const syndicateSacrificeController: RequestHandler = async (request, response) => {
    const accountId = await getAccountIdForRequest(request);
    const inventory = await getInventory(accountId);
    const data = getJSONfromString<ISyndicateSacrificeRequest>(String(request.body));

    let syndicate = inventory.Affiliations.find(x => x.Tag == data.AffiliationTag);
    if (!syndicate) {
        syndicate = inventory.Affiliations[inventory.Affiliations.push({ Tag: data.AffiliationTag, Standing: 0 }) - 1];
    }

    const level = data.SacrificeLevel - (syndicate.Title ?? 0);
    const res: ISyndicateSacrificeResponse = {
        AffiliationTag: data.AffiliationTag,
        InventoryChanges: {},
        Level: data.SacrificeLevel,
        LevelIncrease: level <= 0 ? 1 : level,
        NewEpisodeReward: syndicate.Tag == "RadioLegionIntermission9Syndicate"
    };

    const manifest = ExportSyndicates[data.AffiliationTag];
    let sacrifice: ISyndicateSacrifice | undefined;
    let reward: string | undefined;
    if (data.SacrificeLevel == 0) {
        sacrifice = manifest.initiationSacrifice;
        reward = manifest.initiationReward;
        syndicate.Initiated = true;
    } else {
        sacrifice = manifest.titles?.find(x => x.level == data.SacrificeLevel)?.sacrifice;
    }

    if (sacrifice) {
        res.InventoryChanges = { ...updateCurrency(inventory, sacrifice.credits, false) };

        const miscItemChanges = sacrifice.items.map(x => ({
            ItemType: x.ItemType,
            ItemCount: x.ItemCount * -1
        }));
        addMiscItems(inventory, miscItemChanges);
        res.InventoryChanges.MiscItems = miscItemChanges;
    }

    syndicate.Title ??= 0;
    syndicate.Title += 1;

    if (syndicate.Title > 0 && manifest.favours.length != 0) {
        syndicate.FreeFavorsEarned ??= [];
        if (!syndicate.FreeFavorsEarned.includes(syndicate.Title)) {
            syndicate.FreeFavorsEarned.push(syndicate.Title);
        }
    }

    if (reward) {
        combineInventoryChanges(
            res.InventoryChanges,
            (await handleStoreItemAcquisition(reward, inventory)).InventoryChanges
        );
    }

    await inventory.save();

    response.json(res);
};

interface ISyndicateSacrificeRequest {
    AffiliationTag: string;
    SacrificeLevel: number;
    AllowMultiple: boolean;
}

interface ISyndicateSacrificeResponse {
    AffiliationTag: string;
    Level: number;
    LevelIncrease: number;
    InventoryChanges: IInventoryChanges;
    NewEpisodeReward: boolean;
}
