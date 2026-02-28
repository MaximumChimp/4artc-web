import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db, rtdb } from "../firebase";
import { FiSidebar, FiSend, FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneMissed } from "react-icons/fi";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayRemove,
} from "firebase/firestore";
import { ref, set, onDisconnect, onValue } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

export default function Space() {
  const { spaceId } = useParams();
  const navigate = useNavigate();

  const [userProfile, setUserProfile] = useState(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [remoteUsers, setRemoteUsers] = useState([]);

  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const chatEndRef = useRef(null);
  const joinTimeRef = useRef(Date.now());

  const pcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:your-turn-server.com",
      username: "user",
      credential: "pass"
    }
  ]
};
  const spaceRef = doc(db, "spaces", spaceId);

  // --- 1. CHAT MESSAGE LISTENER (RESTORED) ---
  useEffect(() => {
    if (!spaceId) return;
    const q = query(collection(db, `spaces/${spaceId}/messages`), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsubscribe();
  }, [spaceId]);

  // --- 2. BROADCAST MUTE STATUS TO RTDB ---
  useEffect(() => {
    if (!spaceId || !userProfile || !auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const myPresenceRef = ref(rtdb, `spaces/${spaceId}/presence/${myId}`);

    const userPresenceData = {
  id: myId,
  name: userProfile.displayName || "Anonymous",
  color: userProfile.color || "#6366f1",
  photoURL: userProfile.photoURL || null,
  joinedAt: joinTimeRef.current,
  muted: isMuted,
  camOff: isCamOff, // 👈 ADD THIS
};

    set(myPresenceRef, userPresenceData);
    onDisconnect(myPresenceRef).remove();
}, [spaceId, userProfile, isMuted, isCamOff]);

  // --- 3. GHOST REMOVAL ---
  useEffect(() => {
    if (!spaceId) return;
    const roomPresenceRef = ref(rtdb, `spaces/${spaceId}/presence`);
    const unsubscribePresence = onValue(roomPresenceRef, async (snapshot) => {
      const activeData = snapshot.val() || {};
      const activeIds = Object.keys(activeData);
      const spaceSnap = await getDoc(spaceRef);
      if (spaceSnap.exists()) {
        const firestoreUsers = spaceSnap.data().users || [];
        const ghosts = firestoreUsers.filter(u => 
          !activeIds.includes(u.id) && u.id !== auth.currentUser?.uid
        );
        for (const ghost of ghosts) {
          await updateDoc(spaceRef, { users: arrayRemove(ghost) });
        }
      }
    });
    return () => unsubscribePresence();
  }, [spaceId]);

  const leaveSpace = async () => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    try {
      const spaceSnap = await getDoc(spaceRef);
      if (spaceSnap.exists()) {
        const currentUsers = spaceSnap.data().users || [];
        const myUserObject = currentUsers.find(u => u.id === myId);
        if (myUserObject) await updateDoc(spaceRef, { users: arrayRemove(myUserObject) });
      }
      const myPresenceRef = ref(rtdb, `spaces/${spaceId}/presence/${myId}`);
      await set(myPresenceRef, null);
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peersRef.current).forEach(pc => pc.close());
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      navigate("/dashboard");
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCamOff(!videoTrack.enabled);
      }
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) return;
    try {
      const textToSend = newMessage;
      setNewMessage("");
      await addDoc(collection(db, `spaces/${spaceId}/messages`), {
        text: textToSend,
        senderId: auth.currentUser.uid,
        senderName: userProfile?.displayName ?? "Anonymous",
        senderColor: userProfile?.color ?? "#6366f1",
        timestamp: serverTimestamp(),
      });
    } catch (e) { console.error(e); }
  };

  const startLocalStream = async () => {
    if (localStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (err) {
      alert("Could not access camera/microphone.");
    }
  };

  const setupConnection = async (remoteUser, isCaller) => {
    const remoteUserId = remoteUser.id;
    if (peersRef.current[remoteUserId]) return;

    const pc = new RTCPeerConnection(pcConfig);
    peersRef.current[remoteUserId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    }

    // Remote UI Creation
    let container = document.createElement("div");
    container.id = `container-${remoteUserId}`;
    container.style.cssText = `position: relative; width: 100%; height: 100%; background: #1e293b; overflow: hidden; border-radius: 20px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; border: 3px solid transparent;`;

    const muteIndicator = document.createElement("div");
    muteIndicator.id = `mute-remote-${remoteUserId}`;
    muteIndicator.innerHTML = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" height="18" width="18" xmlns="http://www.w3.org/2000/svg"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
    muteIndicator.style.cssText = `position: absolute; top: 15px; left: 15px; background: #ef4444; padding: 6px; border-radius: 8px; display: none; z-index: 10; color: white;`;

    const remotePresenceRef = ref(rtdb, `spaces/${spaceId}/presence/${remoteUserId}`);
    onValue(remotePresenceRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  // Mute indicator
  muteIndicator.style.display = data.muted ? "flex" : "none";

  // 👇 CAMERA LOGIC
  if (data.camOff) {
    video.style.display = "none";
    avatar.style.display = "flex";
  } else {
    video.style.display = "block";
    avatar.style.display = "none";
  }
});

    const avatar = document.createElement("div");
    avatar.innerText = remoteUser.name?.[0].toUpperCase() || "U";
   avatar.style.cssText = `
  position: absolute;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: ${remoteUser.color || '#6366f1'};
  display: none; /* 👈 hidden until cam off */
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  color: white;
  z-index: 5;
`;
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.style.cssText = `width: 100%; height: 100%; object-fit: cover; z-index: 2; position: relative; border-radius: 20px;`;

    const label = document.createElement("div");
    label.innerText = remoteUser.name || "Guest";
    label.style.cssText = `position: absolute; bottom: 20px; left: 20px; background: rgba(15, 23, 42, 0.7); padding: 6px 14px; border-radius: 8px; font-size: 0.85rem; color: white; z-index: 10;`;

    container.append(avatar, video, label, muteIndicator);
    document.getElementById("remote-videos").appendChild(container);

    pc.ontrack = (e) => { if (video && e.streams[0]) video.srcObject = e.streams[0]; };

    // Signaling logic...
    const signalingBase = `spaces/${spaceId}/signaling`;
    const myCandidatesCol = collection(db, `${signalingBase}/${auth.currentUser.uid}/candidates`);
    const mySessionsCol = collection(db, `${signalingBase}/${auth.currentUser.uid}/sessions`);
    const remoteCandidatesCol = collection(db, `${signalingBase}/${remoteUserId}/candidates`);
    const remoteSessionsCol = collection(db, `${signalingBase}/${remoteUserId}/sessions`);

    pc.onicecandidate = (e) => e.candidate && addDoc(myCandidatesCol, { candidate: e.candidate.toJSON(), to: remoteUserId, timestamp: Date.now() });

    onSnapshot(query(remoteCandidatesCol, where("timestamp", ">", joinTimeRef.current)), (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === "added" && pc.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(change.doc.data().candidate)); } catch (e) {}
        }
      });
    });

    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await addDoc(mySessionsCol, { type: offer.type, sdp: offer.sdp, to: remoteUserId, timestamp: Date.now() });
      onSnapshot(query(remoteSessionsCol, where("timestamp", ">", joinTimeRef.current)), async (snap) => {
        snap.docChanges().forEach(async (change) => {
          const data = change.doc.data();
          if (change.type === "added" && data.to === auth.currentUser.uid && data.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
          }
        });
      });
    } else {
      onSnapshot(query(remoteSessionsCol, where("timestamp", ">", joinTimeRef.current)), async (snap) => {
        snap.docChanges().forEach(async (change) => {
          const data = change.doc.data();
          if (change.type === "added" && data.to === auth.currentUser.uid && data.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await addDoc(mySessionsCol, { type: answer.type, sdp: answer.sdp, to: remoteUserId, timestamp: Date.now() });
          }
        });
      });
    }
  };

  const initWebRTC = async () => {
    await startLocalStream();
    onSnapshot(spaceRef, (snap) => {
      const data = snap.data();
      if (data?.users) {
        const currentRemoteUsers = data.users.filter(u => u.id !== auth.currentUser.uid);
        setRemoteUsers(currentRemoteUsers);
        Object.keys(peersRef.current).forEach(peerId => {
          if (!data.users.find(u => u.id === peerId)) {
            peersRef.current[peerId].close();
            delete peersRef.current[peerId];
            document.getElementById(`container-${peerId}`)?.remove();
          }
        });
        currentRemoteUsers.forEach(user => {
          if (!peersRef.current[user.id]) setupConnection(user, auth.currentUser.uid < user.id);
        });
      }
    });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return navigate("/");
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) setUserProfile(docSnap.data());
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (spaceId && userProfile && auth.currentUser) {
      const enterRoom = async () => {
        const spaceSnap = await getDoc(spaceRef);
        if (spaceSnap.exists()) {
          const currentUsers = spaceSnap.data().users || [];
          if (!currentUsers.some(u => u.id === auth.currentUser.uid)) {
            const myUserData = { id: auth.currentUser.uid, name: userProfile.displayName, color: userProfile.color };
            await updateDoc(spaceRef, { users: [...currentUsers, myUserData] });
          }
        }
        initWebRTC();
      };
      enterRoom();
      return () => leaveSpace();
    }
  }, [spaceId, userProfile]);

  // Button Style Helpers
  const btnStyle = (isActive) => ({
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "1.2rem",
    transition: "all 0.2s",
    background: isActive ? "#ef4444" : "#334155",
    color: "white",
  });

  const endCallStyle = {
    ...btnStyle(true),
    width: "60px",
    height: "60px",
    transform: "translateY(-10px)",
    boxShadow: "0 10px 15px -3px rgba(239, 68, 68, 0.4)"
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#020617", color: "#f8fafc", display: "flex", flexDirection: "column" }}>
      <header style={{ height: "64px", background: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ fontWeight: "800", color: "#6366f1" }}>4ARTC</div>
        <div style={{ cursor: "pointer", width: 38, height: 38, borderRadius: "50%", background: userProfile?.color || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
          {userProfile?.displayName?.[0]}
        </div>
      </header>

      <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* SIDEBAR MESSAGES */}
        {/* SIDEBAR MESSAGES */}
<aside
  style={{
    width: isChatOpen ? "350px" : "60px",
    transition: "width 0.3s ease",
    background: "#0f172a",
    borderRight: "1px solid #1e293b",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  }}
>
  {/* CHAT HEADER */}
  <div
    style={{
      height: "60px",
      borderBottom: isChatOpen ? "1px solid #1e293b" : "none",
      display: "flex",
      alignItems: "center",
      justifyContent: isChatOpen ? "space-between" : "center",
      padding: isChatOpen ? "0 20px" : "0",
      fontWeight: "600",
      fontSize: "1rem",
    }}
  >
    {isChatOpen && <span>Space Chat</span>}

    {/* TOGGLE BUTTON */}
    <button
      onClick={() => setIsChatOpen(!isChatOpen)}
      style={{
        background: "transparent",
        border: "none",
        color: "#94a3b8",
        cursor: "pointer",
        fontSize: "1.3rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "40px",
        height: "40px",
      }}
    >
      <FiSidebar />
    </button>
  </div>

  {/* CHAT CONTENT (ONLY WHEN OPEN) */}
  {isChatOpen && (
    <>
      <div
  style={{
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    scrollbarWidth: "none",        // Firefox
    msOverflowStyle: "none",       // IE/Edge
  }}
  className="hide-scrollbar"
>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf:
                m.senderId === auth.currentUser?.uid
                  ? "flex-end"
                  : "flex-start",
              maxWidth: "80%",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                color: "#94a3b8",
                marginBottom: "4px",
              }}
            >
              {m.senderName}
            </div>
            <div
              style={{
                background:
                  m.senderId === auth.currentUser?.uid
                    ? "#6366f1"
                    : "#1e293b",
                padding: "10px 14px",
                borderRadius: "12px",
                fontSize: "0.9rem",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form
        onSubmit={sendMessage}
        style={{
          padding: "20px",
          borderTop: "1px solid #1e293b",
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            background: "#1e293b",
            border: "none",
            padding: "10px",
            borderRadius: "8px",
            color: "white",
          }}
        />
        <button
          type="submit"
          style={{
            background: "#6366f1",
            border: "none",
            padding: "10px",
            borderRadius: "8px",
            color: "white",
          }}
        >
          <FiSend />
        </button>
      </form>
    </>
  )}
</aside>

        {/* VIDEO AREA */}
        <section style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
          <div id="remote-videos" style={{ display: "grid", gap: "20px", width: "100%", height: "100%", gridTemplateColumns: remoteUsers.length === 0 ? "1fr" : "repeat(auto-fit, minmax(400px, 1fr))" }}></div>
    
          {/* LOCAL PREVIEW */}
          <div style={ remoteUsers.length === 0 ? { position: "absolute", inset: 0 } : { position: "absolute", bottom: "30px", right: "30px", width: "240px", height: "180px", borderRadius: "20px", overflow: "hidden", border: "3px solid #6366f1", zIndex: 10 }}>
            <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: isCamOff ? "none" : "block" }} />
            {isCamOff && <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e293b", color: userProfile?.color, fontSize: "3rem" }}>{userProfile?.displayName?.[0]}</div>}
          </div>

          {/* CONTROLS */}
          <div style={{ position: "absolute", bottom: "30px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "16px", zIndex: 100, background: "rgba(15, 23, 42, 0.8)", padding: "12px 24px", borderRadius: "50px", backdropFilter: "blur(12px)" }}>
            <button style={btnStyle(isMuted)} onClick={toggleMute}>{isMuted ? <FiMicOff /> : <FiMic />}</button>
            <button style={endCallStyle} onClick={leaveSpace}><FiPhoneMissed /></button>
            <button style={btnStyle(isCamOff)} onClick={toggleCamera}>{isCamOff ? <FiVideoOff /> : <FiVideo />}</button>
          
          </div>
        </section>
      </main>
    </div>
  );
}