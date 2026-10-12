import { Outlet, Link, useLocation } from "react-router-dom";
import { ClipboardList, LayoutDashboard, ListTodo, Upload, LogOut, Users } from "lucide-react";

export default function Layout({ user, onLogout }) {
  const location = useLocation();

  const isActive = (path) => {
    if (path === "/" && location.pathname !== "/") return false;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navClass = (path) => `
    flex items-center gap-3 px-4 py-3 font-bold text-lg border-b-2 transition-colors
    ${isActive(path) 
      ? "text-nhs-blue bg-white border-nhs-blue" 
      : "text-nhs-dark hover:bg-white hover:text-nhs-blue border-transparent"}
  `;

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar navigation styled with NHS brand elements */}
      <div className="w-72 bg-nhs-pale border-r-4 border-white shadow-md flex flex-col z-20">
        
        {/* NHS Blue Brand Header */}
        <div className="p-6 bg-nhs-blue text-white border-b-8 border-nhs-dark-blue">
          <h1 className="text-2xl font-bold leading-tight">
            Clinical Guidance Assistant
          </h1>
        </div>
        
        <nav className="flex-1 p-0 flex flex-col">
          <Link to="/" className={navClass("/")}>
            <ClipboardList size={22} />
            <span>Assessments</span>
          </Link>
          <Link to="/report" className={navClass("/report")}>
            <LayoutDashboard size={22} />
            <span>Reports</span>
          </Link>
          <Link to="/tracker" className={navClass("/tracker")}>
            <ListTodo size={22} />
            <span>Action Tracker</span>
          </Link>

          <div className="mt-8 border-t-2 border-white">
            <h3 className="px-6 pt-6 pb-2 text-sm font-bold text-nhs-dark uppercase tracking-wide">Administration</h3>
            <Link to="/admin/upload" className={navClass("/admin/upload")}>
              <Upload size={22} />
              <span>Upload Guidelines</span>
            </Link>
            <Link to="/admin/users" className={navClass("/admin/users")}>
              <Users size={22} />
              <span>Manage Access</span>
            </Link>
          </div>
        </nav>
        
        {/* User Profile Area */}
        {user && (
          <div className="mt-auto border-t-4 border-white bg-nhs-pale p-6">
            <div className="text-sm font-bold text-nhs-dark">{user.name}</div>
            <div className="text-xs font-medium text-gray-500 mb-4">{user.email}</div>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 text-nhs-red font-bold hover:text-red-800 transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white">
        <Outlet />
      </div>
    </div>
  );
}
