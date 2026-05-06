import { getRedisClient } from "../lib/redis.js";
import jwt from "jsonwebtoken";

const WINDOW_SECONDS = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60);
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100);

export const rateLimiter = async (req, res, next) => {
    try {
        const redis = await getRedisClient();
        if (!redis) {
            return next();
        }

        const authHeader = req.headers.authorization;
        const headerToken = authHeader?.startsWith("Bearer ")
            ? authHeader.slice(7)
            : null;
        const token = headerToken || req.headers.token;

        let identifier = `ip:${req.ip}`;
        if (req.user?._id) {
            identifier = `user:${req.user._id}`;
        } else if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                identifier = `user:${decoded.userId}`;
            } catch {
                identifier = `ip:${req.ip}`;
            }
        }

        const key = `rate-limit:${identifier}`;

        const currentCount = await redis.incr(key);
        if (currentCount === 1) {
            await redis.expire(key, WINDOW_SECONDS);
        }

        const ttl = await redis.ttl(key);
        res.setHeader("X-RateLimit-Limit", MAX_REQUESTS);
        res.setHeader("X-RateLimit-Remaining", Math.max(MAX_REQUESTS - currentCount, 0));
        res.setHeader("X-RateLimit-Reset", Math.max(ttl, 0));

        if (currentCount > MAX_REQUESTS) {
            return res.status(429).json({
                success: false,
                message: "Rate limit exceeded. Please try again later.",
            });
        }

        next();
    } catch (error) {
        console.error("Rate limiter fallback:", error.message);
        next();
    }
};
