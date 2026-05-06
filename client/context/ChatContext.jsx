import { createContext, useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AuthContext } from "./AuthContext";

const DEFAULT_PAGE_LIMIT = 20;

export const ChatContext = createContext();

const chatKeyFor = (chatType, id) => `${chatType}:${id}`;

const mergeMessages = (existingMessages, incomingMessages, placement = "replace") => {
    if (placement === "replace") {
        return incomingMessages;
    }

    const nextMessages = placement === "prepend"
        ? [...incomingMessages, ...existingMessages]
        : [...existingMessages, ...incomingMessages];

    const byId = new Map();
    for (const message of nextMessages) {
        byId.set(message._id, message);
    }

    return [...byId.values()].sort(
        (first, second) => new Date(first.createdAt) - new Date(second.createdAt),
    );
};

export const ChatProvider = ({ children })=>{
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [friends, setFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [friendSuggestions, setFriendSuggestions] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [unseenMessages, setUnseenMessages] = useState({});
    const [typingUsers, setTypingUsers] = useState({});
    const [pagination, setPagination] = useState({
        nextCursor: null,
        hasMore: false,
        isLoading: false,
        isLoadingMore: false,
    });

    const { socket, axios, authUser } = useContext(AuthContext);
    const typingTimeoutsRef = useRef({});

    const refreshSidebarData = async () => {
        try {
            const [usersResponse, groupsResponse, friendsResponse] = await Promise.all([
                axios.get("/api/messages/users"),
                axios.get("/api/groups"),
                axios.get("/api/friends/state"),
            ]);

            if (usersResponse.data.success) {
                setUsers(usersResponse.data.users.map((user) => ({
                    ...user,
                    chatType: "personal",
                })));
                setUnseenMessages((previous) => ({
                    ...previous,
                    ...Object.fromEntries(
                        Object.entries(usersResponse.data.unseenMessages || {}).map(([id, count]) => [
                            chatKeyFor("personal", id),
                            count,
                        ]),
                    ),
                }));
            }

            if (groupsResponse.data.success) {
                setGroups(groupsResponse.data.groups.map((group) => ({
                    ...group,
                    chatType: "group",
                })));
            }

            if (friendsResponse.data.success) {
                setFriends(friendsResponse.data.friends || []);
                setFriendRequests(friendsResponse.data.requests || []);
                setFriendSuggestions(friendsResponse.data.suggestions || []);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const getMessages = async (chat, options = {})=>{
        if (!chat) return;

        const { cursor = null, mode = "replace" } = options;

        try {
            setPagination((previous) => ({
                ...previous,
                isLoading: mode === "replace",
                isLoadingMore: mode === "prepend",
            }));

            const { data } = await axios.get(`/api/messages/${chat.chatType}/${chat._id}`, {
                params: {
                    cursor,
                    limit: DEFAULT_PAGE_LIMIT,
                },
            });

            if (data.success){
                setMessages((previousMessages) =>
                    mergeMessages(previousMessages, data.messages, mode),
                );
                setPagination((previous) => ({
                    ...previous,
                    nextCursor: data.pagination?.nextCursor || null,
                    hasMore: Boolean(data.pagination?.hasMore),
                    isLoading: false,
                    isLoadingMore: false,
                }));
                setUnseenMessages((previous) => ({
                    ...previous,
                    [chatKeyFor(chat.chatType, chat._id)]: 0,
                }));
            }
        } catch (error) {
            setPagination((previous) => ({
                ...previous,
                isLoading: false,
                isLoadingMore: false,
            }));
            toast.error(error.message);
        }
    };

    const loadOlderMessages = async () => {
        if (!selectedChat || !pagination.hasMore || pagination.isLoadingMore) return;
        await getMessages(selectedChat, {
            cursor: pagination.nextCursor,
            mode: "prepend",
        });
    };

    const markConversationAsRead = async (chat) => {
        if (!chat) return;

        try {
            await axios.put(`/api/messages/read/${chat.chatType}/${chat._id}`);
            setUnseenMessages((previous) => ({
                ...previous,
                [chatKeyFor(chat.chatType, chat._id)]: 0,
            }));
        } catch (error) {
            toast.error(error.message);
        }
    };

    const sendMessage = async (messageData)=>{
        if (!selectedChat) return;

        try {
            const { data } = await axios.post(
                `/api/messages/send/${selectedChat.chatType}/${selectedChat._id}`,
                messageData,
            );

            if (data.success){
                setMessages((previousMessages) =>
                    mergeMessages(previousMessages, [data.newMessage], "append"),
                );
            }else{
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const editMessage = async (messageId, text) => {
        try {
            const { data } = await axios.put(`/api/messages/${messageId}`, { text });
            if (!data.success) {
                toast.error(data.message);
                return;
            }
            toast.success(data.acknowledgement || "Message updated");
        } catch (error) {
            toast.error(error.message);
        }
    };

    const deleteMessage = async (messageId, scope = "me") => {
        try {
            const { data } = await axios.delete(`/api/messages/${messageId}`, {
                params: { scope },
            });
            if (!data.success) {
                toast.error(data.message);
                return;
            }
            if (scope === "me") {
                setMessages((previousMessages) => previousMessages.filter((message) => message._id !== messageId));
            }
            toast.success(data.acknowledgement || "Message deleted");
        } catch (error) {
            toast.error(error.message);
        }
    };

    const sendTypingState = (isTyping) => {
        if (!socket || !selectedChat) return;

        socket.emit("conversation:typing", {
            chatType: selectedChat.chatType,
            chatId: selectedChat._id,
            toUserId: selectedChat.chatType === "personal" ? selectedChat._id : null,
            groupMemberIds: selectedChat.chatType === "group"
                ? selectedChat.members.map((member) => String(member._id || member))
                : [],
            isTyping,
        });
    };

    const selectChat = async (chat) => {
        if (!chat) {
            setSelectedChat(null);
            setMessages([]);
            setPagination({
                nextCursor: null,
                hasMore: false,
                isLoading: false,
                isLoadingMore: false,
            });
            return;
        }

        setSelectedChat(chat);
        setMessages([]);
        setPagination({
            nextCursor: null,
            hasMore: false,
            isLoading: true,
            isLoadingMore: false,
        });

        await getMessages(chat, { mode: "replace" });
        await markConversationAsRead(chat);
    };

    const sendFriendRequest = async (userId) => {
        try {
            const { data } = await axios.post(`/api/friends/request/${userId}`);
            if (!data.success) {
                toast.error(data.message);
                return;
            }
            toast.success(data.message);
            refreshSidebarData();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const respondToFriendRequest = async (requestId, action) => {
        try {
            const { data } = await axios.post(`/api/friends/respond/${requestId}`, { action });
            if (!data.success) {
                toast.error(data.message);
                return;
            }
            toast.success(data.message);
            refreshSidebarData();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const createGroup = async (payload) => {
        try {
            const { data } = await axios.post("/api/groups", payload);
            if (!data.success) {
                toast.error(data.message);
                return null;
            }
            toast.success(data.message);
            refreshSidebarData();
            return data.group;
        } catch (error) {
            toast.error(error.message);
            return null;
        }
    };

    const joinGroupByLink = async (inviteToken) => {
        try {
            const { data } = await axios.post("/api/groups/join-by-link", { inviteToken });
            if (!data.success) {
                toast.error(data.message);
                return;
            }
            toast.success(data.message);
            refreshSidebarData();
        } catch (error) {
            toast.error(error.message);
        }
    };

    useEffect(() => {
        if (authUser) {
            refreshSidebarData();
        }
    }, [authUser])

    useEffect(()=>{
        if(!socket || !authUser) return;

        const handleNewMessage = (newMessage, acknowledgement) => {
            acknowledgement?.({ received: true });
            const key = chatKeyFor(newMessage.chatType, newMessage.chatType === "group" ? newMessage.groupId : newMessage.senderId);
            const isCurrentPersonal = selectedChat
                && newMessage.chatType === "personal"
                && selectedChat.chatType === "personal"
                && newMessage.senderId === selectedChat._id;
            const isCurrentGroup = selectedChat
                && newMessage.chatType === "group"
                && selectedChat.chatType === "group"
                && String(newMessage.groupId) === String(selectedChat._id);

            if (isCurrentPersonal || isCurrentGroup){
                setMessages((previousMessages) =>
                    mergeMessages(previousMessages, [newMessage], "append"),
                );
                markConversationAsRead(selectedChat);
            }else{
                setUnseenMessages((previousUnseenMessages)=>({
                    ...previousUnseenMessages,
                    [key]: (previousUnseenMessages[key] || 0) + 1,
                }));
            }
        };

        const handleOwnMessage = (newMessage) => {
            if (newMessage.senderId !== authUser._id) return;

            const isSelected = selectedChat
                && selectedChat.chatType === newMessage.chatType
                && String(selectedChat._id) === String(newMessage.chatType === "group" ? newMessage.groupId : newMessage.receiverId);

            if (isSelected) {
                setMessages((previousMessages) =>
                    mergeMessages(previousMessages, [newMessage], "append"),
                );
            }
        };

        const handleStatusUpdated = ({ messageIds, status, deliveredAt, readAt }) => {
            const messageIdSet = new Set(messageIds);
            setMessages((previousMessages) =>
                previousMessages.map((message) => (
                    messageIdSet.has(message._id)
                        ? {
                            ...message,
                            status,
                            deliveredAt: deliveredAt || message.deliveredAt,
                            readAt: readAt || message.readAt,
                        }
                        : message
                )),
            );
        };

        const handleUpdatedMessage = (updatedMessage) => {
            setMessages((previousMessages) =>
                previousMessages.map((message) => message._id === updatedMessage._id ? updatedMessage : message),
            );
        };

        const handleDeletedMessage = ({ messageId, scope }) => {
            if (scope === "me") {
                setMessages((previousMessages) => previousMessages.filter((message) => message._id !== messageId));
                return;
            }

            setMessages((previousMessages) =>
                previousMessages.map((message) => (
                    message._id === messageId
                        ? {
                            ...message,
                            text: "This message was deleted",
                            attachments: [],
                            image: "",
                            deletedForEveryone: true,
                        }
                        : message
                )),
            );
        };

        const handleTyping = ({ fromUserId, chatType, chatId, isTyping }) => {
            const typingKey = chatKeyFor(chatType, chatType === "group" ? chatId : fromUserId);
            setTypingUsers((previous) => ({
                ...previous,
                [typingKey]: isTyping,
            }));

            if (typingTimeoutsRef.current[typingKey]) {
                clearTimeout(typingTimeoutsRef.current[typingKey]);
            }

            if (isTyping) {
                typingTimeoutsRef.current[typingKey] = setTimeout(() => {
                    setTypingUsers((previous) => ({
                        ...previous,
                        [typingKey]: false,
                    }));
                }, 2500);
            }
        };

        const handleGroupUpdated = () => {
            refreshSidebarData();
        };

        const handleFriendRequestUpdated = () => {
            refreshSidebarData();
        };

        socket.on("message:new", handleNewMessage);
        socket.on("message:created", handleOwnMessage);
        socket.on("message:status-updated", handleStatusUpdated);
        socket.on("message:updated", handleUpdatedMessage);
        socket.on("message:deleted", handleDeletedMessage);
        socket.on("conversation:typing", handleTyping);
        socket.on("group:updated", handleGroupUpdated);
        socket.on("friend-request:updated", handleFriendRequestUpdated);

        return ()=>{
            socket.off("message:new", handleNewMessage);
            socket.off("message:created", handleOwnMessage);
            socket.off("message:status-updated", handleStatusUpdated);
            socket.off("message:updated", handleUpdatedMessage);
            socket.off("message:deleted", handleDeletedMessage);
            socket.off("conversation:typing", handleTyping);
            socket.off("group:updated", handleGroupUpdated);
            socket.off("friend-request:updated", handleFriendRequestUpdated);
        };
    },[socket, selectedChat, authUser])

    const value = {
        messages,
        users,
        groups,
        friends,
        friendRequests,
        friendSuggestions,
        selectedChat,
        selectedUser: selectedChat,
        unseenMessages,
        typingUsers,
        pagination,
        refreshSidebarData,
        getMessages,
        loadOlderMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        sendTypingState,
        setSelectedUser: selectChat,
        setSelectedChat: selectChat,
        setUnseenMessages,
        markConversationAsRead,
        sendFriendRequest,
        respondToFriendRequest,
        createGroup,
        joinGroupByLink,
    }

    return (
        <ChatContext.Provider value={value}>
            { children }
        </ChatContext.Provider>
    )
}
