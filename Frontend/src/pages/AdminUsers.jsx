import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { getAllUsers, deleteUser as deleteUserApi, updateUser, createUser } from "../services/authService";

const getId = (u) => u?._id || u?.id;

const getName = (u) => {
  const fullName = u?.name || `${u?.prenom || ""} ${u?.nom || ""}`.trim();
  return fullName || u?.email || "Utilisateur";
};

const getRoleLabel = (role) => {
  const normalized = String(role || "").toLowerCase();
  return normalized === "admin" ? "Admin" : "Utilisateur";
};

// Backend actuel: pas de "status" dans le model => on affiche Actif par défaut
const getStatusLabel = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active" || normalized === "actif") return "Actif";
  if (normalized === "suspended" || normalized === "suspendu") return "Suspendu";
  if (normalized === "inactive" || normalized === "inactif") return "Inactif";
  return "Actif";
};

const roleBadge = (role) => {
  const m = {
    Admin: "bg-green-100 text-green-700 border border-green-200",
    Utilisateur: "bg-gray-100 text-gray-600 border border-gray-200",
  };
  return m[role] || "";
};

const statusDot = (s) => {
  const m = { Actif: "bg-green-500", Inactif: "bg-gray-400", Suspendu: "bg-red-500" };
  return m[s] || "bg-gray-400";
};

