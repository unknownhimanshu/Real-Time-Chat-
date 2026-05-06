import jwt from "jsonwebtoken";

// Function to generate a token for a user
export const generateToken = (userId)=>{
    const token = jwt.sign({userId}, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
    return token;
}

export const cookieOptions = {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const sanitizeUser = (user) => {
    if (!user) return null;

    const userObject = { ...user };
    delete userObject.password;
    return userObject;
};
