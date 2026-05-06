import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import toast from "react-hot-toast";
import { AuthContext } from "./AuthContext";

export const CallContext = createContext();

const defaultCallState = {
    partnerUserId: null,
    callType: "video",
    phase: "idle",
};

export const CallProvider = ({ children }) => {
    const { socket, iceServers } = useContext(AuthContext);

    const [incomingCall, setIncomingCall] = useState(null);
    const [activeCall, setActiveCall] = useState(defaultCallState);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    const peerConnectionRef = useRef(null);
    const currentPartnerRef = useRef(null);
    const localStreamRef = useRef(null);

    useEffect(() => {
        localStreamRef.current = localStream;
    }, [localStream]);

    const cleanupCall = () => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.onicecandidate = null;
            peerConnectionRef.current.ontrack = null;
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
        }

        setLocalStream(null);
        setRemoteStream(null);
        setIncomingCall(null);
        setActiveCall(defaultCallState);
        currentPartnerRef.current = null;
    };

    const createPeerConnection = (partnerUserId, callType, stream) => {
        const connection = new RTCPeerConnection({
            iceServers: iceServers.length > 0
                ? iceServers
                : [{ urls: "stun:stun.l.google.com:19302" }],
        });

        const nextRemoteStream = new MediaStream();
        setRemoteStream(nextRemoteStream);

        stream.getTracks().forEach((track) => {
            connection.addTrack(track, stream);
        });

        connection.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                nextRemoteStream.addTrack(track);
            });
        };

        connection.onicecandidate = (event) => {
            if (!event.candidate || !socket) return;

            socket.emit("call:ice-candidate", {
                toUserId: partnerUserId,
                candidate: event.candidate,
            });
        };

        peerConnectionRef.current = connection;
        currentPartnerRef.current = partnerUserId;
        setActiveCall({
            partnerUserId,
            callType,
            phase: "connecting",
        });

        return connection;
    };

    const getMediaStream = async (callType) => {
        return navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === "video",
        });
    };

    const startCall = async (partnerUserId, callType = "video") => {
        try {
            const stream = await getMediaStream(callType);
            setLocalStream(stream);

            const connection = createPeerConnection(partnerUserId, callType, stream);
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);

            socket.emit("call:start", {
                toUserId: partnerUserId,
                offer,
                callType,
            });

            setActiveCall({
                partnerUserId,
                callType,
                phase: "ringing",
            });
        } catch (error) {
            cleanupCall();
            toast.error(error.message || "Unable to start call");
        }
    };

    const acceptCall = async () => {
        if (!incomingCall) return;

        try {
            const stream = await getMediaStream(incomingCall.callType);
            setLocalStream(stream);

            const connection = createPeerConnection(
                incomingCall.fromUserId,
                incomingCall.callType,
                stream,
            );

            await connection.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);

            socket.emit("call:answer", {
                toUserId: incomingCall.fromUserId,
                answer,
                callType: incomingCall.callType,
            });

            setIncomingCall(null);
            setActiveCall({
                partnerUserId: incomingCall.fromUserId,
                callType: incomingCall.callType,
                phase: "connected",
            });
        } catch (error) {
            cleanupCall();
            toast.error(error.message || "Unable to answer call");
        }
    };

    const declineCall = () => {
        if (incomingCall && socket) {
            socket.emit("call:end", {
                toUserId: incomingCall.fromUserId,
                reason: "declined",
            });
        }

        cleanupCall();
    };

    const endCall = () => {
        if (socket && currentPartnerRef.current) {
            socket.emit("call:end", {
                toUserId: currentPartnerRef.current,
                reason: "ended",
            });
        }

        cleanupCall();
    };

    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = ({ fromUserId, offer, callType }) => {
            setIncomingCall({ fromUserId, offer, callType });
            setActiveCall({
                partnerUserId: fromUserId,
                callType,
                phase: "incoming",
            });
        };

        const handleAnsweredCall = async ({ fromUserId, answer, callType }) => {
            if (!peerConnectionRef.current) return;

            await peerConnectionRef.current.setRemoteDescription(
                new RTCSessionDescription(answer),
            );

            currentPartnerRef.current = fromUserId;
            setActiveCall({
                partnerUserId: fromUserId,
                callType,
                phase: "connected",
            });
        };

        const handleIceCandidate = async ({ candidate }) => {
            if (!peerConnectionRef.current) return;

            try {
                await peerConnectionRef.current.addIceCandidate(
                    new RTCIceCandidate(candidate),
                );
            } catch (error) {
                console.error("ICE candidate failed:", error.message);
            }
        };

        const handleCallEnded = () => {
            cleanupCall();
        };

        socket.on("call:incoming", handleIncomingCall);
        socket.on("call:answered", handleAnsweredCall);
        socket.on("call:ice-candidate", handleIceCandidate);
        socket.on("call:ended", handleCallEnded);

        return () => {
            socket.off("call:incoming", handleIncomingCall);
            socket.off("call:answered", handleAnsweredCall);
            socket.off("call:ice-candidate", handleIceCandidate);
            socket.off("call:ended", handleCallEnded);
        };
    }, [socket, iceServers]);

    const value = {
        incomingCall,
        activeCall,
        localStream,
        remoteStream,
        startCall,
        acceptCall,
        declineCall,
        endCall,
    };

    return (
        <CallContext.Provider value={value}>
            {children}
        </CallContext.Provider>
    );
};
