import { useState, useRef, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  deleteDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  FiHome,
  FiMessageCircle,
  FiUsers,
  FiBell,
  FiUser,
  FiPlus,
  FiMoreVertical,
} from "react-icons/fi";
import { onAuthStateChanged } from "firebase/auth";

export default function Dashboard() {
  const [userProfile, setUserProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPrivacy, setFilterPrivacy] = useState("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [kebabOpenId, setKebabOpenId] = useState(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [spaces, setSpaces] = useState([]);
  const [newSpaceTitle, setNewSpaceTitle] = useState("");
  const [newSpacePrivacy, setNewSpacePrivacy] = useState("public");
  const [newSpacePassword, setNewSpacePassword] = useState("");
  const [newSpaceOpenMic, setNewSpaceOpenMic] = useState(true);
  const [newSpaceOpenCam, setNewSpaceOpenCam] = useState(true);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const mockFriends = [
    { id: "1", name: "Alice", active: true },
    { id: "2", name: "Bob", active: false },
    { id: "3", name: "Charlie", active: true },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auth state & user profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        } else {
          const randomColor = getAvatarColor(user.uid);
          const newUser = {
            displayName: user.displayName || "User",
            email: user.email,
            photoURL: user.photoURL || null,
            studyHours: 0,
            active: true,
            color: randomColor,
          };
          await setDoc(docRef, newUser);
          setUserProfile(newUser);
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to spaces in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "spaces"), (snapshot) => {
      const spacesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSpaces(spacesData);
    });
    return () => unsubscribe();
  }, []);

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Create space
  // Create space
const handleCreateSpace = async () => {
  if (!newSpaceTitle.trim()) return alert("Title is required");
  
  // 1. Safety Check: Ensure profile is loaded
  if (!userProfile) {
    return alert("User profile is still loading. Please wait a moment.");
  }

  if (newSpacePrivacy === "private" && !newSpacePassword.trim())
    return alert("Password is required for private spaces");

  try {
    await addDoc(collection(db, "spaces"), {
      title: newSpaceTitle,
      privacy: newSpacePrivacy,
      password: newSpacePrivacy === "private" ? newSpacePassword : null,
      openMic: newSpaceOpenMic,
      openCam: newSpaceOpenCam,
      creatorId: auth.currentUser.uid,
      // 2. Use fallbacks for all profile fields
      users: [
        {
          id: auth.currentUser.uid,
          name: userProfile.displayName || "User",
          photoURL: userProfile.photoURL || null,
          color: userProfile.color || "#3b82f6", // Fallback color
        },
      ],
      createdAt: new Date(),
    });

    // Reset fields...
    setNewSpaceTitle("");
    setNewSpacePassword("");
    setNewSpacePrivacy("public");
    setCreateModalOpen(false);
  } catch (err) {
    console.error("Create space error:", err);
  }
};

  // Join space safely
