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
const ITEM_DETAILS_KEY = `raspored-item-details`; // detalji o vozilima/strojevima/svim stavkama
const ACTIVITY_LOG_KEY = `raspored-activity-log`;
const hoursKey = (yearMonth) => `raspored-hours-${yearMonth}`; // npr. "2026-06"
const STANDARD_DAILY_HOURS = 9;
const SETTINGS_KEY = "gradprom-settings";
const COLORS_KEY = "gradprom-colors"; // lokalno po korisniku (localStorage)
const PINS_KEY = "gradprom-pins"; // custom PINovi koji prepisuju defaultne u Supabaseu

// ── Prijevodi (HR/EN) ──────────────────────────────────────────────────────────
const LANG = {
  hr: {
    raspored: "Raspored gradilišta", sati: "Radni sati", baza: "Baza",
    analiza: "Analiza", ispisi: "Ispiši", izbornik: "Izbornik",
    natrag: "← Natrag", odjava: "← Odjava", radnici: "Radnici",
    kamioni: "Kamioni", prikolice: "Prikolice", strojevi: "Strojevi",
    ucitavanje: "Učitavanje...", spremljeno: "✓ Spremljeno",
    danas: "Danas", gradiliste: "Gradilište", postavke: "Postavke",
  },
  en: {
    raspored: "Site Schedule", sati: "Working Hours", baza: "Database",
    analiza: "Analytics", ispisi: "Print", izbornik: "← Menu",
    natrag: "← Back", odjava: "← Logout", radnici: "Workers",
    kamioni: "Trucks", prikolice: "Trailers", strojevi: "Machines",
    ucitavanje: "Loading...", spremljeno: "✓ Saved",
    danas: "Today", gradiliste: "Site", postavke: "Settings",
  },
};

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

// ── Brand boja (Gradprom) — lako promijeniti kad stigne logo ──
const BRAND_RED = "#DC2626";
const BRAND_RED_DARK = "#B91C1C";
const LOGO_URL = "/logo.png";

// ── MiniLogo — mali logo za zaglavlja svih ekrana (osim landing/login gdje je veći) ──
function MiniLogo({ size = 28 }) {
  return LOGO_URL ? (
    <div style={{
      background: "#fff", borderRadius: size * 0.3,
      padding: size * 0.12,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 6px rgba(0,0,0,0.2)", flexShrink: 0
    }}>
      <img src={LOGO_URL} alt="Gradprom" style={{
        height: size, width: "auto", objectFit: "contain", display: "block"
      }} />
    </div>
  ) : (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, background: BRAND_RED,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.55, color: "#fff", flexShrink: 0
    }}>🏗️</div>
  );
}

// ── Engineers ─────────────────────────────────────────────────────────────────
const ENGINEERS = [
  { name: "Tomislav", pin: "1001" },
  { name: "Tihomir",  pin: "1002" },
  { name: "Silvije",  pin: "1003" },
  { name: "Igor",     pin: "1004" },
  { name: "Antonio",  pin: "1005" },
  { name: "Damir",    pin: "1006", admin: true },
  { name: "Tin",      pin: "1007", admin: true },
  { name: "Gordana",  pin: "1008" },
  { name: "Ena",      pin: "1009" },
  { name: "Anita",    pin: "1010" },
  { name: "Darko",    pin: "1011" },
];

// ── useSettings hook ───────────────────────────────────────────────────────────
function useSettings() {
  const [settings, setSettings] = useState({ fontSize: "normal" });
  useEffect(() => {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        setSettings(parsed);
        applyFontSize(parsed.fontSize);
      }
    } catch (_) {}
  }, []);
  const save = (newSettings) => {
    setSettings(newSettings);
    applyFontSize(newSettings.fontSize);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings)); } catch (_) {}
  };
  return [settings, save];
}

function applyFontSize(size) {
  const map = { small: "13px", normal: "15px", large: "18px" };
  document.documentElement.style.fontSize = map[size] || "15px";
}

