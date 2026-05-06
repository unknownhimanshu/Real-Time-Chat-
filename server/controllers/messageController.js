import cloudinary from "../lib/cloudinary.js";
import {
    CHAT_TYPE,
    createConversationKey,
    createGroupConversationKey,
    decodeCursor,
    encodeCursor,
    MESSAGE_STATUS,
} from "../lib/chat.js";
import { prisma } from "../lib/db.js";
import {
    emitToUser,
    emitToUserWithAck,
    emitToUsers,
    getOnlineUserIds,
} from "../server.js";

const DEFAULT_MESSAGE_LIMIT = 20;
const MAX_MESSAGE_LIMIT = 50;

const buildCursorFilter = (cursor) => {
    if (!cursor) return {};

    return {
        OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
    };
};

const uploadAttachment = async (attachment) => {
    const uploadResponse = await cloudinary.uploader.upload(attachment.data, {
        resource_type: "auto",
        public_id: attachment.fileName || undefined,
    });

    const inferredResourceType = attachment.mimeType?.startsWith("audio/")
        ? "audio"
        : uploadResponse.resource_type === "raw"
            ? "raw"
            : uploadResponse.resource_type;

    return {
        url: uploadResponse.secure_url,
        resourceType: inferredResourceType,
        fileName: attachment.fileName || uploadResponse.original_filename || "",
        mimeType: attachment.mimeType || "",
        sizeBytes: attachment.sizeBytes || uploadResponse.bytes || 0,
    };
};

const serializeMessageForUser = (message, viewerId) => {
    const deletedBy = message.deletedBy.map(u => String(u.id));
    if (deletedBy.includes(String(viewerId))) return null;

    const messageObject = { ...message };
    if (messageObject.deletedForEveryone) {
        messageObject.text = "This message was deleted";
        messageObject.image = "";
        messageObject.attachments = [];
    }
    
    // Convert deletedBy to ids so frontend understands
    messageObject.deletedBy = deletedBy;

    return messageObject;
};

const buildMessageQuery = ({ chatType, targetId, currentUserId }) => {
    if (chatType === CHAT_TYPE.GROUP) {
        return {
            chatType,
            groupId: targetId,
            conversationKey: createGroupConversationKey(targetId),
            deletedBy: { none: { id: currentUserId } },
        };
    }

    return {
        chatType: CHAT_TYPE.PERSONAL,
        conversationKey: createConversationKey(currentUserId, targetId),
        deletedBy: { none: { id: currentUserId } },
    };
};

const emitStatusUpdate = ({ messageIds, status, participantIds, deliveredAt, readAt }) => {
    emitToUsers(participantIds, "message:status-updated", {
        messageIds: messageIds.map(String),
        status,
        deliveredAt,
        readAt,
    });
};

const getChatParticipants = async (chatType, targetId, currentUserId) => {
    if (chatType === CHAT_TYPE.GROUP) {
        const group = await prisma.group.findUnique({
            where: { id: targetId },
            include: { members: true, admins: true }
        });
        if (!group) {
            throw new Error("Group not found");
        }

        const isMember = group.members.some((member) => member.id === currentUserId);
        if (!isMember) {
            throw new Error("You are not a member of this group");
        }

        return {
            participantIds: group.members.map(m => m.id),
            conversationKey: createGroupConversationKey(targetId),
            group,
        };
    }

    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) {
        throw new Error("User not found");
    }

    // eslint-disable-next-line no-unused-vars
    const { password, ...peerUser } = user;

    return {
        participantIds: [currentUserId, targetId],
        conversationKey: createConversationKey(currentUserId, targetId),
        peerUser,
    };
};

export const getUsersForSidebar = async (req, res)=>{
    try {
        const userId = req.user.id;
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            include: { friends: true }
        });
        
        const friendIds = currentUser.friends.map(f => f.id);
        const filteredUsers = await prisma.user.findMany({
            where: { id: { in: friendIds } },
            select: { id: true, email: true, fullName: true, profilePic: true, bio: true }
        });

        const unreadCounts = await prisma.message.groupBy({
            by: ['senderId'],
            where: {
                chatType: CHAT_TYPE.PERSONAL,
                receiverId: userId,
                status: { not: MESSAGE_STATUS.READ },
            },
            _count: {
                id: true
            }
        });

        const unseenMessages = unreadCounts.reduce((accumulator, item) => {
            accumulator[item.senderId] = item._count.id;
            return accumulator;
        }, {});

        res.json({
            success: true,
            users: filteredUsers,
            unseenMessages,
            onlineUsers: getOnlineUserIds(),
        })
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

