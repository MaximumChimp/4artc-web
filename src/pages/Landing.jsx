import { useState } from "react";
import { auth,db} from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const [showModal, setShowModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const navigate = useNavigate();
  const provider = new GoogleAuthProvider();

  const handleGoogleLogin = async () => {
  setError("");
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if user doc exists, if not create it
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      await setDoc(userDocRef, {
        displayName: user.displayName || "",
        email: user.email,
        photoURL: user.photoURL || "",
        studyHours: 0,
        active: true,
        createdAt: new Date(),
      });
    }

    navigate("/dashboard");
  } catch (err) {
    if (err.code !== "auth/popup-closed-by-user") setError(err.message);
  }
};
const handleSubmit = async () => {
  setError("");
  setLoading(true);
  try {
    let userCredential;
    if (isLogin) {
      // LOGIN
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    } else {
      // SIGN UP
      if (!firstName.trim() || !lastName.trim()) {
        setError("Please provide your first and last name.");
        setLoading(false);
        return;
      }

      userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Create Firestore user doc with first & last name
      const userDocRef = doc(db, "users", userCredential.user.uid);
      await setDoc(userDocRef, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        email: userCredential.user.email,
        photoURL: "",
        studyHours: 0,
        active: true,
        createdAt: new Date(),
      });
    }
    navigate("/dashboard");
  } catch (err) {
    setError(err.message);
  }
  setLoading(false);
};


  return (
    <div className="page">

      {/* HEADER */}
      <header className="header">
        <div className="logo">4ARTC</div>

        <nav className={`nav ${menuOpen ? "open" : ""}`}>
          <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>

          {/* Mobile Auth Buttons */}
          <div className="mobile-auth">
            <button onClick={() => {setIsLogin(true); setShowModal(true); setMenuOpen(false);}}>
              Login
            </button>
            <button onClick={() => {setIsLogin(false); setShowModal(true); setMenuOpen(false);}}>
              Sign Up
            </button>
          </div>
        </nav>

        <div className="auth-buttons">
          <button className="login-btn" onClick={() => {setIsLogin(true); setShowModal(true);}}>
            Login
          </button>
          <button className="signup-btn" onClick={() => {setIsLogin(false); setShowModal(true);}}>
            Sign Up
          </button>
        </div>

        <div className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          ☰
        </div>
      </header>

      {/* HERO */}
      <section className="hero" id="home">
        <div className="hero-text">
          <h1>Empowering Student Collaboration</h1>
          <p>
            4ARTC is a modern WebRTC-powered video platform built for students,
            educators, and digital classrooms.
          </p>

          <div className="hero-buttons">
            <button onClick={() => {setIsLogin(false); setShowModal(true);}}>
              Get Started
            </button>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="section">
        <h2>About 4ARTC</h2>
        <p>
          4ARTC enables seamless academic communication using secure WebRTC
          video rooms, Firebase authentication, and cloud infrastructure.
        </p>

        <div className="about-grid">
          <div>
            <h3>Built for Students</h3>
            <p>Simple interface designed for academic collaboration.</p>
          </div>
          <div>
            <h3>Cloud Powered</h3>
            <p>Reliable backend infrastructure for global access.</p>
          </div>
          <div>
            <h3>Secure & Private</h3>
            <p>Authentication & protected meeting rooms.</p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="section dark">
        <h2>Platform Features</h2>
        <div className="features">
          <div className="feature">
            <h3>HD Video Meetings</h3>
            <p>Real-time WebRTC communication.</p>
          </div>
          <div className="feature">
            <h3>Instant Room Creation</h3>
            <p>Create and join meetings instantly.</p>
          </div>
          <div className="feature">
            <h3>Google Authentication</h3>
            <p>Secure login with Firebase Auth.</p>
          </div>
          <div className="feature">
            <h3>Scalable Deployment</h3>
            <p>Optimized for Vercel cloud hosting.</p>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="section">
        <h2>Contact Support</h2>
        <p>Email: support@4artc.com</p>
        <p>Response time: Within 24 hours</p>
      </section>

      {/* STATIC MODAL */}
      {showModal && (
  <div className="modal-overlay">
    <div className="modern-modal">

      <div className="modal-header">
        <h2>{isLogin ? "Welcome Back" : "Create Your Account"}</h2>
        <span className="close-btn" onClick={() => setShowModal(false)}>×</span>
      </div>

      {!isLogin && (
        <>
          <div className="input-group">
            <input
              type="text"
              placeholder=" "
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <label>First Name</label>
          </div>

          <div className="input-group">
            <input
              type="text"
              placeholder=" "
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <label>Last Name</label>
          </div>
        </>
      )}

      <div className="input-group">
        <input
          type="email"
          placeholder=" "
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label>Email</label>
      </div>

      <div className="input-group">
        <input
          type="password"
          placeholder=" "
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label>Password</label>
      </div>

      {error && <div className="error-modern">{error}</div>}

      <button className="primary-btn" onClick={handleSubmit}>
        {loading ? "Processing..." : isLogin ? "Login" : "Sign Up"}
      </button>

      <div className="divider"><span>OR</span></div>

      <button className="google-btn" onClick={handleGoogleLogin}>
        Continue with Google
      </button>

      <p className="switch-modern" onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? "Create an account" : "Already have an account?"}
      </p>

    </div>
  </div>
)}

