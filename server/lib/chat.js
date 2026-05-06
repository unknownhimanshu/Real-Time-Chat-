import crypto from "crypto";

export const MESSAGE_STATUS = {
    SENT: "sent",
    DELIVERED: "delivered",
    READ: "read",
};

export const CHAT_TYPE = {
    PERSONAL: "personal",
    GROUP: "group",
};

export const createConversationKey = (firstUserId, secondUserId) => {
    return [String(firstUserId), String(secondUserId)].sort().join(":");
};

export const createGroupConversationKey = (groupId) => `group:${String(groupId)}`;

export const toObjectId = (value) => String(value);

export const generateInviteToken = () => crypto.randomBytes(16).toString("hex");

export const encodeCursor = (message) => {
    if (!message?.id || !message?.createdAt) return null;

    return Buffer.from(
        JSON.stringify({
            id: String(message.id),
            createdAt: new Date(message.createdAt).toISOString(),
        }),
    ).toString("base64url");
};

export const decodeCursor = (cursor) => {
    if (!cursor) return null;

    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));

    return {
        id: String(decoded.id),
        createdAt: new Date(decoded.createdAt),
    };
};
