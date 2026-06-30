import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

// ── Supabase client ───────────────────────────────────────────────────────────
const SUPABASE_URL = "https://ixyxeqkqobwbujwkuliv.supabase.co";
const SUPABASE_KEY = "sb_publishable_2h5IhSluEa9yUOwT3oWrRQ_40JZrf7G";

const storage = {
  get: async (key) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/raspored?id=eq.${encodeURIComponent(key)}&select=data`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
      });
      const rows = await res.json();
      if (rows && rows.length > 0) return { value: JSON.stringify(rows[0].data) };
      return null;
    } catch { return null; }
  },
  set: async (key, value) => {
    try {
      const data = typeof value === "string" ? JSON.parse(value) : value;
      await fetch(`${SUPABASE_URL}/rest/v1/raspored`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({ id: key, data, updated_at: new Date().toISOString() })
      });
      return true;
    } catch { return null; }
  },
};


// ── Initial data ──────────────────────────────────────────────────────────────
const initialWorkers = [
  "Marko", "Mico", "Jurica", "Branko", "Mevludin",
  "Lucija", "Zubčarić", "Dušatić",
  "Frenk", "Anđelić", "Anđelko",
  "Kemec", "Karlovčanin",
  "Sćkomlić", "Danilo", "Olmec", "Horoz", "Bajnak",
  "Badžaj", "Luka", "Antonio", "Louro", "Elmir",
  "Čeljat", "Štefan", "Mladen", "Pjanić",
  "Matija", "Merić", "Dorijan",
  "Pejčan", "Šmit", "Dašić",
  "Mirza", "Adnan", "Darko", "Ivica", "Katija",
];
const initialTrucks    = ["TGS","3349","K48","K27","Suz 1841","Suz 823","Suz 7833","1836 / 2x","PL-MAN","760","K10","1523","Mitsubishi","Master C."];
const initialTrailers  = []; // korisnik dodaje
const initialMachines  = []; // korisnik dodaje

const siteNames = []; // novi dan kreće prazan — inženjer sam dodaje gradilišta
const PERMANENT_SITES = ["Komin", "Fali"]; // uvijek vidljive, uvijek na dnu

const makeEmptySites = () => [
  ...siteNames.map((name, i) => ({ id: `site-${i}`, name, workers: [], trucks: [], trailers: [], machines: [] })),
  ...PERMANENT_SITES.map((name) => ({ id: `permanent-${name}`, name, workers: [], trucks: [], trailers: [], machines: [], permanent: true })),
];

// ── Storage ───────────────────────────────────────────────────────────────────
const dateKey  = (d) => `raspored-day-${d}`;
const BAZA_KEY = `raspored-baza-v2`;
const ACTIVITY_LOG_KEY = `raspored-activity-log`;

// ── Date helpers ──────────────────────────────────────────────────────────────
const fmt   = (d) => d.toISOString().slice(0, 10);
const today = () => fmt(new Date());
const addDays = (dateStr, n) => { const d = new Date(dateStr); d.setDate(d.getDate() + n); return fmt(d); };
const hrDate  = (dateStr) => new Date(dateStr + "T12:00:00").toLocaleDateString("hr-HR", { weekday: "long", day: "numeric", month: "numeric", year: "numeric" });

// ── Category config ───────────────────────────────────────────────────────────
const DEFAULT_CATS = [
  { key: "workers",  label: "Radnici",   icon: "👷", color: "#3b82f6", bg: "#eff6ff", border: "#3b82f6" },
  { key: "trucks",   label: "Kamioni",   icon: "🚛", color: "#f97316", bg: "#fff7ed", border: "#f97316" },
  { key: "trailers", label: "Prikolice", icon: "🚜", color: "#8b5cf6", bg: "#f5f3ff", border: "#8b5cf6" },
  { key: "machines", label: "Strojevi",  icon: "⚙️", color: "#059669", bg: "#ecfdf5", border: "#059669" },
];
const CATS_KEY = `raspored-categories`;
// Paleta boja za nove kategorije koje admin doda
const CAT_COLOR_PALETTE = [
  { color: "#3b82f6", bg: "#eff6ff", border: "#3b82f6" },
  { color: "#f97316", bg: "#fff7ed", border: "#f97316" },
  { color: "#8b5cf6", bg: "#f5f3ff", border: "#8b5cf6" },
  { color: "#059669", bg: "#ecfdf5", border: "#059669" },
  { color: "#dc2626", bg: "#fef2f2", border: "#dc2626" },
  { color: "#0891b2", bg: "#ecfeff", border: "#0891b2" },
  { color: "#ca8a04", bg: "#fefce8", border: "#ca8a04" },
  { color: "#db2777", bg: "#fdf2f8", border: "#db2777" },
];

// ── Engineers ─────────────────────────────────────────────────────────────────
const ENGINEERS = [
  { name: "Tomislav", pin: "1001" },
  { name: "Tihomir",  pin: "1002" },
  { name: "Silvije",  pin: "1003" },
  { name: "Igor",     pin: "1004" },
  { name: "Antonio",  pin: "1005" },
  { name: "Damir",    pin: "1006", admin: true },
  { name: "Tin",      pin: "1007", admin: true },
];

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, color, onRemove, warn, draggable, onDragStart, onDragEnd, isDragging }) {
  return (
    <span
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        background: warn ? "#ef4444" : color,
        borderRadius: 6, padding: "2px 8px",
        fontSize: 12, fontWeight: 600, color: "#fff", margin: "2px", whiteSpace: "nowrap",
        cursor: draggable ? "grab" : "default",
        opacity: isDragging ? 0.4 : 1,
      }}>
      {warn && "⚠️ "}{label}
      {onRemove && (
        <button onClick={onRemove} style={{
          background: "none", border: "none", color: "#fff",
          cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2
        }}>×</button>
      )}
    </span>
  );
}

// ── BottomSheet ───────────────────────────────────────────────────────────────
function BottomSheet({ title, options, onAdd, onClose }) {
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const sorted = [...options].sort((a, b) => a.localeCompare(b, "hr", { numeric: true, sensitivity: "base" }));
  const filtered = sorted.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const showAddNew = filtered.length === 0 && search;
  const listLength = showAddNew ? 1 : filtered.length;

  // Reset highlight when search changes
  useEffect(() => { setHighlighted(0); }, [search]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, listLength - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showAddNew) { onAdd(search); onClose(); }
      else if (filtered[highlighted]) { onAdd(filtered[highlighted]); onClose(); }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 1000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: "20px 20px 0 0", width: "100%",
        maxHeight: "70vh", display: "flex", flexDirection: "column", padding: "20px 16px 32px", boxSizing: "border-box"
      }}>
        <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 16px" }} />
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>{title}</h3>
        <input autoFocus placeholder="Traži ili dodaj novo... (↑↓ Enter)" value={search}
          onChange={e => setSearch(e.target.value)} onKeyDown={handleKeyDown}
          style={{ border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 15, marginBottom: 12, outline: "none", width: "100%", boxSizing: "border-box" }} />
        <div style={{ overflowY: "auto", flex: 1 }}>
          {showAddNew && (
            <button onClick={() => { onAdd(search); onClose(); }} style={{
              display: "block", width: "100%", textAlign: "left", padding: "12px 14px",
              border: highlighted === 0 ? "1.5px solid #f97316" : "1.5px dashed #f97316",
              borderRadius: 10, background: highlighted === 0 ? "#fed7aa" : "#fff7ed",
              color: "#f97316", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 6
            }}>+ Dodaj "{search}" kao novo</button>
          )}
          {filtered.map((opt, i) => (
            <button key={opt} onClick={() => { onAdd(opt); onClose(); }}
              onMouseEnter={() => setHighlighted(i)} style={{
              display: "block", width: "100%", textAlign: "left", padding: "12px 14px",
              border: "none", borderBottom: "1px solid #f1f5f9",
              background: highlighted === i ? "#eff6ff" : "none",
              fontSize: 14, cursor: "pointer", color: "#1e293b"
            }}>{opt}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SiteCard ──────────────────────────────────────────────────────────────────
function SiteCard({ site, allSites, allData, duplicateWorkers, onUpdate, onDelete, readOnly, dragItem, onDragStartItem, onDragEndItem, onDropItem, cats }) {
  const [modal, setModal] = useState(null); // cat key or null
  const [dragOverCat, setDragOverCat] = useState(null); // koja kategorija je trenutno "meta" za drop

  const addItem = (cat, val) => {
    if (!site[cat].includes(val)) onUpdate({ ...site, [cat]: [...site[cat], val] });
  };
  const removeItem = (cat, val) => onUpdate({ ...site, [cat]: site[cat].filter(x => x !== val) });

  const hasAny = cats.some(c => site[c.key]?.length > 0);

  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12,
      boxShadow: "0 1px 6px rgba(0,0,0,0.08)", border: "1.5px solid #f1f5f9"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{site.name}</span>
        {!readOnly && !site.permanent && <button onClick={onDelete} style={{ background: "none", border: "none", color: "#cbd5e1", fontSize: 18, cursor: "pointer" }}>🗑</button>}
      </div>

      {cats.filter(cat => !site.permanent || cat.key === "workers").map(cat => {
        const isDropTarget = dragItem && dragItem.cat === cat.key && dragItem.siteId !== site.id;
        const isDragOver = dragOverCat === cat.key;
        return (
          <div
            key={cat.key}
            onDragOver={(e) => { if (isDropTarget) { e.preventDefault(); setDragOverCat(cat.key); } }}
            onDragLeave={() => setDragOverCat(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverCat(null);
              if (isDropTarget) onDropItem(site.id, cat.key);
            }}
            style={{
              marginBottom: 8, borderRadius: 8, transition: "background 0.15s",
              background: isDropTarget && isDragOver ? "#dbeafe" : "transparent",
              outline: isDropTarget && isDragOver ? "2px dashed #3b82f6" : "none",
              padding: isDropTarget ? 4 : 0,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
              {cat.icon} {cat.label}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", minHeight: 28 }}>
              {(site[cat.key] || []).map(val => (
                <Badge key={val} label={val} color={cat.color}
                  warn={cat.key === "workers" && duplicateWorkers.has(val)}
                  onRemove={readOnly ? null : () => removeItem(cat.key, val)}
                  draggable={!readOnly}
                  isDragging={dragItem && dragItem.value === val && dragItem.siteId === site.id && dragItem.cat === cat.key}
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStartItem(site.id, cat.key, val); }}
                  onDragEnd={() => onDragEndItem()}
                />
              ))}
              {!readOnly && (
                <button onClick={() => setModal(cat.key)} style={{
                  background: cat.bg, border: `1.5px dashed ${cat.border}`, borderRadius: 6,
                  color: cat.color, fontSize: 12, fontWeight: 600, padding: "2px 10px", cursor: "pointer", margin: "2px"
                }}>+ {cat.label.slice(0, -1) === "Radnic" ? "Radnik" : cat.label.replace(/i$/, "")}</button>
              )}
            </div>
          </div>
        );
      })}

      {modal && (
        <BottomSheet
          title={`Dodaj ${cats.find(c => c.key === modal)?.label.toLowerCase().replace(/i$/, "")}`}
          options={(allData[modal] || []).filter(v => {
              // Already on THIS site — hide
              if ((site[modal] || []).includes(v)) return false;
              // Already on ANY other site — hide
              const usedElsewhere = allSites.some(s => s.id !== site.id && (s[modal] || []).includes(v));
              if (usedElsewhere) return false;
              return true;
            })}
          onAdd={(val) => addItem(modal, val)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── BazaScreen ────────────────────────────────────────────────────────────────
function BazaScreen({ allData, onUpdate, onBack, cats, isAdmin, onAddCategory, onDeleteCategory }) {
  const [tab, setTab] = useState("workers");
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🔧");
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null);

  const cat = cats.find(c => c.key === tab) || cats[0];
  const items = allData[tab] || [];
  const sortedItems = [...items].sort((a, b) => a.localeCompare(b, "hr", { numeric: true, sensitivity: "base" }));
  const filtered = sortedItems.filter(i => i.toLowerCase().includes(search.toLowerCase()));

  const addItem = () => {
    const name = newName.trim();
    if (!name || items.includes(name)) return;
    const updated = [...items, name].sort((a, b) => a.localeCompare(b, "hr", { numeric: true, sensitivity: "base" }));
    onUpdate(tab, updated);
    setNewName("");
  };

  const deleteItem = (name) => {
    onUpdate(tab, items.filter(i => i !== name));
    setConfirmDelete(null);
  };

  const handleAddCategory = () => {
    const label = newCatLabel.trim();
    if (!label) return;
    onAddCategory(label, newCatIcon.trim() || "🔧");
    setNewCatLabel("");
    setNewCatIcon("🔧");
    setShowAddCat(false);
  };

  const handleDeleteCategory = (key) => {
    onDeleteCategory(key);
    if (tab === key) setTab(cats.find(c => c.key !== key)?.key || "workers");
    setConfirmDeleteCat(null);
  };

  const placeholder = `Naziv stavke (${cat?.label?.toLowerCase()})...`;
  const PROTECTED_KEYS = ["workers", "trucks", "trailers", "machines"]; // ne mogu se brisati

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)", padding: "20px 16px 0", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onBack} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>← Natrag</button>
            <div>
              <div style={{ fontSize: 11, opacity: 0.8, letterSpacing: 1, textTransform: "uppercase" }}>Upravljanje</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Baza podataka</div>
            </div>
          </div>
          {isAdmin && (
            <button onClick={() => setShowAddCat(true)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Izbornik</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 3, overflowX: "auto" }}>
          {cats.map(c => (
            <button key={c.key} onClick={() => { setTab(c.key); setSearch(""); setNewName(""); }} style={{
              flex: "0 0 auto", padding: "8px 12px", border: "none", borderRadius: "8px 8px 0 0",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: tab === c.key ? "#fff" : "rgba(255,255,255,0.15)",
              color: tab === c.key ? "#1e40af" : "#fff"
            }}>{c.icon} {c.label} ({(allData[c.key] || []).length})</button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {isAdmin && !PROTECTED_KEYS.includes(tab) && (
          <button onClick={() => setConfirmDeleteCat(tab)} style={{
            background: "#fef2f2", border: "1.5px solid #fecaca", color: "#dc2626",
            borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 600,
            cursor: "pointer", marginBottom: 12, display: "block"
          }}>🗑️ Obriši cijeli izbornik "{cat?.label}"</button>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input placeholder={placeholder} value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
            style={{ flex: 1, border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", fontSize: 15, outline: "none" }} />
          <button onClick={addItem} style={{ background: "#1e40af", color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>+ Dodaj</button>
        </div>
        <input placeholder="Traži..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 12 }} />

        <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
              {search ? "Nema rezultata." : "Baza je prazna — dodaj prvi unos gore."}
            </div>
          )}
          {filtered.map((item, i) => (
            <div key={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <span style={{ fontSize: 15, color: "#1e293b", fontWeight: 500 }}>{item}</span>
              <button onClick={() => setConfirmDelete(item)} style={{ background: "#fef2f2", border: "none", color: "#ef4444", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Obriši</button>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: "#cbd5e1", marginTop: 12 }}>Ukupno: {items.length}</div>
      </div>

      {/* Delete item confirm */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 1000 }} onClick={() => setConfirmDelete(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "24px 16px 32px", boxSizing: "border-box" }}>
            <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🗑️</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>Obriši "{confirmDelete}"?</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>Briše se samo iz baze — postojeći rasporedi ostaju nepromijenjeni.</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "13px 0", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Odustani</button>
              <button onClick={() => deleteItem(confirmDelete)} style={{ flex: 1, padding: "13px 0", background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Da, obriši</button>
            </div>
          </div>
        </div>
      )}

      {/* Add category sheet */}
      {showAddCat && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 1000 }} onClick={() => setShowAddCat(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "24px 16px 32px", boxSizing: "border-box" }}>
            <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Novi izbornik</h3>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Naziv (npr. Alati)</label>
            <input autoFocus value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddCategory()}
              placeholder="Alati" style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", fontSize: 15, outline: "none", marginBottom: 14 }} />
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Emoji ikona</label>
            <input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)}
              placeholder="🔧" style={{ width: 80, boxSizing: "border-box", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", fontSize: 20, outline: "none", marginBottom: 18, textAlign: "center" }} />
            <button onClick={handleAddCategory} style={{ background: "#1e40af", color: "#fff", border: "none", borderRadius: 10, padding: "13px 0", width: "100%", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Dodaj izbornik</button>
          </div>
        </div>
      )}

      {/* Delete category confirm */}
      {confirmDeleteCat && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 1000 }} onClick={() => setConfirmDeleteCat(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "24px 16px 32px", boxSizing: "border-box" }}>
            <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>Obriši izbornik "{cats.find(c => c.key === confirmDeleteCat)?.label}"?</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>Ovo briše cijeli izbornik i sve njegove stavke sa svih gradilišta. Ne može se poništiti.</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDeleteCat(null)} style={{ flex: 1, padding: "13px 0", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Odustani</button>
              <button onClick={() => handleDeleteCategory(confirmDeleteCat)} style={{ flex: 1, padding: "13px 0", background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Da, obriši sve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PrintModal ────────────────────────────────────────────────────────────────
function PrintModal({ sites, date, onClose, cats }) {
  const regularSites = sites.filter(s => !s.permanent && cats.some(c => (s[c.key] || []).length > 0));
  const permanentSites = sites.filter(s => s.permanent);
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("hr-HR", { weekday: "long", day: "numeric", month: "numeric", year: "numeric" });

  const rightCats = cats.filter(c => c.key !== "workers");
  const contentRef = useRef(null);
  const [zoom, setZoom] = useState(1);

  const A4_USABLE_HEIGHT_PX = 920; // konzervativnije, da uvijek stane uz padding print-layera

  const calcZoom = useCallback(() => {
    if (!contentRef.current) return;
    contentRef.current.style.zoom = 1;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!contentRef.current) return;
        const naturalHeight = contentRef.current.scrollHeight;
        if (naturalHeight > A4_USABLE_HEIGHT_PX) {
          const z = Math.max(0.3, A4_USABLE_HEIGHT_PX / naturalHeight);
          setZoom(z);
        } else {
          setZoom(1);
        }
      });
    });
  }, []);

  useEffect(() => {
    calcZoom();
    window.addEventListener("beforeprint", calcZoom);
    return () => window.removeEventListener("beforeprint", calcZoom);
  }, [sites, cats, calcZoom]);

  // Sadržaj koji se stvarno printa — bez fiksnog pozicioniranja, da Chrome ne duplicira stranice
  const printableContent = (
    <div ref={contentRef} style={{ zoom }}>
      {/* Page header */}
      <div style={{ borderBottom: "3px solid #1e293b", paddingBottom: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Raspored gradilišta</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#1e293b" }}>{dateLabel}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#64748b", lineHeight: 2 }}>
            {cats.map(c => (
              <div key={c.key}>{c.icon} {c.label}: <strong style={{ color: "#1e293b" }}>{sites.reduce((a, s) => a + (s[c.key] || []).length, 0)}</strong></div>
            ))}
          </div>
        </div>
      </div>

      {/* Regular sites — dva stupca */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
        {regularSites.map((site) => (
          <div key={site.id} style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 12, marginBottom: 12, breakInside: "avoid" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #1e293b", paddingBottom: 4, marginBottom: 8 }}>
              {site.name}
            </div>
            <div style={{ display: "flex", gap: 0 }}>
              <div style={{ flex: 1, paddingRight: 10 }}>
                {(site.workers || []).length > 0 ? (
                  (site.workers || []).map((w, i) => (
                    <div key={w} style={{ fontSize: 12, color: "#1e293b", padding: "2px 0", borderBottom: i < site.workers.length - 1 ? "1px dotted #e2e8f0" : "none" }}>{w}</div>
                  ))
                ) : (
                  <div style={{ fontSize: 11, color: "#cbd5e1", fontStyle: "italic" }}>—</div>
                )}
              </div>
              <div style={{ width: 1, background: "#1e293b", opacity: 0.15, flexShrink: 0 }} />
              <div style={{ flex: 1, paddingLeft: 10 }}>
                {(() => {
                  const allRightVals = rightCats.flatMap(cat => site[cat.key] || []);
                  return allRightVals.length > 0 ? (
                    allRightVals.map((v, i) => (
                      <div key={v} style={{ fontSize: 12, color: "#1e293b", padding: "2px 0", borderBottom: i < allRightVals.length - 1 ? "1px dotted #e2e8f0" : "none" }}>{v}</div>
                    ))
                  ) : (
                    <div style={{ fontSize: 11, color: "#cbd5e1", fontStyle: "italic" }}>—</div>
                  );
                })()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {regularSites.length === 0 && (
        <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>Nema unesenih podataka za ovaj dan.</div>
      )}

      {/* Permanent sites — Komin i Fali uvijek na dnu desno, samo radnici. Komin bez okvira, Fali s okvirom */}
      <div style={{ display: "flex", gap: 16, marginTop: 16, justifyContent: "flex-end", breakInside: "avoid" }}>
        {permanentSites.map(site => (
          <div key={site.id} style={{
            width: 220, padding: "10px 14px", boxSizing: "border-box",
            border: site.name === "Fali" ? "2px solid #1e293b" : "2px solid transparent",
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #1e293b", paddingBottom: 4, marginBottom: 8 }}>
              {site.name}
            </div>
            <div>
              {(site.workers || []).length > 0 ? (site.workers || []).map((w, i) => (
                <div key={w} style={{ fontSize: 12, color: "#1e293b", padding: "3px 0", borderBottom: i < site.workers.length - 1 ? "1px dotted #e2e8f0" : "none" }}>{w}</div>
              )) : <div style={{ fontSize: 11, color: "#cbd5e1", fontStyle: "italic" }}>—</div>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 16, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
        Generirano: {new Date().toLocaleString("hr-HR")}
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          /* Sakrij sve OSIM print-only sloja */
          #root { display: none !important; }
          #print-only-layer { display: block !important; }
        }
        @media screen {
          #print-only-layer { display: none !important; }
        }
      `}</style>

      {/* Ekranski overlay — modal preview, vidljiv samo na ekranu */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "20px 0" }}>
        <div style={{ background: "#fff", width: 794, maxWidth: "calc(100% - 32px)", borderRadius: 16, padding: "32px 28px", boxSizing: "border-box", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
          {printableContent}
          <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => window.print()} style={{ flex: 1, padding: "13px 0", background: "linear-gradient(135deg, #1e40af, #3b82f6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>🖨️ Ispiši / Spremi PDF</button>
            <button onClick={onClose} style={{ padding: "13px 20px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Zatvori</button>
          </div>
        </div>
      </div>

      {/* Print-only sloj — izvan svih fixed/absolute roditelja, direktno u body, samo za printer */}
      {createPortal(
        <div id="print-only-layer" style={{ display: "none", width: "794px", padding: "8px", boxSizing: "border-box" }}>
          {printableContent}
        </div>,
        document.body
      )}
    </>
  );
}

// ── SidebarPalette ────────────────────────────────────────────────────────────
function SidebarPalette({ allData, sites, isOpen, onToggle, onDragStartItem, onDragEndItem, dragItem, cats }) {
  const [activeCat, setActiveCat] = useState("workers");
  const [search, setSearch] = useState("");

  const usedValues = new Set();
  sites.forEach(s => (s[activeCat] || []).forEach(v => usedValues.add(v)));

  const cat = cats.find(c => c.key === activeCat);
  const available = (allData[activeCat] || [])
    .filter(v => !usedValues.has(v))
    .filter(v => v.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "hr", { numeric: true, sensitivity: "base" }));

  if (!isOpen) {
    return (
      <button onClick={onToggle} style={{
        position: "fixed", top: "50%", right: 0, transform: "translateY(-50%)",
        background: "linear-gradient(135deg, #1e40af, #3b82f6)", color: "#fff",
        border: "none", borderRadius: "10px 0 0 10px", padding: "16px 8px",
        fontSize: 13, fontWeight: 700, cursor: "pointer", writingMode: "vertical-rl",
        boxShadow: "-2px 0 10px rgba(0,0,0,0.15)", zIndex: 500
      }}>⬅ Brzi izbornik</button>
    );
  }

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 200,
      background: "#fff", boxShadow: "-4px 0 16px rgba(0,0,0,0.12)",
      zIndex: 500, display: "flex", flexDirection: "column"
    }}>
      {/* Header / close */}
      <div style={{ padding: "12px 10px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Brzi izbornik</span>
        <button onClick={onToggle} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 16, cursor: "pointer", padding: 2 }}>✕</button>
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2, padding: 8, borderBottom: "1px solid #f1f5f9" }}>
        {cats.map(c => (
          <button key={c.key} onClick={() => { setActiveCat(c.key); setSearch(""); }} style={{
            flex: "1 0 45%", padding: "6px 4px", border: "none", borderRadius: 6,
            fontSize: 10, fontWeight: 700, cursor: "pointer",
            background: activeCat === c.key ? c.color : "#f1f5f9",
            color: activeCat === c.key ? "#fff" : "#64748b"
          }}>{c.icon} {c.label}</button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: 8 }}>
        <input
          placeholder="Traži..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "6px 8px", fontSize: 12, outline: "none" }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
        {available.length === 0 && (
          <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: 11, padding: 20 }}>
            {search ? "Nema rezultata" : "Sve je raspoređeno"}
          </div>
        )}
        {available.map(val => (
          <div
            key={val}
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStartItem("sidebar", activeCat, val); }}
            onDragEnd={onDragEndItem}
            style={{
              background: cat.bg, border: `1.5px solid ${cat.border}`, borderRadius: 6,
              padding: "6px 8px", marginBottom: 4, fontSize: 12, fontWeight: 600,
              color: cat.color, cursor: "grab", whiteSpace: "nowrap", overflow: "hidden",
              textOverflow: "ellipsis",
              opacity: dragItem && dragItem.siteId === "sidebar" && dragItem.value === val ? 0.4 : 1
            }}
          >
            {val}
          </div>
        ))}
      </div>

      <div style={{ padding: "8px 10px", borderTop: "1px solid #f1f5f9", fontSize: 10, color: "#cbd5e1", textAlign: "center" }}>
        Povuci na gradilište lijevo
      </div>
    </div>
  );
}

