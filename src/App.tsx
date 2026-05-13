import React, { useState, useEffect, useRef } from 'react';
import {
  Truck, Camera, CheckCircle2, ChevronRight, ChevronLeft,
  Clock, MapPin, AlertTriangle, User, ShieldCheck,
  Edit3, FileText, Lock, EyeOff, Plus, X,
  Download, RefreshCw, Check, Hash, Gauge,
  Building2, LogOut, Settings, Copy, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SignaturePad } from './components/SignaturePad';

// ─── Style Tokens ───────────────────────────────────────────────────────────
const PRIMARY   = "h-[72px] w-full bg-[#FF6321] text-white font-black rounded-2xl flex items-center justify-center text-xl active:scale-[0.96] transition-all shadow-lg px-6 mb-4 disabled:opacity-50 disabled:active:scale-100";
const SECONDARY = "h-[60px] w-full bg-slate-100 text-slate-800 font-bold rounded-xl flex items-center justify-center text-base active:scale-[0.98] transition-all mb-4";
const INPUT     = "w-full h-16 bg-white border-2 border-slate-200 rounded-xl px-4 font-bold text-lg outline-none focus:border-[#FF6321] transition-all mb-4";
const SELECT    = "w-full h-16 bg-white border-2 border-slate-200 rounded-xl px-4 font-bold text-lg outline-none focus:border-[#FF6321] transition-all mb-4 appearance-none";
const LABEL     = "text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1";
const CARD      = "bg-white border border-slate-100 rounded-[28px] p-6 shadow-sm";

// ─── Company Data ────────────────────────────────────────────────────────────
type CompanyId = 'auto-misselwitz' | 'swientek-glaeser';

const COMPANIES: Record<CompanyId, {
  id: CompanyId; name: string; short: string; street: string; zip: string;
  city: string; phone: string; email: string; gf: string; logo: string;
}> = {
  'auto-misselwitz': {
    id: 'auto-misselwitz',
    name: 'Auto-Misselwitz GmbH',
    short: 'Auto Misselwitz',
    street: 'Mühlenstraße 18',
    zip: '06179',
    city: 'Teutschenthal OT Holleben',
    phone: '0345 / 61 38 433',
    email: 'info@auto-misselwitz.de',
    gf: 'Jens Förster',
    logo: '/logo-misselwitz.png',
  },
  'swientek-glaeser': {
    id: 'swientek-glaeser',
    name: 'Swientek & Gläser GmbH',
    short: 'Swientek & Gläser',
    street: 'Herrfurthstraße 10',
    zip: '06217',
    city: 'Merseburg',
    phone: '03461 - 50 35 32',
    email: 'foerster@swientek-glaeser.de',
    gf: 'Jens Förster',
    logo: '/logo-swientek.png',
  },
};

const FIXED_DESTINATIONS = [
  { id: 'am-holleben',          label: 'Auto-Misselwitz GmbH – Holleben',        sub: 'Mühlenstraße 18 · 06179 Teutschenthal OT Holleben', street: 'Mühlenstraße 18',   houseNum: '', zip: '06179', city: 'Teutschenthal OT Holleben' },
  { id: 'am-werkstatt-holleben',label: 'Auto-Misselwitz – Werkstatt Holleben',   sub: 'Werkstatt · Mühlenstraße 18 · 06179 Teutschenthal OT Holleben', street: 'Mühlenstraße 18', houseNum: '', zip: '06179', city: 'Teutschenthal OT Holleben' },
  { id: 'sg-weissenfels',       label: 'Swientek & Gläser – Weißenfels',         sub: 'Kleben Nr. 8 · 06667 Weißenfels',                   street: 'Kleben Nr. 8',       houseNum: '', zip: '06667', city: 'Weißenfels' },
  { id: 'sg-merseburg',         label: 'Swientek & Gläser – Merseburg',          sub: 'Herrfurthstraße 10 · 06217 Merseburg',              street: 'Herrfurthstraße 10', houseNum: '', zip: '06217', city: 'Merseburg' },
];

const STATUSES = ["Angenommen","Auf dem Weg","Ankunft","Dokumentation","Transport","Abgeschlossen"];

const PRE_DAMAGE_CATS = [
  { id: 'Karosserie',    label: 'Karosserie' },
  { id: 'Verglasung',    label: 'Verglasung' },
  { id: 'Reifen_Felgen', label: 'Reifen / Felgen' },
  { id: 'Beleuchtung',   label: 'Beleuchtung' },
  { id: 'Besonderheiten',label: 'Besonderheiten' },
];

// ─── Types ────────────────────────────────────────────────────────────────────
type ServiceType = 'transport' | 'pannenhilfe' | 'notoeffnung';
type View = 'login'|'dashboard'|'basics'|'detail'|'service'|'destination'|'presence'|'docs'|'damages'|'sigs'|'notes'|'summary'|'admin';

interface JobState {
  id: string; uid: string; company: CompanyId|'';
  orderId: string; driverName: string; driverVehicle: string;
  statusIndex: number; timestamps: Record<string,string>;
  licensePlate: string; vehicleModel: string;
  customerDriverName: string; ownerName: string;
  phone: string; address: string; zip: string; city: string;
  serviceType: ServiceType; isSevereAccident: boolean;
  isCustomerPresent: boolean|null; serviceNotes: string;
  continueJourneyPossible: boolean|null; identityChecked: boolean;
  waivedSignature: boolean; refusedSignature: boolean; customerCrashed: boolean;
  customerTravelingAlong: boolean|null;
  destinationType: string; destName: string; destStreet: string;
  destHouseNum: string; destZip: string; destCity: string;
  customerEmail: string;
  customerStreet: string; customerHouseNum: string;
  customerZip: string; customerCity: string;
  kundeDa: string; officeNotes: string;
  damagesChecked: boolean; noSpecialNotes: boolean;
  liabilityHelp: string;
  photos: Record<string,string[]>;
  preDamages: Record<string,{isDefect:boolean;photos:string[];note?:string}>;
  signatures: { privacy:string|null; order:string|null; liability:string|null; liabilityDriver:string|null };
}

// ─── Photo entry helpers (backward-compat: old data stored urls as plain strings) ──
type PhotoEntry = { url: string; note: string };
const photoUrl  = (p: any): string => (typeof p === 'string' ? p : p?.url  ?? '');
const photoNote = (p: any): string => (typeof p === 'string' ? '' : p?.note ?? '');
const toPhotoEntry = (p: any): PhotoEntry => ({ url: photoUrl(p), note: photoNote(p) });

// ─── Helpers ──────────────────────────────────────────────────────────────────
const nowISO = () => new Date().toISOString();
const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '–';
const fmtDate = (iso?: string) =>
  new Date(iso||Date.now()).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
const co = (id: CompanyId|'') => COMPANIES[id as CompanyId] || COMPANIES['auto-misselwitz'];
const preDmgSummary = (pd: Record<string,any>) => {
  const items = Object.entries(pd).filter(([,d])=>d.isDefect).map(([k,d])=>`${k}${d.note?': '+d.note:''}`);
  return items.length ? items.join('; ') : 'Keine Vorschäden dokumentiert';
};

// ─── Initial State ────────────────────────────────────────────────────────────
const mkState = (): JobState => {
  const sp = new URLSearchParams(window.location.search);
  const uid = sp.get('uid') || localStorage.getItem('last_uid') || '';
  if (uid) localStorage.setItem('last_uid', uid);
  return {
    id: localStorage.getItem('current_job_id') || Math.random().toString(36).substring(7),
    uid,
    company: (localStorage.getItem('selected_company') as CompanyId) || '',
    orderId: '', driverName: localStorage.getItem('selected_driver')||'',
    driverVehicle: localStorage.getItem('selected_vehicle')||'',
    statusIndex: 0, timestamps: { accepted: nowISO() },
    licensePlate: '', vehicleModel: '', customerDriverName: '', ownerName: '',
    phone: '', address: '', zip: '', city: '',
    serviceType: 'transport', isSevereAccident: false,
    isCustomerPresent: null, serviceNotes: '', continueJourneyPossible: null,
    identityChecked: false, waivedSignature: false, refusedSignature: false,
    customerCrashed: false, customerTravelingAlong: null,
    destinationType: '', destName: '', destStreet: '', destHouseNum: '', destZip: '', destCity: '',
    customerEmail: '', customerStreet: '', customerHouseNum: '', customerZip: '', customerCity: '',
    kundeDa: '', officeNotes: '', damagesChecked: false, noSpecialNotes: false,
    liabilityHelp: '',
    photos: {}, preDamages: {},
    signatures: { privacy: null, order: null, liability: null, liabilityDriver: null },
  };
};

