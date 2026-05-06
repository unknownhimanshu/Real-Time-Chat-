import React, { useContext, useEffect, useState } from 'react'
import assets from '../assets/assets'
import { ChatContext } from '../../context/ChatContext'
import { AuthContext } from '../../context/AuthContext'

const RightSidebar = () => {

    const {selectedChat, messages} = useContext(ChatContext)
    const {logout, onlineUsers} = useContext(AuthContext)
    const [mediaAttachments, setMediaAttachments] = useState([])

    useEffect(()=>{
        setMediaAttachments(
            messages.flatMap((msg) => msg.attachments || []).filter((attachment) => ["image", "video", "audio"].includes(attachment.resourceType))
        )
    },[messages])

  return selectedChat && (
    <div className={`bg-[#8185B2]/10 text-white w-full relative overflow-y-scroll ${selectedChat ? "max-md:hidden" : ""}`}>

        <div className='pt-16 flex flex-col items-center gap-2 text-xs font-light mx-auto'>
            <img src={(selectedChat.chatType === "group" ? selectedChat?.avatar : selectedChat?.profilePic) || assets.avatar_icon} alt=""
            className='w-20 h-20 rounded-full object-cover' />
            <h1 className='px-10 text-xl font-medium mx-auto flex items-center gap-2'>
                {selectedChat.chatType === "personal" && onlineUsers.includes(selectedChat._id) && <p className='w-2 h-2 rounded-full bg-green-500'></p>}
                {selectedChat.chatType === "group" ? selectedChat.name : selectedChat.fullName}
            </h1>
            <p className='px-10 mx-auto'>
                {selectedChat.chatType === "group"
                    ? selectedChat.description || `${selectedChat.members?.length || 0} members`
                    : selectedChat.bio}
            </p>
            {selectedChat.chatType === "group" && (
                <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(selectedChat.inviteToken)}
                    className='mt-2 rounded-full bg-sky-500/20 px-4 py-2 text-xs cursor-pointer'
                >
                    Copy Invite Link
                </button>
            )}
        </div>

        <hr className="border-[#ffffff50] my-4"/>

        <div className="px-5 text-xs">
            <p>Media</p>
            <div className='mt-2 max-h-[200px] overflow-y-scroll grid grid-cols-2 gap-4 opacity-80'>
                {mediaAttachments.map((attachment, index)=>(
                    <div key={index} onClick={()=> window.open(attachment.url)} className='cursor-pointer rounded'>
                        {attachment.resourceType === "image" && <img src={attachment.url} alt="" className='h-full rounded-md'/>}
                        {attachment.resourceType === "video" && <video src={attachment.url} className='h-full rounded-md' />}
                        {attachment.resourceType === "audio" && <div className='rounded-md bg-white/5 p-3 text-center'>Audio</div>}
                    </div>
                ))}
            </div>
        </div>

        <button onClick={()=> logout()} className='absolute bottom-5 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-400 to-violet-600 text-white border-none text-sm font-light py-2 px-20 rounded-full cursor-pointer'>
            Logout
        </button>
    </div>
  )
}

export default RightSidebar
