import { RequestHandler } from "express";
import { getAccountIdForRequest } from "@/src/services/loginService";
import { getJSONfromString } from "@/src/helpers/stringHelpers";
import { Inventory } from "@/src/models/inventoryModels/inventoryModel";
import { Guild } from "@/src/models/guildModel";

export const createGuildController: RequestHandler = async (req, res) => {
    const accountId = await getAccountIdForRequest(req);
    const payload = getJSONfromString<ICreateGuildRequest>(String(req.body));

    // Create guild on database
    const guild = new Guild({
        Name: payload.guildName
    });
    await guild.save();

    // Update inventory
    const inventory = await Inventory.findOne({ accountOwnerId: accountId });
    if (inventory) {
        // Set GuildId
        inventory.GuildId = guild._id;

        // Give clan key (TODO: This should only be a blueprint)
        inventory.LevelKeys.push({
            ItemType: "/Lotus/Types/Keys/DojoKey",
            ItemCount: 1
        });

        await inventory.save();
    }

    res.json(guild);
};

interface ICreateGuildRequest {
    guildName: string;
}
