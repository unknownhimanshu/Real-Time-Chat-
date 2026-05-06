import { cookieOptions, generateToken, sanitizeUser } from "../lib/utils.js";
import { prisma } from "../lib/db.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js"

// Signup a new user
export const signup = async (req, res)=>{
    const { fullName, email, password, bio } = req.body;

    try {
        if (!fullName || !email || !password || !bio){
            return res.json({success: false, message: "Missing Details" })
        }
        const user = await prisma.user.findUnique({ where: { email } });

        if(user){
            return res.json({success: false, message: "Account already exists" })
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await prisma.user.create({
            data: { fullName, email, password: hashedPassword, bio }
        });

        const token = generateToken(newUser.id)
        res.cookie("token", token, cookieOptions);

        res.json({
            success: true,
            userData: sanitizeUser(newUser),
            token,
            message: "Account created successfully",
        })
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// Controller to login a user
export const login = async (req, res) =>{
    try {
        const { email, password } = req.body;
        const userData = await prisma.user.findUnique({ where: { email } })

        if (!userData) {
            return res.json({ success: false, message: "Invalid credentials" });
        }

        const isPasswordCorrect = await bcrypt.compare(password, userData.password);

        if (!isPasswordCorrect){
            return res.json({ success: false, message: "Invalid credentials" });
        }

        const token = generateToken(userData.id)
        res.cookie("token", token, cookieOptions);

        res.json({
            success: true,
            userData: sanitizeUser(userData),
            token,
            message: "Login successful",
        })
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}
// Controller to check if user is authenticated
export const checkAuth = (req, res)=>{
    res.json({success: true, user: req.user});
}

export const logout = (_req, res) => {
    res.clearCookie("token", { ...cookieOptions, maxAge: 0 });
    res.json({ success: true, message: "Logged out successfully" });
};

export const getRtcConfig = (_req, res) => {
    const stunServers = (process.env.RTC_STUN_SERVERS || "stun:stun.l.google.com:19302")
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean);

    const turnServers = (process.env.RTC_TURN_SERVERS || "")
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean);

    const iceServers = [
        ...stunServers.map((urls) => ({ urls })),
        ...turnServers.map((urls) => ({
            urls,
            username: process.env.RTC_TURN_USERNAME || "",
            credential: process.env.RTC_TURN_CREDENTIAL || "",
        })),
    ];

    res.json({ success: true, iceServers });
};

// Controller to update user profile details
export const updateProfile = async (req, res)=>{
    try {
        const { profilePic, bio, fullName } = req.body;

        const userId = req.user.id;
        let updatedUser;

        if(!profilePic){
            updatedUser = await prisma.user.update({
                where: { id: userId },
                data: { bio, fullName }
            });
        } else{
            const upload = await cloudinary.uploader.upload(profilePic);

            updatedUser = await prisma.user.update({
                where: { id: userId },
                data: { profilePic: upload.secure_url, bio, fullName }
            });
        }
        res.json({success: true, user: sanitizeUser(updatedUser)})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}
