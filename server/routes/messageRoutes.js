import express from "express";
import { protectRoute } from "../middleware/auth.js";
import {
    deleteMessage,
    getMessages,
    getUsersForSidebar,
    markConversationAsRead,
    sendMessage,
    updateMessage,
} from "../controllers/messageController.js";

const messageRouter = express.Router();

messageRouter.get("/users", protectRoute, getUsersForSidebar);
messageRouter.get("/:chatType/:id", protectRoute, getMessages);
messageRouter.put("/read/:chatType/:id", protectRoute, markConversationAsRead);
messageRouter.post("/send/:chatType/:id", protectRoute, sendMessage)
messageRouter.put("/:id", protectRoute, updateMessage);
messageRouter.delete("/:id", protectRoute, deleteMessage);

export default messageRouter;