<style>{`

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Inter', 'Segoe UI', sans-serif;
  scroll-behavior: smooth;
}

body {
  background: #0f172a;
}

/* ===== HEADER ===== */

.header {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 92%;
  max-width: 1200px;
  padding: 14px 30px;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(15px);
  border-radius: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
}

.logo {
  font-weight: 700;
  font-size: 20px;
  background: linear-gradient(90deg,#3b82f6,#8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav {
  display: flex;
  gap: 25px;
  align-items: center;
}

.nav a {
  color: #cbd5e1;
  text-decoration: none;
  font-size: 14px;
  transition: 0.3s ease;
}

.nav a:hover {
  color: white;
}

/* ===== BUTTONS ===== */

.auth-buttons button {
  margin-left: 12px;
  padding: 8px 18px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.login-btn {
  background: transparent;
  color: white;
  border: 1px solid rgba(255,255,255,0.2);
}

.login-btn:hover {
  background: rgba(255,255,255,0.1);
}

.signup-btn {
  background: linear-gradient(90deg,#3b82f6,#8b5cf6);
  color: white;
  box-shadow: 0 5px 20px rgba(59,130,246,0.4);
}

.signup-btn:hover {
  transform: translateY(-2px);
}

/* ===== HERO ===== */

.hero {
  padding: 180px 20px 120px;
  min-height: 100vh;
  background: linear-gradient(-45deg,#0f172a,#1e3a8a,#312e81,#0f172a);
  background-size: 400% 400%;
  animation: gradientMove 12s ease infinite;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

@keyframes gradientMove {
  0% {background-position:0% 50%}
  50% {background-position:100% 50%}
  100% {background-position:0% 50%}
}

.hero h1 {
  font-size: 48px;
  font-weight: 700;
  margin-bottom: 20px;
}

.hero p {
  font-size: 18px;
  color: #cbd5e1;
  max-width: 600px;
  margin: auto;
}

.hero-buttons button {
  margin-top: 35px;
  padding: 14px 32px;
  border-radius: 14px;
  border: none;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(90deg,#3b82f6,#8b5cf6);
  color: white;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(59,130,246,0.5);
  transition: all 0.3s ease;
}

.hero-buttons button:hover {
  transform: translateY(-3px);
}

/* ===== SECTIONS ===== */

.section {
  padding: 120px 20px;
  text-align: center;
}

.section h2 {
  font-size: 34px;
  margin-bottom: 20px;
}

.section p {
  max-width: 700px;
  margin: auto;
  color: #64748b;
}

.dark {
  background: #0f172a;
  color: white;
}

/* ===== CARDS ===== */

.features {
  display: flex;
  flex-wrap: wrap;
  gap: 30px;
  justify-content: center;
  margin-top: 60px;
}

.feature {
  background: white;
  padding: 35px;
  border-radius: 20px;
  width: 260px;
  transition: all 0.3s ease;
  box-shadow: 0 10px 40px rgba(0,0,0,0.05);
}

.feature:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}

.dark .feature {
  background: rgba(30,41,59,0.8);
  color: white;
}

/* ===== MODAL ===== */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15,23,42,0.8);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modern-modal {
  background: white;
  padding: 45px;
  border-radius: 24px;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.3);
  animation: popUp 0.3s ease;
}

@keyframes popUp {
  from { transform: scale(0.9); opacity:0; }
  to { transform: scale(1); opacity:1; }
}

.primary-btn {
  width: 100%;
  padding: 14px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(90deg,#3b82f6,#8b5cf6);
  color: white;
  font-weight: 600;
  margin-bottom: 20px;
  cursor: pointer;
  transition: 0.3s ease;
}

.primary-btn:hover {
  transform: translateY(-2px);
}

/* ===== MODAL INPUTS ===== */

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.close-btn {
  font-size: 22px;
  cursor: pointer;
  color: #64748b;
  transition: 0.2s ease;
}

.close-btn:hover {
  color: #0f172a;
}

.input-group {
  position: relative;
  margin-bottom: 22px;
}

.input-group input {
  width: 100%;
  padding: 16px 14px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  outline: none;
  font-size: 14px;
  transition: 0.3s ease;
  background: #f8fafc;
}

.input-group input:focus {
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}

.input-group label {
  position: absolute;
  top: 50%;
  left: 14px;
  transform: translateY(-50%);
  background: white;
  padding: 0 6px;
  font-size: 13px;
  color: #94a3b8;
  pointer-events: none;
  transition: 0.2s ease;
}

.input-group input:focus + label,
.input-group input:not(:placeholder-shown) + label {
  top: -8px;
  font-size: 11px;
  color: #3b82f6;
}

/* ===== ERROR ===== */

.error-modern {
  background: #fee2e2;
  color: #991b1b;
  padding: 10px;
  border-radius: 12px;
  font-size: 13px;
  margin-bottom: 18px;
}

/* ===== DIVIDER ===== */

.divider {
  position: relative;
  text-align: center;
  margin: 25px 0;
}

.divider span {
  background: white;
  padding: 0 12px;
  position: relative;
  z-index: 1;
  font-size: 12px;
  color: #64748b;
}

.divider:before {
  content: "";
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 1px;
  background: #e2e8f0;
}

/* ===== GOOGLE BUTTON ===== */

.google-btn {
  width: 100%;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  background: white;
  font-weight: 500;
  cursor: pointer;
  transition: 0.3s ease;
}

.google-btn:hover {
  background: #f1f5f9;
}

/* ===== SWITCH TEXT ===== */

.switch-modern {
  text-align: center;
  margin-top: 25px;
  font-size: 14px;
  color: #3b82f6;
  cursor: pointer;
  transition: 0.2s ease;
}

.switch-modern:hover {
  opacity: 0.7;
}

/* ===== MOBILE ===== */

.mobile-auth { display:none; }
.hamburger { display:none; cursor:pointer; }

@media(max-width:768px){

  .hero h1 { font-size:32px; }

  .nav {
    display:${menuOpen ? "flex" : "none"};
    flex-direction:column;
    position:absolute;
    top:80px;
    left:0;
    width:100%;
    padding:30px;
    background:rgba(15,23,42,0.95);
    backdrop-filter: blur(15px);
  }

  .auth-buttons { display:none; }

  .mobile-auth {
    display:flex;
    flex-direction:column;
    gap:15px;
    margin-top:20px;
  }

  .hamburger { display:block; color:white; }

}

`}</style>

    </div>
  );
}