const handleJoinSpace = async (spaceId) => {
  if (!userProfile) return alert("User profile not loaded yet.");

  const spaceRef = doc(db, "spaces", spaceId);

  try {
    const spaceSnap = await getDoc(spaceRef);
    if (!spaceSnap.exists()) return alert("Space does not exist");

    const spaceData = spaceSnap.data();
    const existingUsers = Array.isArray(spaceData.users) ? spaceData.users : [];
    const userAlreadyIn = existingUsers.some(u => u.id === auth.currentUser.uid);

    if (!userAlreadyIn) {
      // Ensure all fields are defined
      const joinUser = {
        id: auth.currentUser.uid,
        name: userProfile.displayName || "User",
        photoURL: userProfile.photoURL || null,
        color: userProfile.color || "#3b82f6", // fallback if color is undefined
      };

      console.log("Joining user data:", joinUser); // debug

      await updateDoc(spaceRef, {
        users: arrayUnion(joinUser),
      });
    }

    navigate(`/space/${spaceId}`);
  } catch (err) {
    console.error("Join space error:", err);
    alert("Failed to join space. Please try again.");
  }
};
  // Delete space
  const handleDeleteSpace = async (spaceId) => {
    if (!window.confirm("Are you sure you want to delete this space?")) return;
    try {
      await deleteDoc(doc(db, "spaces", spaceId));
      if (kebabOpenId === spaceId) setKebabOpenId(null);
    } catch (err) {
      console.error("Delete space error:", err);
    }
  };

  const filteredSpaces = spaces.filter(
    (space) =>
      space.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (filterPrivacy === "all" || space.privacy === filterPrivacy)
  );

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0].toUpperCase())
      .join("")
      .slice(0, 2);
  };

  const getAvatarColor = (seed) => {
    const colors = [
      "#f87171",
      "#fbbf24",
      "#34d399",
      "#60a5fa",
      "#a78bfa",
      "#f472b6",
      "#fb923c",
    ];
    if (!seed) return colors[Math.floor(Math.random() * colors.length)];
    const index = seed
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  return (
    <div className="dashboard">
      {/* HEADER */}
      <header className="header">
        <div className="logo">4ARTC</div>
        <div className="menu-icons">
          <FiHome className="icon" />
          <FiMessageCircle className="icon" />
          <FiUsers className="icon" />
          <FiBell className="icon" />
          <div className="profile-dropdown" ref={dropdownRef}>
            {userProfile?.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt="Profile"
                className="icon-avatar"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              />
            ) : (
              <div
                className="icon-avatar"
                style={{
                  background: userProfile?.color,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontWeight: "bold",
                  color: "white",
                }}
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              >
                {getInitials(userProfile?.displayName)}
              </div>
            )}

            {profileDropdownOpen && (
              <div
                className="dropdown-content"
                style={{ background: "#3b82f6", color: "white" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="profile-info">
                  <strong>{userProfile?.displayName}</strong>
                  <p>{userProfile?.email}</p>
                  <p>Study Hours/Week: {userProfile?.studyHours || 0}</p>
                  <p>
                    Status:{" "}
                    <span className={userProfile?.active ? "online" : "offline"}>
                      {userProfile?.active ? "Online" : "Offline"}
                    </span>
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  style={{ background: "#2563eb", color: "white" }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {/* LEFT PANEL */}
        <div className="left-panel">
          <div className="profile-card" style={{ background: userProfile?.color }}>
            <div className="avatar" style={{ background: userProfile?.color }}>
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt="Profile" />
              ) : (
                <span>{getInitials(userProfile?.displayName)}</span>
              )}
            </div>
            <h3>{userProfile?.displayName || "User"}</h3>
            <p>
              Status:{" "}
              <span className={userProfile?.active ? "online" : "offline"}>
                {userProfile?.active ? "Online" : "Offline"}
              </span>
            </p>
            <p>Study Hours/Week: {userProfile?.studyHours || 0} hrs</p>
          </div>
        </div>

        {/* CENTER PANEL */}
        <div className="center-panel">
          <div className="filters">
            <button
              className={filterPrivacy === "all" ? "active" : ""}
              onClick={() => setFilterPrivacy("all")}
            >
              All
            </button>
            <button
              className={filterPrivacy === "public" ? "active" : ""}
              onClick={() => setFilterPrivacy("public")}
            >
              Public
            </button>
            <button
              className={filterPrivacy === "private" ? "active" : ""}
              onClick={() => setFilterPrivacy("private")}
            >
              Private
            </button>
          </div>

          <div className="search-bar">
            <input
              type="text"
              placeholder="Search Spaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="create-space-btn">
            <button onClick={() => setCreateModalOpen(true)}>
              <FiPlus /> Create Space
            </button>
          </div>

          {/* CREATE SPACE MODAL */}
          {createModalOpen && (
            <div className="modal-container">
              <div className="modal">
                <h3>Create New Space</h3>
                <input
                  type="text"
                  placeholder="Title"
                  value={newSpaceTitle}
                  onChange={(e) => setNewSpaceTitle(e.target.value)}
                />

                <select
                  value={newSpacePrivacy}
                  onChange={(e) => setNewSpacePrivacy(e.target.value)}
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>

                {newSpacePrivacy === "private" && (
                  <input
                    type="password"
                    placeholder="Password"
                    value={newSpacePassword}
                    onChange={(e) => setNewSpacePassword(e.target.value)}
                  />
                )}

                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={newSpaceOpenMic}
                      onChange={() => setNewSpaceOpenMic(!newSpaceOpenMic)}
                    />{" "}
                    Open Mic
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={newSpaceOpenCam}
                      onChange={() => setNewSpaceOpenCam(!newSpaceOpenCam)}
                    />{" "}
                    Open Cam
                  </label>
                </div>

                <div className="modal-actions">
                  <button className="btn-create" onClick={handleCreateSpace}>
                    Create
                  </button>
                  <button
                    className="btn-cancel"
                    onClick={() => setCreateModalOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SPACES LIST */}
         {/* SPACES LIST */}
<div className="spaces-list">
  {filteredSpaces.map((space) => {
    const currentUserId = auth.currentUser?.uid;

    return (
      <div key={space.id} className="space-card">
        <div className="space-header">
          <h4 title={space.title}>{space.title}</h4>

          {/* Kebab menu only for creator */}
          {space.creatorId === currentUserId && (
            <div className="kebab-menu-wrapper">
              <FiMoreVertical
                className="kebab-icon"
                onClick={() =>
                  setKebabOpenId(kebabOpenId === space.id ? null : space.id)
                }
              />
              {kebabOpenId === space.id && (
                <div className="kebab-dropdown">
                  <button onClick={() => handleDeleteSpace(space.id)}>
                    Delete Space
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Users Avatars */}
        <div className="space-users">
          {space.users?.slice(0, 3).map((u, idx) => (
            <div
              key={u.id}
              className="avatar-small"
              style={{
                zIndex: 3 - idx,
                marginLeft: idx === 0 ? 0 : -12,
                background: u.color || getAvatarColor(u.id),
                color: "white",
              }}
            >
              {u.photoURL ? <img src={u.photoURL} /> : <span>{u.name[0]}</span>}
            </div>
          ))}
          {space.users?.length > 3 && (
            <div className="avatar-small extra" style={{ marginLeft: -12 }}>
              +{space.users.length - 3}
            </div>
          )}
        </div>

        {/* Join Button - always clickable */}
        {currentUserId && (
          <button
            className="join-btn"
            onClick={() => handleJoinSpace(space.id)}
          >
            Join Space
          </button>
        )}
      </div>
    );
  })}
</div>
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel">
          <h4>Active Friends</h4>
          <ul className="friends-list">
            {mockFriends.map((f) => (
              <li key={f.id}>
                <span className={f.active ? "online-dot" : "offline-dot"}></span>
                {f.name}
              </li>
            ))}
          </ul>
        </div>
      </main>

      {/* STYLES */}
     <style>{`
/* GLOBAL */
* { box-sizing:border-box; margin:0; padding:0; font-family:Segoe UI; }

/* HEADER */
.header {
  position:fixed;
  top:0;
  left:0;
  right:0;
  height:60px;
  background:#0f172a;
  color:white;
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:0 20px;
  z-index:1000;
}
.logo { font-weight:700; font-size:20px; }
.menu-icons { display:flex; gap:20px; align-items:center; }
.menu-icons .icon { font-size:22px; cursor:pointer; color:#cbd5e1; }

/* PROFILE DROPDOWN */
.profile-dropdown { position:relative; }
.dropdown-content {
  flex-direction:column;
  position:absolute;
  top:40px;
  right:0;
  background:white;
  color:black;
  border-radius:8px;
  box-shadow:0 4px 12px rgba(0,0,0,0.2);
  overflow:hidden;
}
.dropdown-content button {
  padding:10px 15px;
  background:none;
  border:none;
  cursor:pointer;
  text-align:left;
}
.dropdown-content button:hover { background:#f3f4f6; }

/* MAIN LAYOUT */
.main-content { display:flex; gap:20px; margin-top:60px; padding:20px; }
.left-panel, .right-panel { width:200px; }
.center-panel { flex:1; display:flex; flex-direction:column; gap:15px; }

/* PROFILE CARD */
.profile-card {
  background:#1e293b;
  color:white;
  padding:20px;
  border-radius:12px;
  text-align:center;
}
.avatar {
  width:80px;        /* bigger circle */
  height:80px;
  border-radius:50%;
  background:#3b82f6;
  display:flex;
  justify-content:center;
  align-items:center;
  margin:0 auto 10px;
  font-weight:bold;
  font-size:28px;
  overflow:hidden;
}
.avatar img { width:100%; height:100%; object-fit:cover; border-radius:50%; }

/* FILTERS & SEARCH */
.filters { display:flex; gap:10px; }
.filters button {
  padding:6px 12px;
  border-radius:8px;
  border:none;
  cursor:pointer;
  background:#e2e8f0;
}
.filters button.active { background:#3b82f6; color:white; }
.search-bar input {
  width:100%;
  padding:10px 12px;
  border-radius:8px;
  border:1px solid #ccc;
}

/* CREATE SPACE BUTTON */
.create-space-btn button {
  margin-top:10px;
  padding:10px 15px;
  border-radius:8px;
  border:none;
  background:#3b82f6;
  color:white;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:5px;
  cursor:pointer;
}

/* SPACES LIST */
.spaces-list {
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(200px,1fr));
  gap:20px;
}
.space-card {
  background:#1e293b;
  color:white;
  border-radius:12px;
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  transition: transform 0.2s, box-shadow 0.2s;
  overflow:hidden;  /* ensure button border-radius works */
}
.space-card:hover {
  transform: translateY(-3px);
  box-shadow:0 10px 25px rgba(0,0,0,0.3);
}
.space-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:10px;
}
.space-header h4 {
  flex:1;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  margin-right:10px;
}

/* KEBAB MENU */
.kebab-menu-wrapper { position:relative; }
.kebab-icon { cursor:pointer; }
.kebab-dropdown {
  position:absolute;
  top:20px;
  right:0;
  background:white;
  color:black;
  border-radius:6px;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  min-width:120px;
  box-shadow:0 4px 12px rgba(0,0,0,0.2);
}
.kebab-dropdown button {
  padding:8px 12px;
  border:none;
  background:none;
  text-align:left;
  cursor:pointer;
}
.kebab-dropdown button:hover { background:#f3f4f6; }

/* SPACE USERS - center avatars with overlap */
.space-users {
  display:flex;
  justify-content:center;   /* center horizontally */
  align-items:center;
  margin:10px 0 0 0;
  position:relative;
}
.avatar-small {
  width:40px;
  height:40px;
  border-radius:50%;
  display:flex;
  justify-content:center;
  align-items:center;
  font-weight:bold;
  font-size:16px;
  border:2px solid #1e293b;
  overflow:hidden;
  background:#3b82f6;
  color:white;
  position:relative;
}

.icon-avatar {
  width: 40px;           /* set the size you want */
  height: 40px;
  border-radius: 50%;    /* makes it a perfect circle */
  object-fit: cover;     /* ensures the image fills the circle */
  cursor: pointer;       /* optional, makes it clickable */
}
.avatar-small img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
.avatar-small.extra { background:#64748b; }

/* Overlap */
.space-users .avatar-small:not(:first-child) { margin-left:-12px; z-index:1; }
.space-users .avatar-small:first-child { z-index:2; }

/* JOIN BUTTON - full width, no padding/margin, border-radius bottom only */
.join-btn {
  background: #3b82f6;
  border: none;
  color: white;
 width: 100%;
margin: 0;
padding: 12px 0;
border-radius: 0 0 12px 12px;
  cursor: pointer;
  display: block;     /* ensure it fills the container */
  text-align: center; /* center text/icon */
}
.join-btn:hover {
  background: #2563eb;
}

/* FRIENDS LIST */
.right-panel h4 { margin-bottom:10px; }
.friends-list { list-style:none; }
.friends-list li {
  display:flex;
  align-items:center;
  gap:5px;
  margin-bottom:8px;
}
.online-dot, .offline-dot {
  width:10px;
  height:10px;
  border-radius:50%;
  display:inline-block;
}
.online-dot { background:#34d399; }
.offline-dot { background:#f87171; }

/* MODAL */
.modal-container {
  position:fixed;
  inset:0;
  background: rgba(0,0,0,0.25);
  display:flex;
  justify-content:center;
  align-items:center;
  z-index:2000;
}
.modal {
  background:#fff;
  padding:30px;
  border-radius:16px;
  min-width:380px;
  max-width:400px;
  display:flex;
  flex-direction:column;
  gap:15px;
  box-shadow:0 15px 35px rgba(0,0,0,0.3);
}
.modal input,
.modal select {
  padding:12px 14px;
  border-radius:10px;
  border:1px solid #cbd5e1;
  font-size:14px;
  width:100%;
}
.checkbox-group { display:flex; gap:20px; margin-top:10px; }
.checkbox-group label { display:flex; align-items:center; gap:6px; cursor:pointer; font-size:14px; }
.modal-actions { display:flex; justify-content:flex-end; gap:12px; margin-top:10px; }
.btn-create { background:#3b82f6; color:white; border:none; padding:10px 18px; border-radius:10px; cursor:pointer; }
.btn-create:hover { background:#2563eb; }
.btn-cancel { background:#e5e7eb; color:#111827; border:none; padding:10px 18px; border-radius:10px; cursor:pointer; }
.btn-cancel:hover { background:#d1d5db; }

/* RESPONSIVE */
@media(max-width:1024px){
  .main-content { flex-direction:column; }
  .left-panel, .right-panel { width:100%; order:2; }
  .center-panel { order:1; }
}
`}</style>
    </div>
  );
}