// Defaultne boje (koriste se ako korisnik nije promijenio)
const DEFAULT_UI_COLOR = "#DF5050";
const DEFAULT_CAT_COLORS = {
  workers:  { color: "#3b82f6", bg: "#eff6ff", border: "#3b82f6" },
  trucks:   { color: "#f97316", bg: "#fff7ed", border: "#f97316" },
  trailers: { color: "#8b5cf6", bg: "#f5f3ff", border: "#8b5cf6" },
  machines: { color: "#059669", bg: "#ecfdf5", border: "#059669" },
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

// Generiraj blagu pozadinsku boju iz primarne
function colorToBg(hex) {
  return hex + "18";
}

function useColors() {
  const [colors, setColors] = useState({ ui: DEFAULT_UI_COLOR, cats: {} });
  useEffect(() => {
    try {
      const c = localStorage.getItem(COLORS_KEY);
      if (c) setColors(JSON.parse(c));
    } catch (_) {}
  }, []);
  const save = (newColors) => {
    setColors(newColors);
    try { localStorage.setItem(COLORS_KEY, JSON.stringify(newColors)); } catch (_) {}
  };
  return [colors, save];
}

// Vrati efektivnu boju kategorije — korisnikova ili defaultna
function getCatColor(catKey, userColors) {
  if (userColors?.cats?.[catKey]) return userColors.cats[catKey];
  return DEFAULT_CAT_COLORS[catKey] || { color: "#64748b", bg: "#f8fafc", border: "#64748b" };
}

// Vrati efektivnu UI boju
function getUIColor(userColors) {
  return userColors?.ui || DEFAULT_UI_COLOR;
}

// ── SettingsPanel ──────────────────────────────────────────────────────────────
function SettingsPanel({ user, onClose, settings, onSaveSettings, cats, userColors, onSaveColors }) {
  const [fontSize, setFontSize] = useState(settings.fontSize || "normal");
  const [localUIColor, setLocalUIColor] = useState(userColors?.ui || DEFAULT_UI_COLOR);
  const [localCatColors, setLocalCatColors] = useState(userColors?.cats || {});
  const [pinStep, setPinStep] = useState(0);
  const [pinOld, setPinOld] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);

  const handleSave = () => {
    onSaveSettings({ fontSize });
    onSaveColors({ ui: localUIColor, cats: localCatColors });
    onClose();
  };

  // Primijeni font odmah pri kliku, bez čekanja na Save
  const handleFontSize = (val) => {
    setFontSize(val);
    applyFontSize(val);
  };

  const setCatColor = (catKey, hex) => {
    setLocalCatColors(prev => ({ ...prev, [catKey]: { color: hex, bg: colorToBg(hex), border: hex } }));
  };

  const [pinsOverride, setPinsOverride] = useState({});

  useEffect(() => {
    storage.get(PINS_KEY).then(res => {
      if (res?.value) setPinsOverride(JSON.parse(res.value));
    }).catch(() => {});
  }, []);

  const getEffectivePin = (name) => pinsOverride[name] || ENGINEERS.find(e => e.name === name)?.pin;

  const handlePinChange = async () => {
    const currentPin = getEffectivePin(user.name);
    if (pinOld !== currentPin) { setPinError("Pogrešan stari PIN."); setPinOld(""); return; }
    if (pinNew.length < 4) { setPinError("Novi PIN mora imati barem 4 znamenke."); return; }
    if (pinNew !== pinConfirm) { setPinError("PINovi se ne podudaraju."); setPinConfirm(""); return; }
    try {
      const newOverrides = { ...pinsOverride, [user.name]: pinNew };
      await storage.set(PINS_KEY, JSON.stringify(newOverrides), true);
      setPinsOverride(newOverrides);
      setPinSuccess(true);
      setPinError("");
      setPinStep(0);
      setPinOld(""); setPinNew(""); setPinConfirm("");
    } catch (_) {
      setPinError("Greška pri spremanju. Pokušaj ponovo.");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 2000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: "20px 20px 0 0", width: "100%",
        maxHeight: "85vh", overflowY: "auto", padding: "20px 16px 40px", boxSizing: "border-box"
      }}>
        <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1e293b" }}>⚙️ Postavke</h3>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{user.name}</span>
        </div>

        {/* Veličina fonta */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>🔠 Veličina teksta</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["small", "Mala", "13px"], ["normal", "Normalna", "15px"], ["large", "Velika", "18px"]].map(([val, label, size]) => (
              <button key={val} onClick={() => handleFontSize(val)} style={{
                flex: 1, padding: "12px 0", border: "2px solid",
                borderColor: fontSize === val ? "#C73E3E" : "#e2e8f0",
                borderRadius: 12, background: fontSize === val ? "#fef2f2" : "#fff",
                color: fontSize === val ? "#C73E3E" : "#64748b",
                fontSize: size, fontWeight: 700, cursor: "pointer"
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Boje sučelja */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>🎨 Boje sučelja</div>

          {/* UI boja (header, gumbi) */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Glavna boja (header, gumbi)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="color" value={localUIColor} onChange={e => setLocalUIColor(e.target.value)}
                style={{ width: 48, height: 40, border: "none", borderRadius: 8, cursor: "pointer", padding: 2 }} />
              <div style={{ flex: 1, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${localUIColor}CC, ${localUIColor})` }} />
              <button onClick={() => setLocalUIColor(DEFAULT_UI_COLOR)} style={{ fontSize: 11, color: "#94a3b8", background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>Reset</button>
            </div>
          </div>

          {/* Boje kategorija — dinamički iz cats liste */}
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Boje kategorija (samo za tebe)</div>
          {cats.map(cat => {
            const currentColor = localCatColors[cat.key]?.color || DEFAULT_CAT_COLORS[cat.key]?.color || "#64748b";
            const defaultColor = DEFAULT_CAT_COLORS[cat.key]?.color || "#64748b";
            return (
              <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <input type="color" value={currentColor} onChange={e => setCatColor(cat.key, e.target.value)}
                  style={{ width: 40, height: 36, border: "none", borderRadius: 6, cursor: "pointer", padding: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: currentColor, fontWeight: 700, flex: 1 }}>{cat.icon} {cat.label}</span>
                <button onClick={() => setCatColor(cat.key, defaultColor)} style={{ fontSize: 11, color: "#94a3b8", background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>Reset</button>
              </div>
            );
          })}
        </div>

        {/* Promjena PIN-a */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>🔑 Promjena PIN-a</div>
          {pinSuccess && (
            <div style={{ background: "#ecfdf5", borderRadius: 10, padding: "10px 14px", color: "#059669", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              ✅ PIN uspješno promijenjen! Novi PIN je aktivan odmah.
            </div>
          )}
          {pinStep === 0 && !pinSuccess && (
            <button onClick={() => setPinStep(1)} style={{
              width: "100%", padding: "12px 0", border: "1.5px solid #e2e8f0",
              borderRadius: 12, background: "#f8fafc", color: "#1e293b",
              fontSize: 14, fontWeight: 600, cursor: "pointer"
            }}>Promijeni PIN</button>
          )}
          {pinStep >= 1 && !pinSuccess && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input type="password" placeholder="Stari PIN" value={pinOld} onChange={e => setPinOld(e.target.value)}
                style={{ border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 18, letterSpacing: 6, outline: "none", textAlign: "center" }} />
              <input type="password" placeholder="Novi PIN" value={pinNew} onChange={e => setPinNew(e.target.value)}
                style={{ border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 18, letterSpacing: 6, outline: "none", textAlign: "center" }} />
              <input type="password" placeholder="Potvrdi novi PIN" value={pinConfirm} onChange={e => setPinConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handlePinChange()}
                style={{ border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 18, letterSpacing: 6, outline: "none", textAlign: "center" }} />
              {pinError && <p style={{ color: "#ef4444", fontSize: 13, margin: 0, textAlign: "center" }}>{pinError}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setPinStep(0); setPinOld(""); setPinNew(""); setPinConfirm(""); setPinError(""); }} style={{ flex: 1, padding: "11px 0", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#f1f5f9", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Odustani</button>
                <button onClick={handlePinChange} style={{ flex: 1, padding: "11px 0", border: "none", borderRadius: 10, background: "#C73E3E", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Potvrdi</button>
              </div>
            </div>
          )}
        </div>

        <button onClick={handleSave} style={{
          width: "100%", padding: "14px 0",
          background: `var(--ui-gradient-btn, linear-gradient(180deg, #EF6B6B 0%, #DF5050 55%, #C73E3E 100%))`,
          border: "none", color: "#fff", borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: "pointer",
          boxShadow: "0 4px 12px #DF505030"
        }}>Spremi postavke</button>
      </div>
    </div>
  );
}

// ── SettingsButton — mala ikona ⚙️ za gornji desni kut ────────────────────────
function SettingsButton({ user, settings, onSaveSettings, cats, userColors, onSaveColors }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
        borderRadius: 8, width: 32, height: 32, fontSize: 16,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0
      }}>⚙️</button>
      {open && <SettingsPanel user={user} onClose={() => setOpen(false)} settings={settings} onSaveSettings={onSaveSettings} cats={cats} userColors={userColors} onSaveColors={onSaveColors} />}
    </>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, color, onRemove, warn, draggable, onDragStart, onDragEnd, isDragging, onClick, hasNote, isBirthday }) {
  const [dragStarted, setDragStarted] = useState(false);
  return (
    <span
      draggable={draggable}
      onDragStart={(e) => { setDragStarted(true); onDragStart && onDragStart(e); }}
      onDragEnd={(e) => { setDragStarted(false); onDragEnd && onDragEnd(e); }}
      onClick={(e) => { if (!dragStarted && onClick) { e.stopPropagation(); onClick(); } }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        background: warn ? "#ef4444" : color,
        borderRadius: 6, padding: "2px 8px",
        fontSize: 12, fontWeight: 600, color: "#fff", margin: "2px", whiteSpace: "nowrap",
        cursor: draggable ? "grab" : onClick ? "pointer" : "default",
        opacity: isDragging ? 0.4 : 1,
      }}>
      {warn && "⚠️ "}{label}
      {isBirthday && <span style={{ fontSize: 11, marginLeft: 2 }}>🎂</span>}
      {hasNote && <span style={{ fontSize: 10, marginLeft: 2 }}>⭐</span>}
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{
          background: "none", border: "none", color: "#fff",
          cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2
        }}>×</button>
      )}
    </span>
  );
}

