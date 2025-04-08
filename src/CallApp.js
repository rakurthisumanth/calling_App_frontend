import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import './CallApp.css'; // Import the CSS file

const socket = io('https://callingappbackend-production.up.railway.app');

const CallApp = () => {
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pcRef = useRef(null);
  const [otherUserId, setOtherUserId] = useState('');
  const [myId, setMyId] = useState('');

  useEffect(() => {
    socket.on('connect', () => {
      setMyId(socket.id);
    });
  
    socket.on('call-made', async ({ offer, from }) => {
      if (!pcRef.current) {
        const pc = createPeerConnection(from);
        pcRef.current = pc;
  
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localAudioRef.current.srcObject = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      }
  
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      socket.emit('make-answer', { answer: pcRef.current.localDescription, to: from });
    });
  
    socket.on('answer-made', async ({ answer }) => {
      // Only set remote description if it's not already set
      if (!pcRef.current.currentRemoteDescription) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });
  
    socket.on('ice-candidate', async ({ candidate }) => {
      if (candidate && pcRef.current) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });
  }, []);
  

  const createPeerConnection = (toId) => {
    const pc = new RTCPeerConnection();
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('ice-candidate', { candidate: e.candidate, to: toId });
      }
    };
    pc.ontrack = (e) => {
      remoteAudioRef.current.srcObject = e.streams[0];
    };
    pcRef.current = pc;
    return pc;
  };

  const startCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localAudioRef.current.srcObject = stream;
    const pc = createPeerConnection(otherUserId);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('call-user', { offer, to: otherUserId });
  };

  return (
    <div className="call-container">
      <h2 className="my-id">My ID: <span>{myId}</span></h2>
      <input
        className="input-id"
        type="text"
        placeholder="Enter user ID to call"
        value={otherUserId}
        onChange={(e) => setOtherUserId(e.target.value)}
      />
      <button className="call-button" onClick={startCall}>
        📞 Call
      </button>
      <div className="audio-players">
        <audio ref={localAudioRef} autoPlay muted />
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    </div>
  );
};

export default CallApp;
