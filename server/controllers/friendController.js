import { prisma } from "../lib/db.js";
import { emitToUser } from "../server.js";

const populateRequest = {
    sender: { select: { id: true, email: true, fullName: true, profilePic: true, bio: true } },
    receiver: { select: { id: true, email: true, fullName: true, profilePic: true, bio: true } }
};

export const getFriendState = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const currentUser = await prisma.user.findUnique({
            where: { id: currentUserId },
            include: { friends: true }
        });

        const requests = await prisma.friendRequest.findMany({
            where: {
                OR: [{ senderId: currentUserId }, { receiverId: currentUserId }]
            },
            include: populateRequest,
            orderBy: { createdAt: 'desc' }
        });

        const requestUserIds = new Set();
        requests.forEach((request) => {
            requestUserIds.add(request.senderId);
            requestUserIds.add(request.receiverId);
        });
        requestUserIds.add(currentUserId);
        
        const friendIds = currentUser.friends.map(f => f.id);

        const suggestions = await prisma.user.findMany({
            where: {
                id: { notIn: [...requestUserIds, ...friendIds] }
            },
            select: { id: true, email: true, fullName: true, profilePic: true, bio: true }
        });

        res.json({
            success: true,
            friends: currentUser.friends,
            requests,
            suggestions,
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const sendFriendRequest = async (req, res) => {
    try {
        const senderId = req.user.id;
        const receiverId = req.params.id;

        if (senderId === receiverId) {
            return res.json({ success: false, message: "You cannot friend yourself." });
        }

        const sender = await prisma.user.findUnique({
            where: { id: senderId },
            include: { friends: true }
        });
        
        if (sender.friends.some((friend) => friend.id === receiverId)) {
            return res.json({ success: false, message: "You are already friends." });
        }

        let request = await prisma.friendRequest.findFirst({
            where: {
                OR: [
                    { senderId, receiverId },
                    { senderId: receiverId, receiverId: senderId }
                ]
            }
        });

        if (request) {
            request = await prisma.friendRequest.update({
                where: { id: request.id },
                data: { senderId, receiverId, status: "pending" },
                include: populateRequest
            });
        } else {
            request = await prisma.friendRequest.create({
                data: { senderId, receiverId, status: "pending" },
                include: populateRequest
            });
        }

        emitToUser(receiverId, "friend-request:updated", request);
        res.json({ success: true, request, message: "Friend request sent." });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const respondToFriendRequest = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const requestId = req.params.id;
        const { action } = req.body;

        let request = await prisma.friendRequest.findUnique({
            where: { id: requestId }
        });

        if (!request) {
            return res.json({ success: false, message: "Request not found." });
        }

        if (request.receiverId !== currentUserId) {
            return res.status(403).json({ success: false, message: "Not allowed." });
        }

        if (!["accepted", "rejected"].includes(action)) {
            return res.json({ success: false, message: "Invalid action." });
        }

        request = await prisma.friendRequest.update({
            where: { id: requestId },
            data: { status: action },
            include: populateRequest
        });

        if (action === "accepted") {
            await prisma.user.update({
                where: { id: request.senderId },
                data: { friends: { connect: { id: request.receiverId } } }
            });
            await prisma.user.update({
                where: { id: request.receiverId },
                data: { friends: { connect: { id: request.senderId } } }
            });
        }

        emitToUser(request.senderId, "friend-request:updated", request);
        emitToUser(request.receiverId, "friend-request:updated", request);

        res.json({
            success: true,
            request,
            message: action === "accepted" ? "Friend request accepted." : "Friend request rejected.",
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};
