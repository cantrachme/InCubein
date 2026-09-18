import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Save, Shield, UserPlus, KeyRound } from "lucide-react";
import { toast } from "react-toastify";

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid var(--border-color)",
  fontSize: "0.8rem",
  background: "white",
  color: "var(--text-primary)",
};

const labelStyle = {
  fontSize: "0.68rem",
  fontWeight: 700,
  textTransform: "uppercase",
  color: "var(--text-dim)",
  marginBottom: "4px",
  display: "block",
};

const sectionStyle = {
  fontSize: "0.8rem", fontWeight: 800, color: "var(--text-primary)", margin: 0,
  display: "flex", alignItems: "center", gap: "6px",
};

const emptyBtn = {
  padding: "7px 12px", borderRadius: "8px", border: "1px solid var(--border-color)",
  background: "white", color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
};

const primaryBtn = {
  display: "flex", alignItems: "center", gap: "5px", padding: "7px 13px", borderRadius: "8px",
  border: "none", background: "var(--primary)", color: "white", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
};

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export default function UsersRolesTab() {
  const [features, setFeatures] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedRole, setSelectedRole] = useState(null);
  const [permSet, setPermSet] = useState({});

  const [roleModal, setRoleModal] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: "", description: "" });
  const [editingRole, setEditingRole] = useState(null);

  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ username: "", name: "", password: "", role_id: "", active: true });

  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [f, r, u] = await Promise.all([
        getJson("/api/rbac/features"),
        getJson("/api/rbac/roles"),
        getJson("/api/rbac/users"),
      ]);
      setFeatures(f);
      setRoles(r);
      setUsers(u);
    } catch {
      toast.error("Failed to load RBAC data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const groupedFeatures = features.reduce((acc, f) => {
    (acc[f.section] = acc[f.section] || []).push(f);
    return acc;
  }, {});

  const selectRole = (role) => {
    setSelectedRole(role);
    setPermSet(Object.fromEntries((role.permissions || []).map((p) => [p, true])));
  };

  const togglePerm = (id) => {
    setPermSet((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const savePermissions = async () => {
    const perms = Object.entries(permSet).filter(([, v]) => v).map(([k]) => k);
    setSaving(true);
    try {
      const res = await fetch(`/api/rbac/roles/${selectedRole.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: perms }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Role permissions updated.");
        await reload();
        const r = (await getJson("/api/rbac/roles")).find((x) => x.id === selectedRole.id);
        selectRole(r);
      } else {
        toast.error(data.detail || "Failed to update role.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const openRoleModal = (role = null) => {
    setEditingRole(role);
    setRoleForm(role ? { name: role.name, description: role.description || "" } : { name: "", description: "" });
    setRoleModal(true);
  };

  const submitRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error("Role name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/rbac/roles${editingRole ? `/${editingRole.id}` : ""}`, {
        method: editingRole ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingRole ? { name: roleForm.name, description: roleForm.description } : { ...roleForm, permissions: [] }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setRoleModal(false);
        await reload();
      } else {
        toast.error(data.detail || "Failed to save role.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role) => {
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    try {
      const res = await fetch(`/api/rbac/roles/${role.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        if (selectedRole && selectedRole.id === role.id) setSelectedRole(null);
        await reload();
      } else {
        toast.error(data.detail || "Failed to delete role.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const submitUser = async () => {
    if (!userForm.username.trim()) {
      toast.error("Username is required.");
      return;
    }
    if (userForm.role_id === "") {
      toast.error("Select a role.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/rbac/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setUserModal(false);
        setUserForm({ username: "", name: "", password: "", role_id: "", active: true });
        await reload();
      } else {
        toast.error(data.detail || "Failed to create user.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const updateUserRole = async (user, roleId) => {
    try {
      const res = await fetch(`/api/rbac/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_id: roleId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("User role updated.");
        await reload();
      } else {
        toast.error(data.detail || "Failed to update user.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const toggleUserActive = async (user) => {
    try {
      const res = await fetch(`/api/rbac/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(user.active ? "User deactivated." : "User activated.");
        await reload();
      } else {
        toast.error(data.detail || "Failed to update user.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Delete user "${user.username}"?`)) return;
    try {
      const res = await fetch(`/api/rbac/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        await reload();
      } else {
        toast.error(data.detail || "Failed to delete user.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  if (loading) return <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>Loading users & roles…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-dim)" }}>
          Create roles, assign feature-level access per sidebar item, and manage platform users. Login enforcement is not active yet.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button style={primaryBtn} onClick={() => openRoleModal()}><Plus size={14} /> New Role</button>
          <button style={primaryBtn} onClick={() => setUserModal(true)}><UserPlus size={14} /> New User</button>
        </div>
      </div>

      {/* Roles + permissions */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1rem", alignItems: "start" }}>
        <div>
          <h4 style={sectionStyle}><Shield size={15} /> Roles</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.6rem" }}>
            {roles.map((role) => (
              <div
                key={role.id}
                onClick={() => selectRole(role)}
                style={{
                  padding: "0.7rem 0.85rem", borderRadius: "10px", cursor: "pointer",
                  background: selectedRole && selectedRole.id === role.id ? "var(--primary-light)" : "var(--bg-white, white)",
                  border: `1px solid ${selectedRole && selectedRole.id === role.id ? "var(--primary)" : "var(--border-color)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                  <div>
                    <div style={{ fontSize: "0.83rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {role.name}
                      {role.is_system && <span style={{ fontSize: "0.62rem", marginLeft: "6px", padding: "1px 6px", borderRadius: "99px", background: "#ede9fe", color: "#5b21b6", fontWeight: 700 }}>SYSTEM</span>}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{role.description || (role.permissions || []).length + " features"}</div>
                  </div>
                  {!role.is_system && (
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button style={iconBtn} onClick={() => openRoleModal(role)} title="Edit role"><Pencil size={13} /></button>
                      <button style={{ ...iconBtn, color: "var(--danger)" }} onClick={() => deleteRole(role)} title="Delete role"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {!selectedRole ? (
            <div style={{ padding: "2rem", textAlign: "center", background: "var(--bg-dark)", borderRadius: "10px", border: "1px dashed var(--border-color)", color: "var(--text-dim)", fontSize: "0.82rem" }}>
              Select a role to configure feature-level permissions.
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                <h4 style={sectionStyle}>
                  {selectedRole.name} — Permissions
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, marginLeft: "6px" }}>
                    {Object.values(permSet).filter(Boolean).length} / {features.length} enabled
                  </span>
                </h4>
                <button style={{ ...primaryBtn, background: "#16a34a" }} onClick={savePermissions} disabled={saving}>
                  <Save size={14} /> {saving ? "Saving…" : "Save Permissions"}
                </button>
              </div>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {Object.entries(groupedFeatures).map(([section, feats]) => (
                  <div key={section} style={{ background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "0.7rem 0.85rem" }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.5rem" }}>{section}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.35rem 0.75rem" }}>
                      {feats.map((f) => (
                        <label key={f.id} style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.78rem", color: "var(--text-primary)", cursor: "pointer" }}>
                          <input type="checkbox" checked={!!permSet[f.id]} onChange={() => togglePerm(f.id)} />
                          {f.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Users */}
      <div>
        <h4 style={sectionStyle}><KeyRound size={15} /> Platform Users ({users.length})</h4>
        <div style={{ overflowX: "auto", marginTop: "0.6rem", background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "10px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "0.66rem" }}>Username</th>
                <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "0.66rem" }}>Name</th>
                <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "0.66rem" }}>Role</th>
                <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "0.66rem" }}>Status</th>
                <th style={{ textAlign: "right", padding: "0.6rem 0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "0.66rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-dim)" }}>No users yet. Create the first user.</td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>{u.username}</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-primary)" }}>{u.name}</td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <select
                      style={{ ...inputStyle, padding: "5px 8px", width: "150px", fontSize: "0.72rem" }}
                      value={u.role_id ?? ""}
                      onChange={(e) => updateUserRole(u, e.target.value)}
                    >
                      <option value="">—</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: "99px", background: u.active ? "#d1fae5" : "#fee2e2", color: u.active ? "#065f46" : "#991b1b" }}>
                      {u.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                    <button style={iconBtn} onClick={() => toggleUserActive(u)} title={u.active ? "Disable" : "Enable"}>
                      {u.active ? <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#065f46" }}>Disable</span> : <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#065f46" }}>Enable</span>}
                    </button>
                    <button style={{ ...iconBtn, marginLeft: "4px", color: "var(--danger)" }} onClick={() => deleteUser(u)} title="Delete user">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role modal */}
      {roleModal && (
        <div style={modalOverlay} onClick={() => setRoleModal(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: "0 0 14px", fontSize: "0.9rem", color: "var(--text-primary)" }}>
              {editingRole ? "Edit Role" : "New Role"}
            </h4>
            <div style={{ display: "grid", gap: "10px" }}>
              <div>
                <label style={labelStyle}>Role name *</label>
                <input style={inputStyle} value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} placeholder="e.g. Outreach Analyst" />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: "56px", resize: "vertical" }} value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
              <button style={emptyBtn} onClick={() => setRoleModal(false)}>Cancel</button>
              <button style={primaryBtn} onClick={submitRole} disabled={saving}>{saving ? "Saving…" : "Save Role"}</button>
            </div>
          </div>
        </div>
      )}

      {/* User modal */}
      {userModal && (
        <div style={modalOverlay} onClick={() => setUserModal(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: "0 0 14px", fontSize: "0.9rem", color: "var(--text-primary)" }}>New Platform User</h4>
            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Username *</label>
                  <input style={inputStyle} value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Display name</label>
                  <input style={inputStyle} value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Password *</label>
                <input type="password" style={inputStyle} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Role *</label>
                <select style={inputStyle} value={userForm.role_id} onChange={(e) => setUserForm({ ...userForm, role_id: e.target.value })}>
                  <option value="">— Select role —</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-primary)", cursor: "pointer" }}>
                <input type="checkbox" checked={userForm.active} onChange={(e) => setUserForm({ ...userForm, active: e.target.checked })} />
                Active
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
              <button style={emptyBtn} onClick={() => setUserModal(false)}>Cancel</button>
              <button style={primaryBtn} onClick={submitUser} disabled={saving}>{saving ? "Creating…" : "Create User"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtn = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "5px 8px",
  border: "1px solid var(--border-color)", borderRadius: "7px", background: "white", cursor: "pointer",
};

const modalOverlay = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
  display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
};

const modalBox = {
  background: "white", borderRadius: "14px", padding: "20px", maxWidth: "460px",
  width: "100%", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
};