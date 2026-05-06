import React, { useContext, useMemo, useState } from 'react'
import assets from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import { ChatContext } from '../../context/ChatContext'

const Sidebar = () => {
    const {
        users,
        groups,
        selectedChat,
        setSelectedChat,
        unseenMessages,
        friendRequests,
        friendSuggestions,
        sendFriendRequest,
        respondToFriendRequest,
        createGroup,
        joinGroupByLink,
    } = useContext(ChatContext)

    const { logout, onlineUsers, authUser } = useContext(AuthContext)
    const [input, setInput] = useState("")
    const [tab, setTab] = useState("chats")

    const navigate = useNavigate()

    const filteredUsers = useMemo(
        () => users.filter((user) => user.fullName.toLowerCase().includes(input.toLowerCase())),
        [users, input],
    )
    const filteredGroups = useMemo(
        () => groups.filter((group) => group.name.toLowerCase().includes(input.toLowerCase())),
        [groups, input],
    )

    const handleCreateGroup = async () => {
        const name = window.prompt("Group name");
        if (!name) return;

        const description = window.prompt("Group description (optional)") || "";
        const memberMap = users.map((user) => `${user.fullName}:${user._id}`).join(", ");
        const rawMembers = window.prompt(`Invite members by id, comma-separated.\nAvailable: ${memberMap}`) || "";
        const memberIds = rawMembers.split(",").map((value) => value.trim()).filter(Boolean);

        const group = await createGroup({ name, description, memberIds });
        if (group) {
            setSelectedChat({ ...group, chatType: "group" });
            setTab("groups");
        }
    }

    const handleJoinGroup = async () => {
        const inviteToken = window.prompt("Paste the group invite token");
        if (!inviteToken) return;
        await joinGroupByLink(inviteToken.trim());
        setTab("groups");
    }

    const renderChatRow = (item, type = "personal") => {
        const isGroup = type === "group";
        const key = `${type}:${item._id}`;
        const name = isGroup ? item.name : item.fullName;
        const avatar = isGroup ? item.avatar : item.profilePic;
        const subtitle = isGroup
            ? `${item.members?.length || 0} members`
            : onlineUsers.includes(item._id) ? "Online" : "Offline";

        return (
            <div
                onClick={() => setSelectedChat({ ...item, chatType: type })}
                key={key}
                className={`relative flex items-center gap-2 p-2 pl-4 rounded cursor-pointer max-sm:text-sm ${selectedChat?._id === item._id && selectedChat?.chatType === type ? 'bg-[#282142]/50' : ''}`}
            >
                <img src={avatar || assets.avatar_icon} alt="" className='w-[35px] h-[35px] rounded-full object-cover'/>
                <div className='flex flex-col leading-5'>
                    <p>{name}</p>
                    <span className={`text-xs ${isGroup ? "text-sky-300" : onlineUsers.includes(item._id) ? "text-green-400" : "text-neutral-400"}`}>
                        {subtitle}
                    </span>
                </div>
                {(unseenMessages[key] || 0) > 0 && (
                    <p className='absolute top-4 right-4 text-xs h-5 w-5 flex justify-center items-center rounded-full bg-violet-500/50'>
                        {unseenMessages[key]}
                    </p>
                )}
            </div>
        )
    }

    return (
        <div className={`bg-[#8185B2]/10 h-full p-5 rounded-r-xl overflow-y-scroll text-white ${selectedChat ? "max-md:hidden" : ''}`}>
            <div className='pb-5'>
                <div className='flex justify-between items-center'>
                    <img src={assets.logo} alt="logo" className='max-w-40' />
                    <div className="relative py-2 group">
                        <img src={assets.menu_icon} alt="Menu" className='max-h-5 cursor-pointer' />
                        <div className='absolute top-full right-0 z-20 w-36 p-5 rounded-md bg-[#282142] border border-gray-600 text-gray-100 hidden group-hover:block'>
                            <p onClick={()=>navigate('/profile')} className='cursor-pointer text-sm'>Edit Profile</p>
                            <hr className="my-2 border-t border-gray-500" />
                            <p onClick={handleCreateGroup} className='cursor-pointer text-sm'>Create Group</p>
                            <p onClick={handleJoinGroup} className='cursor-pointer text-sm mt-2'>Join Group</p>
                            <hr className="my-2 border-t border-gray-500" />
                            <p onClick={()=> logout()} className='cursor-pointer text-sm'>Logout</p>
                        </div>
                    </div>
                </div>

                <div className='bg-[#282142] rounded-full flex items-center gap-2 py-3 px-4 mt-5'>
                    <img src={assets.search_icon} alt="Search" className='w-3'/>
                    <input
                        onChange={(event)=>setInput(event.target.value)}
                        type="text"
                        className='bg-transparent border-none outline-none text-white text-xs placeholder-[#c8c8c8] flex-1'
                        placeholder='Search chats, groups, friends...'
                    />
                </div>

                <div className='mt-4 grid grid-cols-3 gap-2 text-xs'>
                    {["chats", "groups", "friends"].map((item) => (
                        <button
                            key={item}
                            type="button"
                            onClick={() => setTab(item)}
                            className={`rounded-full px-3 py-2 cursor-pointer ${tab === item ? "bg-violet-500/40" : "bg-white/5"}`}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </div>

            {tab === "chats" && <div className='flex flex-col'>{filteredUsers.map((user) => renderChatRow(user, "personal"))}</div>}

            {tab === "groups" && (
                <div className='flex flex-col gap-3'>
                    <div className='flex gap-2'>
                        <button type="button" onClick={handleCreateGroup} className='flex-1 text-xs rounded-full bg-emerald-500/20 py-2 cursor-pointer'>New Group</button>
                        <button type="button" onClick={handleJoinGroup} className='flex-1 text-xs rounded-full bg-sky-500/20 py-2 cursor-pointer'>Join by Link</button>
                    </div>
                    <div className='flex flex-col'>
                        {filteredGroups.map((group) => renderChatRow(group, "group"))}
                    </div>
                </div>
            )}

            {tab === "friends" && (
                <div className='space-y-5 text-sm'>
                    <div>
                        <p className='text-violet-200 mb-2'>Pending Requests</p>
                        <div className='space-y-2'>
                            {friendRequests.filter((request) => request.status === "pending").map((request) => {
                                const isIncoming = String(request.receiverId._id) === String(authUser?._id);
                                const displayUser = isIncoming ? request.senderId : request.receiverId;

                                return (
                                    <div key={request._id} className='rounded-2xl bg-white/5 p-3'>
                                        <p>{displayUser.fullName}</p>
                                        <p className='text-xs text-gray-400 mt-1'>
                                            {isIncoming ? "Sent you a friend request" : "Request pending"}
                                        </p>
                                        {isIncoming && (
                                            <div className='mt-2 flex gap-2'>
                                                <button type="button" onClick={() => respondToFriendRequest(request._id, "accepted")} className='flex-1 rounded-full bg-emerald-500/20 py-2 text-xs cursor-pointer'>Accept</button>
                                                <button type="button" onClick={() => respondToFriendRequest(request._id, "rejected")} className='flex-1 rounded-full bg-rose-500/20 py-2 text-xs cursor-pointer'>Reject</button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            {friendRequests.filter((request) => request.status === "pending").length === 0 && (
                                <p className='text-xs text-gray-400'>No pending friend requests.</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <p className='text-violet-200 mb-2'>People You May Know</p>
                        <div className='space-y-2'>
                            {friendSuggestions
                                .filter((user) => user.fullName.toLowerCase().includes(input.toLowerCase()))
                                .map((user) => (
                                    <div key={user._id} className='rounded-2xl bg-white/5 p-3 flex items-center justify-between gap-2'>
                                        <div>
                                            <p>{user.fullName}</p>
                                            <p className='text-xs text-gray-400'>{user.bio}</p>
                                        </div>
                                        <button type="button" onClick={() => sendFriendRequest(user._id)} className='rounded-full bg-violet-500/30 px-3 py-2 text-xs cursor-pointer'>
                                            Add
                                        </button>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Sidebar