export const getMessages = async (req, res) =>{
    try {
        const chatType = req.params.chatType || CHAT_TYPE.PERSONAL;
        const targetId = req.params.id;
        const myId = String(req.user.id);
        const cursor = decodeCursor(req.query.cursor);
        const parsedLimit = Number(req.query.limit) || DEFAULT_MESSAGE_LIMIT;
        const limit = Math.min(Math.max(parsedLimit, 1), MAX_MESSAGE_LIMIT);
        const { conversationKey, participantIds } = await getChatParticipants(chatType, targetId, myId);

        const messages = await prisma.message.findMany({
            where: {
                ...buildMessageQuery({ chatType, targetId, currentUserId: myId }),
                conversationKey,
                ...buildCursorFilter(cursor),
            },
            orderBy: [
                { createdAt: 'desc' },
                { id: 'desc' }
            ],
            take: limit + 1,
            include: { deletedBy: true }
        });

        const hasMore = messages.length > limit;
        const pageMessages = hasMore ? messages.slice(0, limit) : messages;
        const nextCursor = hasMore ? encodeCursor(pageMessages[pageMessages.length - 1]) : null;

        const readAt = new Date();
        let unreadSelector;
        if (chatType === CHAT_TYPE.GROUP) {
            unreadSelector = {
                chatType,
                groupId: targetId,
                senderId: { not: myId },
                status: { not: MESSAGE_STATUS.READ },
            };
        } else {
            unreadSelector = {
                chatType,
                senderId: targetId,
                receiverId: myId,
                status: { not: MESSAGE_STATUS.READ },
            };
        }

        const unreadMessages = await prisma.message.findMany({
            where: unreadSelector,
            select: { id: true }
        });

        if (unreadMessages.length > 0) {
            const unreadIds = unreadMessages.map((message) => message.id);
            await prisma.message.updateMany({
                where: { id: { in: unreadIds } },
                data: { status: MESSAGE_STATUS.READ, readAt, deliveredAt: readAt },
            });

            emitStatusUpdate({
                messageIds: unreadIds,
                status: MESSAGE_STATUS.READ,
                participantIds,
                deliveredAt: readAt.toISOString(),
                readAt: readAt.toISOString(),
            });
        }

        const orderedMessages = [...pageMessages]
            .reverse()
            .map((message) => serializeMessageForUser(message, myId))
            .filter(Boolean);

        res.json({
            success: true,
            messages: orderedMessages,
            pagination: {
                nextCursor,
                hasMore,
                limit,
            },
        });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

export const markConversationAsRead = async (req, res) => {
    try {
        const chatType = req.params.chatType || CHAT_TYPE.PERSONAL;
        const targetId = req.params.id;
        const myId = String(req.user.id);
        const { participantIds } = await getChatParticipants(chatType, targetId, myId);
        const readAt = new Date();

        const unreadSelector = chatType === CHAT_TYPE.GROUP
            ? {
                chatType,
                groupId: targetId,
                senderId: { not: myId },
                status: { not: MESSAGE_STATUS.READ },
            }
            : {
                chatType,
                senderId: targetId,
                receiverId: myId,
                status: { not: MESSAGE_STATUS.READ },
            };

        const unreadMessages = await prisma.message.findMany({
            where: unreadSelector,
            select: { id: true }
        });
        
        if (unreadMessages.length === 0) {
            return res.json({ success: true, updatedCount: 0 });
        }

        const unreadIds = unreadMessages.map((message) => message.id);
        await prisma.message.updateMany({
            where: { id: { in: unreadIds } },
            data: { status: MESSAGE_STATUS.READ, readAt, deliveredAt: readAt },
        });

        emitStatusUpdate({
            messageIds: unreadIds,
            status: MESSAGE_STATUS.READ,
            participantIds,
            deliveredAt: readAt.toISOString(),
            readAt: readAt.toISOString(),
        });

        res.json({ success: true, updatedCount: unreadIds.length });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const sendMessage = async (req, res) =>{
    try {
        const chatType = req.params.chatType || CHAT_TYPE.PERSONAL;
        const targetId = String(req.params.id);
        const senderId = String(req.user.id);
        const { text, image, attachments = [] } = req.body;
        const { participantIds, conversationKey } = await getChatParticipants(chatType, targetId, senderId);

        if (!text?.trim() && !image && attachments.length === 0) {
            return res.json({ success: false, message: "Message content is required" });
        }

        const uploadedAttachments = [];
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image, { resource_type: "image" });
            uploadedAttachments.push({
                url: uploadResponse.secure_url,
                resourceType: "image",
                fileName: uploadResponse.original_filename || "image",
                mimeType: "",
                sizeBytes: uploadResponse.bytes || 0,
            });
        }

        for (const attachment of attachments) {
            uploadedAttachments.push(await uploadAttachment(attachment));
        }

        const primaryImage = uploadedAttachments.find((attachment) => attachment.resourceType === "image")?.url || "";
        const newMessage = await prisma.message.create({
            data: {
                senderId,
                receiverId: chatType === CHAT_TYPE.PERSONAL ? targetId : null,
                groupId: chatType === CHAT_TYPE.GROUP ? targetId : null,
                chatType,
                conversationKey,
                text: text?.trim() || "",
                image: primaryImage,
                attachments: uploadedAttachments,
            },
            include: { deletedBy: true }
        });

        emitToUser(senderId, "message:created", newMessage);

        const recipientIds = participantIds.filter((participantId) => participantId !== senderId);
        let delivered = false;
        if (chatType === CHAT_TYPE.PERSONAL && recipientIds[0]) {
            delivered = await emitToUserWithAck(recipientIds[0], "message:new", newMessage);
        } else {
            emitToUsers(recipientIds, "message:new", newMessage);
            delivered = recipientIds.length > 0;
        }

        if (delivered) {
            const deliveredAt = new Date();
            const deliveredMessage = await prisma.message.update({
                where: { id: newMessage.id },
                data: { status: MESSAGE_STATUS.DELIVERED, deliveredAt },
                include: { deletedBy: true }
            });

            if (deliveredMessage) {
                emitStatusUpdate({
                    messageIds: [newMessage.id],
                    status: MESSAGE_STATUS.DELIVERED,
                    participantIds,
                    deliveredAt: deliveredAt.toISOString(),
                });
                return res.json({ success: true, newMessage: deliveredMessage });
            }
        }

        res.json({ success: true, newMessage });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

export const updateMessage = async (req, res) => {
    try {
        const userId = String(req.user.id);
        const { text } = req.body;
        
        let message = await prisma.message.findUnique({
            where: { id: req.params.id },
            include: { deletedBy: true }
        });

        if (!message) {
            return res.json({ success: false, message: "Message not found." });
        }

        if (message.senderId !== userId) {
            return res.status(403).json({ success: false, message: "You can only edit your own messages." });
        }

        if (message.deletedForEveryone) {
            return res.json({ success: false, message: "Deleted messages cannot be edited." });
        }

        message = await prisma.message.update({
            where: { id: req.params.id },
            data: {
                text: text?.trim() || "",
                editedAt: new Date()
            },
            include: { deletedBy: true }
        });

        let participantIds;
        if (message.chatType === CHAT_TYPE.GROUP) {
            const group = await prisma.group.findUnique({ where: { id: message.groupId }, include: { members: true } });
            participantIds = group.members.map(m => m.id);
        } else {
            participantIds = [message.senderId, message.receiverId];
        }

        emitToUsers(participantIds, "message:updated", message);
        res.json({ success: true, message, acknowledgement: "Message edited successfully." });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const userId = String(req.user.id);
        const scope = req.query.scope === "everyone" ? "everyone" : "me";
        
        let message = await prisma.message.findUnique({
            where: { id: req.params.id },
            include: { deletedBy: true }
        });

        if (!message) {
            return res.json({ success: false, message: "Message not found." });
        }

        let participantIds;
        if (message.chatType === CHAT_TYPE.GROUP) {
            const group = await prisma.group.findUnique({ where: { id: message.groupId }, include: { members: true } });
            participantIds = group.members.map(m => m.id);
        } else {
            participantIds = [message.senderId, message.receiverId];
        }

        if (scope === "everyone") {
            if (message.chatType !== CHAT_TYPE.PERSONAL) {
                return res.json({ success: false, message: "Delete for everyone is only available in personal chats." });
            }

            if (message.senderId !== userId) {
                return res.status(403).json({ success: false, message: "Only the sender can delete for everyone." });
            }

            message = await prisma.message.update({
                where: { id: req.params.id },
                data: {
                    deletedForEveryone: true,
                    text: "",
                    image: "",
                    attachments: []
                },
                include: { deletedBy: true }
            });

            emitToUsers(participantIds, "message:deleted", {
                messageId: message.id,
                scope: "everyone",
            });
            return res.json({ success: true, acknowledgement: "Message deleted for everyone." });
        }

        if (!message.deletedBy.some(u => u.id === userId)) {
            message = await prisma.message.update({
                where: { id: req.params.id },
                data: {
                    deletedBy: { connect: { id: userId } }
                },
                include: { deletedBy: true }
            });
        }

        emitToUser(userId, "message:deleted", {
            messageId: message.id,
            scope: "me",
        });
        res.json({ success: true, acknowledgement: "Message deleted for you." });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};
