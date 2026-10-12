import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout";
import GuidelineList from "./pages/GuidelineList";
import Wizard from "./pages/Wizard";
import Report from "./pages/Report";
import ActionTracker from "./pages/ActionTracker";
import AdminUpload from "./pages/AdminUpload";
import AdminUsers from "./pages/AdminUsers";
import Login from "./pages/Login";
import MagicAccess from "./pages/MagicAccess";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")) || null);

  const handleLogin = (newToken, newUser) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const isAccessRoute = window.location.pathname.startsWith('/access');

  if (!token && !isAccessRoute) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/access" element={<MagicAccess onLogin={handleLogin} />} />
        
        <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
          <Route index element={<GuidelineList />} />
          <Route path="wizard/:guidelineId" element={<Wizard />} />
          <Route path="report/:guidelineId" element={<Report />} />
          <Route path="report" element={<Report />} />
          <Route path="tracker" element={<ActionTracker />} />
          <Route path="admin/upload" element={<AdminUpload />} />
          <Route path="admin/users" element={<AdminUsers />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