const statusText = (s) => {
  const m = { Actif: "text-green-700", Inactif: "text-gray-400", Suspendu: "text-red-500" };
  return m[s] || "text-gray-400";
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("Tous");
  const [openMenu, setOpenMenu] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "Utilisateur" });

  // ✅ Edit modal states
  const [editModal, setEditModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ prenom: "", nom: "", email: "", role: "user" });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getAllUsers();

      // Supporte 2 formats:
      // - backend minimal: renvoie un tableau direct [...]
      // - backend paginé: renvoie { users: [...] }
      const list = Array.isArray(data) ? data : data?.users || [];

      // ✅ IMPORTANT: normaliser auditCount en nombre (évite "0" string / undefined)
      const normalized = list.map((u) => ({
        ...u,
        auditCount: Number(u?.auditCount ?? u?.audits ?? 0) || 0,
      }));

      setUsers(normalized);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || "Impossible de charger les utilisateurs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Fermer le menu quand on clique ailleurs
  useEffect(() => {
    const onDocClick = (e) => {
      const target = e.target;
      if (target?.closest?.("[data-user-menu]")) return;
      setOpenMenu(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return users.filter((u) => {
      const name = getName(u).toLowerCase();
      const email = String(u?.email || "").toLowerCase();

      const role = getRoleLabel(u?.role);
      const matchSearch = !q || name.includes(q) || email.includes(q);
      const matchRole = filterRole === "Tous" || role === filterRole;

      return matchSearch && matchRole;
    });
  }, [users, search, filterRole]);

  const handleCreateUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      setError("Nom et email sont obligatoires.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const parts = newUser.name.trim().split(/\s+/);
      const prenom = parts[0] || "";
      const nom = parts.slice(1).join(" ") || parts[0] || "";

      const created = await createUser({
        nom,
        prenom,
        email: newUser.email.trim(),
        role: newUser.role === "Admin" ? "admin" : "user",
        mdp: "ChangeMe123!",
      });

      const createdUser = created?.user || created;

      const normalizedCreated =
        createdUser && !createdUser._id && createdUser.id ? { ...createdUser, _id: createdUser.id } : createdUser;

      // ✅ auditCount par défaut à 0 côté UI
      const createdWithAudit = normalizedCreated ? { ...normalizedCreated, auditCount: 0 } : null;

      if (createdWithAudit?._id) {
        setUsers((prev) => [createdWithAudit, ...prev]);
      } else {
        await fetchUsers();
      }

      setNewUser({ name: "", email: "", role: "Utilisateur" });
      setShowModal(false);
    } catch (err) {
      console.error("Erreur création utilisateur:", err);
      setError(err?.response?.data?.message || err?.message || "Création utilisateur impossible");
    } finally {
      setCreating(false);
    }
  };

  const deleteUser = async (id) => {
    if (!id) return;
    if (!window.confirm("Supprimer cet utilisateur ?")) return;

    try {
      setBusy(true);
      setError("");

      await deleteUserApi(id);

      // ✅ compare en string (évite ObjectId vs string)
      setUsers((prev) => prev.filter((u) => String(getId(u)) !== String(id)));
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || "Suppression impossible");
    } finally {
      setBusy(false);
      setOpenMenu(null);
    }
  };

  const openEdit = (u) => {
    setError("");
    setEditUser(u);

    const full = getName(u);
    const parts = String(full || "").trim().split(/\s+/);

    setEditForm({
      prenom: u?.prenom ?? parts[0] ?? "",
      nom: u?.nom ?? parts.slice(1).join(" "),
      email: u?.email || "",
      role: String(u?.role || "user").toLowerCase() === "admin" ? "admin" : "user",
    });

    setEditModal(true);
    setOpenMenu(null);
  };

  const submitEdit = async () => {
    if (!editUser) return;
    const id = getId(editUser);
    if (!id) return;

    if (!editForm.email.trim()) {
      setError("Email obligatoire");
      return;
    }

    try {
      setEditing(true);
      setError("");

      const payload = {
        prenom: editForm.prenom.trim(),
        nom: editForm.nom.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
      };

      const updated = await updateUser(id, payload);
      const updatedUser = updated?.user || updated;

      setUsers((prev) =>
        prev.map((u) => (String(getId(u)) === String(id) ? { ...u, ...updatedUser } : u))
      );

      setEditModal(false);
      setEditUser(null);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || "Modification impossible");
    } finally {
      setEditing(false);
    }
  };

  const inputCls =
    "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} comptes enregistrés</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
        >
          <UserPlus size={15} />
          Ajouter
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition"
          />
        </div>

        {["Tous", "Admin", "Utilisateur"].map((r) => (
          <button
            key={r}
            onClick={() => setFilterRole(r)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition ${
              filterRole === r
                ? "bg-green-50 text-green-700 border-green-300 font-medium"
                : "border-gray-200 text-gray-500 hover:text-gray-700 bg-white"
            }`}
          >
            {r}
          </button>
        ))}

        <button
          onClick={fetchUsers}
          disabled={loading || busy}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 bg-white disabled:opacity-60"
        >
          Rafraîchir
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Chargement...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-xs bg-gray-50">
                <th className="text-left px-4 py-3 font-normal">Utilisateur</th>
                <th className="text-left px-4 py-3 font-normal">Rôle</th>
                <th className="text-left px-4 py-3 font-normal">Statut</th>
                <th className="text-left px-4 py-3 font-normal">Audits</th>
                <th className="text-left px-4 py-3 font-normal">Inscrit</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {filtered.map((u) => {
                const id = getId(u);
                const name = getName(u);

                const initials = name
                  .split(" ")
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                const roleLabel = getRoleLabel(u?.role);
                const statusLabel = getStatusLabel(u?.status);

                const joinedDate = u?.createdAt
                  ? new Date(u.createdAt).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
                  : "-";

                // ✅ auditCount normalisé
                const audits = Number(u?.auditCount ?? 0) || 0;

                return (
                  <tr key={id} className="hover:bg-gray-50 transition relative">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-semibold text-green-700 shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="text-gray-900 font-medium text-sm">{name}</p>
                          <p className="text-xs text-gray-400">{u?.email || "-"}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-md ${roleBadge(roleLabel)}`}>{roleLabel}</span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot(statusLabel)}`} />
                        <span className={`text-xs ${statusText(statusLabel)}`}>{statusLabel}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-700 text-sm">{audits}</td>

                    <td className="px-4 py-3 text-gray-400 text-xs">{joinedDate}</td>

                    <td className="px-4 py-3 relative" data-user-menu>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenu(openMenu === id ? null : id);
                        }}
                        className="text-gray-300 hover:text-gray-600 transition p-1 rounded"
                        disabled={busy}
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {openMenu === id && (
                        <div className="absolute right-4 top-10 z-20 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden w-44">
                          <button
                            onClick={() => openEdit(u)}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-gray-600 hover:bg-gray-50 transition"
                            disabled={busy}
                          >
                            <Pencil size={13} />
                            Modifier
                          </button>

                          <button
                            onClick={() => deleteUser(id)}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-red-500 hover:bg-red-50 transition"
                            disabled={busy}
                          >
                            <Trash2 size={13} />
                            Supprimer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">Aucun utilisateur trouvé</div>
        )}
      </div>

      {/* Modal CREATE */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Nouvel utilisateur</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Nom complet</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Ex: Ahmed Ben Ali"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="email@exemple.com"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Rôle</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className={inputCls}
                >
                  <option>Utilisateur</option>
                  <option>Admin</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 text-gray-500 text-sm py-2 rounded-lg hover:bg-gray-50 transition"
              >
                Annuler
              </button>

              <button
                onClick={handleCreateUser}
                disabled={creating}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg transition disabled:opacity-60"
              >
                {creating ? "Création..." : "Créer"}
              </button>
            </div>

            <p className="text-[11px] text-gray-400 mt-3">
              Note: le “statut” (Actif/Suspendu) n’est pas stocké en base actuellement. Si tu veux le supporter, il faut
              ajouter un champ <code>status</code> dans le modèle User + controller.
            </p>
          </div>
        </div>
      )}

      {/* Modal EDIT */}
      {editModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Modifier utilisateur</h2>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Prénom</label>
                  <input
                    type="text"
                    value={editForm.prenom}
                    onChange={(e) => setEditForm({ ...editForm, prenom: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Nom</label>
                  <input
                    type="text"
                    value={editForm.nom}
                    onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Rôle</label>
                <select
                  value={editForm.role === "admin" ? "Admin" : "Utilisateur"}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value === "Admin" ? "admin" : "user" })}
                  className={inputCls}
                >
                  <option>Utilisateur</option>
                  <option>Admin</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setEditModal(false);
                  setEditUser(null);
                }}
                className="flex-1 border border-gray-200 text-gray-500 text-sm py-2 rounded-lg hover:bg-gray-50 transition"
              >
                Annuler
              </button>

              <button
                onClick={submitEdit}
                disabled={editing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg transition disabled:opacity-60"
              >
                {editing ? "Sauvegarde..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}