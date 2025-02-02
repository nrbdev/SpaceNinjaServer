import express from "express";

import { tunablesController } from "@/src/controllers/custom/tunablesController";
import { getItemListsController } from "@/src/controllers/custom/getItemListsController";
import { pushArchonCrystalUpgradeController } from "@/src/controllers/custom/pushArchonCrystalUpgradeController";
import { popArchonCrystalUpgradeController } from "@/src/controllers/custom/popArchonCrystalUpgradeController";
import { deleteAccountController } from "@/src/controllers/custom/deleteAccountController";
import { renameAccountController } from "@/src/controllers/custom/renameAccountController";

import { createAccountController } from "@/src/controllers/custom/createAccountController";
import { addItemsController } from "@/src/controllers/custom/addItemsController";
import { addXpController } from "@/src/controllers/custom/addXpController";
import { importController } from "@/src/controllers/custom/importController";

import { getConfigDataController } from "@/src/controllers/custom/getConfigDataController";
import { updateConfigDataController } from "@/src/controllers/custom/updateConfigDataController";
import { createMessageController } from "@/src/controllers/custom/createMessageController";

const customRouter = express.Router();

customRouter.get("/tunables.json", tunablesController);
customRouter.get("/getItemLists", getItemListsController);
customRouter.get("/pushArchonCrystalUpgrade", pushArchonCrystalUpgradeController);
customRouter.get("/popArchonCrystalUpgrade", popArchonCrystalUpgradeController);
customRouter.get("/deleteAccount", deleteAccountController);
customRouter.get("/renameAccount", renameAccountController);

customRouter.post("/createAccount", createAccountController);
customRouter.post("/createMessage", createMessageController);
customRouter.post("/addItems", addItemsController);
customRouter.post("/addXp", addXpController);
customRouter.post("/import", importController);

customRouter.get("/config", getConfigDataController);
customRouter.post("/config", updateConfigDataController);

export { customRouter };
