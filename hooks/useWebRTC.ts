'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { User } from '@/app/lib/types'
import { getPusherClient } from '@/app/lib/pusher-client'

interface UseCallWebRTCProps {
  callId: string
  currentUser: User
  callType: 'audio' | 'video'
  onRemoteStream?: (userId: number, stream: MediaStream) => void
  onRemoteDisconnect?: (userId: number) => void
  initialParticipants?: Array<{
    userId: number
    user: Partial<User> & {
      id: number
      name: string | null
      surname: string | null
      avatar: string | null
    }
  }>
}

export default function useCallWebRTC({
  callId,
  currentUser,
  callType,
  onRemoteStream,
  onRemoteDisconnect,
  initialParticipants = []
}: UseCallWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<number, MediaStream>>(new Map())
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video')
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [participants, setParticipants] = useState<Set<number>>(new Set())

  const peerConnections = useRef<Map<number, RTCPeerConnection>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const pendingIceCandidates = useRef<Map<number, RTCIceCandidateInit[]>>(new Map())
  const pusherRef = useRef<any>(null)

  // refs to store latest handlers to avoid effect dependency churn
  const handlersRef = useRef({
    onRemoteStream,
    onRemoteDisconnect
  })
  handlersRef.current.onRemoteStream = onRemoteStream
  handlersRef.current.onRemoteDisconnect = onRemoteDisconnect

  // init participants once
  useEffect(() => {
    const setInit = new Set<number>()
    setInit.add(currentUser.id)
    initialParticipants.forEach(p => setInit.add(p.userId))
    setParticipants(prev => {
      // avoid state update if identical
      if (prev.size === setInit.size && Array.from(prev).every(x => setInit.has(x))) {
        return prev
      }
      return setInit
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]) // initialParticipants usually stable; if not, pass it explicitly

  // helper: safe add/remove participant (guard against no-op)
  const addParticipant = useCallback((userId: number) => {
    setParticipants(prev => {
      if (prev.has(userId)) return prev
      const next = new Set(prev)
      next.add(userId)
      return next
    })
  }, [])

  const removeParticipant = useCallback((userId: number) => {
    setParticipants(prev => {
      if (!prev.has(userId)) return prev
      const next = new Set(prev)
      next.delete(userId)
      return next
    })
  }, [])

  const participantsArray = useMemo(() => Array.from(participants), [participants])

  // Initialize pusher client once
  useEffect(() => {
    if (!pusherRef.current) {
      pusherRef.current = getPusherClient()
    }
    // cleanup if needed when unmounting whole hook
    return () => {
      // optional: pusherRef.current.disconnect() only if you want to fully teardown
    }
  }, [])

  // set local stream ref when state changes
  useEffect(() => {
    localStreamRef.current = localStream
  }, [localStream])

  // utility to update remoteStreams guarded
  const setRemoteStreamSafely = useCallback((userId: number, stream: MediaStream | null) => {
    setRemoteStreams(prev => {
      const existing = prev.get(userId)
      if (stream === null) {
        if (!prev.has(userId)) return prev
        const next = new Map(prev)
        next.delete(userId)
        return next
      } else {
        if (existing === stream) return prev
        const next = new Map(prev)
        next.set(userId, stream)
        return next
      }
    })
  }, [])

  // stable sendPusherEvent (uses pusherRef)
  const sendPusherEvent = useCallback((channelName: string, eventName: string, data: any) => {
    const p = pusherRef.current
    if (!p) return
    const channel = p.channel(channelName)
    if (!channel) return
    if (channelName.startsWith('private-')) {
      // @ts-ignore
      channel.trigger(`client-${eventName}`, data)
    } else {
      channel.trigger(eventName, data)
    }
  }, [])

  // create peer connection (stable by using refs and not depending on functions that change)
  const createPeerConnection = useCallback((userId: number) => {
    if (peerConnections.current.has(userId)) return peerConnections.current.get(userId)!

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    }

    const pc = new RTCPeerConnection(configuration)

    // attach local tracks if exist
    const local = localStreamRef.current
    if (local) {
      local.getTracks().forEach(track => {
        try {
          pc.addTrack(track, local)
        } catch (err) {
          // some browsers may throw if track is already added; ignore
          console.warn('addTrack error', err)
        }
      })
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const remote = event.streams[0]
        setRemoteStreamSafely(userId, remote)
        const cb = handlersRef.current.onRemoteStream
        if (cb) cb(userId, remote)
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendPusherEvent(`private-user-${userId}`, 'ice-candidate', {
          fromUserId: currentUser.id,
          callId,
          candidate: event.candidate.toJSON(),
          targetUserId: userId
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed') {
        setRemoteStreamSafely(userId, null)
        peerConnections.current.delete(userId)
        const cb = handlersRef.current.onRemoteDisconnect
        if (cb) cb && cb(userId)
      }
    }

    peerConnections.current.set(userId, pc)

    // add pending ICE candidates if any
    const pending = pendingIceCandidates.current.get(userId)
    if (pending && pending.length) {
      pending.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error))
      pendingIceCandidates.current.delete(userId)
    }

    return pc
  }, [callId, currentUser.id, sendPusherEvent, setRemoteStreamSafely])

  const createAndSendOffer = useCallback(async (userId: number) => {
    if (userId === currentUser.id) return
    try {
      const pc = createPeerConnection(userId)
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === 'video' })
      await pc.setLocalDescription(offer)
      sendPusherEvent(`private-user-${userId}`, 'webrtc-offer', {
        fromUserId: currentUser.id,
        callId,
        offer,
        targetUserId: userId
      })
    } catch (err) {
      console.error('createAndSendOffer error', err)
    }
  }, [createPeerConnection, currentUser.id, callId, callType, sendPusherEvent])

  const handleIncomingOffer = useCallback(async (fromUserId: number, offer: RTCSessionDescriptionInit) => {
    try {
      const pc = createPeerConnection(fromUserId)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendPusherEvent(`private-user-${fromUserId}`, 'webrtc-answer', {
        fromUserId: currentUser.id,
        callId,
        answer,
        targetUserId: fromUserId
      })
      addParticipant(fromUserId)
    } catch (err) {
      console.error('handleIncomingOffer error', err)
    }
  }, [createPeerConnection, addParticipant, currentUser.id, callId, sendPusherEvent])

  const handleIncomingAnswer = useCallback(async (fromUserId: number, answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnections.current.get(fromUserId)
      if (!pc) return
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
      addParticipant(fromUserId)
    } catch (err) {
      console.error('handleIncomingAnswer error', err)
    }
  }, [addParticipant])

  const handleIncomingIceCandidate = useCallback(async (fromUserId: number, candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnections.current.get(fromUserId)
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } else {
        const arr = pendingIceCandidates.current.get(fromUserId) ?? []
        arr.push(candidate)
        pendingIceCandidates.current.set(fromUserId, arr)
      }
    } catch (err) {
      console.error('handleIncomingIceCandidate error', err)
    }
  }, [])

  const connectToParticipants = useCallback(async (participantIds: number[]) => {
    for (const userId of participantIds) {
      if (userId === currentUser.id) continue
      await createAndSendOffer(userId)
      addParticipant(userId)
    }
  }, [createAndSendOffer, addParticipant, currentUser.id])

  // Subscribe to Pusher channels. This effect intentionally depends only on callId and currentUser.id
  // to avoid re-subscribes when handler functions change.
  useEffect(() => {
    const p = pusherRef.current
    if (!p || !callId || !currentUser.id) return

    const callChannel = p.subscribe(`call-${callId}`)
    const userChannel = p.subscribe(`private-user-${currentUser.id}`)

    const onOffer = (data: any) => {
      if (data.targetUserId === currentUser.id && data.callId === callId) {
        handleIncomingOffer(data.fromUserId, data.offer)
      }
    }
    const onAnswer = (data: any) => {
      if (data.targetUserId === currentUser.id && data.callId === callId) {
        handleIncomingAnswer(data.fromUserId, data.answer)
      }
    }
    const onIce = (data: any) => {
      if (data.targetUserId === currentUser.id && data.callId === callId) {
        handleIncomingIceCandidate(data.fromUserId, data.candidate)
      }
    }
    const onParticipantJoined = (data: any) => {
      if (data.userId !== currentUser.id && data.callId === callId) {
        addParticipant(data.userId)
        if (localStreamRef.current) {
          // fire-and-forget
          createAndSendOffer(data.userId).catch(console.error)
        }
      }
    }
    const onParticipantLeft = (data: any) => {
      if (data.callId === callId) {
        removeParticipant(data.userId)
        const pc = peerConnections.current.get(data.userId)
        if (pc) {
          pc.close()
          peerConnections.current.delete(data.userId)
        }
        setRemoteStreamSafely(data.userId, null)
      }
    }

    userChannel.bind('client-webrtc-offer', onOffer)
    userChannel.bind('client-webrtc-answer', onAnswer)
    userChannel.bind('client-ice-candidate', onIce)
    callChannel.bind('client-participant-joined', onParticipantJoined)
    callChannel.bind('client-participant-left', onParticipantLeft)

    // announce ourselves once
    try {
      callChannel.trigger('client-participant-joined', {
        userId: currentUser.id,
        callId,
        timestamp: new Date().toISOString()
      })
    } catch (err) {
      // some pusher clients in browser don't allow client events on non-private channels; ignore failures
      console.debug('trigger join may fail in some environments', err)
    }

    return () => {
      try {
        userChannel.unbind('client-webrtc-offer', onOffer)
        userChannel.unbind('client-webrtc-answer', onAnswer)
        userChannel.unbind('client-ice-candidate', onIce)
        callChannel.unbind('client-participant-joined', onParticipantJoined)
        callChannel.unbind('client-participant-left', onParticipantLeft)
        // don't force unsubscribe here — leaving subscription management to pusher client
      } catch (err) {
        console.warn('cleanup error', err)
      }
    }
    // intentionally only on callId/currentUser.id so effect is stable
  }, [callId, currentUser.id, createAndSendOffer, handleIncomingOffer, handleIncomingAnswer, handleIncomingIceCandidate, addParticipant, removeParticipant, setRemoteStreamSafely])

  // Helper function to check media device availability
  const checkMediaDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const hasAudio = devices.some(device => device.kind === 'audioinput')
      const hasVideo = devices.some(device => device.kind === 'videoinput')
      
      return { hasAudio, hasVideo }
    } catch (error) {
      console.error('Error checking media devices:', error)
      return { hasAudio: false, hasVideo: false }
    }
  }, [])

  // initialize local media with enhanced error handling
  const initializeLocalStream = useCallback(async () => {
    try {
      console.log('Initializing local stream for call type:', callType)
      
      // First check if media devices are available
      const devices = await checkMediaDevices()
      
      if (!devices.hasAudio) {
        throw new Error('Микрофон не найден. Проверьте подключение микрофона.')
      }
      
      if (callType === 'video' && !devices.hasVideo) {
        throw new Error('Камера не найдена. Проверьте подключение камеры.')
      }
      
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        },
        video: callType === 'video' ? { 
          width: { ideal: 640, min: 320 }, 
          height: { ideal: 480, min: 240 }, 
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user'
        } : false
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      if (callType === 'audio') {
        stream.getVideoTracks().forEach(t => t.stop())
        setIsVideoEnabled(false)
      }
      
      // Add tracks to existing peer connections if any
      peerConnections.current.forEach(pc => {
        stream.getTracks().forEach(track => {
          const sender = pc.getSenders().find(s => s.track?.kind === track.kind)
          if (sender) {
            sender.replaceTrack(track)
          } else {
            pc.addTrack(track, stream)
          }
        })
      })
      
      setLocalStream(stream)
      localStreamRef.current = stream
      console.log('Local stream initialized successfully')
      return stream
    } catch (err) {
      console.error('media error', err)
      // Provide user-friendly error messages
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          throw new Error('Доступ к камере и микрофону отклонен. Пожалуйста, разрешите доступ и попробуйте снова.')
        } else if (err.name === 'NotFoundError') {
          throw new Error('Камера или микрофон не найдены. Проверьте подключение устройств.')
        } else if (err.name === 'NotReadableError') {
          throw new Error('Не удается получить доступ к камере или микрофону. Возможно, они используются другим приложением.')
        }
      }
      throw new Error('Не удалось получить доступ к камере и микрофону')
    }
  }, [callType, checkMediaDevices])

  const toggleAudio = useCallback(() => {
    const local = localStreamRef.current
    if (!local) return
    const newVal = !isAudioEnabled
    local.getAudioTracks().forEach(t => (t.enabled = newVal))
    setIsAudioEnabled(newVal)
    // broadcast minimal info
    if (pusherRef.current) {
      const ch = pusherRef.current.channel(`call-${callId}`)
      ch?.trigger('client-media-updated', { userId: currentUser.id, isAudioEnabled: newVal, isVideoEnabled })
    }
  }, [callId, currentUser.id, isAudioEnabled, isVideoEnabled])

  const toggleVideo = useCallback(async () => {
    const local = localStreamRef.current
    if (!local || callType !== 'video') return
    const enable = !isVideoEnabled
    if (enable) {
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } })
        const videoTrack = vStream.getVideoTracks()[0]
        const currentVideo = local.getVideoTracks()[0]
        if (currentVideo) {
          local.removeTrack(currentVideo)
          currentVideo.stop()
        }
        local.addTrack(videoTrack)
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          if (sender) sender.replaceTrack(videoTrack)
          else pc.addTrack(videoTrack, local)
        })
        vStream.getAudioTracks().forEach(t => t.stop())
      } catch (err) {
        console.error('enable video error', err)
        return
      }
    } else {
      const cur = local.getVideoTracks()[0]
      if (cur) {
        cur.stop()
        local.removeTrack(cur)
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          if (sender) {
            try { sender.replaceTrack(null as any) } catch {}
          }
        })
      }
    }
    setIsVideoEnabled(enable)
    if (pusherRef.current) {
      const ch = pusherRef.current.channel(`call-${callId}`)
      ch?.trigger('client-media-updated', { userId: currentUser.id, isAudioEnabled, isVideoEnabled: enable })
    }
  }, [callId, callType, currentUser.id, isAudioEnabled, isVideoEnabled])

  const toggleScreenShare = useCallback(async () => {
    if (!localStreamRef.current || callType !== 'video') return
  
    if (!isScreenSharing) {
      try {
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: true
        })
        const screenTrack = screenStream.getVideoTracks()[0]
  
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0]
        if (currentVideoTrack) {
          // убираем камеру
          currentVideoTrack.stop()
          localStreamRef.current.removeTrack(currentVideoTrack)
        }
  
        // заменяем трек у всех peerConnections
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          if (sender) {
            sender.replaceTrack(screenTrack)
          }
        })
  
        // добавляем экран в localStream
        localStreamRef.current.addTrack(screenTrack)
        screenStreamRef.current = screenStream
  
        // если пользователь нажал Stop — возвращаем камеру
        screenTrack.onended = async () => {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: true
          })
          const camTrack = camStream.getVideoTracks()[0]
  
          // удалить трек экрана
          localStreamRef.current!.removeTrack(screenTrack)
          screenTrack.stop()
  
          // добавить камеру обратно
          localStreamRef.current!.addTrack(camTrack)
  
          peerConnections.current.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video')
            if (sender) sender.replaceTrack(camTrack)
          })
  
          setIsScreenSharing(false)
        }
  
        setIsScreenSharing(true)
      } catch (error) {
        console.error('screen share error', error)
      }
    } else {
      // Выключение экранного шаринга
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop())
        screenStreamRef.current = null
      }
      setIsScreenSharing(false)
    }
  }, [callType, isScreenSharing])
  
  

  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop())
      screenStreamRef.current = null
    }
    peerConnections.current.forEach(pc => pc.close())
    peerConnections.current.clear()
    setLocalStream(null)
    setRemoteStreams(new Map())
    setParticipants(new Set())
    setIsAudioEnabled(true)
    setIsVideoEnabled(callType === 'video')
    setIsScreenSharing(false)
    pendingIceCandidates.current.clear()
  }, [callType])

  return {
    localStream,
    remoteStreams,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    participants: participantsArray,
    addParticipant,
    removeParticipant,
    initializeLocalStream,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    connectToParticipants,
    cleanup,
    peerConnections: peerConnections.current,
    retryConnection: async (participantId: number) => {
      try {
        await createAndSendOffer(participantId)
        return true
      } catch (error) {
        console.error('Retry connection failed:', error)
        return false
      }
    }
  }
}
