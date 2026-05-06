import express from "express";
import { protectRoute } from "../middleware/auth.js";
import {
    addGroupMembers,
    createGroup,
    getGroupMedia,
    getGroups,
    joinGroupByLink,
    updateGroup,
} from "../controllers/groupController.js";

const groupRouter = express.Router();

groupRouter.get("/", protectRoute, getGroups);
groupRouter.post("/", protectRoute, createGroup);
groupRouter.post("/join-by-link", protectRoute, joinGroupByLink);
groupRouter.post("/:id/members", protectRoute, addGroupMembers);
groupRouter.put("/:id", protectRoute, updateGroup);
groupRouter.get("/:id/media", protectRoute, getGroupMedia);

export default groupRouter;
