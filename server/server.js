import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import jwt from "jsonwebtoken";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import friendRouter from "./routes/friendRoutes.js";
import groupRouter from "./routes/groupRoutes.js";
import { Server } from "socket.io";
import { rateLimiter } from "./middleware/rateLimiter.js";

const DEFAULT_CLIENT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];

const allowedOrigins = (process.env.CLIENT_ORIGINS || DEFAULT_CLIENT_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const corsOptions = {
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
};

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app)

if (process.env.NODE_ENV === "production") {
    // Required for secure cookies behind proxies (Vercel/Render/Nginx).
    app.set("trust proxy", 1);
}

// Initialize socket.io server
export const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
})

// Store online users across multiple devices
export const userSocketMap = new Map(); // { userId: Set(socketId) }

const getSocketIdsForUser = (userId) => {
    return [...(userSocketMap.get(String(userId)) || new Set())];
};

export const getOnlineUserIds = () => [...userSocketMap.keys()];

export const emitToUser = (userId, eventName, payload) => {
    for (const socketId of getSocketIdsForUser(userId)) {
        io.to(socketId).emit(eventName, payload);
    }
};

export const emitToUsers = (userIds, eventName, payload) => {
    for (const userId of userIds) {
        emitToUser(userId, eventName, payload);
    }
};

export const emitToUserWithAck = async (userId, eventName, payload, timeoutMs = 3000) => {
    const socketIds = getSocketIdsForUser(userId);
    if (socketIds.length === 0) return false;

    const ackResults = await Promise.all(
        socketIds.map((socketId) => new Promise((resolve) => {
            const socket = io.sockets.sockets.get(socketId);
            if (!socket) {
                resolve(false);
                return;
            }

            socket.timeout(timeoutMs).emit(eventName, payload, (error, response) => {
                if (error) {
                    resolve(false);
                    return;
                }

                resolve(response?.received === true);
            });
        })),
    );

    return ackResults.some(Boolean);
};

const getCookieValue = (cookieHeader, name) => {
    if (!cookieHeader) return null;
    const prefix = `${name}=`;
    const parts = String(cookieHeader).split(";").map((part) => part.trim());
    const match = parts.find((part) => part.startsWith(prefix));
    if (!match) return null;
    return decodeURIComponent(match.slice(prefix.length));
};

io.use((socket, next) => {
    try {
        const token =
            socket.handshake.auth?.token
            || getCookieValue(socket.request.headers.cookie, "token");
        if (!token) {
            return next(new Error("Authentication required"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = String(decoded.userId);
        next();
    } catch (error) {
        next(new Error("Invalid token"));
    }
});

// Socket.io connection handler
io.on("connection", (socket)=>{
    const userId = socket.userId;
    console.log("User Connected", userId);

    if(userId) {
        const existingSockets = userSocketMap.get(userId) || new Set();
        existingSockets.add(socket.id);
        userSocketMap.set(userId, existingSockets);
        socket.join(`user:${userId}`);
    }
    
    // Emit online users to all connected clients
    io.emit("presence:online-users", getOnlineUserIds());

    socket.on("conversation:typing", ({ toUserId, groupMemberIds, chatType = "personal", chatId, isTyping }) => {
        const payload = {
            fromUserId: userId,
            chatType,
            chatId,
            isTyping: Boolean(isTyping),
        };

        if (chatType === "group") {
            emitToUsers((groupMemberIds || []).filter((memberId) => String(memberId) !== userId), "conversation:typing", payload);
            return;
        }

        if (!toUserId) return;
        emitToUser(toUserId, "conversation:typing", payload);
    });

    socket.on("call:start", ({ toUserId, offer, callType }) => {
        if (!toUserId || !offer) return;

        emitToUser(toUserId, "call:incoming", {
            fromUserId: userId,
            offer,
            callType: callType || "video",
        });
    });

    socket.on("call:answer", ({ toUserId, answer, callType }) => {
        if (!toUserId || !answer) return;

        emitToUser(toUserId, "call:answered", {
            fromUserId: userId,
            answer,
            callType: callType || "video",
        });
    });

    socket.on("call:ice-candidate", ({ toUserId, candidate }) => {
        if (!toUserId || !candidate) return;

        emitToUser(toUserId, "call:ice-candidate", {
            fromUserId: userId,
            candidate,
        });
    });

    socket.on("call:end", ({ toUserId, reason }) => {
        if (!toUserId) return;

        emitToUser(toUserId, "call:ended", {
            fromUserId: userId,
            reason: reason || "ended",
        });
    });

    socket.on("disconnect", ()=>{
        console.log("User Disconnected", userId);
        const existingSockets = userSocketMap.get(userId);

        if (existingSockets) {
            existingSockets.delete(socket.id);
            if (existingSockets.size === 0) {
                userSocketMap.delete(userId);
            } else {
                userSocketMap.set(userId, existingSockets);
            }
        }

        io.emit("presence:online-users", getOnlineUserIds())
    })
})

// Middleware setup
app.use(express.json({limit: process.env.JSON_BODY_LIMIT || "25mb"}));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || "25mb" }));
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(rateLimiter);


// Routes setup
app.use("/api/status", (req, res)=> res.send("Server is live"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter)
app.use("/api/friends", friendRouter)
app.use("/api/groups", groupRouter)


// Connect to Database
await connectDB();

const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) {
    server.listen(PORT, ()=> console.log("Server is running on PORT: " + PORT));
}

// Export server for Vervel
export default server;
