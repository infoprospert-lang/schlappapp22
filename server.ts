import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import Database from "better-sqlite3";
import axios from "axios";
import archiver from "archiver";
import FormData from "form-data";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import { Resend } from "resend";
import dotenv from "dotenv";
import sharp from "sharp";
import { generateAllPdfs, type PdfResult } from "./pdfGenerator.js";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// --- DATABASE SETUP ---
const db = new Database("towdoc_v2.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    data TEXT,
    status TEXT,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    jobId TEXT,
    fieldName TEXT,
    path TEXT,
    originalName TEXT,
    mimeType TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    companyId TEXT,
    active INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    plate TEXT NOT NULL,
    companyId TEXT,
    active INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrations (idempotent)
try { db.exec("ALTER TABLE files ADD COLUMN compressedPath TEXT"); } catch {}
try { db.exec("ALTER TABLE files ADD COLUMN isArchived INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE jobs ADD COLUMN filesDeleteAt DATETIME"); } catch {}

// Seed drivers and vehicles if tables are empty
const driverCount = (db.prepare("SELECT COUNT(*) as n FROM drivers").get() as any).n;
if (driverCount === 0) {
  const insertDriver = db.prepare("INSERT INTO drivers (id, name, active) VALUES (?, ?, 1)");
  const seedDrivers = [
    "Hans-Peter Beckert","Florian Claußnitzer","Steffen Pause","Oliver Schmidt",
    "Jan Holan","Diana Neubauer","Jens Förster","André Dallmann","Matti Baumgarten",
    "Marian Lungu","Roy Andrae","Steven Werner","Sven Pawlitza","Mareen Puchelt",
    "Birgit Hündorf","Melanie Reichelt","Andreas Dähn","Daniel Schwarze",
  ];
  for (const name of seedDrivers) {
    insertDriver.run(Math.random().toString(36).substring(7), name);
  }
}

const vehicleCount = (db.prepare("SELECT COUNT(*) as n FROM vehicles").get() as any).n;
if (vehicleCount === 0) {
  const insertVehicle = db.prepare("INSERT INTO vehicles (id, label, plate, active) VALUES (?, ?, ?, 1)");
  const seedVehicles = [
    { label: "Iveco Daily", plate: "MQ-SG 999" },
    { label: "MAN TGE", plate: "SK-AM 110" },
    { label: "Mercedes Atego 1218", plate: "SK-HM 866" },
    { label: "Mercedes Atego Kran", plate: "SK-AM 701" },
    { label: "MAN Plateau", plate: "MQ-JR 703" },
    { label: "Mercedes Actros Plateau", plate: "MQ-SG 5" },
    { label: "Mercedes Algema", plate: "BLK-HM 909" },
    { label: "MAN Plateau Kran", plate: "BLK-HM 660" },
    { label: "Mercedes ML", plate: "SK-AM 456" },
    { label: "Smart", plate: "MQ-SG 20" },
    { label: "Mercedes Sprinter", plate: "SK-HM 220" },
    { label: "Citroen Jumper", plate: "MQ-SG 2" },
    { label: "Mercedes Citan", plate: "HHM-HM 15" },
    { label: "Mercedes Actros 4-Achser", plate: "MQ-SG 321" },
    { label: "Scania 3-Achser", plate: "MQ-JR 800" },
  ];
  for (const v of seedVehicles) {
    insertVehicle.run(Math.random().toString(36).substring(7), v.label, v.plate);
  }
}

// --- STORAGE SETUP ---
const UPLOAD_PATH = path.resolve(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
}

const storage = multer.diskStorage({
  destination: UPLOAD_PATH,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const sanitizedFieldname = file.fieldname.replace(/[^a-z0-9]/gi, '_');
    cb(null, `${sanitizedFieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// --- FILE LABELS: Mapping fieldName → ZIP filename (photos + signatures) ---
const FILE_LABELS: Record<string, string> = {
  // Photos
  arrival:             "Fotos/Ankunft_Situation",
  plate:               "Fotos/Kennzeichen_VIN",
  cockpit:             "Fotos/Cockpit_KM-Stand",
  front:               "Fotos/Fahrzeug_Frontal",
  right:               "Fotos/Fahrzeug_Rechts",
  left:                "Fotos/Fahrzeug_Links",
  rear:                "Fotos/Fahrzeug_Heck",
  plateau:             "Fotos/Verladen_Plateau",
  other:               "Fotos/Sonstiges",
  parked:              "Fotos/Abstellort",
  Karosserie_dmg:      "Vorschaeden/Vorschaden_Karosserie",
  Verglasung_dmg:      "Vorschaeden/Vorschaden_Verglasung",
  Reifen_Felgen_dmg:   "Vorschaeden/Vorschaden_Reifen_Felgen",
  Beleuchtung_dmg:     "Vorschaeden/Vorschaden_Beleuchtung",
  Besonderheiten_dmg:  "Vorschaeden/Vorschaden_Besonderheiten",
  // Signatures — fieldNames used by the app (Sigs: type+'_sig', Service: type)
  privacy_sig:         "Unterschriften/Datenschutz_Unterschrift_Kunde",
  order_sig:           "Unterschriften/Auftragsbestaetigung_Unterschrift_Kunde",
  liability:           "Unterschriften/Haftungsausschluss_Unterschrift_Kunde",
  liabilityDriver:     "Unterschriften/Haftungsausschluss_Unterschrift_Fahrer",
};

function buildJobZip(files: any[], pdfs: PdfResult[] = []): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const arc = archiver("zip", { zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    arc.on("data", (chunk: Buffer) => chunks.push(chunk));
    arc.on("end", () => resolve(Buffer.concat(chunks)));
    arc.on("error", reject);

    const zipContents: string[] = [];

    // ── Photos & Signatures (uploaded files) ────────────────────────────────
    const counters: Record<string, number> = {};
    for (const file of files) {
      const label = FILE_LABELS[file.fieldName];
      if (!label) continue; // skip unknown fields
      const fullPath = path.join(UPLOAD_PATH, path.basename(file.path));
      if (!fs.existsSync(fullPath)) {
        console.log(`[ZIP] Datei nicht gefunden, übersprungen: ${file.fieldName}`);
        continue;
      }
      counters[file.fieldName] = (counters[file.fieldName] || 0) + 1;
      const n = counters[file.fieldName];
      const extFromName = path.extname(file.originalName);
      const extFromMime = file.mimeType === "image/png" ? ".png" : ".jpg";
      const ext = extFromName || extFromMime;
      const filename = n > 1 ? `${label}_${n}${ext}` : `${label}${ext}`;
      arc.file(fullPath, { name: filename });
      zipContents.push(filename);
    }

    // ── PDF Documents ────────────────────────────────────────────────────────
    for (const pdf of pdfs) {
      const zipName = `Dokumente/${pdf.name}`;
      arc.append(pdf.buffer, { name: zipName });
      console.log(`[ZIP] PDF hinzugefügt: ${zipName}`);
      zipContents.push(zipName);
    }

    console.log(`[ZIP] Inhalt gesamt (${zipContents.length} Dateien): ${zipContents.join(", ") || "leer"}`);
    arc.finalize();
  });
}

// --- IMAGE COMPRESSION ---

// Only signature fields need PNG (transparency). All photo fields → JPEG regardless of upload format.
const SIGNATURE_FIELDS = new Set(["privacy_sig", "order_sig", "liability", "liabilityDriver"]);

async function compressImageForArchive(inputPath: string, outputPath: string, keepPng: boolean): Promise<void> {
  const pipeline = sharp(inputPath)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true });
  if (keepPng) {
    await pipeline.png({ compressionLevel: 9 }).toFile(outputPath);
  } else {
    await pipeline
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 40, mozjpeg: true })
      .toFile(outputPath);
  }
}

async function archiveJobFiles(files: any[]): Promise<void> {
  for (const file of files) {
    if (!file.mimeType?.startsWith("image/")) continue;
    const originalFullPath = path.join(UPLOAD_PATH, path.basename(file.path));
    if (!fs.existsSync(originalFullPath)) continue;
    const keepPng = SIGNATURE_FIELDS.has(file.fieldName);
    const ext = keepPng ? "png" : "jpg";
    const compressedName = `arch_${path.basename(originalFullPath, path.extname(originalFullPath))}.${ext}`;
    const compressedFullPath = path.join(UPLOAD_PATH, compressedName);
    try {
      await compressImageForArchive(originalFullPath, compressedFullPath, keepPng);
      db.prepare("UPDATE files SET compressedPath = ?, isArchived = 1 WHERE id = ?")
        .run(`/uploads/${compressedName}`, file.id);
    } catch (e: any) {
      console.error(`[Archive] Komprimierung fehlgeschlagen für ${file.fieldName}:`, e.message);
      db.prepare("UPDATE files SET isArchived = 1 WHERE id = ?").run(file.id);
    }
  }
}

// --- CLEANUP ---

function cleanupExpiredFiles() {
  const now = new Date().toISOString();

  // Delete archived files whose 30-day window has passed
  const expired = db.prepare(`
    SELECT f.* FROM files f
    JOIN jobs j ON f.jobId = j.id
    WHERE f.isArchived = 1 AND j.filesDeleteAt IS NOT NULL AND j.filesDeleteAt < ?
  `).all(now) as any[];

  for (const file of expired) {
    const p = file.compressedPath || file.path;
    const fp = path.join(UPLOAD_PATH, path.basename(p));
    if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch {} }
  }
  if (expired.length > 0) {
    db.prepare(`
      DELETE FROM files WHERE isArchived = 1 AND jobId IN (
        SELECT id FROM jobs WHERE filesDeleteAt IS NOT NULL AND filesDeleteAt < ?
      )
    `).run(now);
    console.log(`[Cleanup] ${expired.length} abgelaufene Archivdateien gelöscht`);
  }

  // Delete original files from abandoned (never-completed) jobs older than 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const abandoned = db.prepare(
    "SELECT * FROM files WHERE isArchived = 0 AND createdAt < ?"
  ).all(cutoff) as any[];

  for (const file of abandoned) {
    const fp = path.join(UPLOAD_PATH, path.basename(file.path));
    if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch {} }
  }
  if (abandoned.length > 0) {
    db.prepare("DELETE FROM files WHERE isArchived = 0 AND createdAt < ?").run(cutoff);
    console.log(`[Cleanup] ${abandoned.length} verwaiste Upload-Dateien gelöscht`);
  }
}

// --- DOCUMENT STATUS ---

type DocStatus = { name: string; available: boolean; reason: string };

function computeDocumentStatus(d: any): DocStatus[] {
  const absent = (): string => {
    if (d.customerCrashed)    return "Kunde verunfallt / nicht ansprechbar";
    if (d.refusedSignature)   return "Unterschrift verweigert (KVU)";
    if (d.isCustomerPresent === false) return "Kunde nicht vor Ort";
    if (d.waivedSignature)    return "Unterschrift verzichtet";
    return "Unterschrift fehlt";
  };

  const docs: DocStatus[] = [];

  // Datenschutzerklärung — benötigt signatures.privacy
  const privOk = !!d.signatures?.privacy;
  docs.push({ name: "Datenschutzerklärung",  available: privOk,  reason: privOk  ? "Unterschrift vorhanden" : absent() });

  // Auftragsbestätigung — benötigt signatures.order
  const ordOk = !!d.signatures?.order;
  docs.push({ name: "Auftragsbestätigung",   available: ordOk,   reason: ordOk   ? "Unterschrift vorhanden" : absent() });

  // Haftungsausschluss — nur bei Notöffnung, benötigt liability + liabilityDriver
  if (d.serviceType === "notoeffnung") {
    const liabOk = !!d.signatures?.liability && !!d.signatures?.liabilityDriver;
    docs.push({
      name: "Haftungsausschluss",
      available: liabOk,
      reason: liabOk
        ? "Beide Unterschriften vorhanden"
        : d.waivedSignature
          ? (d.refusedSignature ? "Unterschrift verweigert (KVU)" : "Unterschrift verzichtet")
          : "Unterschrift(en) fehlen",
    });
  }

  return docs;
}

function docStatusRow(doc: DocStatus): string {
  const icon  = doc.available ? "✓" : "✗";
  const color = doc.available ? "#16a34a" : "#dc2626";
  return `<tr>
    <td style="padding:6px 14px;color:#888;font-weight:600;white-space:nowrap;border-bottom:1px solid #f0f0f0">${doc.name}</td>
    <td style="padding:6px 14px;border-bottom:1px solid #f0f0f0">
      <span style="color:${color};font-weight:900">${icon}</span>
      <span style="font-weight:700;margin-left:6px;color:${color}">${doc.reason}</span>
    </td>
  </tr>`;
}

function tr(label: string, value: any): string {
  const v = value !== undefined && value !== null && value !== "" ? String(value) : "–";
  return `<tr><td style="padding:6px 14px;color:#888;font-weight:600;white-space:nowrap;border-bottom:1px solid #f0f0f0">${label}</td><td style="padding:6px 14px;font-weight:700;border-bottom:1px solid #f0f0f0">${v}</td></tr>`;
}

function sec(title: string, rows: string): string {
  return `<tr><td colspan="2" style="padding:14px 14px 4px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#FF6321;background:#fff9f6">${title}</td></tr>${rows}`;
}

function buildEmailHtml(d: any, docStatus: DocStatus[]): string {
  const company = d.company === "swientek-glaeser" ? "Swientek & Gläser GmbH" : "Auto-Misselwitz GmbH";
  const serviceLabel = d.serviceType === "transport" ? "Transport" : d.serviceType === "pannenhilfe" ? "Pannenhilfe" : "Notöffnung";
  const fmtTs = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "–";
  const preDmg = Object.entries(d.preDamages || {})
    .filter(([, v]: any) => v.isDefect)
    .map(([k, v]: any) => `${k}${v.note ? ": " + v.note : ""}`)
    .join(", ") || "Keine";
  const destFull = [d.destStreet, d.destHouseNum, d.destZip, d.destCity].filter(Boolean).join(" ");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#FF6321;padding:24px 28px;color:#fff">
    <div style="font-size:11px;font-weight:900;letter-spacing:0.15em;opacity:0.75;text-transform:uppercase">AppSchleppen – Einsatzdokumentation</div>
    <div style="font-size:22px;font-weight:900;margin-top:4px">${d.orderId || d.id}</div>
    <div style="font-size:13px;opacity:0.85;margin-top:2px">${company}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${sec("Auftrag", [
      tr("Auftragsnummer", d.orderId),
      tr("Datum", fmtTs(d.timestamps?.accepted)),
      tr("Unternehmen", company),
      tr("Fahrer", d.driverName),
      tr("Einsatzfahrzeug", d.driverVehicle),
    ].join(""))}
    ${sec("Kundenfahrzeug", [
      tr("Kennzeichen", d.licensePlate),
      tr("Fahrzeugmodell", d.vehicleModel),
      tr("Halter / Eigentümer", d.ownerName),
      tr("Auftraggeber", d.customerDriverName),
      tr("Telefon", d.phone),
      tr("E-Mail", d.customerEmail),
      tr("Straße", d.customerStreet ? `${d.customerStreet} ${d.customerHouseNum || ''}`.trim() : null),
      tr("PLZ / Ort", d.customerZip || d.customerCity ? `${d.customerZip || ''} ${d.customerCity || ''}`.trim() : null),
    ].join(""))}
    ${sec("Einsatz", [
      tr("Dienstleistung", serviceLabel),
      tr("Einsatzort", [d.address, d.zip, d.city].filter(Boolean).join(" ")),
      tr("Schwerer Unfall", d.isSevereAccident ? "Ja" : "Nein"),
      tr("Kunden-Status", d.kundeDa),
    ].join(""))}
    ${d.serviceType !== "transport" ? sec("Service-Details", [
      d.serviceType === "pannenhilfe" ? tr("Weiterfahrt möglich", d.continueJourneyPossible === true ? "Ja" : d.continueJourneyPossible === false ? "Nein" : "–") : "",
      d.serviceType === "pannenhilfe" ? tr("Pannenhilfe-Notiz", d.serviceNotes) : "",
      d.serviceType === "notoeffnung" ? tr("Identität geprüft", d.identityChecked ? "Ja" : "Nein") : "",
      d.serviceType === "notoeffnung" ? tr("Wie Hilfe geleistet", d.liabilityHelp) : "",
      tr("KVU / Unterschrift verzichtet", d.waivedSignature ? "Ja" : "Nein"),
    ].join("")) : ""}
    ${d.destinationType ? sec("Zielort", [
      tr("Zielort-Typ", d.destinationType),
      tr("Name", d.destName),
      tr("Adresse", destFull),
      tr("Kunde mitgefahren", d.customerTravelingAlong === true ? "Ja" : d.customerTravelingAlong === false ? "Nein" : "–"),
    ].join("")) : ""}
    ${sec("Dokumentenstatus", docStatus.map(docStatusRow).join(""))}
    ${sec("Dokumentation", [
      tr("Vorschäden", preDmg),
      tr("Büro-Notiz", d.officeNotes || (d.noSpecialNotes ? "Keine Besonderheiten" : "–")),
    ].join(""))}
    ${sec("Zeitstempel", [
      tr("Angenommen", fmtTs(d.timestamps?.accepted)),
      tr("Auf dem Weg", fmtTs(d.timestamps?.enRoute)),
      tr("Ankunft am Schadenort", fmtTs(d.timestamps?.arrived)),
      tr("Dokumentation gestartet", fmtTs(d.timestamps?.documenting)),
      tr("Auf dem Weg zum Zielort", fmtTs(d.timestamps?.transport)),
      tr("Zielort erreicht", fmtTs(d.timestamps?.atDest)),
    ].join(""))}
  </table>
  <div style="padding:16px 28px;background:#f9f9f9;font-size:11px;color:#aaa;border-top:1px solid #eee">
    Automatisch generiert von AppSchleppen · ${new Date().toLocaleDateString("de-DE")}
  </div>
</div>
</body></html>`;
}

async function sendJobSummaryEmail(jobData: any, files: any[], pdfs: PdfResult[] = []): Promise<void> {
  const officeEmail = process.env.OFFICE_EMAIL;
  if (!process.env.RESEND_API_KEY || !officeEmail) {
    console.log("Email skipped: RESEND_API_KEY or OFFICE_EMAIL not configured.");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  // Compute document status before building email
  const docStatus = computeDocumentStatus(jobData);

  // ZIP: photos + signatures + PDFs
  const knownFiles = files.filter((f) => FILE_LABELS[f.fieldName]);
  const attachments: any[] = [];

  if (knownFiles.length > 0 || pdfs.length > 0) {
    const zipBuffer = await buildJobZip(knownFiles, pdfs);
    const orderId = jobData.orderId || jobData.id;
    attachments.push({
      filename: `Einsatz_${orderId}.zip`,
      content: zipBuffer,
      contentType: "application/zip",
    });
  }

  const orderId = jobData.orderId || jobData.id;
  const companyShort = jobData.company === "swientek-glaeser" ? "Swientek & Gläser" : "Auto-Misselwitz";

  const fromAddress = process.env.SMTP_FROM || `AppSchleppen <onboarding@resend.dev>`;

  await resend.emails.send({
    from: fromAddress,
    to: officeEmail,
    subject: `Einsatz abgeschlossen: ${orderId} – ${companyShort}`,
    html: buildEmailHtml(jobData, docStatus),
    attachments,
  });
}

// --- API ROUTES ---

// --- DRIVERS CRUD ---
app.get("/api/drivers", (req, res) => {
  const all = req.query.all === '1';
  const rows = all
    ? db.prepare("SELECT * FROM drivers ORDER BY name ASC").all()
    : db.prepare("SELECT * FROM drivers WHERE active = 1 ORDER BY name ASC").all();
  res.json(rows);
});

app.post("/api/drivers", (req, res) => {
  const { name, companyId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name ist Pflichtfeld" });
  const id = Math.random().toString(36).substring(7);
  db.prepare("INSERT INTO drivers (id, name, companyId, active) VALUES (?, ?, ?, 1)").run(id, name.trim(), companyId || null);
  res.json({ id, name: name.trim(), companyId: companyId || null, active: 1 });
});

app.put("/api/drivers/:id", (req, res) => {
  const { name, companyId, active } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name ist Pflichtfeld" });
  db.prepare("UPDATE drivers SET name = ?, companyId = ?, active = ? WHERE id = ?")
    .run(name.trim(), companyId || null, active !== undefined ? (active ? 1 : 0) : 1, req.params.id);
  res.json({ success: true });
});

app.delete("/api/drivers/:id", (req, res) => {
  db.prepare("UPDATE drivers SET active = 0 WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// --- VEHICLES CRUD ---
app.get("/api/vehicles", (req, res) => {
  const all = req.query.all === '1';
  const rows = all
    ? db.prepare("SELECT * FROM vehicles ORDER BY label ASC").all()
    : db.prepare("SELECT * FROM vehicles WHERE active = 1 ORDER BY label ASC").all();
  res.json(rows);
});

app.post("/api/vehicles", (req, res) => {
  const { label, plate, companyId } = req.body;
  if (!label?.trim() || !plate?.trim()) return res.status(400).json({ error: "Name und Kennzeichen sind Pflichtfelder" });
  const id = Math.random().toString(36).substring(7);
  db.prepare("INSERT INTO vehicles (id, label, plate, companyId, active) VALUES (?, ?, ?, ?, 1)").run(id, label.trim(), plate.trim(), companyId || null);
  res.json({ id, label: label.trim(), plate: plate.trim(), companyId: companyId || null, active: 1 });
});

app.put("/api/vehicles/:id", (req, res) => {
  const { label, plate, companyId, active } = req.body;
  if (!label?.trim() || !plate?.trim()) return res.status(400).json({ error: "Name und Kennzeichen sind Pflichtfelder" });
  db.prepare("UPDATE vehicles SET label = ?, plate = ?, companyId = ?, active = ? WHERE id = ?")
    .run(label.trim(), plate.trim(), companyId || null, active !== undefined ? (active ? 1 : 0) : 1, req.params.id);
  res.json({ success: true });
});

app.delete("/api/vehicles/:id", (req, res) => {
  db.prepare("UPDATE vehicles SET active = 0 WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id) as any;
  if (!job) return res.status(404).json({ error: "Not found" });
  
  const files = db.prepare("SELECT * FROM files WHERE jobId = ?").all(req.params.id);
  res.json({ ...job, data: JSON.parse(job.data), files });
});

app.post("/api/jobs", (req, res) => {
  const { id, data, status } = req.body;
  const stmt = db.prepare(`
    INSERT INTO jobs (id, data, status) 
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      data = excluded.data, 
      status = excluded.status,
      updatedAt = CURRENT_TIMESTAMP
  `);
  stmt.run(id, JSON.stringify(data), status);
  res.json({ success: true });
});

app.post("/api/upload/:jobId", (req, res) => {
  const { jobId } = req.params;
  
  upload.any()(req, res, (err) => {
    if (err) {
      console.error("Upload Error:", err);
      return res.status(500).json({ error: err.message });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "No files" });

    try {
      const stmt = db.prepare("INSERT INTO files (id, jobId, fieldName, path, originalName, mimeType) VALUES (?, ?, ?, ?, ?, ?)");
      const results = files.map(file => {
        const fileId = Math.random().toString(36).substring(7);
        const relativePath = `/uploads/${path.basename(file.path)}`;
        stmt.run(fileId, jobId, file.fieldname, relativePath, file.originalname, file.mimetype);
        return { id: fileId, fieldName: file.fieldname, path: relativePath };
      });
      res.json(results);
    } catch (dbErr: any) {
      console.error("DB Error:", dbErr);
      res.status(500).json({ error: dbErr.message });
    }
  });
});

app.use("/uploads", express.static(UPLOAD_PATH));

app.post("/api/jobs/:id/complete", async (req, res) => {
  const { id } = req.params;
  const jobRow = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as any;
  if (!jobRow) return res.status(404).json({ error: "Job not found" });

  const files = db.prepare("SELECT * FROM files WHERE jobId = ?").all(id) as any[];

  // 1. Trigger n8n webhook
  const webhookUrl = process.env.WEBHOOK_URL || "https://n8n.srv1130396.hstgr.cloud/webhook/dd3205b3-9acd-43c5-8b62-5d19eafa6149";
  const jobData = JSON.parse(jobRow.data);
  const docStatus = computeDocumentStatus(jobData);
  const form = new FormData();
  form.append("payload", jobRow.data);
  form.append("event", "form.completed");
  form.append("sentAt", new Date().toISOString());
  // Tell n8n which documents can be generated (only generate PDFs when data+signatures are available)
  form.append("documentStatus", JSON.stringify(docStatus));

  console.log(`Preparing webhook for job ${id}. Files to attach: ${files.length}`);
  for (const file of files) {
    const fullPath = path.join(UPLOAD_PATH, path.basename(file.path));
    if (fs.existsSync(fullPath)) {
      console.log(`Attaching file: ${file.fieldName} (${file.originalName})`);
      form.append(file.fieldName, fs.createReadStream(fullPath), { 
        filename: file.originalName, 
        contentType: file.mimeType 
      });
    } else {
      console.warn(`File not found on disk: ${fullPath}`);
    }
  }

  try {
    console.log(`Sending webhook for job ${id} to ${webhookUrl}...`);
    const response = await axios.post(webhookUrl, form, { 
      headers: form.getHeaders(), 
      timeout: 60000 // Increased timeout for large uploads
    });
    console.log("Webhook successfully sent for job:", id, "Response:", response.status);

    // 2. Generate PDFs (before file cleanup — signatures must still be on disk)
    let pdfs: PdfResult[] = [];
    try {
      pdfs = await generateAllPdfs(jobData);
    } catch (pdfErr: any) {
      console.error(`[PDF] Unerwarteter Fehler bei PDF-Generierung für Job ${id}:`, pdfErr.message);
    }

    // 3. Send summary email with ZIP (photos + signatures + PDFs)
    try {
      await sendJobSummaryEmail(jobData, files, pdfs);
      console.log("Summary email sent for job:", id);
    } catch (emailErr: any) {
      console.error("Email sending failed for job:", id, emailErr.message);
      // Non-fatal: log and continue — job is still marked complete
    }

    // 4. Compress images for archive storage, then delete originals
    await archiveJobFiles(files);

    for (const file of files) {
      const fullPath = path.join(UPLOAD_PATH, path.basename(file.path));
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (unlinkErr: any) {
          console.error("Error deleting original file:", unlinkErr.message);
        }
      }
    }

    // 5. Clear photo URLs from job data; file records stay in DB as archive
    const filesDeleteAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const cleanedData = {
      ...jobData,
      photos: {},
      preDamages: Object.fromEntries(
        Object.entries(jobData.preDamages || {}).map(([key, val]: [string, any]) => [
          key,
          { ...val, photos: [] }
        ])
      ),
      signatures: { driver: "", customer: "" }
    };

    db.prepare("UPDATE jobs SET status = 'Abgeschlossen (Exportiert)', data = ?, filesDeleteAt = ? WHERE id = ?")
      .run(JSON.stringify(cleanedData), filesDeleteAt, id);

    console.log(`Database cleanup completed for job ${id}. File records removed and photo data cleared.`);
    res.json({ success: true });
  } catch (e: any) {
    console.error("Webhook failed for job:", id, "Error:", e.message);
    let details = e.message;
    if (e.response) {
      console.error("Webhook response error data:", e.response.data);
      details = typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data);
    }
    res.status(500).json({ 
      error: "Webhook Export fehlgeschlagen", 
      details: `Der n8n Webhook konnte nicht erreicht werden oder hat einen Fehler gemeldet: ${details}. Die Fotos wurden lokal gespeichert, aber der Export in das Backoffice ist fehlgeschlagen.` 
    });
  }
});

app.delete("/api/admin/jobs/:id", (req, res) => {
  const { id } = req.params;
  const files = db.prepare("SELECT * FROM files WHERE jobId = ?").all(id) as any[];

  for (const file of files) {
    for (const p of [file.path, file.compressedPath].filter(Boolean)) {
      const fp = path.join(UPLOAD_PATH, path.basename(p));
      if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch {} }
    }
  }

  db.prepare("DELETE FROM files WHERE jobId = ?").run(id);
  db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  res.json({ success: true });
});

app.get("/api/admin/jobs", (req, res) => {
  const jobs = db.prepare("SELECT * FROM jobs ORDER BY updatedAt DESC").all() as any[];
  res.json(jobs.map((j: any) => {
    const archivedFiles = db.prepare(
      "SELECT id, fieldName, compressedPath, originalName FROM files WHERE jobId = ? AND isArchived = 1"
    ).all(j.id);
    return { ...j, data: JSON.parse(j.data), archivedFiles };
  }));
});

app.get("/api/admin/export/:id", async (req, res) => {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id) as any;
  if (!job) return res.status(404).send("Not found");

  const files = db.prepare("SELECT * FROM files WHERE jobId = ?").all(req.params.id) as any[];
  
  res.attachment(`Auto-Misselwitz-${req.params.id}.zip`);
  const archive = archiver("zip");
  archive.pipe(res);
  archive.append(job.data, { name: "data.json" });

  for (const file of files) {
    const filePath = (file.isArchived && file.compressedPath) ? file.compressedPath : file.path;
    const fullPath = path.join(UPLOAD_PATH, path.basename(filePath));
    if (fs.existsSync(fullPath)) {
      archive.file(fullPath, { name: `files/${file.fieldName}-${file.originalName}` });
    }
  }
  await archive.finalize();
});

async function start() {
  // Run cleanup immediately, then every hour
  cleanupExpiredFiles();
  setInterval(cleanupExpiredFiles, 60 * 60 * 1000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`Server on http://localhost:${PORT}`));
}

start();