// ════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView]   = useState<View>('login');
  const [role, setRole]   = useState<'driver'|'admin'>('driver');
  const [job,  setJob]    = useState<JobState>(mkState);
  const [isSyncing, setIsSyncing] = useState(false);
  const [adminPassword, setAdminPassword] = useState(() => localStorage.getItem('admin_pw')||'admin');
  const [drivers, setDrivers] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<{id:string;label:string;plate:string}[]>([]);

  useEffect(() => {
    fetch('/api/drivers').then(r => r.json()).then(data => setDrivers(data.map((d:any) => d.name))).catch(() => {});
    fetch('/api/vehicles').then(r => r.json()).then(setVehicles).catch(() => {});
  }, []);

  // Restore job from server if a current_job_id is stored
  useEffect(() => {
    const savedId = localStorage.getItem('current_job_id');
    if (!savedId) return;
    fetch(`/api/jobs/${savedId}`)
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (res?.data && res.status !== 'Abgeschlossen (Exportiert)') {
          setJob({ ...mkState(), ...res.data, id: savedId });
          const savedView = (localStorage.getItem('current_view') || 'detail') as View;
          if (savedView !== 'login' && savedView !== 'admin') {
            setView(savedView);
          } else {
            setView('detail');
          }
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { localStorage.setItem('current_job_id', job.id); }, [job.id]);
  useEffect(() => { if (view !== 'login' && view !== 'admin' && view !== 'dashboard') localStorage.setItem('current_view', view); }, [view]);
  useEffect(() => { localStorage.setItem('admin_pw', adminPassword); }, [adminPassword]);

  const sync = async (j: JobState) => {
    setIsSyncing(true);
    try {
      await fetch('/api/jobs', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id: j.id, data: j, status: STATUSES[j.statusIndex] }),
      });
    } catch {}
    finally { setIsSyncing(false); }
  };

  const upd = (patch: Partial<JobState>) => {
    setJob(prev => { const next = {...prev, ...patch}; sync(next); return next; });
  };

  const uploadFile = async (field: string, file: File|Blob): Promise<string|null> => {
    const fd = new FormData();
    fd.append(field, file);
    try {
      const r = await fetch(`/api/upload/${job.id}`, {method:'POST', body:fd});
      if (!r.ok) throw new Error();
      const d = await r.json();
      return d[0].path;
    } catch {
      alert('Fehler beim Hochladen. Bitte Internet prüfen.');
      return null;
    }
  };

  if (view === 'login')
    return <Login setRole={setRole} setView={setView} setJob={setJob} adminPassword={adminPassword} drivers={drivers} vehicles={vehicles} />;
  if (role === 'admin')
    return <Admin setView={setView} setRole={setRole} adminPassword={adminPassword} setAdminPassword={setAdminPassword} drivers={drivers} vehicles={vehicles} setDrivers={setDrivers} setVehicles={setVehicles} />;

  return (
    <div className="flex flex-col h-screen bg-white max-w-md mx-auto shadow-2xl relative overflow-hidden font-sans border-x border-slate-100">
      {isSyncing && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#FF6321] animate-pulse z-50" />
      )}
      <div className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          {view==='dashboard'   && <Dashboard    key="dash" setView={setView} setJob={setJob} job={job} />}
          {view==='basics'      && <Basics        key="bas"  setView={setView} job={job} upd={upd} drivers={drivers} vehicles={vehicles} />}
          {view==='detail'      && <Detail        key="det"  setView={setView} job={job} upd={upd} />}
          {view==='service'     && <ServiceScreen key="svc"  setView={setView} job={job} upd={upd} uploadFile={uploadFile} />}
          {view==='destination' && <Destination   key="dst"  setView={setView} job={job} upd={upd} />}
          {view==='presence'    && <Presence      key="pre"  setView={setView} job={job} upd={upd} />}
          {view==='docs'        && <Docs          key="doc"  setView={setView} job={job} upd={upd} uploadFile={uploadFile} />}
          {view==='damages'     && <Damages       key="dmg"  setView={setView} job={job} upd={upd} uploadFile={uploadFile} />}
          {view==='sigs'        && <Sigs          key="sig"  setView={setView} job={job} upd={upd} uploadFile={uploadFile} />}
          {view==='notes'       && <Notes         key="nte"  setView={setView} job={job} upd={upd} />}
          {view==='summary'     && <Summary       key="sum"  setView={setView} job={job} upd={upd} uploadFile={uploadFile} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════════
const Login = ({ setRole, setView, setJob, adminPassword, drivers, vehicles }: any) => {
  const [step, setStep] = useState<'company'|'driver'|'admin'>('company');
  const [selCompany, setSelCompany] = useState<CompanyId|''>('');
  const [selDriver, setSelDriver]   = useState('');
  const [selVehicle, setSelVehicle] = useState('');
  const [adminUser, setAdminUser]   = useState('');
  const [adminPass, setAdminPass]   = useState('');
  const [err, setErr] = useState('');

  const handleDriverLogin = () => {
    if (!selCompany || !selDriver || !selVehicle) return;
    localStorage.setItem('selected_company', selCompany);
    localStorage.setItem('selected_driver', selDriver);
    localStorage.setItem('selected_vehicle', selVehicle);
    localStorage.removeItem('current_job_id');
    localStorage.removeItem('current_view');
    setJob(mkState());
    setRole('driver');
    setView('dashboard');
  };

  const handleAdminLogin = () => {
    if (adminUser === 'admin' && adminPass === adminPassword) {
      setRole('admin'); setView('admin');
    } else {
      setErr('Ungültige Anmeldedaten');
      setTimeout(() => setErr(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {step === 'company' && (
          <motion.div key="company" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className="w-full">
            <div className="w-20 h-20 bg-[#FF6321] rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-200">
              <Truck size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-black text-center mb-2 tracking-tighter">AppSchleppen</h1>
            <p className="text-slate-400 text-center text-xs font-black uppercase tracking-widest mb-10">Einsatzdokumentation</p>

            <p className={LABEL + " text-center mb-4"}>Unternehmen wählen</p>
            <div className="grid grid-cols-1 gap-4 mb-8">
              {(Object.values(COMPANIES) as typeof COMPANIES[CompanyId][]).map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelCompany(c.id); setStep('driver'); }}
                  className="w-full bg-white border-2 border-slate-100 rounded-[24px] p-5 flex items-center gap-5 active:scale-[0.98] transition-all hover:border-[#FF6321] shadow-sm"
                >
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0 border border-slate-100">
                    <img src={c.logo} alt={c.short} className="w-full h-full object-contain p-1"
                      onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                    <Truck size={28} className="text-[#FF6321] absolute" style={{display:'none'}} />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-lg tracking-tight">{c.short}</p>
                    <p className="text-xs text-slate-400 font-bold">{c.street} · {c.zip} {c.city}</p>
                  </div>
                  <ChevronRight className="text-slate-200 ml-auto" />
                </button>
              ))}
            </div>

            <button onClick={() => setStep('admin')} className={SECONDARY}>
              <Settings size={18} className="mr-2 text-slate-400" /> Büro / Backoffice
            </button>
          </motion.div>
        )}

        {step === 'driver' && (
          <motion.div key="driver" initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-40}} className="w-full">
            <div className="flex items-center gap-4 mb-8">
              <button onClick={()=>setStep('company')} className="p-2 -ml-2"><ChevronLeft size={32}/></button>
              <div>
                <p className={LABEL + " mb-0"}>Anmelden als Fahrer</p>
                <h2 className="text-2xl font-black tracking-tight">{selCompany ? co(selCompany).short : ''}</h2>
              </div>
            </div>

            <div className="mb-6">
              <label className={LABEL}>Fahrername *</label>
              <select className={SELECT} value={selDriver} onChange={e=>setSelDriver(e.target.value)}>
                <option value="">-- Fahrer wählen --</option>
                {drivers.map((d:string) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="mb-8">
              <label className={LABEL}>Einsatzfahrzeug *</label>
              <select className={SELECT} value={selVehicle} onChange={e=>setSelVehicle(e.target.value)}>
                <option value="">-- Fahrzeug wählen --</option>
                {vehicles.map((v:any) => <option key={v.plate} value={`${v.label} – ${v.plate}`}>{v.label} – {v.plate}</option>)}
              </select>
            </div>

            <button disabled={!selDriver||!selVehicle} onClick={handleDriverLogin} className={PRIMARY}>
              <Check size={22} className="mr-2" /> ANMELDEN & STARTEN
            </button>
          </motion.div>
        )}

        {step === 'admin' && (
          <motion.div key="admin" initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-40}} className="w-full">
            <div className="flex items-center gap-4 mb-8">
              <button onClick={()=>setStep('company')} className="p-2 -ml-2"><ChevronLeft size={32}/></button>
              <h2 className="text-2xl font-black tracking-tight">Büro-Login</h2>
            </div>
            <div className="space-y-4">
              <div><label className={LABEL}>Benutzername</label>
                <input className={INPUT} placeholder="admin" value={adminUser} onChange={e=>setAdminUser(e.target.value)} /></div>
              <div><label className={LABEL}>Passwort</label>
                <input type="password" className={INPUT} placeholder="••••••" value={adminPass} onChange={e=>setAdminPass(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&handleAdminLogin()} /></div>
              {err && <p className="text-red-500 text-xs font-black uppercase tracking-widest text-center">{err}</p>}
              <button onClick={handleAdminLogin} className={PRIMARY}>ANMELDEN</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
const Dashboard = ({ setView, setJob, job }: any) => {
  const company = co(job.company);
  const hasActiveJob = !!(job.orderId || job.licensePlate);

  return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="p-6">
      <div className="flex justify-between items-center mb-10">
        <div>
          <div className="w-10 h-10 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100 mb-2">
            <img src={company.logo} alt={company.short} className="w-full h-full object-contain p-1"
              onError={e=>{(e.target as HTMLImageElement).style.display='none'}} />
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{company.short}</p>
          <p className="font-black text-sm">{job.driverName}</p>
        </div>
        <button onClick={() => { localStorage.removeItem('selected_company'); localStorage.removeItem('selected_driver'); localStorage.removeItem('selected_vehicle'); setView('login'); }} className="p-3 bg-slate-50 rounded-xl text-slate-400">
          <LogOut size={20}/>
        </button>
      </div>

      {hasActiveJob && (
        <motion.button
          initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
          onClick={() => setView('basics')}
          className="w-full bg-orange-50 border-4 border-[#FF6321] rounded-[40px] p-8 flex flex-col items-center justify-center gap-4 active:bg-orange-100 transition-all mb-4"
        >
          <div className="w-16 h-16 bg-[#FF6321] rounded-full shadow-lg flex items-center justify-center">
            <Edit3 size={32} className="text-white" />
          </div>
          <div className="text-center">
            <span className="font-black text-[#FF6321] uppercase tracking-widest text-sm block">Einsatz fortsetzen</span>
            <span className="text-xs text-slate-500 font-bold">{job.orderId || job.licensePlate || '–'}</span>
          </div>
        </motion.button>
      )}

      <button
        onClick={() => {
          if (hasActiveJob && !confirm('Aktuellen Einsatz verwerfen und neuen starten?')) return;
          localStorage.removeItem('current_job_id');
          localStorage.removeItem('current_view');
          setJob(mkState());
          setView('basics');
        }}
        className="w-full bg-slate-50 border-4 border-dashed border-slate-200 rounded-[40px] p-12 flex flex-col items-center justify-center gap-6 active:bg-slate-100 transition-all group"
      >
        <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center group-active:scale-90 transition-transform">
          <Plus size={40} className="text-slate-300" />
        </div>
        <span className="font-black text-slate-400 uppercase tracking-widest text-sm">Neuer Einsatz</span>
      </button>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// BASICS
// ════════════════════════════════════════════════════════════════════════════
const Basics = ({ setView, job, upd, drivers, vehicles }: any) => {
  const valid = job.orderId.trim() && job.driverName.trim() && job.licensePlate.trim() && job.vehicleModel.trim() && job.ownerName.trim() && job.phone.trim();

  const openMaps = () => {
    if (!job.address) return;
    const q = encodeURIComponent(`${job.address}, ${job.zip} ${job.city}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  };

  return (
    <motion.div initial={{x:50,opacity:0}} animate={{x:0,opacity:1}} className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={()=>setView('dashboard')} className="p-2 -ml-2"><ChevronLeft size={32}/></button>
        <h2 className="text-2xl font-black tracking-tight">Basis-Daten</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className={LABEL}>Auftragsnummer *</label>
          <input className={INPUT} placeholder="Versicherungsnr. oder Polizei + Datum" value={job.orderId} onChange={e=>upd({orderId:e.target.value})} />
          <p className="text-[10px] text-slate-400 font-bold -mt-3 ml-1 mb-2">z.B. Allianz-123456 oder Polizei 25.03.2026</p>
        </div>

        <div>
          <label className={LABEL}>Fahrername *</label>
          <select className={SELECT} value={job.driverName} onChange={e=>upd({driverName:e.target.value})}>
            <option value="">-- Fahrer wählen --</option>
            {drivers.map((d:string)=><option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label className={LABEL}>Einsatzfahrzeug</label>
          <select className={SELECT} value={job.driverVehicle} onChange={e=>upd({driverVehicle:e.target.value})}>
            <option value="">-- Fahrzeug wählen --</option>
            {vehicles.map((v:any)=><option key={v.plate} value={`${v.label} – ${v.plate}`}>{v.label} – {v.plate}</option>)}
          </select>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Fahrzeug-/Halterdaten</p>
        </div>

        <div>
          <label className={LABEL}>Name des Halters / Firma *</label>
          <input className={INPUT} placeholder="Halter oder Unternehmen" value={job.ownerName} onChange={e=>upd({ownerName:e.target.value})} />
        </div>

        <div>
          <label className={LABEL}>Name des Fahrers (Auftraggeber)</label>
          <input className={INPUT} placeholder="Falls abweichend vom Halter" value={job.customerDriverName} onChange={e=>upd({customerDriverName:e.target.value})} />
        </div>

        <div>
          <label className={LABEL}>Telefonnummer *</label>
          <div className="relative mb-4">
            <input className="w-full h-16 bg-white border-2 border-slate-200 rounded-xl px-4 pr-14 font-bold text-lg outline-none focus:border-[#FF6321] transition-all" placeholder="+49 ..." value={job.phone} onChange={e=>upd({phone:e.target.value})} />
            {job.phone && (
              <button onClick={()=>{ navigator.clipboard.writeText(job.phone); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-slate-100 rounded-lg">
                <Copy size={16} className="text-slate-500"/>
              </button>
            )}
          </div>
        </div>

        <div>
          <label className={LABEL}>Kennzeichen *</label>
          <input className={INPUT} placeholder="z.B. SK-AM 123" value={job.licensePlate} onChange={e=>upd({licensePlate:e.target.value.toUpperCase()})} />
        </div>

        <div>
          <label className={LABEL}>Fahrzeug Marke / Modell *</label>
          <input className={INPUT} placeholder="z.B. VW Golf, BMW 3er" value={job.vehicleModel} onChange={e=>upd({vehicleModel:e.target.value})} />
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Rechnungsadresse Auftraggeber</p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-3"><label className={LABEL}>Straße</label><input className={INPUT} placeholder="Straße" value={job.customerStreet} onChange={e=>upd({customerStreet:e.target.value})} /></div>
          <div className="col-span-1"><label className={LABEL}>Nr.</label><input className={INPUT} placeholder="Nr." value={job.customerHouseNum} onChange={e=>upd({customerHouseNum:e.target.value})} /></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className={LABEL}>PLZ</label><input className={INPUT} placeholder="PLZ" value={job.customerZip} onChange={e=>upd({customerZip:e.target.value})} /></div>
          <div><label className={LABEL}>Stadt</label><input className={INPUT} placeholder="Stadt" value={job.customerCity} onChange={e=>upd({customerCity:e.target.value})} /></div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Einsatzort</p>
        </div>

        <div>
          <label className={LABEL}>Straße / Einsatzort</label>
          <input className={INPUT} placeholder="Straße oder z.B. A9 Höhe Ausfahrt 16" value={job.address} onChange={e=>upd({address:e.target.value})} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className={LABEL}>PLZ</label><input className={INPUT} placeholder="PLZ" value={job.zip} onChange={e=>upd({zip:e.target.value})} /></div>
          <div><label className={LABEL}>Stadt</label><input className={INPUT} placeholder="Stadt" value={job.city} onChange={e=>upd({city:e.target.value})} /></div>
        </div>

        {job.address && (
          <button onClick={openMaps} className="w-full h-14 bg-blue-50 text-blue-600 rounded-2xl font-black text-xs tracking-widest flex items-center justify-center gap-2 mb-4 active:scale-95 transition-all">
            <MapPin size={18}/> EINSATZORT IN GOOGLE MAPS
          </button>
        )}

        <div>
          <label className={LABEL}>Dienstleistung *</label>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {(['transport','pannenhilfe','notoeffnung'] as ServiceType[]).map(t=>(
              <button key={t} onClick={()=>upd({serviceType:t})}
                className={`h-16 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${job.serviceType===t?'bg-[#FF6321] text-white border-[#FF6321] shadow-lg':'bg-white text-slate-400 border-slate-100'}`}>
                {t==='transport'?'Transport':t==='pannenhilfe'?'Pannenhilfe':'Notöffnung'}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <JobSummaryCard job={job} />
        </div>

        <button disabled={!valid} onClick={()=>setView('detail')} className={PRIMARY}>
          EINSATZ STARTEN <ChevronRight size={22} className="ml-1"/>
        </button>
      </div>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// DETAIL (Status Hub)
// ════════════════════════════════════════════════════════════════════════════
const Detail = ({ setView, job, upd }: any) => {
  const si = job.statusIndex;
  const docStarted = si >= 3;   // true once "DOKUMENTATION STARTEN" was clicked
  const unlocked   = docStarted;

  // Completion checks
  // isSevereAccident: no photos required at all (unsafe to document).
  // All service types now require the same 7-photo set; plateau added for transport/pannenhilfe-no-continue.
  const requiredPhotos = job.isSevereAccident
    ? []
    : ['arrival','plate','cockpit','front','right','left','rear'];
  if (!job.isSevereAccident && (job.serviceType==='transport'||(job.serviceType==='pannenhilfe'&&job.continueJourneyPossible===false)))
    requiredPhotos.push('plateau');
  // isSevereAccident skips damagesChecked; all other types require it.
  const docsOk     = requiredPhotos.every(id=>job.photos[id]?.length>0)&&(job.isSevereAccident||job.damagesChecked);
  const sigsDeferred = job.customerTravelingAlong===true;
  const sigsOk     = job.waivedSignature||(job.signatures.order&&job.signatures.privacy)||sigsDeferred;
  const notesOk    = job.officeNotes.trim().length>0||job.noSpecialNotes;
  const serviceOk  = job.serviceType==='transport'
    ? (!!job.destinationType)
    : job.serviceType==='pannenhilfe'
      ? (job.serviceNotes.trim().length>0 && job.continueJourneyPossible!==null)
      : (!!job.signatures.liability && !!job.signatures.liabilityDriver); // notoeffnung: both signatures required

  const canAdvance3to4 = docsOk && sigsOk && notesOk && serviceOk;

  const advanceStatus = () => {
    if (si===0) { upd({statusIndex:1, timestamps:{...job.timestamps,enRoute:nowISO()}}); return; }
    if (si===1) { upd({statusIndex:2, timestamps:{...job.timestamps,arrived:nowISO()}}); return; }
    if (si===2) { upd({statusIndex:3, timestamps:{...job.timestamps,documenting:nowISO()}}); return; }
    if (si===3) {
      if (!canAdvance3to4) {
        const missing=[];
        if(!docsOk) missing.push('Fotos/Vorschäden');
        if(!sigsOk) missing.push('Unterschriften');
        if(!notesOk) missing.push('Büro-Notiz');
        if(!serviceOk) missing.push(job.serviceType==='transport'?'Zielort':job.serviceType==='notoeffnung'?'Haftungsausschluss':'Dienstleistungsdetails');
        alert('Noch nicht vollständig:\n• '+missing.join('\n• '));
        return;
      }
      if (job.serviceType==='notoeffnung') { setView('summary'); return; }
      if (job.serviceType==='pannenhilfe'&&job.continueJourneyPossible===true) { setView('summary'); return; }
      upd({statusIndex:4, timestamps:{...job.timestamps,transport:nowISO()}});
      return;
    }
    if (si===4) { upd({statusIndex:5, timestamps:{...job.timestamps,atDest:nowISO()}}); setView('summary'); return; }
    if (si===5) { setView('summary'); return; }
  };

  const btnLabel = ['AUF DEM WEG','ANGEKOMMEN','DOKUMENTATION STARTEN',
    job.serviceType==='notoeffnung'||((job.serviceType==='pannenhilfe')&&job.continueJourneyPossible===true)
      ? 'AUFTRAG ABSCHLIESSEN' : 'AUF DEM WEG ZUM ZIELORT',
    'ZIELORT ERREICHT / ABSCHLUSS','ZUSAMMENFASSUNG'][si]||'WEITER';

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex flex-col bg-white min-h-full">
      {/* Header */}
      <div className="p-6 border-b border-slate-50">
        <div className="flex items-center justify-between mb-6">
          <button onClick={()=>setView('dashboard')} className="p-2 -ml-2"><ChevronLeft size={28}/></button>
          <div className="text-center">
            <span className="font-black text-[10px] text-slate-400 uppercase tracking-[0.2em] block mb-1">Auftrag</span>
            <span className="font-black text-xl tracking-tight">{job.orderId||'NEU'}</span>
          </div>
          <button onClick={()=>setView('basics')} className="p-2 bg-slate-50 rounded-xl text-slate-600 active:scale-90 transition-transform">
            <Edit3 size={20}/>
          </button>
        </div>
        {/* Stepper */}
        <div className="flex justify-between items-center px-2 relative">
          <div className="absolute h-[2px] bg-slate-100 left-6 right-6 top-1/2 -translate-y-1/2 -z-10"/>
          <motion.div className="absolute h-[2px] bg-[#FF6321] left-6 top-1/2 -translate-y-1/2 -z-10 origin-left"
            initial={{scaleX:0}} animate={{scaleX:si/(STATUSES.length-1)}}
            transition={{duration:0.5}} style={{width:'calc(100% - 48px)'}} />
          {STATUSES.map((s,i)=>(
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm transition-colors ${si>=i?'bg-[#FF6321]':'bg-slate-200'}`}/>
              <span className={`text-[7px] font-black uppercase tracking-tighter ${si===i?'text-[#FF6321]':'text-slate-300'}`}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Timestamps */}
        {si>=1&&job.timestamps.enRoute&&<TimestampBadge icon={<Truck size={10}/>} label="Auf dem Weg" value={fmtDateTime(job.timestamps.enRoute)}/>}
        {si>=2&&job.timestamps.arrived&&<TimestampBadge icon={<MapPin size={10}/>} label="Ankunft am Schadenort" value={fmtDateTime(job.timestamps.arrived)}/>}

        {/* Google Maps - scene */}
        {(si===0||si===1)&&job.address&&(
          <button onClick={()=>{const q=encodeURIComponent(`${job.address}, ${job.zip} ${job.city}`);window.open(`https://www.google.com/maps/search/?api=1&query=${q}`,'_blank');}}
            className="w-full h-14 bg-blue-50 text-blue-600 rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 transition-all text-xs tracking-widest">
            <MapPin size={18}/> SCHADENORT IN MAPS ÖFFNEN
          </button>
        )}
        {/* Google Maps - destination */}
        {si===4&&job.destStreet&&(
          <button onClick={()=>{const q=encodeURIComponent(`${job.destStreet} ${job.destHouseNum}, ${job.destZip} ${job.destCity}`);window.open(`https://www.google.com/maps/search/?api=1&query=${q}`,'_blank');}}
            className="w-full h-14 bg-indigo-50 text-indigo-600 rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 transition-all text-xs tracking-widest">
            <MapPin size={18}/> ZIELORT IN MAPS ÖFFNEN
          </button>
        )}

        {/* Main CTA */}
        <button onClick={advanceStatus} className={PRIMARY}>{btnLabel}</button>

        {/* Lock */}
        {!unlocked ? (
          <div className="bg-orange-50 border-2 border-orange-100 rounded-[32px] p-8 text-center">
            <Lock size={28} className="text-orange-300 mx-auto mb-3"/>
            <p className="text-sm font-black text-orange-900 uppercase tracking-tight">
              {si < 2 ? 'Module erst nach Ankunft am Schadenort' : 'Dokumentation starten, um Module freizuschalten'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className={LABEL + " pt-2"}>Einsatz-Module</p>

            {/* Service-type specific module */}
            {job.serviceType!=='transport'&&(
              <ModuleBtn
                icon={job.serviceType==='pannenhilfe'?<Truck size={26}/>:<ShieldCheck size={26}/>}
                label={job.serviceType==='pannenhilfe'?'Pannenhilfe Details':'Notöffnung'}
                sublabel={job.serviceType==='pannenhilfe'?(serviceOk?'Erledigt':'Pflicht'):serviceOk?'Haftungsausschluss erledigt':'Haftungsausschluss Pflicht'}
                done={serviceOk}
                onClick={()=>setView('service')}
              />
            )}

            {/* Docs – required for every service type */}
            <ModuleBtn icon={<Camera size={26}/>} label="Fotos & Vorschäden" sublabel={docsOk?'Vollständig':'Pflichtfotos aufnehmen'} done={docsOk} onClick={()=>setView('docs')} />

            {/* Sigs – Datenschutz + Auftragsbestätigung for every service type */}
            <ModuleBtn
              icon={<ShieldCheck size={26}/>}
              label="Kunden-Abnahme"
              sublabel={sigsDeferred?'Erfolgt am Zielort':job.waivedSignature?'KVU / Nicht vor Ort':sigsOk?'Unterschriften erhalten':'Unterschriften benötigt'}
              done={sigsOk}
              onClick={()=>setView('sigs')}
            />

            {/* Destination (transport/pannenhilfe-no-continue) */}
            {(job.serviceType==='transport'||(job.serviceType==='pannenhilfe'&&job.continueJourneyPossible===false))&&(
              <ModuleBtn
                icon={<MapPin size={26}/>}
                label="Zielort & Kundenstatus"
                sublabel={job.destinationType?(job.destinationType+(job.kundeDa?' · Kunde: '+job.kundeDa:'')):'Zielort auswählen'}
                done={!!job.destinationType&&(job.isCustomerPresent!==null||job.waivedSignature)}
                onClick={()=>setView('destination')}
              />
            )}

            {/* Notes */}
            <ModuleBtn icon={<FileText size={26}/>} label="Büro-Notiz" sublabel={notesOk?'Ausgefüllt':'Pflichtfeld'} done={notesOk} onClick={()=>setView('notes')} />
          </div>
        )}

        <div className="pt-4 border-t border-slate-50">
          <JobSummaryCard job={job}/>
        </div>
      </div>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SERVICE (Pannenhilfe + Notöffnung)
// ════════════════════════════════════════════════════════════════════════════
const ServiceScreen = ({ setView, job, upd, uploadFile }: any) => {
  const [loading, setLoading] = useState(false);
  // Notoeffnung KVU abort states (safe to declare here for all service types)
  const [abortLoading, setAbortLoading] = useState(false);
  const [abortDone, setAbortDone] = useState(false);

  if (job.serviceType === 'pannenhilfe') return (
    <motion.div initial={{x:50,opacity:0}} animate={{x:0,opacity:1}} className="p-6 bg-white min-h-full">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={()=>setView('detail')} className="p-2 -ml-2"><ChevronLeft size={32}/></button>
        <h2 className="text-2xl font-black tracking-tight">Pannenhilfe</h2>
      </div>
      <div className="space-y-6">
        <div>
          <label className={LABEL}>Geleistete Hilfe (Notiz) *</label>
          <textarea className="w-full h-36 bg-slate-50 border-2 border-slate-200 rounded-xl p-4 font-bold text-base outline-none focus:border-[#FF6321] resize-none"
            placeholder="z.B. Starthilfe, Reifenwechsel Vorne Links, Fehlerspeicher ausgelesen..." value={job.serviceNotes} onChange={e=>upd({serviceNotes:e.target.value})} />
        </div>
        <div>
          <label className={LABEL}>Weiterfahrt möglich? *</label>
          <div className="grid grid-cols-2 gap-3">
            {[{v:true,l:'JA – Weiterfahrt'},{v:false,l:'NEIN – Transport'}].map(({v,l})=>(
              <button key={String(v)} onClick={()=>upd({continueJourneyPossible:v})}
                className={`h-20 rounded-[24px] font-black text-sm border-2 transition-all active:scale-95 ${job.continueJourneyPossible===v?(v?'bg-green-600 text-white border-green-600':'bg-[#FF6321] text-white border-[#FF6321]'):'bg-white text-slate-300 border-slate-100'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <button disabled={!job.serviceNotes.trim()||job.continueJourneyPossible===null}
          onClick={()=>{ if(job.continueJourneyPossible) setView('presence'); else setView('destination'); }}
          className={PRIMARY}>WEITER</button>
      </div>
      <div className="mt-8 pt-6 border-t border-slate-100"><JobSummaryCard job={job}/></div>
    </motion.div>
  );

  // Notöffnung
  const [showLiabFull, setShowLiabFull] = useState(false);
  const [loadSig, setLoadSig] = useState(false);

  const saveSig = async (type:'liability'|'liabilityDriver', dataUrl:string) => {
    if(!dataUrl) return;
    setLoadSig(true);
    try {
      const r = await fetch(dataUrl); const blob = await r.blob();
      const url = await uploadFile(type, blob);
      upd({signatures:{...job.signatures,[type]:url}});
    } finally { setLoadSig(false); }
  };

  const handleKvuAbort = async () => {
    setAbortLoading(true);
    try {
      await fetch('/api/jobs', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          id: job.id,
          data: {...job, waivedSignature:true, refusedSignature:true, kundeDa:'KVU – Abgebrochen'},
          status: 'Abgebrochen (KVU)',
        }),
      });
      localStorage.removeItem('current_job_id');
      localStorage.removeItem('current_view');
      setAbortDone(true);
    } finally { setAbortLoading(false); }
  };

  if (abortDone) return (
    <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="p-10 flex flex-col items-center justify-center h-full text-center bg-white">
      <motion.div initial={{scale:0,rotate:-45}} animate={{scale:1,rotate:0}} transition={{type:'spring',damping:12}}
        className="w-24 h-24 bg-amber-500 text-white rounded-[32px] flex items-center justify-center mb-8 shadow-2xl shadow-amber-200">
        <AlertTriangle size={56}/>
      </motion.div>
      <h2 className="text-3xl font-black uppercase mb-2 tracking-tighter">Abgebrochen</h2>
      <p className="text-slate-400 font-black mb-4 uppercase text-[10px] tracking-[0.2em]">Vorgang abgebrochen (KVU)</p>
      <p className="text-slate-500 text-sm font-bold mb-12">Alle Daten wurden gespeichert und ins Backend übertragen.</p>
      <button onClick={()=>window.location.reload()} className={PRIMARY}>NÄCHSTER EINSATZ</button>
    </motion.div>
  );

  const liabilityDone = !!job.signatures.liability && !!job.signatures.liabilityDriver;
  const company = co(job.company);

  return (
    <motion.div initial={{x:50,opacity:0}} animate={{x:0,opacity:1}} className="p-6 bg-white min-h-full">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={()=>setView('detail')} className="p-2 -ml-2"><ChevronLeft size={32}/></button>
        <h2 className="text-2xl font-black tracking-tight">Notöffnung – Haftungsausschluss</h2>
      </div>

      <div className="space-y-4">
        {/* Identity check */}
        <label className="flex items-center gap-4 p-5 bg-slate-50 rounded-[24px] border border-slate-100 cursor-pointer">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${job.identityChecked?'bg-black text-white':'bg-white text-slate-300 border border-slate-200'}`}>
            <User size={22}/>
          </div>
          <div className="flex-1">
            <p className="font-black text-sm uppercase tracking-tight">Fahrer/Halter-Identität geprüft</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Optional – empfohlen</p>
          </div>
          <input type="checkbox" className="w-6 h-6 accent-black" checked={job.identityChecked} onChange={e=>upd({identityChecked:e.target.checked})} />
        </label>

        {/* Haftungsausschluss */}
        <div className="border-2 border-red-100 rounded-[28px] overflow-hidden">
          <div className="bg-red-50 p-5">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-red-600"/><p className="font-black text-xs text-red-700 uppercase tracking-widest">Haftungsausschluss – Pflicht</p></div>
            <p className="text-xs text-red-500 font-medium italic">Bei Tür- oder Fensteröffnungen entstehen häufig mechanische Beschädigungen an Dichtungen, Lack oder Schlossanlage.</p>
          </div>

          <div className="p-5 bg-white space-y-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Auto-gefüllt aus Basisdaten:</p>
            <div className="bg-slate-50 rounded-xl p-4 text-xs font-medium text-slate-600 space-y-1">
              <p><strong>Unternehmen:</strong> {company.name}</p>
              <p><strong>Aktenzeichen:</strong> {job.orderId||'–'}</p>
              <p><strong>KFZ:</strong> {job.licensePlate||'–'}</p>
              <p><strong>Kunde:</strong> {job.ownerName||'–'}</p>
              <p><strong>Einsatzort:</strong> {job.address||'–'}</p>
              <p><strong>Datum:</strong> {fmtDate()}</p>
            </div>

            <div>
              <label className={LABEL}>Wie wird Hilfe geleistet (Feld 4)</label>
              <textarea className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-[#FF6321] resize-none"
                placeholder="Konkrete Vorgehensweise" value={job.liabilityHelp} onChange={e=>upd({liabilityHelp:e.target.value})} />
            </div>

            <div>
              <label className={LABEL}>Unterschrift Kunde *</label>
              {job.signatures.liability
                ? <div className="bg-green-50 rounded-xl p-3 flex items-center gap-2"><CheckCircle2 size={18} className="text-green-600"/><span className="text-xs font-black text-green-700">Unterschrift gespeichert</span></div>
                : <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200"><SignaturePad onSave={d=>saveSig('liability',d)} height={150}/></div>
              }
            </div>
            <div>
              <label className={LABEL}>Unterschrift Fahrer *</label>
              {job.signatures.liabilityDriver
                ? <div className="bg-green-50 rounded-xl p-3 flex items-center gap-2"><CheckCircle2 size={18} className="text-green-600"/><span className="text-xs font-black text-green-700">Unterschrift gespeichert</span></div>
                : <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200"><SignaturePad onSave={d=>saveSig('liabilityDriver',d)} height={150}/></div>
              }
            </div>
          </div>
        </div>

        {/* Save + back when signed */}
        <button disabled={!liabilityDone||loadSig} onClick={()=>setView('detail')} className={PRIMARY}>
          {loadSig?<RefreshCw className="animate-spin" size={20}/>:'HAFTUNGSAUSSCHLUSS GESPEICHERT – ZURÜCK'}
        </button>

        {/* KVU – triggers immediate abort for notoeffnung */}
        <div className="p-5 bg-red-50 border-2 border-red-100 rounded-[24px] space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5"><EyeOff size={20}/></div>
            <div className="flex-1">
              <p className="font-black text-sm text-red-900 uppercase tracking-tight">Kunde verweigert Unterschrift (KVU)</p>
              <p className="text-[10px] text-red-400 font-bold uppercase mt-0.5">Notöffnung wird abgebrochen – Daten werden gespeichert</p>
            </div>
          </div>
          <button onClick={handleKvuAbort} disabled={abortLoading}
            className="w-full h-14 bg-red-600 text-white rounded-2xl font-black text-xs tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
            {abortLoading?<RefreshCw className="animate-spin" size={18}/>:<><AlertTriangle size={16}/> VORGANG ABBRECHEN & SPEICHERN</>}
          </button>
        </div>
      </div>
      <div className="mt-8 pt-6 border-t border-slate-100"><JobSummaryCard job={job}/></div>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// DESTINATION
// ════════════════════════════════════════════════════════════════════════════
const Destination = ({ setView, job, upd }: any) => {
  const isFixed = FIXED_DESTINATIONS.some(d=>d.id===job.destinationType);
  const isCustom = job.destinationType==='werkstatt'||job.destinationType==='kunde';
  const valid = !!job.destinationType && (isFixed || (isCustom && job.destStreet.trim() && job.destZip.trim()));

  const handleSelect = (type: string) => {
    const fd = FIXED_DESTINATIONS.find(d=>d.id===type);
    if (fd) {
      upd({destinationType:type, destName:fd.label, destStreet:fd.street, destHouseNum:fd.houseNum, destZip:fd.zip, destCity:fd.city});
    } else {
      upd({destinationType:type, destName:'', destStreet:'', destHouseNum:'', destZip:'', destCity:''});
    }
  };

  const openMaps = () => {
    const q=encodeURIComponent(`${job.destStreet} ${job.destHouseNum}, ${job.destZip} ${job.destCity}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`,'_blank');
  };

  return (
    <motion.div initial={{x:50,opacity:0}} animate={{x:0,opacity:1}} className="p-6 bg-white min-h-full">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={()=>setView('detail')} className="p-2 -ml-2"><ChevronLeft size={32}/></button>
        <h2 className="text-2xl font-black tracking-tight">Zielort</h2>
      </div>
      <div className="space-y-3 mb-6">
        {FIXED_DESTINATIONS.map(d=>(
          <button key={d.id} onClick={()=>handleSelect(d.id)}
            className={`w-full p-5 rounded-[24px] border-2 text-left transition-all ${job.destinationType===d.id?'border-[#FF6321] bg-orange-50':'border-slate-100 bg-white'}`}>
            <p className="font-black text-sm">{d.label}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">{d.sub}</p>
          </button>
        ))}
        {[{id:'werkstatt',label:'Werkstatt'},{id:'kunde',label:'Zum Kunden'}].map(d=>(
          <button key={d.id} onClick={()=>handleSelect(d.id)}
            className={`w-full p-5 rounded-[24px] border-2 text-left transition-all ${job.destinationType===d.id?'border-[#FF6321] bg-orange-50':'border-slate-100 bg-white'}`}>
            <p className="font-black text-sm">{d.label}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Adresse manuell eingeben</p>
          </button>
        ))}
      </div>

      {isCustom&&(
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="space-y-2 mb-6">
          <div><label className={LABEL}>Name</label><input className={INPUT} placeholder="Name" value={job.destName} onChange={e=>upd({destName:e.target.value})}/></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><label className={LABEL}>Straße</label><input className={INPUT} placeholder="Straße" value={job.destStreet} onChange={e=>upd({destStreet:e.target.value})}/></div>
            <div><label className={LABEL}>Nr.</label><input className={INPUT} placeholder="Nr." value={job.destHouseNum} onChange={e=>upd({destHouseNum:e.target.value})}/></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>PLZ</label><input className={INPUT} placeholder="PLZ" value={job.destZip} onChange={e=>upd({destZip:e.target.value})}/></div>
            <div><label className={LABEL}>Ort</label><input className={INPUT} placeholder="Ort" value={job.destCity} onChange={e=>upd({destCity:e.target.value})}/></div>
          </div>
          {job.destStreet&&(
            <button onClick={openMaps} className="w-full h-14 bg-blue-50 text-blue-600 rounded-2xl font-black text-xs tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
              <MapPin size={18}/> ZIELORT IN GOOGLE MAPS
            </button>
          )}
        </motion.div>
      )}

      <button disabled={!valid} onClick={()=>setView('presence')} className={PRIMARY}>WEITER ZUM KUNDENSTATUS</button>
      <div className="mt-6 pt-6 border-t border-slate-100"><JobSummaryCard job={job}/></div>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// PRESENCE CHECK
// ════════════════════════════════════════════════════════════════════════════
const Presence = ({ setView, job, upd }: any) => {
  // pannenhilfe+no-continue behaves like transport (needs transport to destination)
  const isTransportLike = job.serviceType==='transport' || (job.serviceType==='pannenhilfe' && job.continueJourneyPossible===false);
  return (
  <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="p-6 h-full flex flex-col items-center justify-center text-center bg-white relative">
    <button onClick={()=>setView('destination')} className="absolute top-6 left-6 p-2 bg-slate-50 rounded-xl text-slate-400"><ChevronLeft size={24}/></button>
    <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center mb-8 text-slate-300 shadow-inner"><User size={48}/></div>
    <h2 className="text-3xl font-black mb-2 tracking-tighter">Kunde vor Ort?</h2>
    <p className="text-slate-400 font-bold mb-10 uppercase text-[10px] tracking-widest">Ist der Kunde beim Einsatz anwesend?</p>
    <div className="w-full space-y-4">
      <button onClick={()=>{upd({isCustomerPresent:true,kundeDa:'JA',waivedSignature:false,refusedSignature:false});}}
        className={`w-full h-[72px] font-black rounded-2xl flex items-center justify-center text-xl active:scale-[0.96] transition-all gap-3 ${job.isCustomerPresent===true&&!job.refusedSignature?'bg-green-600 text-white':'bg-black text-white'}`}>
        <Check size={24}/> JA, KUNDE IST DA
      </button>

      {job.isCustomerPresent===true&&!job.refusedSignature&&isTransportLike&&(
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fährt der Kunde mit zum Zielort?</p>
          <div className="grid grid-cols-2 gap-3">
            {[{v:true,l:'JA, fährt mit'},{v:false,l:'NEIN, bleibt hier'}].map(({v,l})=>(
              <button key={String(v)} onClick={()=>{upd({customerTravelingAlong:v});setView('detail');}}
                className={`h-12 rounded-xl font-black text-sm transition-all ${job.customerTravelingAlong===v?'bg-[#FF6321] text-white':'bg-white text-slate-600 border border-slate-200'}`}>{l}</button>
            ))}
          </div>
        </motion.div>
      )}
      {job.isCustomerPresent===true&&!job.refusedSignature&&!isTransportLike&&(
        <button onClick={()=>setView('sigs')} className="w-full h-14 bg-slate-50 text-slate-800 font-black rounded-2xl border border-slate-200 flex items-center justify-center gap-2 active:scale-95 transition-all text-sm">
          <Edit3 size={18}/> WEITER ZU DEN UNTERSCHRIFTEN
        </button>
      )}

      <button onClick={()=>{upd({isCustomerPresent:false,kundeDa:'NEIN',waivedSignature:true,refusedSignature:false,customerTravelingAlong:false});setView('detail');}}
        className="w-full h-[72px] bg-slate-50 text-slate-800 font-black rounded-2xl flex items-center justify-center text-xl active:scale-[0.96] transition-all border border-slate-100 gap-3">
        <EyeOff size={24}/> NEIN, NICHT DA
      </button>

      <button onClick={()=>{upd({isCustomerPresent:true,kundeDa:'Verweigert',waivedSignature:true,refusedSignature:true,customerTravelingAlong:false});setView('detail');}}
        className="w-full h-[72px] bg-red-50 text-red-600 font-black rounded-2xl flex items-center justify-center text-xl active:scale-[0.96] transition-all border border-red-100 gap-3">
        <AlertTriangle size={24}/> UNTERSCHRIFT VERWEIGERT
      </button>

      <label className="flex items-center gap-4 p-4 bg-red-50 border border-red-100 rounded-2xl cursor-pointer">
        <input type="checkbox" className="w-5 h-5 accent-red-600" checked={job.customerCrashed}
          onChange={e=>{upd({customerCrashed:e.target.checked,waivedSignature:e.target.checked,refusedSignature:e.target.checked,kundeDa:e.target.checked?'Verunfallt':job.kundeDa});if(e.target.checked)setView('detail');}} />
        <p className="text-xs font-black text-red-900 uppercase tracking-tight">Kunde verunfallt / nicht ansprechbar</p>
      </label>
    </div>
    <div className="mt-8 pt-6 border-t border-slate-100 w-full"><JobSummaryCard job={job}/></div>
  </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// DOCS (Photos)
// ════════════════════════════════════════════════════════════════════════════
const Docs = ({ setView, job, upd, uploadFile }: any) => {
  const [loading, setLoading] = useState<string|null>(null);

  const handleUpload = async (cat:string, e:any) => {
    const file = e.target.files?.[0]; if(!file) return;
    setLoading(cat);
    try {
      const url = await uploadFile(cat, file);
      if(url) upd({photos:{...job.photos,[cat]:[...(job.photos[cat]||[]),{url, note:''}]}});
    } finally { setLoading(null); e.target.value=''; }
  };
  const removePhoto = (cat:string, i:number) => {
    upd({photos:{...job.photos,[cat]:job.photos[cat].filter((_:any,idx:number)=>idx!==i)}});
  };
  const updateNote = (cat:string, i:number, note:string) => {
    const updated = (job.photos[cat]||[]).map((p:any, idx:number) =>
      idx===i ? {...toPhotoEntry(p), note} : p
    );
    upd({photos:{...job.photos,[cat]:updated}});
  };

  const severe = job.isSevereAccident;
  const cats = [
    {id:'arrival', label:'Ankunft / Situation',     icon:<Camera size={20}/>,  req:!severe},
    {id:'plate',   label:'Kennzeichen / VIN',        icon:<Hash size={20}/>,    req:!severe},
    {id:'cockpit', label:'Cockpit / KM-Stand',       icon:<Gauge size={20}/>,   req:!severe},
    {id:'front',   label:'Fahrzeug Frontal',         icon:<Camera size={20}/>,  req:!severe},
    {id:'right',   label:'Fahrzeug Rechts',          icon:<Camera size={20}/>,  req:!severe},
    {id:'left',    label:'Fahrzeug Links',           icon:<Camera size={20}/>,  req:!severe},
    {id:'rear',    label:'Fahrzeug Heck',            icon:<Camera size={20}/>,  req:!severe},
    {id:'plateau', label:'Verladen auf Plateau',     icon:<Truck size={20}/>,   req:!severe&&(job.serviceType==='transport'||(job.serviceType==='pannenhilfe'&&job.continueJourneyPossible===false))},
    {id:'other',   label:'Sonstige Dokumente',       icon:<FileText size={20}/>,req:false},
  ];

  return (
    <motion.div initial={{x:50,opacity:0}} animate={{x:0,opacity:1}} className="p-6 bg-slate-50 min-h-full">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={()=>setView('detail')} className="p-2 -ml-2"><ChevronLeft size={32}/></button>
        <h2 className="text-2xl font-black tracking-tight">Fotos</h2>
      </div>

      {/* Severe accident toggle */}
      <div className="mb-6 p-5 bg-red-50 border-2 border-red-100 rounded-[24px] flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${job.isSevereAccident?'bg-red-600 text-white':'bg-white text-red-200'}`}><AlertTriangle size={22}/></div>
        <div className="flex-1">
          <label htmlFor="severe" className="font-black text-xs text-red-900 uppercase tracking-tight block">Schwerer Unfall</label>
          <p className="text-[10px] font-bold text-red-400 uppercase">Alle Pflichtfotos entfallen – Dokumentation trotzdem abschließbar</p>
        </div>
        <input id="severe" type="checkbox" className="w-6 h-6 accent-red-600" checked={job.isSevereAccident} onChange={e=>upd({isSevereAccident:e.target.checked})} />
      </div>

      <div className="space-y-4 mb-8">
        {cats.map((cat,idx)=>(
          <motion.div key={cat.id} initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.05*idx}}
            className="bg-white border border-slate-100 rounded-[24px] p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">{cat.icon}</div>
                <div>
                  <span className="font-black text-sm tracking-tight block">{cat.label}</span>
                  {cat.req&&<span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Pflichtfoto</span>}
                </div>
              </div>
              <label className="w-10 h-10 bg-black text-white rounded-xl cursor-pointer active:scale-90 transition-all flex items-center justify-center shadow-lg">
                {loading===cat.id?<RefreshCw className="animate-spin" size={16}/>:<Plus size={20}/>}
                <input type="file" className="hidden" onChange={e=>handleUpload(cat.id,e)} accept="image/*" capture="environment" />
              </label>
            </div>
            {job.photos[cat.id]?.length>0&&(
              <div className="space-y-3 pt-2 border-t border-slate-50">
                {job.photos[cat.id].map((p:any,i:number)=>(
                  <div key={i} className="flex gap-3 items-start">
                    <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border border-slate-100 group">
                      <img src={photoUrl(p)} className="w-full h-full object-cover"/>
                      <button onClick={()=>removePhoto(cat.id,i)} className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                    </div>
                    <textarea
                      className="flex-1 h-20 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none focus:border-[#FF6321] resize-none"
                      placeholder="Notiz zu diesem Foto (optional)…"
                      value={photoNote(p)}
                      onChange={e=>updateNote(cat.id,i,e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <button onClick={()=>setView('damages')} className="w-full h-16 bg-[#FF6321] text-white rounded-2xl font-black text-sm tracking-widest active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 mb-4">
        VORSCHÄDEN PRÜFEN <ChevronRight size={20}/>
      </button>
      <button onClick={()=>setView('detail')} className={SECONDARY}>ZURÜCK ZUR ÜBERSICHT</button>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// DAMAGES (Pre-damage documentation)
// ════════════════════════════════════════════════════════════════════════════
const Damages = ({ setView, job, upd, uploadFile }: any) => {
  const [loading, setLoading] = useState<string|null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const handlePhoto = async (cat:string, e:any) => {
    const file = e.target.files?.[0]; if(!file) return;
    setLoading(cat);
    try {
      const url = await uploadFile(cat+'_dmg', file);
      if(url) {
        const cur = job.preDamages[cat]||{isDefect:false,photos:[],note:''};
        upd({preDamages:{...job.preDamages,[cat]:{...cur,photos:[...cur.photos,url],isDefect:true}}});
      }
    } finally { setLoading(null); e.target.value=''; }
  };
  const removePhoto = (cat:string, i:number) => {
    const cur = job.preDamages[cat]||{photos:[]};
    upd({preDamages:{...job.preDamages,[cat]:{...cur,photos:cur.photos.filter((_:any,idx:number)=>idx!==i)}}});
  };
  const setDefect = (cat:string, v:boolean) => {
    const cur = job.preDamages[cat]||{isDefect:false,photos:[],note:''};
    upd({preDamages:{...job.preDamages,[cat]:{...cur,isDefect:v}}});
  };
  const setNote = (cat:string, note:string) => {
    const cur = job.preDamages[cat]||{isDefect:false,photos:[],note:''};
    upd({preDamages:{...job.preDamages,[cat]:{...cur,note}}});
  };
  const isValid = PRE_DAMAGE_CATS.every(c=>{
    const d=job.preDamages[c.id];
    return !d||!d.isDefect||d.photos?.length>0;
  });

  return (
    <motion.div initial={{x:50,opacity:0}} animate={{x:0,opacity:1}} className="p-6 bg-white min-h-full">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={()=>setView('docs')} className="p-2 -ml-2"><ChevronLeft size={32}/></button>
        <h2 className="text-2xl font-black tracking-tight">Vorschäden</h2>
      </div>

      <div className="space-y-5 mb-10">
        {PRE_DAMAGE_CATS.map((cat,idx)=>{
          const d=job.preDamages[cat.id]||{isDefect:false,photos:[],note:''};
          return (
            <motion.div key={cat.id} initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:idx*0.05}}
              className="p-5 border border-slate-100 rounded-[28px] bg-slate-50/50 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <span className="font-black text-lg tracking-tight">{cat.label}</span>
                <div className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-inner">
                  <button onClick={()=>setDefect(cat.id,false)} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${!d.isDefect?'bg-black text-white shadow-lg':'text-slate-400'}`}>OK</button>
                  <button onClick={()=>setDefect(cat.id,true)} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${d.isDefect?'bg-[#FF6321] text-white shadow-lg':'text-slate-400'}`}>DEFEKT</button>
                </div>
              </div>
              <div className="space-y-3">
                <textarea className="w-full bg-white border border-slate-100 rounded-2xl p-3 text-sm font-bold outline-none focus:border-[#FF6321] resize-none h-20"
                  placeholder="Notiz (optional)..." value={d.note||''} onChange={e=>setNote(cat.id,e.target.value)} />
                <div className="grid grid-cols-4 gap-2">
                  {d.photos?.map((url:string,i:number)=>(
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-100 group">
                      <img src={url} className="w-full h-full object-cover"/>
                      <button onClick={()=>removePhoto(cat.id,i)} className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                    </div>
                  ))}
                  <label className={`aspect-square rounded-xl flex items-center justify-center cursor-pointer border-2 border-dashed transition-all ${d.isDefect&&(!d.photos||d.photos.length===0)?'border-[#FF6321] bg-orange-50 text-[#FF6321]':'border-slate-200 bg-slate-50 text-slate-300'}`}>
                    {loading===cat.id?<RefreshCw className="animate-spin" size={18}/>:<Plus size={24}/>}
                    <input type="file" className="hidden" onChange={e=>handlePhoto(cat.id,e)} accept="image/*" capture="environment" />
                  </label>
                </div>
                {d.isDefect&&(!d.photos||d.photos.length===0)&&(
                  <p className="text-[10px] font-black text-[#FF6321] uppercase tracking-widest flex items-center gap-1"><AlertTriangle size={12}/> Foto Pflicht bei Defekt!</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      {/* ── Vorschäden-Checkliste (Reminder) ─────────────────────────────── */}
      {PRE_DAMAGE_CATS.some(c=>job.preDamages[c.id]?.isDefect)&&(
        <div className="mb-4">
          <button onClick={()=>setShowChecklist(v=>!v)}
            className="w-full h-14 bg-[#FF6321] text-white font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-sm tracking-widest shadow-lg shadow-orange-100">
            <CheckCircle2 size={18}/> VORSCHÄDEN PRÜFEN
          </button>

          {showChecklist&&(
            <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
              className="mt-3 p-5 bg-amber-50 border-2 border-amber-100 rounded-[24px] space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-amber-600 flex-shrink-0"/>
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Reminder – alle Vorschäden prüfen</p>
              </div>
              {PRE_DAMAGE_CATS.filter(c=>job.preDamages[c.id]?.isDefect).map(cat=>{
                const d = job.preDamages[cat.id];
                const done = checkedItems.has(cat.id);
                return (
                  <label key={cat.id} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${done?'bg-green-50 border border-green-200':'bg-white border border-amber-100'}`}>
                    <input type="checkbox" className="w-5 h-5 mt-0.5 accent-[#FF6321] flex-shrink-0"
                      checked={done}
                      onChange={e=>{
                        const next=new Set(checkedItems);
                        if(e.target.checked) next.add(cat.id); else next.delete(cat.id);
                        setCheckedItems(next);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`font-black text-sm ${done?'line-through text-slate-400':'text-slate-800'}`}>{cat.label}</p>
                      {d?.note&&<p className="text-[10px] text-slate-500 font-bold mt-0.5 truncate">{d.note}</p>}
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">{d?.photos?.length||0} Foto(s) vorhanden</p>
                    </div>
                    {done&&<Check size={16} className="text-green-500 flex-shrink-0 mt-0.5"/>}
                  </label>
                );
              })}
              {PRE_DAMAGE_CATS.filter(c=>job.preDamages[c.id]?.isDefect).every(c=>checkedItems.has(c.id))&&(
                <div className="flex items-center gap-2 pt-1">
                  <CheckCircle2 size={16} className="text-green-600"/>
                  <p className="text-xs font-black text-green-700 uppercase tracking-widest">Alle Vorschäden geprüft</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      <button disabled={!isValid} onClick={()=>{upd({damagesChecked:true});setView('detail');}} className={PRIMARY}>VORSCHÄDEN SPEICHERN</button>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SIGS (Privacy + Order + Liability)
// ════════════════════════════════════════════════════════════════════════════
const Sigs = ({ setView, job, upd, uploadFile }: any) => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const company = co(job.company);

  const saveSig = async (type: keyof JobState['signatures'], dataUrl: string) => {
    if(!dataUrl) return;
    setLoading(true);
    try {
      const r = await fetch(dataUrl); const blob = await r.blob();
      const url = await uploadFile(type+'_sig', blob);
      if(url) upd({signatures:{...job.signatures,[type]:url}});
    } finally { setLoading(false); }
  };

  // Build steps
  const steps = [
    { id:'privacy', show: !job.waivedSignature },
    { id:'order',   show: !job.waivedSignature },
    { id:'liability',show: false }, // optional, shown via button
  ].filter(s=>s.show);

  const cur = steps[step];

  // Use effect to avoid calling setState during render
  useEffect(() => {
    if (!cur) setView('detail');
  }, [!!cur]);

  const goKVU = () => {
    upd({waivedSignature:true,refusedSignature:true,kundeDa:'Verweigert'});
    setView('detail');
  };

  if (!cur) return null;

  const next = () => {
    if (step < steps.length-1) setStep(step+1);
    else setView('detail');
  };

  return (
    <motion.div initial={{x:50,opacity:0}} animate={{x:0,opacity:1}} className="p-6 bg-white min-h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <button onClick={()=>step>0?setStep(step-1):setView('detail')} className="p-2 -ml-2"><ChevronLeft size={32}/></button>
        <div className="flex gap-1">
          {steps.map((_,i)=>(
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${step===i?'w-8 bg-[#FF6321]':'w-2 bg-slate-100'}`}/>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {cur.id==='privacy' && (
          <motion.div key="privacy" initial={{x:20,opacity:0}} animate={{x:0,opacity:1}} exit={{x:-20,opacity:0}} className="flex-1">
            <h2 className="text-2xl font-black mb-1 tracking-tight">Datenschutz-Einwilligung</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Schritt {step+1} von {steps.length}</p>

            <div className="bg-slate-50 border border-slate-200 rounded-[24px] p-5 mb-5 text-xs text-slate-600 font-medium leading-relaxed max-h-64 overflow-y-auto">
              <p className="font-black text-slate-900 mb-3 text-sm">{company.name}</p>
              <p className="mb-3">Im Zuge des Auftragsverhältnisses zur Erbringung einer Pannenhilfsleistung, einer Berge- und Abschleppleistung, einer Werkstatt-/Reparaturleistung, eines Fahrzeugankaufes o.ä. verarbeitet die <strong>{company.name}</strong> personenbezogene Daten, z.B. Name, Wohnanschrift, Telefonnummer, E-Mail-Adresse, Geburtsdatum, Kennzeichen. Besonders sensitive Daten im Sinne des Art. 9 Abs. 1 DS-GVO werden nicht verarbeitet.</p>
              <p className="mb-3">Ich willige mit meiner Unterschrift ein, dass die <strong>{company.name}</strong> meine personenbezogenen Daten erhebt, speichert und nutzt, soweit es zur Bearbeitung des Auftrages erforderlich ist.</p>
              <p className="mb-3">Ich willige auch in die Weitergabe meiner personenbezogenen Daten an Dritte ein, soweit es zur Durchführung des Auftrages nötig ist. Hierzu zählen u.a. Haftpflicht- und Vollkaskoversicherer, Reparaturwerkstätten, Rechtsanwaltskanzleien, Polizeidienststellen sowie IT-Anwendungen.</p>
              <p className="mb-3">Diese Einwilligung ist freiwillig. Ich kann die Einwilligung jederzeit widerrufen (z.B. per E-Mail an <strong>{company.email}</strong> oder telefonisch unter <strong>{company.phone}</strong>). Der Widerruf gilt nicht rückwirkend.</p>
              <p className="font-black text-slate-700 mt-4">Datenschutzrechtliche Hinweise:</p>
              <p>1. Verantwortlicher: {company.name}, GF {company.gf}, {company.street}, {company.zip} {company.city}, Tel.: {company.phone}</p>
              <p>2. Kein Datenschutzbeauftragter bestellt.</p>
              <p>3. Rechtsgrundlage: Art. 6 Abs. 1 lit. a, b, c DS-GVO.</p>
              <p>5. Betroffenenrechte: Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung.</p>
              <p>6. Beschwerderecht: Landesbeauftragter für den Datenschutz Sachsen-Anhalt, Leiterstr. 9, 39104 Magdeburg.</p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 mb-3 flex items-center gap-3 border border-slate-200">
              <div className="text-xs text-slate-500">
                <span className="font-black">Ort:</span> {job.city||job.address||'–'} &nbsp;|&nbsp; <span className="font-black">Datum:</span> {fmtDate()}
              </div>
            </div>

            <div>
              <label className={LABEL}>E-Mail-Adresse des Kunden</label>
              <input
                type="email"
                className={INPUT}
                placeholder="kunde@beispiel.de"
                value={job.customerEmail}
                onChange={e=>upd({customerEmail:e.target.value})}
              />
            </div>

            <div>
              <label className={LABEL}>Unterschrift Kunde *</label>
              {job.signatures.privacy
                ? <div className="bg-green-50 rounded-xl p-4 flex items-center gap-2 mb-4"><CheckCircle2 size={20} className="text-green-600"/><span className="text-sm font-black text-green-700">Datenschutz-Unterschrift gespeichert</span></div>
                : <div className="bg-slate-50 rounded-[24px] p-3 border border-slate-200 mb-4"><SignaturePad onSave={d=>saveSig('privacy',d)} height={160}/></div>
              }
            </div>

            <button disabled={!job.signatures.privacy||loading} onClick={next} className={PRIMARY}>
              {loading?<RefreshCw className="animate-spin" size={20}/>:'WEITER ZUR AUFTRAGSBESTÄTIGUNG'}
            </button>
          </motion.div>
        )}

        {cur.id==='order' && (
          <motion.div key="order" initial={{x:20,opacity:0}} animate={{x:0,opacity:1}} exit={{x:-20,opacity:0}} className="flex-1">
            <h2 className="text-2xl font-black mb-1 tracking-tight">Auftragsbestätigung</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Schritt {step+1} von {steps.length}</p>

            <div className="bg-slate-50 border border-slate-200 rounded-[24px] p-5 mb-5 text-xs text-slate-700 max-h-72 overflow-y-auto">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-200">
                <div className="w-12 h-12 bg-white rounded-xl overflow-hidden flex items-center justify-center border border-slate-100">
                  <img src={company.logo} alt="" className="w-full h-full object-contain p-1" onError={e=>{(e.target as HTMLImageElement).style.display='none'}} />
                </div>
                <div>
                  <p className="font-black text-sm">{company.name}</p>
                  <p className="text-slate-400">{company.street} · {company.zip} {company.city}</p>
                </div>
              </div>
              <p className="font-black text-slate-900 text-sm mb-4 uppercase tracking-tight">AUFTRAGSBESTÄTIGUNG</p>
              <div className="space-y-2">
                {[
                  ['Datum',           fmtDate()],
                  ['Auftragsnummer',  job.orderId||'–'],
                  ['Kennzeichen',     job.licensePlate||'–'],
                  ['Fahrzeug',        job.vehicleModel||'–'],
                  ['Halter',          job.ownerName||'–'],
                  ['Auftraggeber',    job.customerDriverName||job.ownerName||'–'],
                  ['Telefon',         job.phone||'–'],
                  ['Einsatzort',      `${job.address||'–'}${job.zip?' '+job.zip+' '+job.city:''}`],
                  ['Dienstleistung',  job.serviceType==='transport'?'Transport':job.serviceType==='pannenhilfe'?'Pannenhilfe':'Notöffnung'],
                  ['Einsatzfahrzeug', job.driverVehicle||'–'],
                  ['Fahrer',          job.driverName||'–'],
                ].map(([k,v])=>(
                  <div key={k} className="flex justify-between items-start gap-3 py-1 border-b border-slate-100 last:border-0">
                    <span className="text-slate-400 font-bold flex-shrink-0">{k}:</span>
                    <span className="font-bold text-right">{v}</span>
                  </div>
                ))}
                {Object.entries(job.preDamages).some(([,d])=>(d as any).isDefect)&&(
                  <div className="pt-2">
                    <p className="font-black text-slate-700 mb-1">Vorschäden:</p>
                    <p className="text-slate-500 italic">{preDmgSummary(job.preDamages)}</p>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="font-medium italic text-slate-500">Hiermit bestätige ich, dass die oben genannte Dienstleistung ordnungsgemäß durchgeführt wurde und das Fahrzeug im dokumentierten Zustand übernommen/abgeholt wurde.</p>
              </div>
            </div>

            <div>
              <label className={LABEL}>Unterschrift Kunde *</label>
              {job.signatures.order
                ? <div className="bg-green-50 rounded-xl p-4 flex items-center gap-2 mb-4"><CheckCircle2 size={20} className="text-green-600"/><span className="text-sm font-black text-green-700">Auftragsbestätigung unterschrieben</span></div>
                : <div className="bg-slate-50 rounded-[24px] p-3 border border-slate-200 mb-4"><SignaturePad onSave={d=>saveSig('order',d)} height={160}/></div>
              }
            </div>

            <button disabled={!job.signatures.order||loading} onClick={next} className={PRIMARY}>
              {loading?<RefreshCw className="animate-spin" size={20}/>:'ABNAHME ABSCHLIESSEN'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 pt-4 border-t border-slate-100">
        <JobSummaryCard job={job}/>
      </div>
      <button onClick={goKVU} className="w-full h-14 mt-4 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 active:scale-95 border border-red-100">
        <AlertTriangle size={16}/> KUNDE VERWEIGERT UNTERSCHRIFT (KVU)
      </button>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// NOTES
// ════════════════════════════════════════════════════════════════════════════
const Notes = ({ setView, job, upd }: any) => (
  <motion.div initial={{y:50,opacity:0}} animate={{y:0,opacity:1}} className="p-6 flex flex-col bg-white min-h-full">
    <div className="flex items-center gap-4 mb-8">
      <button onClick={()=>setView('detail')} className="p-2 -ml-2"><ChevronLeft size={32}/></button>
      <h2 className="text-2xl font-black tracking-tight">Büro-Notiz</h2>
    </div>
    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5 flex items-start gap-3">
      <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0"/>
      <p className="text-xs font-black text-amber-700 uppercase tracking-wide">Nur für das Büro – nicht für den Kunden sichtbar</p>
    </div>
    <label className="flex items-center gap-4 mb-5 p-5 bg-slate-50 rounded-[24px] border border-slate-100 cursor-pointer">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${job.noSpecialNotes?'bg-black text-white':'bg-white text-slate-300 border border-slate-200'}`}><Check size={22}/></div>
      <div className="flex-1">
        <p className="font-black text-sm uppercase tracking-tight">Keine Besonderheiten</p>
        <p className="text-[10px] text-slate-400 font-bold uppercase">Standard-Einsatz ohne Vorkommnisse</p>
      </div>
      <input type="checkbox" className="w-6 h-6 accent-black" checked={job.noSpecialNotes}
        onChange={e=>upd({noSpecialNotes:e.target.checked,officeNotes:e.target.checked?'Keine Besonderheiten':job.officeNotes})} />
    </label>
    <textarea disabled={job.noSpecialNotes}
      className="flex-1 w-full min-h-[160px] bg-slate-50 border-2 border-slate-100 rounded-[28px] p-5 font-bold text-base outline-none focus:border-[#FF6321] resize-none disabled:opacity-30 transition-all shadow-inner"
      placeholder="Interne Bemerkung (z.B. KVU, Besonderheiten, Hinweise für die Zentrale)..."
      value={job.officeNotes} onChange={e=>upd({officeNotes:e.target.value})} />
    <div className="mt-6 pt-6 border-t border-slate-100"><JobSummaryCard job={job}/></div>
    <button disabled={!job.officeNotes.trim()} onClick={()=>setView('detail')} className={`${PRIMARY} mt-4`}>NOTIZ SPEICHERN</button>
  </motion.div>
);

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY (Final step)
// ════════════════════════════════════════════════════════════════════════════
const Summary = ({ setView, job, upd, uploadFile }: any) => {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string|null>(null);
  const [confirm, setConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleParkedPhoto = async (e:any) => {
    const file = e.target.files?.[0]; if(!file) return;
    setLoading(true);
    try {
      const url = await uploadFile('parked', file);
      if(url) upd({photos:{...job.photos,parked:[{url, note:''}]}});
    } finally { setLoading(false); }
  };

  const needsParkedPhoto = job.serviceType!=='pannenhilfe'||job.continueJourneyPossible===false;
  const parkedOk = !needsParkedPhoto || (job.photos.parked?.length>0);

  const finish = async () => {
    if(!confirm) { setConfirm(true); return; }
    setLoading(true); setError(null);
    try {
      const sr = await fetch('/api/jobs', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:job.id,data:job,status:'Abgeschlossen'})});
      if(!sr.ok) throw new Error('Synchronisierung fehlgeschlagen');
      const cr = await fetch(`/api/jobs/${job.id}/complete`, {method:'POST'});
      if(!cr.ok) { const e=await cr.json(); throw new Error(e.details||e.error||'Export fehlgeschlagen'); }
      localStorage.removeItem('current_job_id');
      localStorage.removeItem('current_view');
      setDone(true);
    } catch(e:any) {
      setError('Fehler: '+e.message);
      setConfirm(false);
    } finally { setLoading(false); }
  };

  if (done) return (
    <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="p-10 flex flex-col items-center justify-center h-full text-center bg-white">
      <motion.div initial={{scale:0,rotate:-45}} animate={{scale:1,rotate:0}} transition={{type:'spring',damping:12}}
        className="w-24 h-24 bg-green-500 text-white rounded-[32px] flex items-center justify-center mb-8 shadow-2xl shadow-green-200">
        <CheckCircle2 size={56}/>
      </motion.div>
      <h2 className="text-3xl font-black uppercase mb-2 tracking-tighter">Abgeschlossen</h2>
      <p className="text-slate-400 font-black mb-12 uppercase text-[10px] tracking-[0.2em]">Daten erfolgreich übermittelt</p>
      <button onClick={()=>window.location.reload()} className={PRIMARY}>NÄCHSTER EINSATZ</button>
    </motion.div>
  );

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} className="p-6 bg-white min-h-full flex flex-col">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={()=>setView('detail')} className="p-2 -ml-2"><ChevronLeft size={32}/></button>
        <h2 className="text-2xl font-black tracking-tight">Abschluss</h2>
      </div>

      <div className="space-y-5 flex-1">
        {/* Parked photo */}
        {needsParkedPhoto&&(
          <div className={CARD}>
            <h3 className={LABEL + " mb-3"}>Abstellort dokumentieren {!parkedOk&&'*'}</h3>
            <input type="file" accept="image/*" capture="environment" ref={inputRef} className="hidden" onChange={handleParkedPhoto}/>
            <div onClick={()=>inputRef.current?.click()}
              className="w-full aspect-video bg-slate-50 border-4 border-dashed border-slate-200 rounded-[20px] flex flex-col items-center justify-center gap-3 overflow-hidden cursor-pointer active:scale-98 transition-all">
              {job.photos.parked?.length>0
                ? <img src={photoUrl(job.photos.parked[0])} className="w-full h-full object-cover"/>
                : <><Camera size={28} className="text-slate-300"/><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FOTO ABSTELLORT TIPPEN</span></>
              }
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className={CARD}>
          <h3 className={LABEL + " mb-4"}>Zeitstempel</h3>
          <div className="space-y-2">
            {[['Auftrag angenommen',job.timestamps.accepted],['Auf dem Weg',job.timestamps.enRoute],['Ankunft am Schadenort',job.timestamps.arrived],['Dokumentation gestartet',job.timestamps.documenting],['Auf dem Weg zum Zielort',job.timestamps.transport],['Zielort erreicht',job.timestamps.atDest]].filter(([,v])=>v).map(([l,v])=>(
              <div key={l as string} className="flex justify-between text-xs">
                <span className="text-slate-400 font-bold">{l as string}</span>
                <span className="font-black">{fmtDateTime(v as string)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status card */}
        <div className="bg-white border-2 border-slate-100 p-6 rounded-[32px] shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-[#FF6321] text-white rounded-2xl flex items-center justify-center shadow-lg"><Check size={24}/></div>
            <div><p className={LABEL + " mb-0"}>Bereit zum Senden</p><p className="font-black text-lg">{co(job.company).short}</p></div>
          </div>
          {[['Auftrag',job.orderId],['Fahrzeug',job.licensePlate],['Dienstleistung',job.serviceType],['Fahrer',job.driverName],['Kunden-Status',job.kundeDa||'–']].map(([k,v])=>(
            <div key={k as string} className="flex justify-between items-center border-b border-slate-50 py-2 text-sm last:border-0">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{k as string}</span>
              <span className="font-black">{v as string}</span>
            </div>
          ))}
        </div>

        <JobSummaryCard job={job}/>
      </div>

      <div className="pt-6 pb-4">
        {error&&<div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl"><p className="text-[10px] font-black text-red-600 uppercase tracking-widest">{error}</p></div>}
        {!parkedOk&&<p className="text-center text-[10px] font-black text-red-500 uppercase mb-4 tracking-widest"><AlertTriangle size={12} className="inline mr-1"/>Foto vom Abstellort fehlt!</p>}
        <button disabled={loading||!parkedOk} onClick={finish}
          className={`w-full h-20 rounded-[28px] font-black text-sm tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl ${(!parkedOk||loading)?'bg-slate-100 text-slate-300':confirm?'bg-red-500 text-white shadow-red-200':'bg-[#FF6321] text-white shadow-orange-200'}`}>
          {loading?<RefreshCw className="animate-spin" size={24}/>:confirm?'JETZT WIRKLICH ABSCHLIESSEN?':'VORGANG ABSCHLIESSEN & SENDEN'}
        </button>
        <p className="text-center text-[9px] font-black text-slate-400 uppercase mt-4 tracking-widest opacity-60">Nach dem Absenden werden lokale Daten gelöscht</p>
      </div>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════════════════════
const Admin = ({ setView, setRole, adminPassword, setAdminPassword, drivers, vehicles, setDrivers, setVehicles }: any) => {
  const [jobs, setJobs]       = useState<any[]>([]);
  const [tab,  setTab]        = useState<'jobs'|'stammdaten'|'settings'>('jobs');
  const [sel,  setSel]        = useState<any|null>(null);
  const [tmpPw, setTmpPw]     = useState(adminPassword);
  const [saved, setSaved]     = useState(false);

  // Stammdaten state
  const [driverList, setDriverList]   = useState<any[]>([]);
  const [vehicleList, setVehicleList] = useState<any[]>([]);
  const [newDriverName, setNewDriverName]   = useState('');
  const [newVehicleLabel, setNewVehicleLabel] = useState('');
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [editDriver, setEditDriver]   = useState<any|null>(null);
  const [editVehicle, setEditVehicle] = useState<any|null>(null);
  const [stamErr, setStamErr] = useState('');

  useEffect(() => {
    fetch('/api/admin/jobs').then(r=>r.json()).then(setJobs).catch(()=>{});
  }, []);

  useEffect(() => {
    if (tab === 'stammdaten') {
      fetch('/api/drivers?all=1').then(r=>r.json()).then(setDriverList).catch(()=>{});
      fetch('/api/vehicles?all=1').then(r=>r.json()).then(setVehicleList).catch(()=>{});
    }
  }, [tab]);

  const reloadStammdaten = () => {
    fetch('/api/drivers?all=1').then(r=>r.json()).then(setDriverList).catch(()=>{});
    fetch('/api/vehicles?all=1').then(r=>r.json()).then(setVehicleList).catch(()=>{});
    fetch('/api/drivers').then(r=>r.json()).then((data:any[]) => setDrivers(data.map(d=>d.name))).catch(()=>{});
    fetch('/api/vehicles').then(r=>r.json()).then(setVehicles).catch(()=>{});
  };

  const addDriver = async () => {
    if (!newDriverName.trim()) return;
    const r = await fetch('/api/drivers', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: newDriverName.trim() }) });
    if (r.ok) { setNewDriverName(''); reloadStammdaten(); } else { const e = await r.json(); setStamErr(e.error); setTimeout(()=>setStamErr(''),3000); }
  };

  const saveDriver = async () => {
    if (!editDriver || !editDriver.name.trim()) return;
    const r = await fetch(`/api/drivers/${editDriver.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: editDriver.name, active: editDriver.active }) });
    if (r.ok) { setEditDriver(null); reloadStammdaten(); }
  };

  const deleteDriver = async (id: string) => {
    if (!confirm('Fahrer deaktivieren?')) return;
    await fetch(`/api/drivers/${id}`, { method: 'DELETE' });
    reloadStammdaten();
  };

  const addVehicle = async () => {
    if (!newVehicleLabel.trim() || !newVehiclePlate.trim()) return;
    const r = await fetch('/api/vehicles', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ label: newVehicleLabel.trim(), plate: newVehiclePlate.trim() }) });
    if (r.ok) { setNewVehicleLabel(''); setNewVehiclePlate(''); reloadStammdaten(); } else { const e = await r.json(); setStamErr(e.error); setTimeout(()=>setStamErr(''),3000); }
  };

  const saveVehicle = async () => {
    if (!editVehicle || !editVehicle.label.trim() || !editVehicle.plate.trim()) return;
    await fetch(`/api/vehicles/${editVehicle.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ label: editVehicle.label, plate: editVehicle.plate, active: editVehicle.active }) });
    setEditVehicle(null); reloadStammdaten();
  };

  const deleteVehicle = async (id: string) => {
    if (!confirm('Fahrzeug deaktivieren?')) return;
    await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
    reloadStammdaten();
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen max-w-md mx-auto border-x border-slate-100">
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="w-12 h-12 bg-[#FF6321] rounded-[18px] flex items-center justify-center mb-3 shadow-lg"><ShieldCheck size={24} className="text-white"/></div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Backoffice</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Einsatzdokumentation</p>
        </div>
        <button onClick={()=>{setRole('driver');setView('login');}} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl"><X size={20}/></button>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm mb-6 gap-1">
        {(['jobs','stammdaten','settings'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`flex-1 h-12 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${tab===t?'bg-black text-white':'text-slate-400'}`}>
            {t==='jobs'?'Einsätze':t==='stammdaten'?'Stammdaten':'Einstellungen'}
          </button>
        ))}
      </div>

      {tab==='jobs'&&(
        <div className="space-y-3">
          {jobs.length===0&&<p className="text-center text-slate-400 font-bold text-sm py-10">Keine Einsätze vorhanden</p>}
          {jobs.map((j,idx)=>(
            <motion.div key={j.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:idx*0.04}}
              className="bg-white p-5 rounded-[28px] shadow-sm border border-slate-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-black text-slate-900 text-lg tracking-tight">{j.data?.orderId||j.id}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{j.data?.driverName||'–'}</span>
                    <span className="w-1 h-1 bg-slate-200 rounded-full"/>
                    <span className="text-[9px] text-slate-300 font-bold">{new Date(j.updatedAt).toLocaleDateString('de-DE')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${j.status?.includes('Abgeschlossen')?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}`}>{j.status}</span>
                  <a href={`/api/admin/export/${j.id}`} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center active:scale-90 transition-all"><Download size={16}/></a>
                </div>
              </div>
              <button onClick={()=>setSel(sel?.id===j.id?null:j)} className="w-full text-left">
                <div className="grid grid-cols-3 gap-2 text-[9px]">
                  {[['Kennzeichen',j.data?.licensePlate],['Dienstl.',j.data?.serviceType],['Firma',co(j.data?.company)?.short]].map(([k,v])=>(
                    <div key={k as string}>
                      <p className="text-slate-400 font-black uppercase tracking-widest">{k as string}</p>
                      <p className="font-black text-slate-700 truncate">{v as string||'–'}</p>
                    </div>
                  ))}
                </div>
              </button>
              {sel?.id===j.id&&(
                <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  {[['Halter',j.data?.ownerName],['Telefon',j.data?.phone],['Einsatzort',j.data?.address],['Fahrer',j.data?.driverName],['Fahrzeug',j.data?.vehicleModel],['Büro-Notiz',j.data?.officeNotes]].map(([k,v])=>(
                    <div key={k as string} className="flex justify-between text-xs gap-2">
                      <span className="text-slate-400 font-bold flex-shrink-0">{k as string}:</span>
                      <span className="font-bold text-right text-slate-700 truncate">{v as string||'–'}</span>
                    </div>
                  ))}
                  <div className="flex gap-3 mt-4">
                    {[['Datenschutz',j.data?.signatures?.privacy],['Auftrag',j.data?.signatures?.order],['Haftung',j.data?.signatures?.liability]].map(([k,v])=>(
                      <div key={k as string} className={`flex-1 h-10 rounded-xl flex items-center justify-center text-[9px] font-black uppercase tracking-widest border-2 ${v?'bg-green-50 text-green-700 border-green-100':'bg-slate-50 text-slate-400 border-slate-100'}`}>
                        {v?<Check size={12} className="mr-1"/>:null}{k as string}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {tab==='stammdaten'&&(
        <div className="space-y-6">
          {stamErr&&<p className="text-red-500 text-xs font-black text-center uppercase tracking-widest mb-2">{stamErr}</p>}

          {/* ── FAHRER-TABELLE ─────────────────────────────────────── */}
          <div className={CARD}>
            <p className="font-black text-sm mb-3 uppercase tracking-tight">Fahrer</p>
            <div className="w-full overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="text-left px-3 py-2 w-full">Name</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap">Aktiv</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap" colSpan={2}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {driverList.map((d:any, idx:number)=>(
                    <tr key={d.id} className={`border-t border-slate-50 ${idx%2===0?'bg-white':'bg-slate-50/50'} ${!d.active?'opacity-40':''}`}>
                      {editDriver?.id===d.id ? (
                        <>
                          <td className="px-2 py-1.5" colSpan={2}>
                            <input
                              autoFocus
                              className="w-full h-9 bg-white border-2 border-[#FF6321] rounded-lg px-3 font-bold text-sm outline-none"
                              value={editDriver.name}
                              onChange={e=>setEditDriver({...editDriver,name:e.target.value})}
                              onKeyDown={e=>{if(e.key==='Enter')saveDriver();if(e.key==='Escape')setEditDriver(null);}}
                            />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={saveDriver} className="w-8 h-8 bg-green-500 text-white rounded-lg flex items-center justify-center mx-auto"><Check size={14}/></button>
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={()=>setEditDriver(null)} className="w-8 h-8 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center mx-auto"><X size={14}/></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 font-bold text-slate-800">
                            <span className={!d.active?'line-through text-slate-400':''}>{d.name}</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block w-2 h-2 rounded-full ${d.active?'bg-green-500':'bg-slate-300'}`}/>
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={()=>setEditDriver({...d})} title="Bearbeiten"
                              className="w-8 h-8 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center mx-auto hover:bg-slate-200 transition-colors">
                              <Edit3 size={13}/>
                            </button>
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            {d.active
                              ? <button onClick={()=>deleteDriver(d.id)} title="Deaktivieren"
                                  className="w-8 h-8 bg-red-50 text-red-400 rounded-lg flex items-center justify-center mx-auto hover:bg-red-100 transition-colors">
                                  <X size={13}/>
                                </button>
                              : <button onClick={async()=>{await fetch(`/api/drivers/${d.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:d.name,active:true})});reloadStammdaten();}} title="Reaktivieren"
                                  className="w-8 h-8 bg-green-50 text-green-500 rounded-lg flex items-center justify-center mx-auto hover:bg-green-100 transition-colors">
                                  <Check size={13}/>
                                </button>
                            }
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Add new driver */}
            <div className="flex gap-2 mt-3">
              <input
                className="flex-1 h-11 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 font-bold text-sm outline-none focus:border-[#FF6321] transition-colors"
                placeholder="Name des neuen Fahrers…"
                value={newDriverName}
                onChange={e=>setNewDriverName(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&addDriver()}
              />
              <button onClick={addDriver} disabled={!newDriverName.trim()}
                className="h-11 px-4 bg-[#FF6321] text-white rounded-xl font-black text-xs tracking-widest flex items-center gap-1.5 disabled:opacity-30 transition-opacity active:scale-95">
                <Plus size={16}/> Hinzufügen
              </button>
            </div>
          </div>

          {/* ── FAHRZEUG-TABELLE ───────────────────────────────────── */}
          <div className={CARD}>
            <p className="font-black text-sm mb-3 uppercase tracking-tight">Fahrzeuge</p>
            <div className="w-full overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="text-left px-3 py-2">Bezeichnung</th>
                    <th className="text-left px-3 py-2 whitespace-nowrap">Kennzeichen</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap">Aktiv</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap" colSpan={2}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleList.map((v:any, idx:number)=>(
                    <tr key={v.id} className={`border-t border-slate-50 ${idx%2===0?'bg-white':'bg-slate-50/50'} ${!v.active?'opacity-40':''}`}>
                      {editVehicle?.id===v.id ? (
                        <>
                          <td className="px-2 py-1.5">
                            <input
                              autoFocus
                              className="w-full h-9 bg-white border-2 border-[#FF6321] rounded-lg px-2 font-bold text-sm outline-none"
                              value={editVehicle.label}
                              onChange={e=>setEditVehicle({...editVehicle,label:e.target.value})}
                              placeholder="Bezeichnung"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              className="w-full h-9 bg-white border-2 border-[#FF6321] rounded-lg px-2 font-bold text-sm outline-none"
                              value={editVehicle.plate}
                              onChange={e=>setEditVehicle({...editVehicle,plate:e.target.value})}
                              placeholder="Kennzeichen"
                              onKeyDown={e=>{if(e.key==='Enter')saveVehicle();if(e.key==='Escape')setEditVehicle(null);}}
                            />
                          </td>
                          <td className="px-1 py-1.5"/>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={saveVehicle} className="w-8 h-8 bg-green-500 text-white rounded-lg flex items-center justify-center mx-auto"><Check size={14}/></button>
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={()=>setEditVehicle(null)} className="w-8 h-8 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center mx-auto"><X size={14}/></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 font-bold text-slate-800">
                            <span className={!v.active?'line-through text-slate-400':''}>{v.label}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs font-black text-slate-500 whitespace-nowrap">{v.plate}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block w-2 h-2 rounded-full ${v.active?'bg-green-500':'bg-slate-300'}`}/>
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={()=>setEditVehicle({...v})} title="Bearbeiten"
                              className="w-8 h-8 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center mx-auto hover:bg-slate-200 transition-colors">
                              <Edit3 size={13}/>
                            </button>
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            {v.active
                              ? <button onClick={()=>deleteVehicle(v.id)} title="Deaktivieren"
                                  className="w-8 h-8 bg-red-50 text-red-400 rounded-lg flex items-center justify-center mx-auto hover:bg-red-100 transition-colors">
                                  <X size={13}/>
                                </button>
                              : <button onClick={async()=>{await fetch(`/api/vehicles/${v.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({label:v.label,plate:v.plate,active:true})});reloadStammdaten();}} title="Reaktivieren"
                                  className="w-8 h-8 bg-green-50 text-green-500 rounded-lg flex items-center justify-center mx-auto hover:bg-green-100 transition-colors">
                                  <Check size={13}/>
                                </button>
                            }
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Add new vehicle */}
            <div className="flex flex-col gap-2 mt-3">
              <div className="grid grid-cols-3 gap-2">
                <input
                  className="col-span-2 h-11 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 font-bold text-sm outline-none focus:border-[#FF6321] transition-colors"
                  placeholder="Bezeichnung (z.B. Mercedes Atego)…"
                  value={newVehicleLabel}
                  onChange={e=>setNewVehicleLabel(e.target.value)}
                />
                <input
                  className="col-span-1 h-11 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 font-bold text-sm outline-none focus:border-[#FF6321] transition-colors"
                  placeholder="Kennzeichen…"
                  value={newVehiclePlate}
                  onChange={e=>setNewVehiclePlate(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&addVehicle()}
                />
              </div>
              <button onClick={addVehicle} disabled={!newVehicleLabel.trim()||!newVehiclePlate.trim()}
                className="h-11 w-full bg-[#FF6321] text-white rounded-xl font-black text-xs tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-30 transition-opacity active:scale-95">
                <Plus size={16}/> Fahrzeug hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {tab==='settings'&&(
        <div className="space-y-6">
          <div className={CARD}>
            <label className={LABEL}>Admin Passwort</label>
            <input className={INPUT} type="password" value={tmpPw} onChange={e=>setTmpPw(e.target.value)} />
            <button onClick={()=>{setAdminPassword(tmpPw);setSaved(true);setTimeout(()=>setSaved(false),3000);}} className={PRIMARY}>
              {saved?<><Check size={20} className="mr-2"/>GESPEICHERT</>:'EINSTELLUNGEN SPEICHERN'}
            </button>
          </div>
          <div className={CARD}>
            <p className="font-black text-sm mb-2">API-Endpunkte</p>
            <p className="text-xs text-slate-400 font-mono">/api/admin/jobs</p>
            <p className="text-xs text-slate-400 font-mono">/api/admin/export/:id</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ════════════════════════════════════════════════════════════════════════════
const ModuleBtn = ({ icon, label, sublabel, done, onClick }: any) => (
  <button onClick={onClick} className="w-full bg-white border border-slate-100 p-5 rounded-[24px] flex items-center justify-between shadow-sm active:bg-slate-50 transition-all hover:border-slate-200">
    <div className="flex items-center gap-4">
      <div className={`w-14 h-14 ${done?'bg-green-50 text-green-600':'bg-slate-50 text-slate-500'} rounded-2xl flex items-center justify-center shadow-inner transition-colors`}>
        {done?<CheckCircle2 size={26}/>:icon}
      </div>
      <div className="text-left">
        <div className="flex items-center gap-2">
          <p className="font-black text-lg tracking-tight">{label}</p>
          {done&&<div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"><Check size={10} className="text-white"/></div>}
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{sublabel}</p>
      </div>
    </div>
    <ChevronRight className="text-slate-200 flex-shrink-0"/>
  </button>
);

const TimestampBadge = ({ icon, label, value }: any) => (
  <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs">
    <span className="text-slate-400">{icon}</span>
    <span className="text-slate-500 font-bold">{label}</span>
    <span className="font-black text-slate-900 ml-auto">{value}</span>
  </div>
);

const JobSummaryCard = ({ job }: { job: JobState }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-[20px] p-4">
    <p className={LABEL + " mb-3"}>Zusammenfassung</p>
    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
      <div><p className="text-slate-400 font-black uppercase tracking-widest text-[9px] mb-0.5">Auftrag</p><p className="font-black text-slate-900 truncate">{job.orderId||'–'}</p></div>
      <div><p className="text-slate-400 font-black uppercase tracking-widest text-[9px] mb-0.5">Kennzeichen</p><p className="font-black text-slate-900">{job.licensePlate||'–'}</p></div>
      <div><p className="text-slate-400 font-black uppercase tracking-widest text-[9px] mb-0.5">Telefon</p>
        <div className="flex items-center gap-2">
          <p className="font-black text-slate-900">{job.phone||'–'}</p>
          {job.phone&&<button onClick={e=>{e.stopPropagation();navigator.clipboard.writeText(job.phone);}} className="p-1 bg-white rounded-lg border border-slate-200"><Copy size={10} className="text-slate-500"/></button>}
        </div>
      </div>
      <div><p className="text-slate-400 font-black uppercase tracking-widest text-[9px] mb-0.5">Dienstleistung</p><p className="font-black text-[#FF6321] uppercase">{job.serviceType||'–'}</p></div>
      {job.ownerName&&<div className="col-span-2"><p className="text-slate-400 font-black uppercase tracking-widest text-[9px] mb-0.5">Halter</p><p className="font-black text-slate-900 truncate">{job.ownerName}</p></div>}
      {job.kundeDa&&<div><p className="text-slate-400 font-black uppercase tracking-widest text-[9px] mb-0.5">Kunden-Status</p><p className={`font-black uppercase ${job.refusedSignature?'text-red-600':'text-green-600'}`}>{job.kundeDa}</p></div>}
    </div>
  </div>
);
