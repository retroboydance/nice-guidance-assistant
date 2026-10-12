import { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  ClipboardCheck, 
  Mail, 
  Copy, 
  Check, 
  ExternalLink, 
  Trash2, 
  KeyRound, 
  Shield, 
  X, 
  CheckCircle, 
  AlertTriangle 
} from "lucide-react";

export default function AdminUsers() {
  const [activeTab, setActiveTab] = useState("users"); // "users" or "assignments"
  const [users, setUsers] = useState([]);
  const [guidelines, setGuidelines] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals & form state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(null); // User object
  const [newPassword, setNewPassword] = useState("");
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "reviewer", password: "" });
  
  // Assignment form state
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedGuideline, setSelectedGuideline] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [assignmentResult, setAssignmentResult] = useState(null);

  const [copiedId, setCopiedId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  const fetchData = async () => {
    try {
      const [usersRes, guidelinesRes, assignmentsRes] = await Promise.all([
        fetch("http://localhost:8000/api/admin/users"),
        fetch("http://localhost:8000/api/guidelines"),
        fetch("http://localhost:8000/api/admin/assignments")
      ]);

      const [usersData, guidelinesData, assignmentsData] = await Promise.all([
        usersRes.json(),
        guidelinesRes.json(),
        assignmentsRes.json()
      ]);

      setUsers(Array.isArray(usersData) ? usersData : []);
      setGuidelines(Array.isArray(guidelinesData) ? guidelinesData : []);
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
      setLoading(false);
    } catch (err) {
      console.error("Error loading admin data:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showNotification = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // 1. ADD USER
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8000/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create user.");

      showNotification("success", `User ${data.name} created successfully.`);
      setShowAddUserModal(false);
      setNewUser({ name: "", email: "", role: "reviewer", password: "" });
      fetchData();
    } catch (err) {
      showNotification("error", err.message);
    }
  };

  // 2. DELETE USER
  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to delete ${user.name}? This will also delete their assignments.`)) {
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/api/admin/users/${user.id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete user.");
      showNotification("success", `User ${user.name} removed.`);
      fetchData();
    } catch (err) {
      showNotification("error", err.message);
    }
  };

  // 3. RESET PASSWORD
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!showResetModal || !newPassword) return;

    try {
      const res = await fetch(`http://localhost:8000/api/admin/users/${showResetModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword })
      });
      if (!res.ok) throw new Error("Failed to reset password.");
      showNotification("success", `Password updated for ${showResetModal.name}.`);
      setShowResetModal(null);
      setNewPassword("");
    } catch (err) {
      showNotification("error", err.message);
    }
  };

  // 4. ASSIGN GUIDELINE
  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!selectedUser || !selectedGuideline) return;

    try {
      const res = await fetch("http://localhost:8000/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: parseInt(selectedUser),
          guideline_id: parseInt(selectedGuideline),
          notes: assignmentNotes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create assignment.");

      setAssignmentResult(data);
      setSelectedUser("");
      setSelectedGuideline("");
      setAssignmentNotes("");
      showNotification("success", `Assigned ${data.nice_id} to ${data.user_name}!`);
      fetchData();
    } catch (err) {
      showNotification("error", err.message);
    }
  };

  // 5. DELETE ASSIGNMENT
  const handleDeleteAssignment = async (id) => {
    if (!window.confirm("Are you sure you want to remove this assignment?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/admin/assignments/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to remove assignment.");
      showNotification("success", "Assignment removed.");
      fetchData();
    } catch (err) {
      showNotification("error", err.message);
    }
  };

  const handleCopyLink = (id, link) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return <div className="p-8 text-nhs-dark font-bold text-lg">Loading access management...</div>;
  }

  return (
    <div className="p-8 h-full bg-white overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="mb-8 border-b-4 border-nhs-blue pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-nhs-dark mb-2">Access & Guidance Management</h1>
          <p className="text-lg text-nhs-dark opacity-90">
            Control trust team members, define reviewer roles, and assign NICE guidelines.
          </p>
        </div>

        {feedback && (
          <div className={`px-4 py-2 border-l-4 font-bold text-sm flex items-center gap-2 ${
            feedback.type === 'success' 
              ? 'bg-green-50 border-nhs-green text-green-800' 
              : 'bg-red-50 border-nhs-red text-nhs-red'
          }`}>
            {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            {feedback.message}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-nhs-pale mb-8 gap-4">
        <button
          onClick={() => setActiveTab("users")}
          className={`pb-3 px-6 text-lg font-bold border-b-4 transition-colors flex items-center gap-2 ${
            activeTab === "users"
              ? "border-nhs-blue text-nhs-blue"
              : "border-transparent text-gray-500 hover:text-nhs-dark"
          }`}
        >
          <Users size={20} />
          Team Members & Reviewers ({users.length})
        </button>

        <button
          onClick={() => setActiveTab("assignments")}
          className={`pb-3 px-6 text-lg font-bold border-b-4 transition-colors flex items-center gap-2 ${
            activeTab === "assignments"
              ? "border-nhs-blue text-nhs-blue"
              : "border-transparent text-gray-500 hover:text-nhs-dark"
          }`}
        >
          <ClipboardCheck size={20} />
          Guidance Assignments ({assignments.length})
        </button>
      </div>

      {/* TAB 1: USERS LIST & MANAGEMENT */}
      {activeTab === "users" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-nhs-dark">Trust User Directory</h2>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="btn-nhs-primary flex items-center gap-2"
            >
              <UserPlus size={18} />
              Add New User
            </button>
          </div>

          <div className="bg-white border-2 border-nhs-pale shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-nhs-dark">
              <thead className="bg-nhs-pale border-b-4 border-nhs-dark-blue uppercase text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">NHS Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Assigned Guidance</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold">{u.name}</td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase rounded-full ${
                        u.role === 'admin' 
                          ? 'bg-blue-100 text-nhs-blue border border-nhs-blue' 
                          : 'bg-green-100 text-nhs-green border border-nhs-green'
                      }`}>
                        <Shield size={12} />
                        {u.role === 'admin' ? 'Administrator' : 'Reviewer'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-nhs-blue">
                      {u.assignment_count} {u.assignment_count === 1 ? 'Guideline' : 'Guidelines'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => { setShowResetModal(u); setNewPassword(""); }}
                        title="Reset Password/PIN"
                        className="p-2 text-gray-600 hover:text-nhs-blue hover:bg-gray-100 rounded"
                      >
                        <KeyRound size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        title="Delete User"
                        className="p-2 text-gray-600 hover:text-nhs-red hover:bg-red-50 rounded"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GUIDANCE ASSIGNMENTS */}
      {activeTab === "assignments" && (
        <div className="space-y-10">
          {/* Assignment Creation Form */}
          <div className="bg-nhs-pale p-8 border-l-8 border-nhs-blue shadow-sm max-w-4xl">
            <h2 className="text-2xl font-bold text-nhs-dark mb-2">Assign Guidance to Reviewer</h2>
            <p className="text-gray-600 text-sm mb-6 font-medium">
              Pair a clinician with a specific guideline to track their review status and auto-generate their one-click access link.
            </p>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-nhs-dark mb-2">Reviewer</label>
                  <select
                    value={selectedUser}
                    onChange={e => setSelectedUser(e.target.value)}
                    required
                    className="w-full border-2 border-gray-300 p-3 bg-white font-medium outline-none focus:border-nhs-blue focus:ring-2 focus:ring-nhs-yellow"
                  >
                    <option value="">-- Select Reviewer --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-nhs-dark mb-2">Guideline</label>
                  <select
                    value={selectedGuideline}
                    onChange={e => setSelectedGuideline(e.target.value)}
                    required
                    className="w-full border-2 border-gray-300 p-3 bg-white font-medium outline-none focus:border-nhs-blue focus:ring-2 focus:ring-nhs-yellow"
                  >
                    <option value="">-- Select Guideline --</option>
                    {guidelines.map(g => (
                      <option key={g.id} value={g.id}>{g.nice_id}: {g.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-nhs-dark mb-2">Instructions / Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Please complete sections 1.1 - 1.4 ahead of Governance Committee"
                  value={assignmentNotes}
                  onChange={e => setAssignmentNotes(e.target.value)}
                  className="w-full border-2 border-gray-300 p-3 bg-white text-sm outline-none focus:border-nhs-blue"
                />
              </div>

              <div className="pt-2">
                <button type="submit" className="btn-nhs-primary">
                  Assign Guidance & Generate Link
                </button>
              </div>
            </form>

            {/* Freshly Generated Assignment Link Callout */}
            {assignmentResult && (
              <div className="mt-6 bg-white p-6 border-2 border-nhs-green shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2 text-nhs-green font-bold text-lg mb-2">
                  <CheckCircle size={22} />
                  Guideline Assigned: {assignmentResult.nice_id} to {assignmentResult.user_name}
                </div>
                <div className="flex gap-3 mt-4">
                  <input
                    type="text"
                    readOnly
                    value={assignmentResult.magic_link}
                    className="w-full bg-gray-50 border p-2.5 text-xs font-mono select-all"
                  />
                  <button
                    onClick={() => handleCopyLink('new', assignmentResult.magic_link)}
                    className="btn-nhs-secondary whitespace-nowrap text-sm flex items-center gap-1.5"
                  >
                    {copiedId === 'new' ? <Check size={16} /> : <Copy size={16} />}
                    {copiedId === 'new' ? 'Copied' : 'Copy Link'}
                  </button>
                  <a
                    href={`mailto:${encodeURIComponent(assignmentResult.user_email)}?subject=${encodeURIComponent(`NICE Baseline Assessment Assignment: ${assignmentResult.nice_id}`)}&body=${encodeURIComponent(
`Dear ${assignmentResult.user_name},

You have been assigned the baseline assessment for ${assignmentResult.nice_id}: ${assignmentResult.guideline_name}.

You can begin directly using this secure link (no password required):
${assignmentResult.magic_link}

Kind regards,
Clinical Governance Team`
                    )}`}
                    className="btn-nhs-primary whitespace-nowrap text-sm flex items-center gap-1.5"
                  >
                    <ExternalLink size={16} />
                    Open in Outlook
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Table of Active Assignments */}
          <div>
            <h2 className="text-2xl font-bold text-nhs-dark mb-4">Current Guideline Assignments</h2>
            <div className="bg-white border-2 border-nhs-pale shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm text-nhs-dark">
                <thead className="bg-nhs-pale border-b-4 border-nhs-dark-blue uppercase text-xs font-bold">
                  <tr>
                    <th className="px-6 py-4">Reviewer</th>
                    <th className="px-6 py-4">Guideline</th>
                    <th className="px-6 py-4">Assigned On</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Quick Share & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-500 font-medium">
                        No guidelines currently assigned. Use the form above to assign guidance to a reviewer.
                      </td>
                    </tr>
                  ) : assignments.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold">{a.user_name}</div>
                        <div className="text-xs text-gray-500 font-mono">{a.user_email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2 py-0.5 bg-white border border-nhs-blue text-nhs-blue font-bold text-xs rounded mb-1">
                          {a.nice_id}
                        </span>
                        <div className="text-sm font-medium line-clamp-1">{a.guideline_name}</div>
                        {a.notes && <div className="text-xs text-gray-500 italic mt-0.5">Note: {a.notes}</div>}
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs font-medium">
                        {a.assigned_at}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-nhs-blue border border-nhs-blue">
                          {a.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleCopyLink(a.id, a.magic_link)}
                          className="px-3 py-1.5 border border-gray-300 text-xs font-bold hover:bg-gray-100 inline-flex items-center gap-1.5"
                          title="Copy One-Click Link"
                        >
                          {copiedId === a.id ? <Check size={14} className="text-nhs-green" /> : <Copy size={14} />}
                          {copiedId === a.id ? "Copied" : "Copy Link"}
                        </button>
                        <a
                          href={`mailto:${encodeURIComponent(a.user_email)}?subject=${encodeURIComponent(`NICE Baseline Assessment: ${a.nice_id}`)}&body=${encodeURIComponent(
`Dear ${a.user_name},

Reminder to complete the NICE baseline assessment for ${a.nice_id}: ${a.guideline_name}.

Access link: ${a.magic_link}

Kind regards,
Clinical Governance Team`
                          )}`}
                          className="px-3 py-1.5 bg-nhs-pale border border-nhs-blue text-nhs-blue text-xs font-bold hover:bg-blue-50 inline-flex items-center gap-1"
                          title="Email via Outlook"
                        >
                          <ExternalLink size={14} />
                          Outlook
                        </a>
                        <button
                          onClick={() => handleDeleteAssignment(a.id)}
                          className="p-1.5 text-gray-400 hover:text-nhs-red hover:bg-red-50 rounded inline-flex items-center"
                          title="Remove Assignment"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD USER */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-t-8 border-nhs-blue shadow-2xl max-w-md w-full p-8 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowAddUserModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-nhs-dark"
            >
              <X size={24} />
            </button>

            <h3 className="text-2xl font-bold text-nhs-dark mb-1">Add Trust User</h3>
            <p className="text-sm text-gray-500 mb-6 font-medium">Create credentials for a clinician or governance lead.</p>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-nhs-dark mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr Sarah Jenkins"
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full border-2 border-gray-300 p-2.5 outline-none focus:border-nhs-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-nhs-dark mb-1">NHS Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. s.jenkins@lhch.nhs.uk"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full border-2 border-gray-300 p-2.5 outline-none focus:border-nhs-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-nhs-dark mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full border-2 border-gray-300 p-2.5 bg-white outline-none focus:border-nhs-blue font-medium"
                >
                  <option value="reviewer">Reviewer (Can assess & track assigned guidance)</option>
                  <option value="admin">Administrator (Can upload guidance & manage users)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-nhs-dark mb-1">Initial Password / PIN</label>
                <input
                  type="password"
                  placeholder="Defaults to Welcome1! if blank"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full border-2 border-gray-300 p-2.5 outline-none focus:border-nhs-blue"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="btn-nhs-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-nhs-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESET PASSWORD */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-t-8 border-nhs-blue shadow-2xl max-w-sm w-full p-8 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowResetModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-nhs-dark"
            >
              <X size={24} />
            </button>

            <h3 className="text-xl font-bold text-nhs-dark mb-1">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-6 font-medium">For {showResetModal.name}</p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-nhs-dark mb-1">New Password / PIN</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full border-2 border-gray-300 p-2.5 outline-none focus:border-nhs-blue"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowResetModal(null)}
                  className="btn-nhs-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-nhs-primary">
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
