import express from "express";
import { protectRoute } from "../middleware/auth.js";
import {
    getFriendState,
    respondToFriendRequest,
    sendFriendRequest,
} from "../controllers/friendController.js";

const friendRouter = express.Router();

friendRouter.get("/state", protectRoute, getFriendState);
friendRouter.post("/request/:id", protectRoute, sendFriendRequest);
friendRouter.post("/respond/:id", protectRoute, respondToFriendRequest);

export default friendRouter;
