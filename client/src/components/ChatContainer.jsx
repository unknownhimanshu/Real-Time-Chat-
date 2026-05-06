import React, { useContext, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { AuthContext } from '../../context/AuthContext'
import { CallContext } from '../../context/CallContext'
import { ChatContext } from '../../context/ChatContext'
import assets from '../assets/assets'
import { formatMessageTime, getMessageStatusLabel } from '../lib/utils'

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const ChatContainer = () => {
    const {
        messages,
        selectedChat,
        setSelectedChat,
        sendMessage,
        editMessage,
        deleteMessage,
        loadOlderMessages,
        pagination,
        sendTypingState,
        typingUsers,
    } = useContext(ChatContext)

    const { authUser, onlineUsers } = useContext(AuthContext)
    const { startCall, activeCall } = useContext(CallContext)

    const scrollContainerRef = useRef(null)
    const scrollEndRef = useRef(null)
    const typingTimeoutRef = useRef(null)
    const fileInputRef = useRef(null)

    const [input, setInput] = useState('')

    const chatTypingKey = selectedChat
        ? `${selectedChat.chatType}:${selectedChat._id}`
        : null

    const handleSendMessage = async (event)=>{
        event?.preventDefault?.();
        if(input.trim() === "") return;

        await sendMessage({ text: input.trim() });
        setInput("");
        sendTypingState(false);
    }

    const handleSendFiles = async (event) =>{
        const files = [...(event.target.files || [])];
        if(files.length === 0){
            return;
        }

        const oversizedFile = files.find((file) => file.size > MAX_ATTACHMENT_BYTES);
        if (oversizedFile) {
            toast.error(`${oversizedFile.name} is too large. Max size is 10MB per file.`);
            event.target.value = "";
            return;
        }

        try {
            const attachments = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve({
                    data: reader.result,
                    fileName: file.name,
                    mimeType: file.type,
                    sizeBytes: file.size,
                });
                reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
                reader.readAsDataURL(file);
            })));

            await sendMessage({ attachments });
            event.target.value = "";
            sendTypingState(false);
        } catch (error) {
            toast.error(error.message);
        }
    }

    const handleInputChange = (event) => {
        setInput(event.target.value);
        sendTypingState(true);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            sendTypingState(false);
        }, 1200);
    };

    const handleConversationScroll = async (event) => {
        if (event.currentTarget.scrollTop === 0 && pagination.hasMore && !pagination.isLoadingMore) {
            const currentHeight = event.currentTarget.scrollHeight;
            await loadOlderMessages();
            requestAnimationFrame(() => {
                if (!scrollContainerRef.current) return;
                const nextHeight = scrollContainerRef.current.scrollHeight;
                scrollContainerRef.current.scrollTop = nextHeight - currentHeight;
            });
        }
    };

    const triggerEdit = async (message) => {
        const nextText = window.prompt("Edit message", message.text || "");
        if (nextText === null) return;
        await editMessage(message._id, nextText);
    };

    const triggerDelete = async (message, scope) => {
        await deleteMessage(message._id, scope);
    };

    useEffect(()=>{
        if(scrollEndRef.current && messages.length > 0){
            scrollEndRef.current.scrollIntoView({ behavior: "smooth"})
        }
    },[messages.length, selectedChat?._id, selectedChat?.chatType])

    const isPartnerTyping = chatTypingKey ? typingUsers[chatTypingKey] : false;
    const activeCallMatchesSelection = selectedChat
        && selectedChat.chatType === "personal"
        && activeCall.partnerUserId === selectedChat._id;

    const selectedChatName = selectedChat?.chatType === "group" ? selectedChat.name : selectedChat?.fullName;
    const selectedChatAvatar = selectedChat?.chatType === "group" ? selectedChat.avatar : selectedChat?.profilePic;

    return selectedChat ? (
        <div className='h-full overflow-hidden relative backdrop-blur-lg'>
            <div className='flex items-center gap-3 py-3 mx-4 border-b border-stone-500'>
                <img src={selectedChatAvatar || assets.avatar_icon} alt="" className="w-8 h-8 rounded-full object-cover"/>
                <div className='flex-1 text-white'>
                    <p className='text-lg flex items-center gap-2'>
                        {selectedChatName}
                        {selectedChat.chatType === "personal" && onlineUsers.includes(selectedChat._id) && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
                    </p>
                    <p className='text-xs text-gray-400 h-4'>
                        {isPartnerTyping
                            ? "Typing..."
                            : selectedChat.chatType === "group"
                                ? `${selectedChat.members?.length || 0} members`
                                : onlineUsers.includes(selectedChat._id) ? "Online" : "Offline"}
                    </p>
                </div>
                {selectedChat.chatType === "personal" && (
                    <>
                        <button
                            type="button"
                            onClick={() => startCall(selectedChat._id, "voice")}
                            className='text-xs text-white border border-white/20 px-3 py-2 rounded-full cursor-pointer'
                        >
                            Voice
                        </button>
                        <button
                            type="button"
                            onClick={() => startCall(selectedChat._id, "video")}
                            className='text-xs text-white border border-white/20 px-3 py-2 rounded-full cursor-pointer'
                        >
                            Video
                        </button>
                    </>
                )}
                <img onClick={()=> setSelectedChat(null)} src={assets.arrow_icon} alt="" className='md:hidden max-w-7 cursor-pointer'/>
                <img src={assets.help_icon} alt="" className='max-md:hidden max-w-5'/>
            </div>

            {activeCallMatchesSelection && (
                <div className='mx-4 mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100'>
                    Call status: {activeCall.phase}
                </div>
            )}

            <div
                ref={scrollContainerRef}
                onScroll={handleConversationScroll}
                className='flex flex-col h-[calc(100%-132px)] overflow-y-scroll p-3 pb-6'
            >
                {pagination.hasMore && (
                    <button
                        type="button"
                        onClick={loadOlderMessages}
                        className='mx-auto mb-3 text-xs text-violet-200 border border-violet-300/20 px-3 py-1 rounded-full cursor-pointer'
                    >
                        {pagination.isLoadingMore ? "Loading..." : "Load older messages"}
                    </button>
                )}

                {messages.map((msg) => {
                    const isOwnMessage = msg.senderId === authUser._id;

                    return (
                        <div key={msg._id} className={`group flex items-end gap-2 justify-end ${!isOwnMessage && 'flex-row-reverse'}`}>
                            <div className={`mb-8 max-w-[260px] ${isOwnMessage ? "text-right" : "text-left"}`}>
                                {msg.text && (
                                    <p className={`p-2 md:text-sm font-light rounded-lg break-all bg-violet-500/30 text-white ${isOwnMessage ? 'rounded-br-none' : 'rounded-bl-none'}`}>
                                        {msg.text}
                                        {msg.editedAt && !msg.deletedForEveryone && <span className='ml-2 text-[10px] text-gray-300'>(edited)</span>}
                                    </p>
                                )}

                                {msg.attachments?.length > 0 && (
                                    <div className='mt-2 space-y-2'>
                                        {msg.attachments.map((attachment, index) => (
                                            <div key={`${msg._id}-attachment-${index}`} className='rounded-xl bg-white/8 p-2'>
                                                {attachment.resourceType === "image" && (
                                                    <img src={attachment.url} alt={attachment.fileName} className='max-w-[230px] rounded-lg' />
                                                )}
                                                {attachment.resourceType === "video" && (
                                                    <video controls src={attachment.url} className='max-w-[230px] rounded-lg' />
                                                )}
                                                {attachment.resourceType === "audio" && (
                                                    <audio controls src={attachment.url} className='max-w-[230px]' />
                                                )}
                                                {attachment.resourceType === "raw" && (
                                                    <a href={attachment.url} target="_blank" rel="noreferrer" className='text-sm text-sky-300 underline break-all'>
                                                        {attachment.fileName || "Download file"}
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {isOwnMessage && (
                                    <div className='mt-1 flex items-center justify-end gap-2 text-[10px] text-gray-400'>
                                        <span>{getMessageStatusLabel(msg.status)}</span>
                                        {!msg.deletedForEveryone && (
                                            <>
                                                <button type="button" onClick={() => triggerEdit(msg)} className='cursor-pointer hover:text-white'>Edit</button>
                                                <button type="button" onClick={() => triggerDelete(msg, "me")} className='cursor-pointer hover:text-white'>Delete Me</button>
                                                {selectedChat.chatType === "personal" && (
                                                    <button type="button" onClick={() => triggerDelete(msg, "everyone")} className='cursor-pointer hover:text-white'>Delete All</button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="text-center text-xs">
                                <img
                                    src={isOwnMessage ? authUser?.profilePic || assets.avatar_icon : selectedChatAvatar || assets.avatar_icon}
                                    alt=""
                                    className='w-7 h-7 rounded-full object-cover'
                                />
                                <p className='text-gray-500'>{formatMessageTime(msg.createdAt)}</p>
                            </div>
                        </div>
                    );
                })}
                <div ref={scrollEndRef}></div>
            </div>

            <div className='absolute bottom-0 left-0 right-0 flex items-center gap-3 p-3'>
                <div className='flex-1 flex items-center bg-gray-100/12 px-3 rounded-full'>
                    <input
                        onChange={handleInputChange}
                        value={input}
                        onKeyDown={(event)=> event.key === "Enter" ? handleSendMessage(event) : null}
                        type="text"
                        placeholder={selectedChat.chatType === "group" ? "Message the group" : "Send a message"}
                        className='flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400 bg-transparent'
                    />
                    <input ref={fileInputRef} onChange={handleSendFiles} type="file" id='attachment' multiple hidden/>
                    <label htmlFor="attachment">
                        <img src={assets.gallery_icon} alt="" className="w-5 mr-2 cursor-pointer"/>
                    </label>
                </div>
                <img onClick={handleSendMessage} src={assets.send_button} alt="" className="w-7 cursor-pointer" />
            </div>
        </div>
    ) : (
        <div className='flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden'>
            <img src={assets.logo_icon} className='max-w-16' alt="" />
            <p className='text-lg font-medium text-white'>Chat anytime, anywhere</p>
            <p className='text-sm text-gray-400'>DM friends, join groups by invite link, edit or delete messages, and share files in one place.</p>
        </div>
    )
}

export default ChatContainer
