import React, { useContext, useEffect, useRef } from 'react'
import { CallContext } from '../../context/CallContext'
import { ChatContext } from '../../context/ChatContext'
import assets from '../assets/assets'

const CallOverlay = () => {
    const {
        incomingCall,
        activeCall,
        localStream,
        remoteStream,
        acceptCall,
        declineCall,
        endCall,
    } = useContext(CallContext)
    const { users } = useContext(ChatContext)

    const localVideoRef = useRef(null)
    const remoteVideoRef = useRef(null)

    useEffect(() => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream || null
        }
    }, [localStream])

    useEffect(() => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream || null
        }
    }, [remoteStream])

    if (!incomingCall && activeCall.phase === "idle") return null

    const partnerId = incomingCall?.fromUserId || activeCall.partnerUserId
    const partner = users.find((user) => user._id === partnerId)
    const showVideo = (incomingCall?.callType || activeCall.callType) === "video"
    const isIncoming = activeCall.phase === "incoming" && incomingCall

    return (
        <div className='fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4'>
            <div className='w-full max-w-4xl rounded-3xl border border-white/10 bg-[#101827] text-white p-6 shadow-2xl'>
                <div className='flex items-center justify-between gap-4'>
                    <div className='flex items-center gap-3'>
                        <img
                            src={partner?.profilePic || assets.avatar_icon}
                            alt=""
                            className='w-14 h-14 rounded-full'
                        />
                        <div>
                            <p className='text-xl font-semibold'>{partner?.fullName || "Incoming call"}</p>
                            <p className='text-sm text-gray-300'>
                                {isIncoming ? `Incoming ${incomingCall.callType} call` : `Call status: ${activeCall.phase}`}
                            </p>
                        </div>
                    </div>

                    {!isIncoming && (
                        <button
                            type="button"
                            onClick={endCall}
                            className='px-4 py-2 rounded-full bg-red-500/80 cursor-pointer'
                        >
                            End call
                        </button>
                    )}
                </div>

                {showVideo ? (
                    <div className='mt-6 grid gap-4 md:grid-cols-2'>
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className='w-full rounded-2xl bg-black min-h-[220px] object-cover'
                        />
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className='w-full rounded-2xl bg-black min-h-[220px] object-cover'
                        />
                    </div>
                ) : (
                    <div className='mt-6 rounded-2xl bg-white/5 p-8 text-center text-gray-200'>
                        Audio connection is active. Keep this window open while the call is in progress.
                    </div>
                )}

                {isIncoming && (
                    <div className='mt-6 flex items-center justify-end gap-3'>
                        <button
                            type="button"
                            onClick={declineCall}
                            className='px-5 py-2 rounded-full bg-white/10 cursor-pointer'
                        >
                            Decline
                        </button>
                        <button
                            type="button"
                            onClick={acceptCall}
                            className='px-5 py-2 rounded-full bg-emerald-500/80 cursor-pointer'
                        >
                            Accept
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default CallOverlay
