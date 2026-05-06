import cloudinary from "../lib/cloudinary.js";
import { createGroupConversationKey, generateInviteToken } from "../lib/chat.js";
import { prisma } from "../lib/db.js";
import { emitToUsers } from "../server.js";

const populateGroup = {
    members: { select: { id: true, email: true, fullName: true, profilePic: true, bio: true } },
    admins: { select: { id: true, email: true, fullName: true, profilePic: true, bio: true } },
    createdBy: { select: { id: true, email: true, fullName: true, profilePic: true, bio: true } }
};

export const getGroups = async (req, res) => {
    try {
        const userId = req.user.id;
        const groups = await prisma.group.findMany({
            where: {
                members: { some: { id: userId } }
            },
            include: populateGroup,
            orderBy: { updatedAt: 'desc' }
        });

        res.json({ success: true, groups });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const createGroup = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, description, avatar, memberIds = [] } = req.body;

        if (!name?.trim()) {
            return res.json({ success: false, message: "Group name is required." });
        }

        let avatarUrl = "";
        if (avatar) {
            const upload = await cloudinary.uploader.upload(avatar, { resource_type: "image" });
            avatarUrl = upload.secure_url;
        }

        const uniqueMembers = [...new Set([String(userId), ...memberIds.map(String)])];
        const group = await prisma.group.create({
            data: {
                name: name.trim(),
                description: description?.trim() || "",
                avatar: avatarUrl,
                inviteToken: generateInviteToken(),
                createdById: userId,
                admins: { connect: { id: userId } },
                members: { connect: uniqueMembers.map(id => ({ id })) }
            },
            include: populateGroup
        });

        emitToUsers(uniqueMembers, "group:updated", group);

        res.json({ success: true, group, message: "Group created successfully." });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const joinGroupByLink = async (req, res) => {
    try {
        const userId = req.user.id;
        const { inviteToken } = req.body;
        
        let group = await prisma.group.findUnique({ where: { inviteToken } });
        if (!group) {
            return res.json({ success: false, message: "Invalid invite link." });
        }

        group = await prisma.group.update({
            where: { inviteToken },
            data: { members: { connect: { id: userId } } },
            include: populateGroup
        });

        emitToUsers(group.members.map(m => m.id), "group:updated", group);
        res.json({ success: true, group, message: "Joined group successfully." });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const addGroupMembers = async (req, res) => {
    try {
        const userId = req.user.id;
        const { memberIds = [] } = req.body;
        
        let group = await prisma.group.findUnique({
            where: { id: req.params.id },
            include: { admins: true }
        });

        if (!group) {
            return res.json({ success: false, message: "Group not found." });
        }

        const isAdmin = group.admins.some((admin) => admin.id === userId);
        if (!isAdmin) {
            return res.status(403).json({ success: false, message: "Only admins can add members." });
        }

        group = await prisma.group.update({
            where: { id: req.params.id },
            data: { members: { connect: memberIds.map(String).map(id => ({ id })) } },
            include: populateGroup
        });

        emitToUsers(group.members.map(m => m.id), "group:updated", group);

        res.json({ success: true, group, message: "Members added successfully." });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const updateGroup = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, description } = req.body;
        
        let group = await prisma.group.findUnique({
            where: { id: req.params.id },
            include: { admins: true }
        });

        if (!group) {
            return res.json({ success: false, message: "Group not found." });
        }

        const isAdmin = group.admins.some((admin) => admin.id === userId);
        if (!isAdmin) {
            return res.status(403).json({ success: false, message: "Only admins can update groups." });
        }

        group = await prisma.group.update({
            where: { id: req.params.id },
            data: {
                name: name?.trim() || group.name,
                description: description?.trim() || group.description
            },
            include: populateGroup
        });

        emitToUsers(group.members.map(m => m.id), "group:updated", group);

        res.json({ success: true, group });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const getGroupMedia = async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: {
                groupId: req.params.id,
                deletedForEveryone: false,
                NOT: {
                    attachments: {
                        equals: []
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, messages });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};