// ── AnalysisScreen ────────────────────────────────────────────────────────────
function AnalysisScreen({ onBack }) {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storage.get(ACTIVITY_LOG_KEY).then(res => {
      setLog(res?.value ? JSON.parse(res.value) : {});
      setLoading(false);
    }).catch(() => { setLog({}); setLoading(false); });
  }, []);

  const sortedUsers = log
    ? Object.entries(log).sort((a, b) => (b[1].total || 0) - (a[1].total || 0))
    : [];
  const grandTotal = sortedUsers.reduce((a, [, v]) => a + (v.total || 0), 0);
  const maxTotal = Math.max(1, ...sortedUsers.map(([, v]) => v.total || 0));

  const formatLastActive = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("hr-HR", { day: "numeric", month: "numeric" }) + " u " + d.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)", padding: "20px 16px 24px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>← Natrag</button>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8, letterSpacing: 1, textTransform: "uppercase" }}>Admin pregled</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>📊 Analiza aktivnosti</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Učitavanje...</div>
        ) : sortedUsers.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Još nema zabilježenih promjena.</div>
        ) : (
          <>
            <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#1e293b" }}>{grandTotal}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Ukupno promjena svih korisnika</div>
            </div>

            {sortedUsers.map(([userName, data]) => (
              <div key={userName} style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{userName}</span>
                  <span style={{ fontWeight: 800, fontSize: 18, color: "#1e40af" }}>{data.total || 0}</span>
                </div>
                {/* Bar */}
                <div style={{ background: "#f1f5f9", borderRadius: 6, height: 8, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{
                    width: `${((data.total || 0) / maxTotal) * 100}%`, height: "100%",
                    background: "linear-gradient(90deg, #1e40af, #3b82f6)", borderRadius: 6
                  }} />
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  Zadnja aktivnost: {formatLastActive(data.lastActive)}
                </div>
                {data.byDay && Object.keys(data.byDay).length > 0 && (
                  <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 6 }}>
                    Danas: {data.byDay[today()] || 0} promjena
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── LoginScreen ───────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [selected, setSelected] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    const eng = ENGINEERS.find(e => e.name === selected);
    if (!eng) { setError("Odaberi korisnika."); return; }
    if (eng.pin !== pin) { setError("Pogrešan PIN."); setPin(""); return; }
    onLogin(eng);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: "100%", maxWidth: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36 }}>🏗️</div>
          <h2 style={{ margin: "8px 0 4px", fontSize: 20, fontWeight: 800, color: "#1e293b" }}>Raspored Gradilišta</h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>Prijavi se za nastavak</p>
        </div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Odaberi korisnika</label>
        <select value={selected} onChange={e => setSelected(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 15, marginBottom: 14, outline: "none", boxSizing: "border-box", background: "#fff" }}>
          <option value="">— Odaberi —</option>
          {ENGINEERS.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
        </select>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>PIN</label>
        <input type="password" placeholder="••••" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 20, letterSpacing: 8, marginBottom: 6, outline: "none", boxSizing: "border-box" }} />
        {error && <p style={{ color: "#ef4444", fontSize: 13, margin: "4px 0 10px" }}>{error}</p>}
        <button onClick={handleLogin} style={{ width: "100%", padding: "13px 0", background: "linear-gradient(135deg, #1e40af, #3b82f6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>Prijavi se</button>
        <p style={{ textAlign: "center", fontSize: 12, color: "#cbd5e1", marginTop: 16, marginBottom: 0 }}>Kontaktiraj admina za PIN pristup.</p>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [currentDate, setCurrentDate] = useState(today());
  const [sites, setSites] = useState(null);
  const [allData, setAllData] = useState({
    workers: initialWorkers, trucks: initialTrucks,
    trailers: initialTrailers, machines: initialMachines,
  });
  const [cats, setCats] = useState(DEFAULT_CATS);
  const [loading, setLoading] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [lastEditor, setLastEditor] = useState(null);
  const [showAddSite, setShowAddSite] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [dragItem, setDragItem] = useState(null); // { siteId, cat, value }
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [screen, setScreen] = useState("raspored");
  const [newSiteName, setNewSiteName] = useState("");
  const pollRef = useRef(null);
  const lastLocalEditRef = useRef(0); // timestamp zadnje lokalne promjene

  const isToday = currentDate === today();
  const isPast = currentDate < today();
  const readOnly = isPast && !user?.admin; // budući dani su uvijek editabilni, prošli samo za admine

  // ── Load day (initial — shows loading state) ──
  const loadDay = useCallback(async (dateStr) => {
    setLoading(true);
    try {
      const res = await storage.get(dateKey(dateStr), true);
      if (res?.value) {
        const data = JSON.parse(res.value);
        let migratedSites = (data.sites || makeEmptySites()).map(s => {
          const ns = { ...s };
          cats.forEach(c => { if (!ns[c.key]) ns[c.key] = []; }); // osiguraj sve trenutne kategorije
          return ns;
        });
        PERMANENT_SITES.forEach(name => {
          if (!migratedSites.find(s => s.id === `permanent-${name}`)) {
            const emptyCatFields = Object.fromEntries(cats.map(c => [c.key, []]));
            migratedSites.push({ id: `permanent-${name}`, name, ...emptyCatFields, permanent: true });
          }
        });
        migratedSites = migratedSites.map(s =>
          PERMANENT_SITES.includes(s.name) ? { ...s, permanent: true } : s
        );
        setSites(migratedSites);
        setLastEditor(data.lastEditor || null);
      } else {
        setSites(makeEmptySites());
        setLastEditor(null);
      }
    } catch (_) { setSites(makeEmptySites()); }
    setLoading(false);
  }, [cats]);

  // ── Silent refresh (background poll — no loading flicker, skips if user just edited) ──
  const silentRefresh = useCallback(async (dateStr) => {
    // Ako je korisnik nešto promijenio u zadnjih 5 sekundi, preskoči ovaj poll ciklus
    if (Date.now() - lastLocalEditRef.current < 5000) return;
    try {
      const res = await storage.get(dateKey(dateStr), true);
      if (res?.value) {
        const data = JSON.parse(res.value);
        let migratedSites = (data.sites || makeEmptySites()).map(s => {
          const ns = { ...s };
          cats.forEach(c => { if (!ns[c.key]) ns[c.key] = []; }); // osiguraj sve trenutne kategorije
          return ns;
        });
        PERMANENT_SITES.forEach(name => {
          if (!migratedSites.find(s => s.id === `permanent-${name}`)) {
            const emptyCatFields = Object.fromEntries(cats.map(c => [c.key, []]));
            migratedSites.push({ id: `permanent-${name}`, name, ...emptyCatFields, permanent: true });
          }
        });
        migratedSites = migratedSites.map(s =>
          PERMANENT_SITES.includes(s.name) ? { ...s, permanent: true } : s
        );
        setSites(migratedSites);
        setLastEditor(data.lastEditor || null);
      }
    } catch (_) {}
  }, [cats]);

  // ── Load kategorije i baza on mount ──
  useEffect(() => {
    if (!user) return;
    storage.get(CATS_KEY).then(res => {
      if (res?.value) {
        const customCats = JSON.parse(res.value);
        if (Array.isArray(customCats) && customCats.length > 0) setCats(customCats);
      }
    }).catch(() => {});
    storage.get(BAZA_KEY).then(res => {
      if (res?.value) {
        const b = JSON.parse(res.value);
        setAllData(prev => ({ ...prev, ...b })); // dinamički merge svih kategorija, ne samo fiksnih 4
      }
    }).catch(() => {});
    loadDay(currentDate);
  }, [user, currentDate, loadDay]);

  // ── Poll (silent, skips during active editing) ──
  useEffect(() => {
    if (!user || readOnly) return;
    pollRef.current = setInterval(() => silentRefresh(currentDate), 15000);
    return () => clearInterval(pollRef.current);
  }, [user, currentDate, readOnly, silentRefresh]);

  // ── Activity log — broji promjene po korisniku ──
  const logActivity = useCallback(async (userName) => {
    try {
      const res = await storage.get(ACTIVITY_LOG_KEY);
      const log = res?.value ? JSON.parse(res.value) : {};
      const today_ = today();
      if (!log[userName]) log[userName] = { total: 0, byDay: {} };
      log[userName].total = (log[userName].total || 0) + 1;
      log[userName].byDay[today_] = (log[userName].byDay[today_] || 0) + 1;
      log[userName].lastActive = new Date().toISOString();
      await storage.set(ACTIVITY_LOG_KEY, JSON.stringify(log));
    } catch (_) {}
  }, []);

  // ── Save day ──
  const save = useCallback(async (newSites) => {
    if (readOnly) return;
    lastLocalEditRef.current = Date.now(); // označi da je korisnik upravo nešto promijenio
    try {
      await storage.set(dateKey(currentDate), JSON.stringify({ sites: newSites, lastEditor: user.name, savedAt: new Date().toISOString() }), true);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      logActivity(user.name);
    } catch (_) {}
  }, [currentDate, user, readOnly, logActivity]);

  // ── Save baza ──
  const saveBaza = async (newAllData) => {
    lastLocalEditRef.current = Date.now();
    try {
      await storage.set(BAZA_KEY, JSON.stringify(newAllData));
      logActivity(user.name);
    } catch (_) {}
  };

  const updateSites = (newSites) => {
    lastLocalEditRef.current = Date.now();
    setSites(newSites);
    save(newSites);
  };
  const updateSite = (updated) => updateSites(sites.map(s => s.id === updated.id ? updated : s));

  // ── Drag & drop premještanje između gradilišta (i iz bočne palete baze) ──
  const handleDragStartItem = (siteId, cat, value) => setDragItem({ siteId, cat, value }); // siteId === "sidebar" za stavke iz baze
  const handleDragEndItem = () => setDragItem(null);
  const handleDropItem = (targetSiteId, cat) => {
    if (!dragItem || dragItem.cat !== cat) { setDragItem(null); return; }

    if (dragItem.siteId === "sidebar") {
      // Iz bočne palete — samo dodaj na ciljano gradilište, provjeri da već nije igdje drugdje
      const usedElsewhere = sites.some(s => (s[cat] || []).includes(dragItem.value));
      if (usedElsewhere) { setDragItem(null); return; }
      const newSites = sites.map(s =>
        s.id === targetSiteId ? { ...s, [cat]: [...s[cat], dragItem.value] } : s
      );
      updateSites(newSites);
      setDragItem(null);
      return;
    }

    if (dragItem.siteId === targetSiteId) { setDragItem(null); return; }
    const newSites = sites.map(s => {
      if (s.id === dragItem.siteId) {
        return { ...s, [cat]: s[cat].filter(v => v !== dragItem.value) };
      }
      if (s.id === targetSiteId) {
        if (s[cat].includes(dragItem.value)) return s; // već postoji, ne dupliciraj
        return { ...s, [cat]: [...s[cat], dragItem.value] };
      }
      return s;
    });
    updateSites(newSites);
    setDragItem(null);
  };
  const deleteSite = (id) => updateSites(sites.filter(s => s.id !== id));

  const updateBazaCat = (cat, vals) => {
    const nd = { ...allData, [cat]: vals };
    setAllData(nd);
    saveBaza(nd);
  };

  // ── Upravljanje izbornicima (kategorijama) — samo admin ──
  const saveCats = async (newCats) => {
    setCats(newCats);
    try {
      await storage.set(CATS_KEY, JSON.stringify(newCats));
      logActivity(user.name);
    } catch (_) {}
  };

  const addCategory = (label, icon) => {
    const key = "cat_" + label.toLowerCase()
      .replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "dj")
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") + "_" + Date.now().toString(36);
    const colorIdx = cats.length % CAT_COLOR_PALETTE.length;
    const newCat = { key, label, icon, ...CAT_COLOR_PALETTE[colorIdx] };
    const newCats = [...cats, newCat];
    saveCats(newCats);
    // Inicijaliziraj praznu listu za novu kategoriju u bazi
    const nd = { ...allData, [key]: [] };
    setAllData(nd);
    saveBaza(nd);
    // Dodaj prazno polje na sva postojeća gradilišta
    if (sites) {
      const newSites = sites.map(s => ({ ...s, [key]: [] }));
      updateSites(newSites);
    }
  };

  const deleteCategory = (key) => {
    const newCats = cats.filter(c => c.key !== key);
    saveCats(newCats);
    // Ukloni iz baze
    const nd = { ...allData };
    delete nd[key];
    setAllData(nd);
    saveBaza(nd);
    // Ukloni sa svih gradilišta
    if (sites) {
      const newSites = sites.map(s => {
        const ns = { ...s };
        delete ns[key];
        return ns;
      });
      updateSites(newSites);
    }
  };

  const addSite = () => {
    if (!newSiteName.trim()) return;
    const emptyCatFields = Object.fromEntries(cats.map(c => [c.key, []]));
    updateSites([{ id: Date.now().toString(), name: newSiteName.trim(), ...emptyCatFields }, ...sites]);
    setNewSiteName(""); setShowAddSite(false);
  };

  const duplicateWorkers = (() => {
    if (!sites) return new Set();
    const counts = {};
    sites.forEach(s => (s.workers || []).forEach(w => { counts[w] = (counts[w] || 0) + 1; }));
    return new Set(Object.keys(counts).filter(w => counts[w] > 1));
  })();

  // Fali se ne računa u brojač — samo radnici koji su na gradilištima
  const totals = cats.map(c => sites ? sites.filter(s => s.name !== "Fali").reduce((a, s) => a + (s[c.key] || []).length, 0) : 0);

  if (!user) return <LoginScreen onLogin={setUser} />;

  if (screen === "baza") return (
    <BazaScreen allData={allData} onUpdate={updateBazaCat} onBack={() => setScreen("raspored")} cats={cats} isAdmin={user.admin} onAddCategory={addCategory} onDeleteCategory={deleteCategory} />
  );

  if (screen === "analiza" && user.admin) return (
    <AnalysisScreen onBack={() => setScreen("raspored")} />
  );

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)", padding: "20px 16px 0", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8, letterSpacing: 1, textTransform: "uppercase" }}>
              {user.name}{user.admin ? " 🔑" : ""} · Raspored
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, marginTop: 2 }}>{hrDate(currentDate)}</div>
            <div style={{ fontSize: 12, marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {readOnly && <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>📖 Samo čitanje</span>}
              {!isToday && user.admin && <span style={{ background: "rgba(255,200,0,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>🔑 Admin edit</span>}
              {savedFlash && <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>✓ Spremljeno</span>}
              {lastEditor && !savedFlash && <span style={{ opacity: 0.75, fontSize: 11 }}>Zadnji: {lastEditor}</span>}
            </div>
          </div>
          {/* Totals */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 160 }}>
            {cats.map((c, i) => (
              <div key={c.key} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "5px 10px", textAlign: "center", minWidth: 44 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{totals[i]}</div>
                <div style={{ fontSize: 9, opacity: 0.85 }}>{c.icon}</div>
              </div>
            ))}
            {duplicateWorkers.size > 0 && (
              <div style={{ background: "#ef4444", borderRadius: 8, padding: "5px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{duplicateWorkers.size}</div>
                <div style={{ fontSize: 9 }}>⚠️</div>
              </div>
            )}
          </div>
        </div>

        {/* Date nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, paddingBottom: 14, overflowX: "auto" }}>
          <button onClick={() => setCurrentDate(addDays(currentDate, -1))} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>‹</button>
          {Array.from({ length: 11 }, (_, i) => addDays(today(), i - 7)).map(d => {
            const isActive = d === currentDate;
            return (
              <button key={d} onClick={() => setCurrentDate(d)} style={{
                flex: "0 0 auto", padding: "6px 10px", border: "none", borderRadius: "8px 8px 0 0",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: isActive ? "#fff" : "rgba(255,255,255,0.15)",
                color: isActive ? "#1e40af" : "#fff"
              }}>{d === today() ? "Danas" : new Date(d + "T12:00:00").toLocaleDateString("hr-HR", { day: "numeric", month: "numeric" })}</button>
            );
          })}
          <button onClick={() => setCurrentDate(addDays(currentDate, 1))} style={{
            background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
            borderRadius: 8, padding: "6px 12px", fontSize: 18, cursor: "pointer", flexShrink: 0
          }}>›</button>
        </div>
      </div>

      {/* Duplicate warning */}
      {duplicateWorkers.size > 0 && (
        <div style={{ background: "#fef2f2", borderBottom: "2px solid #fca5a5", padding: "10px 16px", display: "flex", gap: 8 }}>
          <span>⚠️</span>
          <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>Radnici na 2+ gradilišta: {[...duplicateWorkers].join(", ")}</span>
        </div>
      )}

      {/* Site cards — dva stupca, Komin i Fali uvijek zadnji */}
      <style>{`
        @media (max-width: 640px) {
          .sites-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={{ padding: `16px ${sidebarOpen ? 216 : 16}px 110px 16px`, transition: "padding 0.2s" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Učitavanje...</div>
        ) : (
          <div className="sites-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
            {sites && [...sites]
              .sort((a, b) => (a.permanent ? 1 : 0) - (b.permanent ? 1 : 0))
              .map(site => (
                <SiteCard key={site.id} site={site} allSites={sites} allData={allData}
                  duplicateWorkers={duplicateWorkers} onUpdate={updateSite}
                  onDelete={() => deleteSite(site.id)} readOnly={readOnly}
                  dragItem={dragItem} onDragStartItem={handleDragStartItem}
                  onDragEndItem={handleDragEndItem} onDropItem={handleDropItem} cats={cats} />
              ))}
          </div>
        )}
      </div>

      {/* Bočna paleta — brzi izbornik baze */}
      {!readOnly && (
        <SidebarPalette
          allData={allData} sites={sites || []}
          isOpen={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)}
          dragItem={dragItem}
          onDragStartItem={handleDragStartItem}
          onDragEndItem={handleDragEndItem}
          cats={cats}
        />
      )}

      {/* Add site sheet */}
      {showAddSite && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 1000 }} onClick={() => setShowAddSite(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 16px 32px", boxSizing: "border-box" }}>
            <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 16px" }} />
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Novo gradilište</h3>
            <input autoFocus placeholder="Naziv gradilišta..." value={newSiteName} onChange={e => setNewSiteName(e.target.value)} onKeyDown={e => e.key === "Enter" && addSite()}
              style={{ border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", fontSize: 15, width: "100%", boxSizing: "border-box", outline: "none", marginBottom: 10 }} />
            <button onClick={addSite} style={{ background: "#1e40af", color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", width: "100%", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Dodaj gradilište</button>
          </div>
        </div>
      )}

      {/* Bottom buttons */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(248,250,252,0.95)", backdropFilter: "blur(8px)", borderTop: "1px solid #e2e8f0", padding: "12px 16px", display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
        <button onClick={() => setUser(null)} style={{ background: "none", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer" }}>← Odjava</button>
        <button onClick={() => setScreen("baza")} style={{ background: "none", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#1e40af", cursor: "pointer" }}>📋 Baza</button>
        {user.admin && (
          <button onClick={() => setScreen("analiza")} style={{ background: "none", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#059669", cursor: "pointer" }}>📊 Analiza</button>
        )}
        <button onClick={() => setShowPrint(true)} style={{ background: "none", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#1e293b", cursor: "pointer" }}>🖨️ Ispiši</button>
        {!readOnly && (
          <button onClick={() => setShowAddSite(true)} style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>+ Gradilište</button>
        )}
      </div>

      {showPrint && sites && <PrintModal sites={sites} date={currentDate} onClose={() => setShowPrint(false)} cats={cats} />}
    </div>
  );
}
