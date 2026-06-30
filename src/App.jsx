import { useState, useEffect, useCallback, useRef } from "react";

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

// ── Date helpers ──────────────────────────────────────────────────────────────
const fmt   = (d) => d.toISOString().slice(0, 10);
const today = () => fmt(new Date());
const addDays = (dateStr, n) => { const d = new Date(dateStr); d.setDate(d.getDate() + n); return fmt(d); };
const hrDate  = (dateStr) => new Date(dateStr + "T12:00:00").toLocaleDateString("hr-HR", { weekday: "long", day: "numeric", month: "numeric", year: "numeric" });

// ── Category config ───────────────────────────────────────────────────────────
const CATS = [
  { key: "workers",  label: "Radnici",   icon: "👷", color: "#3b82f6", bg: "#eff6ff", border: "#3b82f6" },
  { key: "trucks",   label: "Kamioni",   icon: "🚛", color: "#f97316", bg: "#fff7ed", border: "#f97316" },
  { key: "trailers", label: "Prikolice", icon: "🚜", color: "#8b5cf6", bg: "#f5f3ff", border: "#8b5cf6" },
  { key: "machines", label: "Strojevi",  icon: "⚙️", color: "#059669", bg: "#ecfdf5", border: "#059669" },
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
function Badge({ label, color, onRemove, warn }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      background: warn ? "#ef4444" : color,
      borderRadius: 6, padding: "2px 8px",
      fontSize: 12, fontWeight: 600, color: "#fff", margin: "2px", whiteSpace: "nowrap"
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
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 1000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: "20px 20px 0 0", width: "100%",
        maxHeight: "70vh", display: "flex", flexDirection: "column", padding: "20px 16px 32px", boxSizing: "border-box"
      }}>
        <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 16px" }} />
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>{title}</h3>
        <input autoFocus placeholder="Traži ili dodaj novo..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 15, marginBottom: 12, outline: "none", width: "100%", boxSizing: "border-box" }} />
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 && search && (
            <button onClick={() => { onAdd(search); onClose(); }} style={{
              display: "block", width: "100%", textAlign: "left", padding: "12px 14px",
              border: "1.5px dashed #f97316", borderRadius: 10, background: "#fff7ed",
              color: "#f97316", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 6
            }}>+ Dodaj "{search}" kao novo</button>
          )}
          {filtered.map(opt => (
            <button key={opt} onClick={() => { onAdd(opt); onClose(); }} style={{
              display: "block", width: "100%", textAlign: "left", padding: "12px 14px",
              border: "none", borderBottom: "1px solid #f1f5f9", background: "none", fontSize: 14, cursor: "pointer", color: "#1e293b"
            }}>{opt}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SiteCard ──────────────────────────────────────────────────────────────────
function SiteCard({ site, allSites, allData, duplicateWorkers, onUpdate, onDelete, readOnly }) {
  const [modal, setModal] = useState(null); // cat key or null

  const addItem = (cat, val) => {
    if (!site[cat].includes(val)) onUpdate({ ...site, [cat]: [...site[cat], val] });
  };
  const removeItem = (cat, val) => onUpdate({ ...site, [cat]: site[cat].filter(x => x !== val) });

  const hasAny = CATS.some(c => site[c.key]?.length > 0);

  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12,
      boxShadow: "0 1px 6px rgba(0,0,0,0.08)", border: "1.5px solid #f1f5f9"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{site.name}</span>
        {!readOnly && !site.permanent && <button onClick={onDelete} style={{ background: "none", border: "none", color: "#cbd5e1", fontSize: 18, cursor: "pointer" }}>🗑</button>}
      </div>

      {CATS.map(cat => (
        <div key={cat.key} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            {cat.icon} {cat.label}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {(site[cat.key] || []).map(val => (
              <Badge key={val} label={val} color={cat.color}
                warn={cat.key === "workers" && duplicateWorkers.has(val)}
                onRemove={readOnly ? null : () => removeItem(cat.key, val)} />
            ))}
            {!readOnly && (
              <button onClick={() => setModal(cat.key)} style={{
                background: cat.bg, border: `1.5px dashed ${cat.border}`, borderRadius: 6,
                color: cat.color, fontSize: 12, fontWeight: 600, padding: "2px 10px", cursor: "pointer", margin: "2px"
              }}>+ {cat.label.slice(0, -1) === "Radnic" ? "Radnik" : cat.label.replace(/i$/, "")}</button>
            )}
          </div>
        </div>
      ))}

      {modal && (
        <BottomSheet
          title={`Dodaj ${CATS.find(c => c.key === modal)?.label.toLowerCase().replace(/i$/, "")}`}
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
function BazaScreen({ allData, onUpdate, onBack }) {
  const [tab, setTab] = useState("workers");
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const cat = CATS.find(c => c.key === tab);
  const items = allData[tab] || [];
  const filtered = items.filter(i => i.toLowerCase().includes(search.toLowerCase()));

  const addItem = () => {
    const name = newName.trim();
    if (!name || items.includes(name)) return;
    const updated = tab === "workers"
      ? [...items, name].sort((a, b) => a.localeCompare(b, "hr"))
      : [...items, name];
    onUpdate(tab, updated);
    setNewName("");
  };

  const deleteItem = (name) => {
    onUpdate(tab, items.filter(i => i !== name));
    setConfirmDelete(null);
  };

  const placeholder = { workers: "Ime radnika...", trucks: "Oznaka kamiona...", trailers: "Oznaka prikolice...", machines: "Naziv stroja..." };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)", padding: "20px 16px 0", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>← Natrag</button>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8, letterSpacing: 1, textTransform: "uppercase" }}>Upravljanje</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Baza podataka</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3, overflowX: "auto" }}>
          {CATS.map(c => (
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
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input placeholder={placeholder[tab]} value={newName} onChange={e => setNewName(e.target.value)}
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
    </div>
  );
}

// ── PrintModal ────────────────────────────────────────────────────────────────
function PrintModal({ sites, date, onClose }) {
  const regularSites = sites.filter(s => !s.permanent && CATS.some(c => (s[c.key] || []).length > 0));
  const permanentSites = sites.filter(s => s.permanent);
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("hr-HR", { weekday: "long", day: "numeric", month: "numeric", year: "numeric" });

  // Print columns: workers left, then trucks | trailers | machines right
  const rightCats = CATS.filter(c => c.key !== "workers");

  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          #print-modal { display: block !important; position: static !important;
            background: white !important; box-shadow: none !important;
            border-radius: 0 !important; padding: 20px !important; margin: 0 !important; max-width: 100% !important; }
          .no-print { display: none !important; }
          .print-site { page-break-inside: avoid; }
        }
      `}</style>

      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "20px 0" }}>
        <div id="print-modal" style={{ background: "#fff", width: "100%", maxWidth: 760, borderRadius: 16, padding: "32px 28px", boxSizing: "border-box", margin: "0 16px", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>

          {/* Page header */}
          <div style={{ borderBottom: "3px solid #1e293b", paddingBottom: 12, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Raspored gradilišta</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#1e293b" }}>{dateLabel}</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 11, color: "#64748b", lineHeight: 2 }}>
                {CATS.map(c => (
                  <div key={c.key}>{c.icon} {c.label}: <strong style={{ color: "#1e293b" }}>{sites.reduce((a, s) => a + (s[c.key] || []).length, 0)}</strong></div>
                ))}
              </div>
            </div>
          </div>

          {/* Regular sites */}
          {regularSites.map((site, idx) => (
            <div key={site.id} className="print-site" style={{ borderBottom: idx < regularSites.length - 1 ? "1px solid #e2e8f0" : "none", paddingBottom: 16, marginBottom: 16 }}>
              {/* Naziv + crta */}
              <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #1e293b", paddingBottom: 4, marginBottom: 10 }}>
                {site.name}
              </div>

              {/* Sadržaj: radnici lijevo | sve ostalo desno */}
              <div style={{ display: "flex", gap: 0 }}>
                {/* Radnici — lijeva kolona */}
                <div style={{ flex: 1, paddingRight: 16 }}>
                  {(site.workers || []).length > 0 ? (
                    (site.workers || []).map((w, i) => (
                      <div key={w} style={{ fontSize: 13, color: "#1e293b", padding: "3px 0", borderBottom: i < site.workers.length - 1 ? "1px dotted #e2e8f0" : "none" }}>{w}</div>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: "#cbd5e1", fontStyle: "italic" }}>—</div>
                  )}
                </div>

                {/* Separator */}
                <div style={{ width: 1, background: "#1e293b", opacity: 0.15, flexShrink: 0 }} />

                {/* Desna strana: kamioni, prikolice, strojevi — svaki u svojoj sekciji */}
                <div style={{ flex: 1, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  {rightCats.map(cat => {
                    const vals = site[cat.key] || [];
                    if (vals.length === 0) return null;
                    return (
                      <div key={cat.key}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>{cat.icon} {cat.label}</div>
                        {vals.map((v, i) => (
                          <div key={v} style={{ fontSize: 13, color: "#1e293b", padding: "3px 0", borderBottom: i < vals.length - 1 ? "1px dotted #e2e8f0" : "none" }}>{v}</div>
                        ))}
                      </div>
                    );
                  })}
                  {rightCats.every(cat => (site[cat.key] || []).length === 0) && (
                    <div style={{ fontSize: 12, color: "#cbd5e1", fontStyle: "italic" }}>—</div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {regularSites.length === 0 && (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>Nema unesenih podataka za ovaj dan.</div>
          )}

          {/* Permanent sites — Komin i Fali uvijek na dnu desno */}
          <div style={{ display: "flex", gap: 16, marginTop: 16, justifyContent: "flex-end" }}>
            {permanentSites.map(site => (
              <div key={site.id} style={{ width: 220, border: "2px solid #1e293b", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #1e293b", paddingBottom: 4, marginBottom: 8 }}>
                  {site.name}
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    {(site.workers || []).length > 0 ? (site.workers || []).map((w, i) => (
                      <div key={w} style={{ fontSize: 12, color: "#1e293b", padding: "3px 0", borderBottom: i < site.workers.length - 1 ? "1px dotted #e2e8f0" : "none" }}>{w}</div>
                    )) : <div style={{ fontSize: 11, color: "#cbd5e1", fontStyle: "italic" }}>—</div>}
                  </div>
                  {CATS.filter(c => c.key !== "workers").some(c => (site[c.key] || []).length > 0) && (
                    <>
                      <div style={{ width: 1, background: "#1e293b", opacity: 0.15 }} />
                      <div style={{ flex: 1 }}>
                        {CATS.filter(c => c.key !== "workers").map(cat => {
                          const vals = site[cat.key] || [];
                          if (!vals.length) return null;
                          return (
                            <div key={cat.key} style={{ marginBottom: 4 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>{cat.icon} {cat.label}</div>
                              {vals.map((v, i) => <div key={v} style={{ fontSize: 12, color: "#1e293b", padding: "2px 0" }}>{v}</div>)}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 16, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
            Generirano: {new Date().toLocaleString("hr-HR")}
          </div>

          <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => window.print()} style={{ flex: 1, padding: "13px 0", background: "linear-gradient(135deg, #1e40af, #3b82f6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>🖨️ Ispiši / Spremi PDF</button>
            <button onClick={onClose} style={{ padding: "13px 20px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Zatvori</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── LoginScreen ───────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [selected, setSelected] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    const eng = ENGINEERS.find(e => e.name === selected);
    if (!eng) { setError("Odaberi inženjera."); return; }
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
        <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Odaberi inženjera</label>
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
  const [loading, setLoading] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [lastEditor, setLastEditor] = useState(null);
  const [showAddSite, setShowAddSite] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [screen, setScreen] = useState("raspored");
  const [newSiteName, setNewSiteName] = useState("");
  const pollRef = useRef(null);

  const isToday = currentDate === today();
  const readOnly = !isToday && !user?.admin;

  // ── Load day ──
  const loadDay = useCallback(async (dateStr) => {
    setLoading(true);
    try {
      const res = await storage.get(dateKey(dateStr), true);
      if (res?.value) {
        const data = JSON.parse(res.value);
        // Migrate old sites without trailers/machines
        let migratedSites = (data.sites || makeEmptySites()).map(s => ({
          ...s, trailers: s.trailers || [], machines: s.machines || []
        }));
        // Ensure permanent sites always exist
        PERMANENT_SITES.forEach(name => {
          if (!migratedSites.find(s => s.id === `permanent-${name}`)) {
            migratedSites.push({ id: `permanent-${name}`, name, workers: [], trucks: [], trailers: [], machines: [], permanent: true });
          }
        });
        // Ensure permanent flag is set
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
  }, []);

  // ── Load baza on mount ──
  useEffect(() => {
    if (!user) return;
    storage.get(BAZA_KEY).then(res => {
      if (res?.value) {
        const b = JSON.parse(res.value);
        setAllData(prev => ({
          workers:  b.workers  || prev.workers,
          trucks:   b.trucks   || prev.trucks,
          trailers: b.trailers || prev.trailers,
          machines: b.machines || prev.machines,
        }));
      }
    }).catch(() => {});
    loadDay(currentDate);
  }, [user, currentDate, loadDay]);

  // ── Poll ──
  useEffect(() => {
    if (!user || !isToday) return;
    pollRef.current = setInterval(() => loadDay(currentDate), 15000);
    return () => clearInterval(pollRef.current);
  }, [user, currentDate, isToday, loadDay]);

  // ── Save day ──
  const save = useCallback(async (newSites) => {
    if (readOnly) return;
    try {
      await storage.set(dateKey(currentDate), JSON.stringify({ sites: newSites, lastEditor: user.name, savedAt: new Date().toISOString() }), true);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (_) {}
  }, [currentDate, user, readOnly]);

  // ── Save baza ──
  const saveBaza = async (newAllData) => {
    try { await storage.set(BAZA_KEY, JSON.stringify(newAllData)); } catch (_) {}
  };

  const updateSites = (newSites) => { setSites(newSites); save(newSites); };
  const updateSite = (updated) => updateSites(sites.map(s => s.id === updated.id ? updated : s));
  const deleteSite = (id) => updateSites(sites.filter(s => s.id !== id));

  const updateBazaCat = (cat, vals) => {
    const nd = { ...allData, [cat]: vals };
    setAllData(nd);
    saveBaza(nd);
  };

  const addSite = () => {
    if (!newSiteName.trim()) return;
    updateSites([...sites, { id: Date.now().toString(), name: newSiteName.trim(), workers: [], trucks: [], trailers: [], machines: [] }]);
    setNewSiteName(""); setShowAddSite(false);
  };

  const duplicateWorkers = (() => {
    if (!sites) return new Set();
    const counts = {};
    sites.forEach(s => (s.workers || []).forEach(w => { counts[w] = (counts[w] || 0) + 1; }));
    return new Set(Object.keys(counts).filter(w => counts[w] > 1));
  })();

  // Fali se ne računa u brojač — samo radnici koji su na gradilištima
  const totals = CATS.map(c => sites ? sites.filter(s => s.name !== "Fali").reduce((a, s) => a + (s[c.key] || []).length, 0) : 0);

  if (!user) return <LoginScreen onLogin={setUser} />;

  if (screen === "baza") return (
    <BazaScreen allData={allData} onUpdate={updateBazaCat} onBack={() => setScreen("raspored")} />
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
            {CATS.map((c, i) => (
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
          {Array.from({ length: 8 }, (_, i) => addDays(today(), i - 7)).map(d => {
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
          <button onClick={() => setCurrentDate(addDays(currentDate, 1))} disabled={currentDate >= today()} style={{
            background: currentDate >= today() ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.2)",
            border: "none", color: currentDate >= today() ? "rgba(255,255,255,0.3)" : "#fff",
            borderRadius: 8, padding: "6px 12px", fontSize: 18, cursor: currentDate >= today() ? "not-allowed" : "pointer", flexShrink: 0
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

      {/* Site cards */}
      <div style={{ padding: "16px 16px 110px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Učitavanje...</div>
        ) : (
          sites && sites.map(site => (
            <SiteCard key={site.id} site={site} allSites={sites} allData={allData}
              duplicateWorkers={duplicateWorkers} onUpdate={updateSite}
              onDelete={() => deleteSite(site.id)} readOnly={readOnly} />
          ))
        )}
      </div>

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
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(248,250,252,0.95)", backdropFilter: "blur(8px)", borderTop: "1px solid #e2e8f0", padding: "12px 16px", display: "flex", gap: 8, justifyContent: "space-between" }}>
        <button onClick={() => setUser(null)} style={{ background: "none", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer" }}>← Odjava</button>
        <button onClick={() => setScreen("baza")} style={{ background: "none", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#1e40af", cursor: "pointer" }}>📋 Baza</button>
        <button onClick={() => setShowPrint(true)} style={{ background: "none", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#1e293b", cursor: "pointer" }}>🖨️ Ispiši</button>
        {!readOnly && (
          <button onClick={() => setShowAddSite(true)} style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>+ Gradilište</button>
        )}
      </div>

      {showPrint && sites && <PrintModal sites={sites} date={currentDate} onClose={() => setShowPrint(false)} />}
    </div>
  );
}