// ── NoteModal — napomena za radnika na gradilištu ──────────────────────────────
function NoteModal({ worker, siteId, siteName, date, note, onSave, onClose }) {
  const [text, setText] = useState(note || "");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 3000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: "20px 20px 0 0", width: "100%",
        padding: "24px 16px 32px", boxSizing: "border-box"
      }}>
        <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b" }}>📝 Napomena</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{worker} · {siteName}</div>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Upiši napomenu za ovog radnika..."
          rows={4}
          style={{
            width: "100%", boxSizing: "border-box", border: "1.5px solid #e2e8f0",
            borderRadius: 12, padding: "12px 14px", fontSize: 14, outline: "none",
            resize: "none", fontFamily: "inherit", marginBottom: 14
          }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px 0", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Odustani</button>
          {text && text !== note && (
            <button onClick={() => { onSave(text.trim()); onClose(); }} style={{ flex: 2, padding: "12px 0", background: "var(--ui-gradient, linear-gradient(135deg, #C73E3E, #DF5050))", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Spremi napomenu</button>
          )}
          {note && (
            <button onClick={() => { onSave(""); onClose(); }} style={{ padding: "12px 14px", background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Obriši</button>
          )}
        </div>
      </div>
    </div>
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
function SiteCard({ site, allSites, allData, duplicateWorkers, onUpdate, onDelete, readOnly, dragItem, onDragStartItem, onDragEndItem, onDropItem, cats, userColors, itemDetails, currentDate }) {
  const [modal, setModal] = useState(null);
  const [dragOverCat, setDragOverCat] = useState(null);
  const [noteModal, setNoteModal] = useState(null);

  // Provjeri je li danas rođendan radnika
  const isBirthday = (workerName) => {
    const details = itemDetails?.[`workers:${workerName}`];
    if (!details?.datumRodenja) return false;
    const bday = new Date(details.datumRodenja);
    const today = new Date(currentDate + "T12:00:00");
    return bday.getDate() === today.getDate() && bday.getMonth() === today.getMonth();
  };

  const addItem = (cat, val) => {
    if (!site[cat].includes(val)) onUpdate({ ...site, [cat]: [...site[cat], val] });
  };
  const removeItem = (cat, val) => onUpdate({ ...site, [cat]: site[cat].filter(x => x !== val) });

  const saveNote = (worker, text) => {
    const notes = { ...(site.notes || {}) };
    if (text) notes[worker] = text;
    else delete notes[worker];
    onUpdate({ ...site, notes });
  };

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

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
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
                flex: cat.key === "workers" ? 2 : 1,
                borderRadius: 8, transition: "background 0.15s",
                background: isDropTarget && isDragOver ? "#dbeafe" : "transparent",
                outline: isDropTarget && isDragOver ? "2px dashed #3b82f6" : "none",
                padding: isDropTarget ? 4 : 0,
                minWidth: 0,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
                {cat.icon} {cat.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {(site[cat.key] || []).map(val => (
                  <Badge key={val} label={val} color={getCatColor(cat.key, userColors).color}
                    warn={cat.key === "workers" && duplicateWorkers.has(val)}
                    hasNote={cat.key === "workers" && !!(site.notes?.[val])}
                    isBirthday={cat.key === "workers" && isBirthday(val)}
                    onClick={cat.key === "workers" && !readOnly ? () => setNoteModal({ worker: val }) : undefined}
                    onRemove={readOnly ? null : () => removeItem(cat.key, val)}
                    draggable={!readOnly}
                    isDragging={dragItem && dragItem.value === val && dragItem.siteId === site.id && dragItem.cat === cat.key}
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStartItem(site.id, cat.key, val); }}
                    onDragEnd={() => onDragEndItem()}
                  />
                ))}
                {!readOnly && (
                  <button onClick={() => setModal(cat.key)} style={{
                    background: getCatColor(cat.key, userColors).bg, border: `1.5px dashed ${getCatColor(cat.key, userColors).border}`, borderRadius: 6,
                    color: getCatColor(cat.key, userColors).color, fontSize: 11, fontWeight: 600, padding: "2px 6px",
                    cursor: "pointer", marginTop: 2, textAlign: "left", width: "fit-content"
                  }}>+ {cat.key === "workers" ? "Radnik" : cat.label.replace(/i$/, "")}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <BottomSheet
          title={`Dodaj ${cats.find(c => c.key === modal)?.label.toLowerCase().replace(/i$/, "")}`}
          options={(allData[modal] || []).filter(v => {
              if ((site[modal] || []).includes(v)) return false;
              const usedElsewhere = allSites.some(s => s.id !== site.id && (s[modal] || []).includes(v));
              if (usedElsewhere) return false;
              return true;
            })}
          onAdd={(val) => addItem(modal, val)}
          onClose={() => setModal(null)}
        />
      )}
      {noteModal && (
        <NoteModal
          worker={noteModal.worker}
          siteId={site.id}
          siteName={site.name}
          note={site.notes?.[noteModal.worker] || ""}
          onSave={(text) => saveNote(noteModal.worker, text)}
          onClose={() => setNoteModal(null)}
        />
      )}
    </div>
  );
}

// ── ItemDetailScreen ───────────────────────────────────────────────────────────
function ItemDetailScreen({ item, catLabel, catIcon, onBack, details, onSave, isWorker }) {
  const [form, setForm] = useState({
    model:        details?.model        || "",
    godina:       details?.godina       || "",
    registracija: details?.registracija || "",
    cijena:       details?.cijena       || "",
    datumKupnje:  details?.datumKupnje  || "",
    datumRodenja: details?.datumRodenja || "",
    napomena:     details?.napomena     || "",
  });
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const field = (label, key, placeholder, type = "text") => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>{label}</label>
      {key === "napomena" ? (
        <textarea
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          rows={3}
          style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit" }}
        />
      ) : (
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none" }}
        />
      )}
    </div>
  );

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: "var(--ui-gradient, linear-gradient(135deg, #C73E3E 0%, #DF5050 100%))", padding: "20px 16px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>← Natrag</button>
          <MiniLogo size={34} />
          <div>
            <div style={{ fontSize: 11, opacity: 0.8, letterSpacing: 1, textTransform: "uppercase" }}>{catIcon} {catLabel}</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{item}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", marginBottom: 16 }}>
          {isWorker ? (
            <>
              {field("Datum rođenja", "datumRodenja", "", "date")}
              {field("Napomena", "napomena", "Dodatne informacije o radniku...")}
            </>
          ) : (
            <>
              {field("Model / Marka", "model", "npr. Volvo FH16, Kubota M7131...")}
              {field("Godina proizvodnje", "godina", "npr. 2019", "number")}
              {field("Registracija / Serijski broj", "registracija", "npr. ZG 1234 AB")}
              {field("Cijena kupnje (€)", "cijena", "npr. 85000", "number")}
              {field("Datum kupnje", "datumKupnje", "", "date")}
              {field("Napomena / Opis", "napomena", "Dodatne informacije...")}
            </>
          )}
        </div>

        <button onClick={handleSave} style={{
          width: "100%", padding: "14px 0",
          background: saved ? "#059669" : "var(--ui-gradient-btn, linear-gradient(180deg, #EF6B6B 0%, #DF5050 55%, #C73E3E 100%))",
          border: "none", color: "#fff", borderRadius: 14,
          fontSize: 16, fontWeight: 800, cursor: "pointer",
          transition: "background 0.3s"
        }}>{saved ? "✓ Spremljeno!" : "Spremi podatke"}</button>
      </div>
    </div>
  );
}

// ── BazaScreen ────────────────────────────────────────────────────────────────
function BazaScreen({ allData, onUpdate, onBack, cats, isAdmin, onAddCategory, onDeleteCategory, settingsBtn, onRename }) {
  const [tab, setTab] = useState("workers");
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editItem, setEditItem] = useState(null); // naziv koji se uređuje
  const [editValue, setEditValue] = useState("");
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🔧");
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null); // { name, catKey }
  const [allDetails, setAllDetails] = useState({});

  useEffect(() => {
    storage.get(ITEM_DETAILS_KEY).then(res => {
      if (res?.value) setAllDetails(JSON.parse(res.value));
    }).catch(() => {});
  }, []);

  const saveItemDetails = async (catKey, itemName, form) => {
    const key = `${catKey}:${itemName}`;
    const updated = { ...allDetails, [key]: form };
    setAllDetails(updated);
    try { await storage.set(ITEM_DETAILS_KEY, JSON.stringify(updated)); } catch (_) {}
  };

  const getItemDetails = (catKey, itemName) => allDetails[`${catKey}:${itemName}`] || null;

  // Ako je odabrana stavka — prikaži detalje
  if (selectedItem) {
    const cat_ = cats.find(c => c.key === selectedItem.catKey);
    return (
      <ItemDetailScreen
        item={selectedItem.name}
        catLabel={cat_?.label || selectedItem.catKey}
        catIcon={cat_?.icon || "📋"}
        isWorker={selectedItem.catKey === "workers"}
        onBack={() => setSelectedItem(null)}
        details={getItemDetails(selectedItem.catKey, selectedItem.name)}
        onSave={(form) => saveItemDetails(selectedItem.catKey, selectedItem.name, form)}
      />
    );
  }

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

  const startEdit = (name) => {
    setEditItem(name);
    setEditValue(name);
  };

  const confirmRename = async () => {
    const newVal = editValue.trim();
    if (!newVal || newVal === editItem) { setEditItem(null); return; }
    if (items.includes(newVal)) { setEditItem(null); return; }
    const updated = items.map(i => i === editItem ? newVal : i)
      .sort((a, b) => a.localeCompare(b, "hr", { numeric: true, sensitivity: "base" }));
    onUpdate(tab, updated);
    setEditItem(null);
    // Propagiraj promjenu kroz sve rasporede, sate i detalje
    if (onRename) await onRename(tab, editItem, newVal);
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
      <div style={{ background: "var(--ui-gradient, linear-gradient(135deg, #C73E3E 0%, #DF5050 100%))", padding: "20px 16px 0", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onBack} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>← Natrag</button>
            <MiniLogo size={34} />
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
          {filtered.map((item, i) => {
            const hasDetails = !!(allDetails[`${tab}:${item}`] && Object.values(allDetails[`${tab}:${item}`]).some(v => v));
            return (
            <div key={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              {editItem === item ? (
                /* Inline edit mode */
                <div style={{ display: "flex", gap: 8, flex: 1 }}>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setEditItem(null); }}
                    style={{ flex: 1, border: "1.5px solid #C73E3E", borderRadius: 8, padding: "6px 10px", fontSize: 14, outline: "none" }}
                  />
                  <button onClick={confirmRename} style={{ background: "#C73E3E", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✓</button>
                  <button onClick={() => setEditItem(null)} style={{ background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                /* Normal mode */
                <>
                  <button onClick={() => setSelectedItem({ name: item, catKey: tab })} style={{
                    background: "none", border: "none", textAlign: "left", cursor: "pointer",
                    flex: 1, display: "flex", alignItems: "center", gap: 8, padding: 0
                  }}>
                    <span style={{ fontSize: 15, color: "#1e293b", fontWeight: 500 }}>{item}</span>
                    {hasDetails && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6", display: "inline-block", flexShrink: 0 }} />}
                  </button>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startEdit(item)} style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", color: "#64748b", borderRadius: 8, padding: "5px 10px", fontSize: 13, cursor: "pointer" }}>✏️</button>
                    <button onClick={() => setConfirmDelete(item)} style={{ background: "#fef2f2", border: "none", color: "#ef4444", borderRadius: 8, padding: "5px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🗑</button>
                  </div>
                </>
              )}
            </div>
            );
          })}
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
  const regularSitesRaw = sites.filter(s => !s.permanent && cats.some(c => (s[c.key] || []).length > 0));
  const permanentSites = sites.filter(s => s.permanent);
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("hr-HR", { weekday: "long", day: "numeric", month: "numeric", year: "numeric" });

  const rightCats = cats.filter(c => c.key !== "workers");

  // ── Pametno balansiranje stupaca za print (samo redoslijed prikaza, ne mijenja stvarni raspored) ──
  // Gradilišta se sortiraju po broju redaka (najveće prvo), pa se svako idući dodaje u TRENUTNO KRAĆI stupac.
  // Time se izbjegava da veliko gradilište (10 ljudi) stoji pored malog (3-4) i ostavlja prazan prostor.
  const rowsOf = (site) => {
    const leftRows = (site.workers || []).length;
    const rightRows = rightCats.reduce((a, c) => a + (site[c.key] || []).length, 0);
    return Math.max(leftRows, rightRows, 1);
  };

  const regularSites = (() => {
    const sorted = [...regularSitesRaw].sort((a, b) => rowsOf(b) - rowsOf(a));
    const leftCol = [], rightCol = [];
    let leftHeight = 0, rightHeight = 0;
    sorted.forEach(site => {
      const h = rowsOf(site);
      if (leftHeight <= rightHeight) { leftCol.push(site); leftHeight += h; }
      else { rightCol.push(site); rightHeight += h; }
    });
    // Spoji natrag u jedan niz koji se prikazuje kao CSS grid (lijevo, desno, lijevo, desno...)
    const merged = [];
    const maxLen = Math.max(leftCol.length, rightCol.length);
    for (let i = 0; i < maxLen; i++) {
      if (leftCol[i]) merged.push(leftCol[i]);
      if (rightCol[i]) merged.push(rightCol[i]);
    }
    return merged;
  })();

  // ── Deterministički izračun zoom faktora na temelju stvarnog sadržaja ──
  const zoom = (() => {
    const HEADER_PX = 70;
    const SITE_HEADER_PX = 26; // naziv gradilišta + linija + razmak
    const ROW_PX = 16.5;       // jedan red (radnik/kamion/...)
    const SITE_GAP_PX = 12;    // razmak između kartica
    const FOOTER_PX = 8; // mali sigurnosni razmak na dnu

    const siteHeights = regularSites.map(site => SITE_HEADER_PX + rowsOf(site) * ROW_PX + SITE_GAP_PX);

    // Stupci su sad balansirani algoritmom gore, pa računamo stvarnu visinu svakog stupca po istom redoslijedu prikaza
    let leftCol = 0, rightCol = 0;
    siteHeights.forEach((h, i) => { if (i % 2 === 0) leftCol += h; else rightCol += h; });
    const sitesBlockHeight = Math.max(leftCol, rightCol);

    const permanentMaxRows = Math.max(1, ...permanentSites.map(s => (s.workers || []).length));
    const permanentBlockHeight = permanentMaxRows > 0 ? (SITE_HEADER_PX + permanentMaxRows * ROW_PX + 20) : 0;

    const totalHeight = HEADER_PX + sitesBlockHeight + permanentBlockHeight + FOOTER_PX;

    const A4_USABLE_HEIGHT_PX = 950;
    if (totalHeight > A4_USABLE_HEIGHT_PX) {
      return Math.max(0.35, A4_USABLE_HEIGHT_PX / totalHeight);
    }
    return 1;
  })();

  // Sadržaj koji se stvarno printa — bez fiksnog pozicioniranja, da Chrome ne duplicira stranice
  const printableContent = (
    <div style={{ zoom }}>
      {/* Page header */}
      <div style={{ borderBottom: "3px solid #1e293b", paddingBottom: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Gradprom — Raspored</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#1e293b" }}>{dateLabel}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "#64748b" }}>
            <span>👷 Radnici ukupno: </span>
            <strong style={{ color: "#1e293b", fontSize: 16 }}>
              {sites.reduce((a, s) => a + (s.workers || []).length, 0)}
            </strong>
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
            <button onClick={() => window.print()} style={{ flex: 1, padding: "13px 0", background: "linear-gradient(135deg, #C73E3E, #DF5050)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>🖨️ Ispiši / Spremi PDF</button>
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
function SidebarPalette({ allData, sites, isOpen, onToggle, onDragStartItem, onDragEndItem, dragItem, cats, userColors }) {
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
        background: "linear-gradient(135deg, #C73E3E, #DF5050)", color: "#fff",
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
function AnalysisScreen({ onBack, settingsBtn }) {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pinsOverride, setPinsOverride] = useState({});

  useEffect(() => {
    storage.get(ACTIVITY_LOG_KEY).then(res => {
      setLog(res?.value ? JSON.parse(res.value) : {});
      setLoading(false);
    }).catch(() => { setLog({}); setLoading(false); });
    storage.get(PINS_KEY).then(res => {
      if (res?.value) setPinsOverride(JSON.parse(res.value));
    }).catch(() => {});
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
      <div style={{ background: "var(--ui-gradient, linear-gradient(135deg, #C73E3E 0%, #DF5050 100%))", padding: "20px 16px 24px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>← Natrag</button>
          <MiniLogo size={34} />
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

        {/* PIN popis — vidljiv samo adminima */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginTop: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>🔑 Popis korisnika i PINova</div>
          {ENGINEERS.map((e, i) => (
            <div key={e.name} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: i < ENGINEERS.length - 1 ? "1px solid #f1f5f9" : "none"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{e.name}</span>
                {e.admin && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ui-color, #C73E3E)", background: "#fef2f2", borderRadius: 4, padding: "2px 6px" }}>ADMIN</span>}
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: pinsOverride[e.name] ? "#C73E3E" : "#64748b", letterSpacing: 3, fontFamily: "monospace" }}>
                {pinsOverride[e.name] || e.pin}
                {pinsOverride[e.name] && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ui-color, #C73E3E)", marginLeft: 6, letterSpacing: 0 }}>✏️</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── LandingScreen ─────────────────────────────────────────────────────────────
function LandingScreen({ onSelect, user, onLogout, settings, onSaveSettings, cats, userColors, onSaveColors }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div style={{
      minHeight: "100vh", background: "#ffffff",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24
    }}>
      {/* Settings button top right — visible only when logged in */}
      {user && (
        <button onClick={() => setSettingsOpen(true)} style={{
          position: "fixed", top: 16, right: 16,
          background: "#f1f5f9", border: "none", borderRadius: 10,
          width: 36, height: 36, fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)"
        }}>⚙️</button>
      )}
      {settingsOpen && user && (
        <SettingsPanel user={user} onClose={() => setSettingsOpen(false)} settings={settings} onSaveSettings={onSaveSettings} cats={cats} userColors={userColors} onSaveColors={onSaveColors} />
      )}
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {LOGO_URL ? (
            <img src={LOGO_URL} alt="Gradprom" style={{
              height: 80, marginBottom: 12, objectFit: "contain",
              filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.18))"
            }} />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: 16, background: BRAND_RED,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, margin: "0 auto 12px", color: "#fff"
            }}>🏗️</div>
          )}
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8, color: "#1e293b" }}>
            {user ? `Bok, ${user.name}!` : "Dobrodošli"}
          </div>
          <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4, color: "#64748b" }}>Što želite otvoriti?</div>
        </div>

        <button onClick={() => onSelect("raspored")} style={{
          width: "100%",
          background: `var(--ui-gradient-btn, linear-gradient(180deg, #EF6B6B 0%, #DF5050 55%, #C73E3E 100%))`,
          border: "none", borderRadius: 24,
          padding: "24px 22px", marginBottom: 16, cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", gap: 16,
          boxShadow: `0 8px 20px #DF505030, inset 0 1px 0 rgba(255,255,255,0.35)`
        }}>
          <span style={{ fontSize: 36 }}>📅</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Raspored gradilišta</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Dnevni raspored radnika, kamiona i strojeva</div>
          </div>
        </button>

        <button onClick={() => onSelect("sati")} style={{
          width: "100%",
          background: `var(--ui-gradient-btn, linear-gradient(180deg, #EF6B6B 0%, #DF5050 55%, #C73E3E 100%))`,
          border: "none", borderRadius: 24,
          padding: "24px 22px", marginBottom: 16, cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", gap: 16,
          boxShadow: `0 8px 20px #DF505030, inset 0 1px 0 rgba(255,255,255,0.35)`
        }}>
          <span style={{ fontSize: 36 }}>⏱️</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Radni sati</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Mjesečno praćenje sati po radniku</div>
          </div>
        </button>

        {user && (
          <button onClick={onLogout} style={{
            width: "100%", background: "#f1f5f9", border: "none", borderRadius: 12,
            padding: "12px 0", marginTop: 8, cursor: "pointer", color: "#64748b", fontSize: 13, fontWeight: 600
          }}>&#8592; Odjava</button>
        )}
      </div>
    </div>
  );
}

// ── HoursScreen ───────────────────────────────────────────────────────────────
function HoursScreen({ user, allWorkers, sites, onBack, settingsBtn }) {
  const today_ = new Date();
  const [yearMonth, setYearMonth] = useState(
    `${today_.getFullYear()}-${String(today_.getMonth() + 1).padStart(2, "0")}`
  );
  const [hoursData, setHoursData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("calendar"); // "calendar" | "workers"
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [search, setSearch] = useState("");
  const [editModal, setEditModal] = useState(null); // { worker, day }
  const [editValue, setEditValue] = useState("");
  const [dayNotes, setDayNotes] = useState({}); // { day: { worker: "napomena" } }

  const [y, m] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("hr-HR", { month: "long", year: "numeric" });
  const firstDayOfWeek = (new Date(y, m - 1, 1).getDay() + 6) % 7; // 0=Pon
  const DAY_LABELS = ["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"];

  // Učitaj napomene iz svih rasporeda u ovom mjesecu
  useEffect(() => {
    const loadNotes = async () => {
      const notes = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        try {
          const res = await storage.get(`raspored-day-${dateStr}`);
          if (res?.value) {
            const data = JSON.parse(res.value);
            const dayNote = {};
            (data.sites || []).forEach(site => {
              if (site.notes) Object.assign(dayNote, site.notes);
            });
            if (Object.keys(dayNote).length > 0) notes[d] = dayNote;
          }
        } catch (_) {}
      }
      setDayNotes(notes);
    };
    loadNotes();
  }, [yearMonth, y, m, daysInMonth]);

  useEffect(() => {
    setLoading(true);
    storage.get(hoursKey(yearMonth)).then(res => {
      setHoursData(res?.value ? JSON.parse(res.value) : {});
      setLoading(false);
    }).catch(() => { setHoursData({}); setLoading(false); });
  }, [yearMonth]);

  const saveHours = async (newData) => {
    setHoursData(newData);
    try { await storage.set(hoursKey(yearMonth), JSON.stringify(newData)); } catch (_) {}
  };

  const getDayHours = (workerName, day) => {
    if (hoursData && hoursData[workerName] && hoursData[workerName][day] !== undefined)
      return hoursData[workerName][day];
    return null;
  };

  const setDayHours = (workerName, day, value) => {
    const nd = { ...hoursData };
    if (!nd[workerName]) nd[workerName] = {};
    nd[workerName] = { ...nd[workerName], [day]: value };
    saveHours(nd);
  };

  const getMonthTotal = (workerName) => {
    if (!hoursData || !hoursData[workerName]) return 0;
    return Object.values(hoursData[workerName]).reduce((a, h) => a + (Number(h) || 0), 0);
  };

  const getDayTotal = (day) => {
    if (!hoursData) return 0;
    return allWorkers.reduce((a, w) => {
      const h = hoursData[w]?.[day];
      return a + (h !== undefined ? Number(h) : 0);
    }, 0);
  };

  const getDayWorkerCount = (day) => {
    if (!hoursData) return 0;
    return allWorkers.filter(w => hoursData[w]?.[day] > 0).length;
  };

  const changeMonth = (delta) => {
    const d = new Date(y, m - 1 + delta, 1);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setSelectedDay(null);
    setSelectedWorker(null);
  };

  const openEdit = (worker, day) => {
    const current = getDayHours(worker, day);
    setEditValue(current !== null ? String(current) : String(STANDARD_DAILY_HOURS));
    setEditModal({ worker, day });
  };

  const confirmEdit = () => {
    if (!editModal) return;
    const val = parseFloat(editValue.replace(",", "."));
    if (!isNaN(val) && val >= 0 && val <= 24) {
      setDayHours(editModal.worker, editModal.day, val);
    }
    setEditModal(null);
  };

  const filteredWorkers = allWorkers
    .filter(w => w.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "hr", { numeric: true, sensitivity: "base" }));

  // Ako je otvoren detalj radnika (iz workers view)
  if (selectedWorker) {
    return (
      <WorkerHoursDetail
        worker={selectedWorker}
        yearMonth={yearMonth}
        monthLabel={monthLabel}
        daysInMonth={daysInMonth}
        getDayHours={getDayHours}
        setDayHours={setDayHours}
        monthTotal={getMonthTotal(selectedWorker)}
        onBack={() => setSelectedWorker(null)}
      />
    );
  }

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "var(--ui-gradient, linear-gradient(135deg, #C73E3E 0%, #DF5050 100%))", padding: "20px 16px 0", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>← Natrag</button>
          <MiniLogo size={34} />
          <div>
            <div style={{ fontSize: 11, opacity: 0.8, letterSpacing: 1, textTransform: "uppercase" }}>{user.name}</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>⏱️ Radni sati</div>
          </div>
          </div>
          {settingsBtn}
        </div>

        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={() => changeMonth(-1)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 18, cursor: "pointer" }}>‹</button>
          <div style={{ fontSize: 16, fontWeight: 700, textTransform: "capitalize" }}>{monthLabel}</div>
          <button onClick={() => changeMonth(1)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 18, cursor: "pointer" }}>›</button>
        </div>

        {/* View tabs */}
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => { setView("calendar"); setSelectedDay(null); }} style={{
            flex: 1, padding: "8px 0", border: "none", borderRadius: "8px 8px 0 0",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: view === "calendar" ? "#fff" : "rgba(255,255,255,0.2)",
            color: view === "calendar" ? "#C73E3E" : "#fff"
          }}>📅 Po danu</button>
          <button onClick={() => { setView("workers"); setSelectedDay(null); }} style={{
            flex: 1, padding: "8px 0", border: "none", borderRadius: "8px 8px 0 0",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: view === "workers" ? "#fff" : "rgba(255,255,255,0.2)",
            color: view === "workers" ? "#C73E3E" : "#fff"
          }}>👷 Po radniku</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Učitavanje...</div>
      ) : view === "calendar" ? (
        /* ── KALENDAR VIEW ── */
        <div style={{ padding: 16 }}>
          {/* Mini kalendar */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
            {/* Dani u tjednu */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
              {DAY_LABELS.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{d}</div>
              ))}
            </div>
            {/* Dani u mjesecu */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const isSelected = selectedDay === day;
                const isToday = `${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}` === new Date().toISOString().slice(0,10);
                const workerCount = getDayWorkerCount(day);
                const isWeekend = ((firstDayOfWeek + day - 1) % 7) >= 5;
                return (
                  <button key={day} onClick={() => setSelectedDay(isSelected ? null : day)} style={{
                    padding: "8px 2px", border: "none", borderRadius: 8, cursor: "pointer",
                    background: isSelected ? "#C73E3E" : isToday ? "#fef2f2" : "transparent",
                    color: isSelected ? "#fff" : isWeekend ? "#94a3b8" : "#1e293b",
                    fontSize: 13, fontWeight: isToday ? 800 : 500,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2
                  }}>
                    <span>{day}</span>
                    {workerCount > 0 && (
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: isSelected ? "#fff" : "#C73E3E", opacity: 0.8 }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detalj odabranog dana */}
          {selectedDay ? (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
                {new Date(y, m-1, selectedDay).toLocaleDateString("hr-HR", { weekday: "long", day: "numeric", month: "long" })}
                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 8 }}>
                  {getDayWorkerCount(selectedDay)} radnika · {getDayTotal(selectedDay)}h ukupno
                </span>
              </div>
              <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
                {filteredWorkers.map((w, i) => {
                  const hours = getDayHours(w, selectedDay);
                  const hasNote = !!(dayNotes[selectedDay]?.[w]);
                  return (
                    <div key={w} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "11px 16px", borderBottom: i < filteredWorkers.length - 1 ? "1px solid #f1f5f9" : "none"
                    }}>
                      <span style={{ fontSize: 14, color: "#1e293b", fontWeight: 500 }}>
                        {w} {hasNote && <span title={dayNotes[selectedDay][w]} style={{ fontSize: 12 }}>⭐</span>}
                      </span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button onClick={() => setDayHours(w, selectedDay, 0)} style={{
                          fontSize: 11, padding: "3px 7px", borderRadius: 6, border: "1.5px solid #fecaca",
                          background: hours === 0 ? "#ef4444" : "#fef2f2", color: hours === 0 ? "#fff" : "#ef4444",
                          cursor: "pointer", fontWeight: 600
                        }}>0h</button>
                        <button onClick={() => setDayHours(w, selectedDay, STANDARD_DAILY_HOURS)} style={{
                          fontSize: 11, padding: "3px 7px", borderRadius: 6, border: "1.5px solid #bbf7d0",
                          background: hours === STANDARD_DAILY_HOURS ? "#059669" : "#ecfdf5", color: hours === STANDARD_DAILY_HOURS ? "#fff" : "#059669",
                          cursor: "pointer", fontWeight: 600
                        }}>{STANDARD_DAILY_HOURS}h</button>
                        <button onClick={() => openEdit(w, selectedDay)} style={{
                          fontSize: 13, fontWeight: 800, padding: "3px 10px", borderRadius: 6,
                          border: "1.5px solid #e2e8f0",
                          background: hours !== null && hours !== 0 && hours !== STANDARD_DAILY_HOURS ? "#fef2f2" : "#fff",
                          color: hours !== null && hours !== 0 && hours !== STANDARD_DAILY_HOURS ? "#C73E3E" : "#94a3b8",
                          cursor: "pointer", minWidth: 42
                        }}>{hours !== null ? `${hours}h` : "—"}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 32, fontSize: 14 }}>
              Klikni na dan u kalendaru da vidiš sate
            </div>
          )}
        </div>
      ) : (
        /* ── RADNICI VIEW ── */
        <div style={{ padding: 16 }}>
          <input
            placeholder="Traži radnika..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 12 }}
          />
          <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
            {filteredWorkers.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>Nema radnika.</div>
            )}
            {filteredWorkers.map((w, i) => {
              const total = getMonthTotal(w);
              return (
                <button key={w} onClick={() => setSelectedWorker(w)} style={{
                  display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", border: "none", background: "none", cursor: "pointer",
                  borderBottom: i < filteredWorkers.length - 1 ? "1px solid #f1f5f9" : "none", textAlign: "left"
                }}>
                  <span style={{ fontSize: 15, color: "#1e293b", fontWeight: 500 }}>{w}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: total > 0 ? "#C73E3E" : "#cbd5e1" }}>{total}h</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 1000 }} onClick={() => setEditModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "24px 16px 32px", boxSizing: "border-box" }}>
            <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, textAlign: "center" }}>
              {editModal.worker} — {editModal.day}. {monthLabel}
            </h3>
            <input
              autoFocus type="number" step="0.5" min="0" max="24"
              value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirmEdit()}
              style={{ width: "100%", boxSizing: "border-box", textAlign: "center", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "16px", fontSize: 28, fontWeight: 800, outline: "none", marginBottom: 16 }}
            />
            <button onClick={confirmEdit} style={{ width: "100%", background: "#C73E3E", color: "#fff", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Spremi sate</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── WorkerHoursDetail ─────────────────────────────────────────────────────────
function WorkerHoursDetail({ worker, yearMonth, monthLabel, daysInMonth, getDayHours, setDayHours, monthTotal, onBack }) {
  const [editDay, setEditDay] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [workerNotes, setWorkerNotes] = useState({}); // { day: "napomena" }

  const [y, m] = yearMonth.split("-").map(Number);

  // Učitaj napomene za ovog radnika iz rasporeda svakog dana
  useEffect(() => {
    const loadNotes = async () => {
      const notes = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        try {
          const res = await storage.get(`raspored-day-${dateStr}`);
          if (res?.value) {
            const data = JSON.parse(res.value);
            (data.sites || []).forEach(site => {
              if (site.notes?.[worker]) notes[d] = site.notes[worker];
            });
          }
        } catch (_) {}
      }
      setWorkerNotes(notes);
    };
    loadNotes();
  }, [worker, yearMonth, y, m, daysInMonth]);

  const dayLabel = (day) => {
    const d = new Date(y, m - 1, day);
    return d.toLocaleDateString("hr-HR", { weekday: "short" });
  };

  const isWeekend = (day) => {
    const dow = new Date(y, m - 1, day).getDay();
    return dow === 0 || dow === 6;
  };

  const openEdit = (day) => {
    const current = getDayHours(worker, day);
    setEditValue(current !== null ? String(current) : String(STANDARD_DAILY_HOURS));
    setEditDay(day);
  };

  const confirmEdit = () => {
    const val = parseFloat(editValue.replace(",", "."));
    if (!isNaN(val) && val >= 0 && val <= 24) {
      setDayHours(worker, editDay, val);
    }
    setEditDay(null);
  };

  const quickSet = (day, val) => {
    setDayHours(worker, day, val);
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: "var(--ui-gradient, linear-gradient(135deg, #C73E3E 0%, #DF5050 100%))", padding: "20px 16px 0", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>← Natrag</button>
          <MiniLogo size={34} />
          <div>
            <div style={{ fontSize: 11, opacity: 0.8, letterSpacing: 1, textTransform: "uppercase" }}>{monthLabel}</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{worker}</div>
          </div>
        </div>
        <div style={{ paddingBottom: 16 }}>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 16px", display: "inline-block" }}>
            <span style={{ fontSize: 12, opacity: 0.85 }}>Ukupno: </span>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{monthTotal}h</span>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const hours = getDayHours(worker, day);
            const weekend = isWeekend(day);
            const note = workerNotes[day];
            return (
              <div key={day} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderBottom: day < daysInMonth ? "1px solid #f1f5f9" : "none",
                background: weekend ? "#f8fafc" : "#fff"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: weekend ? "#cbd5e1" : "#1e293b", minWidth: 24 }}>{day}.</span>
                  <span style={{ fontSize: 12, color: "#94a3b8", textTransform: "capitalize" }}>{dayLabel(day)}</span>
                  {note && <span title={note} style={{ fontSize: 12, cursor: "help" }}>⭐</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => quickSet(day, 0)} style={{
                    fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1.5px solid #fecaca",
                    background: hours === 0 ? "#ef4444" : "#fef2f2", color: hours === 0 ? "#fff" : "#ef4444",
                    cursor: "pointer", fontWeight: 600
                  }}>0h</button>
                  <button onClick={() => quickSet(day, STANDARD_DAILY_HOURS)} style={{
                    fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1.5px solid #bbf7d0",
                    background: hours === STANDARD_DAILY_HOURS ? "#059669" : "#ecfdf5", color: hours === STANDARD_DAILY_HOURS ? "#fff" : "#059669",
                    cursor: "pointer", fontWeight: 600
                  }}>{STANDARD_DAILY_HOURS}h</button>
                  <button onClick={() => openEdit(day)} style={{
                    fontSize: 13, fontWeight: 800, padding: "5px 12px", borderRadius: 6,
                    border: "1.5px solid #e2e8f0",
                    background: hours !== null && hours !== 0 && hours !== STANDARD_DAILY_HOURS ? "#eff6ff" : "#fff",
                    color: hours !== null && hours !== 0 && hours !== STANDARD_DAILY_HOURS ? "#1e40af" : "#94a3b8",
                    cursor: "pointer", minWidth: 48
                  }}>{hours !== null ? `${hours}h` : "—"}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit modal */}
      {editDay && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 1000 }} onClick={() => setEditDay(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "24px 16px 32px", boxSizing: "border-box" }}>
            <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, textAlign: "center" }}>
              {worker} — {editDay}. {monthLabel}
            </h3>
            <input
              autoFocus type="number" step="0.5" min="0" max="24"
              value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirmEdit()}
              style={{
                width: "100%", boxSizing: "border-box", textAlign: "center",
                border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "16px",
                fontSize: 28, fontWeight: 800, outline: "none", marginBottom: 16
              }}
            />
            <button onClick={confirmEdit} style={{
              width: "100%", background: "#1e40af", color: "#fff", border: "none", borderRadius: 10,
              padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer"
            }}>Spremi sate</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LoginScreen ───────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pinsOverride, setPinsOverride] = useState({});

  useEffect(() => {
    storage.get(PINS_KEY).then(res => {
      if (res?.value) setPinsOverride(JSON.parse(res.value));
    }).catch(() => {});
  }, []);

  const handleLogin = () => {
    if (pin.length < 4) { setError("Upiši PIN."); return; }
    const eng = ENGINEERS.find(e => {
      const effectivePin = pinsOverride[e.name] || e.pin;
      return effectivePin === pin;
    });
    if (!eng) { setError("Pogrešan PIN."); setPin(""); return; }
    onLogin(eng);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: "100%", maxWidth: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.1)", border: "1px solid #f1f5f9" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          {LOGO_URL ? (
            <img src={LOGO_URL} alt="Gradprom" style={{
              height: 70, marginBottom: 8, objectFit: "contain",
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))"
            }} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: 14, background: BRAND_RED,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, margin: "0 auto 8px", color: "#fff"
            }}>🏗️</div>
          )}
          <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 14 }}>Upiši PIN za nastavak</p>
        </div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>PIN</label>
        <input autoFocus type="password" placeholder="••••" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 24, letterSpacing: 10, marginBottom: 6, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
        {error && <p style={{ color: "#ef4444", fontSize: 13, margin: "4px 0 10px", textAlign: "center" }}>{error}</p>}
        <button onClick={handleLogin} style={{
          width: "100%", padding: "15px 0",
          background: `var(--ui-gradient-btn, linear-gradient(180deg, #EF6B6B 0%, #DF5050 55%, #C73E3E 100%))`,
          border: "none", color: "#fff",
          borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: "pointer", marginTop: 8,
          boxShadow: `0 8px 20px #DF505030, inset 0 1px 0 rgba(255,255,255,0.35)`
        }}>Prijavi se</button>
        <p style={{ textAlign: "center", fontSize: 12, color: "#cbd5e1", marginTop: 16, marginBottom: 0 }}>Kontaktiraj admina za PIN pristup.</p>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [settings, saveSettings] = useSettings();
  const [userColors, saveColors] = useColors();

  // Primijeni boje kao CSS varijable — svi elementi koji ih koriste automatski se ažuriraju
  useEffect(() => {
    const ui = userColors?.ui || DEFAULT_UI_COLOR;
    const uiDark = ui; // koristimo istu boju, samo tamniju varijantu
    const r = document.documentElement;
    r.style.setProperty("--ui-color", ui);
    r.style.setProperty("--ui-gradient", `linear-gradient(135deg, ${ui}CC 0%, ${ui} 100%)`);
    r.style.setProperty("--ui-gradient-btn", `linear-gradient(180deg, ${ui}DD 0%, ${ui} 55%, ${ui}BB 100%)`);
    // Boje kategorija
    const allCatKeys = ["workers","trucks","trailers","machines"];
    allCatKeys.forEach(key => {
      const c = userColors?.cats?.[key];
      if (c) {
        r.style.setProperty(`--cat-color-${key}`, c.color);
        r.style.setProperty(`--cat-bg-${key}`, c.bg || c.color + "18");
        r.style.setProperty(`--cat-border-${key}`, c.border || c.color);
      } else {
        r.style.removeProperty(`--cat-color-${key}`);
        r.style.removeProperty(`--cat-bg-${key}`);
        r.style.removeProperty(`--cat-border-${key}`);
      }
    });
  }, [userColors]);
  const [currentDate, setCurrentDate] = useState(today());
  const [sites, setSites] = useState(null);
  const [allData, setAllData] = useState({
    workers: initialWorkers, trucks: initialTrucks,
    trailers: initialTrailers, machines: initialMachines,
  });
  const [cats, setCats] = useState(DEFAULT_CATS);
  const [itemDetails, setItemDetails] = useState({});

  useEffect(() => {
    storage.get(ITEM_DETAILS_KEY).then(res => {
      if (res?.value) setItemDetails(JSON.parse(res.value));
    }).catch(() => {});
  }, []);
  const [loading, setLoading] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [lastEditor, setLastEditor] = useState(null);
  const [showAddSite, setShowAddSite] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [dragItem, setDragItem] = useState(null); // { siteId, cat, value }
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [screen, setScreen] = useState("landing");
  const [pendingDest, setPendingDest] = useState(null); // "raspored" ili "sati" — pamti odabir prije logina
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

  // ── Preimenovanje — propagira kroz sve rasporede, sate, detalje i napomene ──
  const handleRename = async (catKey, oldName, newName) => {
    try {
      // 1) Ažuriraj sve rasporede (prošli + budući dani u Supabaseu)
      const { data: rows } = await supabase
        .from("raspored")
        .select("id, data")
        .like("id", "raspored-day-%");
      if (rows) {
        for (const row of rows) {
          let changed = false;
          const data = row.data || {};
          const newSites = (data.sites || []).map(site => {
            const catItems = site[catKey] || [];
            if (!catItems.includes(oldName)) return site;
            changed = true;
            const newSite = { ...site, [catKey]: catItems.map(v => v === oldName ? newName : v) };
            // Ažuriraj i napomene ako postoje (samo za radnike)
            if (site.notes && site.notes[oldName] !== undefined) {
              const notes = { ...site.notes };
              notes[newName] = notes[oldName];
              delete notes[oldName];
              newSite.notes = notes;
            }
            return newSite;
          });
          if (changed) {
            await supabase.from("raspored").upsert({ id: row.id, data: { ...data, sites: newSites }, updated_at: new Date().toISOString() });
          }
        }
      }

      // 2) Ažuriraj radne sate (svi ključevi raspored-hours-*)
      const { data: hoursRows } = await supabase
        .from("raspored")
        .select("id, data")
        .like("id", "raspored-hours-%");
      if (hoursRows) {
        for (const row of hoursRows) {
          const data = row.data || {};
          if (data[oldName] !== undefined) {
            const newData = { ...data, [newName]: data[oldName] };
            delete newData[oldName];
            await supabase.from("raspored").upsert({ id: row.id, data: newData, updated_at: new Date().toISOString() });
          }
        }
      }

      // 3) Ažuriraj item detalje (premjesti sa starog ključa na novi)
      const detailsRes = await storage.get(ITEM_DETAILS_KEY);
      if (detailsRes?.value) {
        const details = JSON.parse(detailsRes.value);
        const oldKey = `${catKey}:${oldName}`;
        const newKey = `${catKey}:${newName}`;
        if (details[oldKey]) {
          details[newKey] = details[oldKey];
          delete details[oldKey];
          await storage.set(ITEM_DETAILS_KEY, JSON.stringify(details));
        }
      }

      // 4) Ažuriraj trenutno prikazane sites u memoriji
      if (sites) {
        const newSites = sites.map(site => {
          const catItems = site[catKey] || [];
          if (!catItems.includes(oldName)) return site;
          const newSite = { ...site, [catKey]: catItems.map(v => v === oldName ? newName : v) };
          if (site.notes?.[oldName] !== undefined) {
            const notes = { ...site.notes, [newName]: site.notes[oldName] };
            delete notes[oldName];
            newSite.notes = notes;
          }
          return newSite;
        });
        setSites(newSites);
      }

    } catch (err) {
      console.error("Rename propagation error:", err);
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
  const totals = cats.map(c => sites ? sites.reduce((a, s) => a + (s[c.key] || []).length, 0) : 0);

  const fontSizeMap = { small: "13px", normal: "15px", large: "18px" };
  const appFont = fontSizeMap[settings.fontSize] || "15px";

  // 1) Landing — izbornik prikazan ODMAH; ako korisnik već nije prijavljen, prvo traži login
  if (screen === "landing") return (
    <div style={{ fontSize: appFont }}>
      <LandingScreen
        user={user}
        settings={settings} onSaveSettings={saveSettings}
        cats={cats} userColors={userColors} onSaveColors={saveColors}
        onLogout={() => { setUser(null); setScreen("landing"); }}
        onSelect={(dest) => {
          if (user) { setScreen(dest); }
          else { setPendingDest(dest); setScreen("login"); }
        }}
      />
    </div>
  );

  // 2) Login — traži se tek nakon što korisnik odabere što želi otvoriti
  if (screen === "login" || !user) return (
    <div style={{ fontSize: appFont }}>
      <LoginScreen onLogin={(u) => { setUser(u); setScreen(pendingDest || "raspored"); }} />
    </div>
  );

  const settingsBtn = <SettingsButton user={user} settings={settings} onSaveSettings={saveSettings} cats={cats} userColors={userColors} onSaveColors={saveColors} />;

  if (screen === "sati") return (
    <div style={{ fontSize: appFont }}>
      <HoursScreen user={user} allWorkers={allData.workers || []} sites={sites || []} onBack={() => setScreen("landing")} settingsBtn={settingsBtn} />
    </div>
  );

  if (screen === "baza") return (
    <div style={{ fontSize: appFont }}>
      <BazaScreen allData={allData} onUpdate={updateBazaCat} onBack={() => setScreen("raspored")} cats={cats} isAdmin={user.admin} onAddCategory={addCategory} onDeleteCategory={deleteCategory} settingsBtn={settingsBtn} onRename={handleRename} />
    </div>
  );

  if (screen === "analiza" && user.admin) return (
    <div style={{ fontSize: appFont }}>
      <AnalysisScreen onBack={() => setScreen("raspored")} settingsBtn={settingsBtn} />
    </div>
  );

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", fontSize: appFont }}>
      {/* Header */}
      <div style={{ background: "var(--ui-gradient, linear-gradient(135deg, #C73E3E 0%, #DF5050 100%))", padding: "20px 16px 0", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <MiniLogo size={34} />
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
          </div>
          {/* Totals + Settings */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>{settingsBtn}</div>
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
                  onDragEndItem={handleDragEndItem} onDropItem={handleDropItem} cats={cats} userColors={userColors} itemDetails={itemDetails} currentDate={currentDate} />
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
          userColors={userColors}
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
        <button onClick={() => setScreen("landing")} style={{ background: "none", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer" }}>&#8592; Izbornik</button>
        <button onClick={() => setScreen("baza")} style={{ background: "none", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#1e40af", cursor: "pointer" }}>📋 Baza</button>
        {user.admin && (
          <button onClick={() => setScreen("analiza")} style={{ background: "none", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#059669", cursor: "pointer" }}>📊 Analiza</button>
        )}
        <button onClick={() => setShowPrint(true)} style={{ background: "none", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#1e293b", cursor: "pointer" }}>🖨️ Ispiši</button>
        {!readOnly && (
          <button onClick={() => setShowAddSite(true)} style={{ background: "linear-gradient(135deg, #C73E3E, #DF5050)", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>+ Gradilište</button>
        )}
      </div>

      {showPrint && sites && <PrintModal sites={sites} date={currentDate} onClose={() => setShowPrint(false)} cats={cats} />}
    </div>
  );
}
