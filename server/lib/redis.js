import { createClient } from "redis";

let redisClient;
let redisUnavailableUntil = 0;

const REDIS_RETRY_COOLDOWN_MS = Number(process.env.REDIS_RETRY_COOLDOWN_MS || 30000);
const REDIS_CONNECT_TIMEOUT_MS = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 1500);

const withTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
        reject(new Error("Redis connection timeout"));
    }, timeoutMs);

    promise
        .then((value) => {
            clearTimeout(timer);
            resolve(value);
        })
        .catch((error) => {
            clearTimeout(timer);
            reject(error);
        });
});

export const getRedisClient = async () => {
    if (redisClient?.isOpen) return redisClient;
    if (Date.now() < redisUnavailableUntil) return null;

    redisClient = createClient({
        url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
        socket: {
            connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
        },
    });

    redisClient.on("error", (error) => {
        console.error("Redis error:", error.message);
    });

    try {
        await withTimeout(redisClient.connect(), REDIS_CONNECT_TIMEOUT_MS + 250);
        return redisClient;
    } catch (error) {
        redisUnavailableUntil = Date.now() + REDIS_RETRY_COOLDOWN_MS;
        console.error("Redis unavailable, continuing without rate limiting:", error.message);

        try {
            await redisClient.disconnect();
        } catch {
            // Ignore cleanup failures when Redis never fully connected.
        }

        redisClient = null;
        return null;
    }
};
