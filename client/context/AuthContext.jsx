import { createContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export const AuthContext = createContext();

export const AuthProvider = ({ children })=>{
    const [authUser, setAuthUser] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [socket, setSocket] = useState(null);
    const [iceServers, setIceServers] = useState([]);

    const api = useMemo(() => {
        const instance = axios.create({
            baseURL: backendUrl,
            withCredentials: true, // send httpOnly cookie token when available
        });

        // Fallback for dev/proxy setups where cookies may not be sent.
        instance.interceptors.request.use((config) => {
            const token = localStorage.getItem("token");
            if (token) {
                config.headers = config.headers || {};
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });

        return instance;
    }, []);

    const fetchRtcConfig = async () => {
        try {
            const { data } = await api.get("/api/auth/rtc-config");
            if (data.success) {
                setIceServers(data.iceServers || []);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const connectSocket = () => {
        if (socket?.connected) return;

        const newSocket = io(backendUrl, {
            withCredentials: true,
            autoConnect: false,
        });

        newSocket.connect();

        newSocket.on("presence:online-users", (userIds)=>{
            setOnlineUsers(userIds);
        });

        newSocket.on("connect_error", (error) => {
            console.error("Socket connection failed:", error.message);
        });

        setSocket(newSocket);
    };

    const disconnectSocket = () => {
        if (socket) {
            socket.disconnect();
            setSocket(null);
        }
    };

    const checkAuth = async () => {
        try {
            const { data } = await api.get("/api/auth/check");
            if (data.success) {
                setAuthUser(data.user);
                connectSocket();
                fetchRtcConfig();
            }
        } catch (error) {
            console.error("Auth check failed:", error.message);
        }
    };

    const login = async (state, credentials)=>{
        try {
            const { data } = await api.post(`/api/auth/${state}`, credentials);
            if (data.success){
                setAuthUser(data.userData);
                localStorage.setItem("token", data.token);
                connectSocket();
                fetchRtcConfig();
                toast.success(data.message);
            }else{
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const logout = async () =>{
        try {
            await api.post("/api/auth/logout");
        } catch (error) {
            console.error("Logout request failed:", error.message);
        }
        localStorage.removeItem("token");
        setAuthUser(null);
        setOnlineUsers([]);
        setIceServers([]);
        disconnectSocket();
        toast.success("Logged out successfully");
    };

    const updateProfile = async (body)=>{
        try {
            const { data } = await api.put("/api/auth/update-profile", body);
            if(data.success){
                setAuthUser(data.user);
                toast.success("Profile updated successfully");
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    useEffect(()=>{
        checkAuth();

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    },[])

    const value = {
        axios: api,
        authUser,
        onlineUsers,
        socket,
        iceServers,
        login,
        logout,
        updateProfile,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
