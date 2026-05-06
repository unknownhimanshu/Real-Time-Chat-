import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
});

export const connectDB = async () => {
    try {
        await prisma.$connect();
        console.log('Database Connected (PostgreSQL via Prisma)');
    } catch (error) {
        console.log(error);
    }
}