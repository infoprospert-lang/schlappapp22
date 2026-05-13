import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export const UPLOAD_PATH = path.resolve(__dirname, 'uploads');

// ─── Company data (mirrors App.tsx) ─────────────────────────────────────────
const CO: Record<string, any> = {
  'auto-misselwitz': {
    name: 'Auto-Misselwitz GmbH',
    street: 'Mühlenstraße 18', zip: '06179', city: 'Teutschenthal OT Holleben',
    phone: '0345 / 61 38 433', email: 'info@auto-misselwitz.de', gf: 'Jens Förster',
    logo: path.resolve(__dirname, 'neuelogos', 'Logo Misselwitz.jpg'),
  },
  'swientek-glaeser': {
    name: 'Swientek & Gläser GmbH',
    street: 'Herrfurthstraße 10', zip: '06217', city: 'Merseburg',
    phone: '03461 - 50 35 32', email: 'foerster@swientek-glaeser.de', gf: 'Jens Förster',
    logo: path.resolve(__dirname, 'neuelogos', 'Logo Swientek.jpg'),
  },
};
const co = (id: string) => CO[id] || CO['auto-misselwitz'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
export type PdfResult = { name: string; buffer: Buffer };

/** Resolve a signature URL to an absolute disk path; null if not found. */
function sigPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const full = path.join(UPLOAD_PATH, path.basename(url));
  return fs.existsSync(full) ? full : null;
}

function fmtDate(iso?: string): string {
  return new Date(iso || Date.now()).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtDateTime(iso?: string): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function preDmgText(preDamages: any): string {
  const items = Object.entries(preDamages || {})
    .filter(([, v]: any) => v.isDefect)
    .map(([k, v]: any) => `${k}${v.note ? ': ' + v.note : ''}`);
  return items.length ? items.join('; ') : 'Keine Vorschäden';
}

/** Collect PDFDocument output into a Buffer. Must be called BEFORE any content. */
function toBuffer(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

/** Embed logo — silently skips if file not found or not a valid image. */
function tryLogo(doc: InstanceType<typeof PDFDocument>, logoPath: string, x: number, y: number, w: number) {
  if (fs.existsSync(logoPath)) {
    try { doc.image(logoPath, x, y, { width: w }); } catch { /* skip */ }
  }
}

/** Embed a signature image; silently skips if missing. */
function trySig(
  doc: InstanceType<typeof PDFDocument>,
  url: string | null | undefined,
  x: number, y: number, h: number,
) {
  const p = sigPath(url);
  if (p) {
    try { doc.image(p, x, y, { height: h }); } catch { /* skip */ }
  }
}

/** Horizontal rule in light grey. */
function hline(doc: InstanceType<typeof PDFDocument>, y: number, m = 50) {
  doc.save()
    .moveTo(m, y).lineTo(doc.page.width - m, y)
    .strokeColor('#bbbbbb').lineWidth(0.5).stroke()
    .restore();
}

/** Orange section header (used in Auftrag PDF). */
function secHeader(doc: InstanceType<typeof PDFDocument>, text: string, m: number) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#FF6321')
    .text(text.toUpperCase(), m)
    .fillColor('#000000');
  doc.moveDown(0.25);
}

/** One label + value line, both on the same row. */
function fl(
  doc: InstanceType<typeof PDFDocument>,
  lbl: string,
  val: string | null | undefined,
  m: number,
) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#555555')
    .text(lbl + ':', m, doc.y, { continued: true });
  doc.font('Helvetica').fontSize(9).fillColor('#000000')
    .text('  ' + (val?.trim() || '–'));
  doc.moveDown(0.1);
}

/** Draw blank underlines (n lines) for unfilled template fields. */
function blankLines(doc: InstanceType<typeof PDFDocument>, n: number, m: number) {
  for (let i = 0; i < n; i++) {
    hline(doc, doc.y + 6, m);
    doc.moveDown(0.9);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. DATENSCHUTZERKLÄRUNG
//    Template: "Einwilligungen und Hinweise für Auftraggeber – DSGVO ab Mai 2018"
// ══════════════════════════════════════════════════════════════════════════════
export async function generateDatenschutzPdf(job: any): Promise<PdfResult> {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'Datenschutzerklärung' } });
  const buf = toBuffer(doc);
  const M   = 50;
  const W   = doc.page.width - M * 2;
  const C   = co(job.company);

  const location = [job.city, job.address].filter(Boolean).join(', ') || '–';
  const date     = fmtDate(job.timestamps?.accepted);

  // ── Header ──────────────────────────────────────────────────────────────
  tryLogo(doc, C.logo, doc.page.width - M - 130, M, 130);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000')
    .text('Einwilligungen mit Informationspflichten im Sinne der', M, M, { width: W - 150 });
  doc.font('Helvetica-Bold').fontSize(11)
    .text('Datenschutz-Grundverordnung ' + C.name, { width: W - 150 });
  doc.moveDown(1.5);

  // ── Box: Einwilligung ────────────────────────────────────────────────────
  const b1y = doc.y - 4;
  doc.font('Helvetica-Bold').fontSize(9).text('Einwilligung', M);
  doc.moveDown(0.25);
  doc.font('Helvetica').fontSize(8.5).fillColor('#222')
    .text(
      `Im Zuge des Auftragsverhältnisses zur Erbringung einer Pannenhilfsleistung, einer Berge- und ` +
      `Abschleppleistung, einer Werkstatt-/Reparaturleistung, eines Fahrzeugankaufes o.ä. verarbeitet ` +
      `die ${C.name} personenbezogene Daten, z.B. Name, Wohnanschrift, Telefonnummer, E-Mail-Adresse, ` +
      `Geburtsdatum, Kennzeichen. Besonders sensitive Daten im Sinne des Art. 9 Abs. 1 ` +
      `Datenschutz-Grundverordnung (DS-GVO) werden nicht verarbeitet.`,
      { width: W, align: 'justify' },
    );
  doc.moveDown(0.3);
  doc.text(
    `Ich willige mit meiner Unterschrift ein, dass die ${C.name} meine personenbezogenen Daten erhebt, ` +
    `speichert und nutzt, soweit es zur Bearbeitung des Auftrages erforderlich ist.`,
    { width: W, align: 'justify' },
  );
  doc.moveDown(0.3);
  doc.text(
    `Ich willige auch in die Weitergabe meiner personenbezogenen Daten an Dritte ein, soweit es zur ` +
    `Durchführung des Auftrages bzw. zur Erbringung der Leistung nötig ist. Hierzu zählen u.a. Haftpflicht-, ` +
    `Vollkaskoversicherer zum Zwecke der Schadenregulierung, Reparaturwerkstätten, zur Wahrung rechtlicher ` +
    `Interessen beauftragte Rechtsanwaltskanzleien, Polizeidienststellen sowie IT-Anwendungen. ` +
    `Die Weitergabe an Dritte erfolgt auch, wenn die ${C.name} aus gesetzlichen Gründen dazu verpflichtet ist. ` +
    `Eine darüber hinaus gehende Weitergabe erfolgt nicht.`,
    { width: W, align: 'justify' },
  );
  doc.moveDown(0.3);
  doc.text(
    'Die Liste der Stellen, an die meine Daten weitergeleitet werden, erhalte ich auf Anfrage.',
    { width: W },
  );
  const b1bottom = doc.y + 4;
  doc.rect(M - 4, b1y, W + 8, b1bottom - b1y).strokeColor('#999').lineWidth(0.5).stroke();
  doc.moveDown(0.7);

  // ── Box: Widerruf ────────────────────────────────────────────────────────
  const b2y = doc.y - 4;
  doc.font('Helvetica').fontSize(8.5).fillColor('#222').text(
    `Diese Einwilligung ist freiwillig. Ich kann die Einwilligung jederzeit widerrufen ` +
    `(z.B. unter der E-Mail-Adresse ${C.email} oder telefonisch unter ${C.phone}, aber auch postalisch). ` +
    `Der Widerruf gilt nicht rückwirkend, d.h. der Widerruf ändert nichts an der Rechtmäßigkeit der ` +
    `Verarbeitung bis zum Widerruf. Die bis dahin erfolgte Verarbeitung Ihrer Daten auf Grundlage der ` +
    `Einwilligung ist rechtmäßig, erst die zukünftige Verarbeitung nach Ihrem Widerruf wäre unzulässig. ` +
    `Im Falle des Widerrufs werden die personenbezogenen Daten, soweit keine gesetzlichen ` +
    `Aufbewahrungsfristen entgegenstehen, gelöscht oder datenschutzkonform vernichtet, wozu ich bereits ` +
    `jetzt auch meine Einwilligung erkläre.`,
    { width: W, align: 'justify' },
  );
  const b2bottom = doc.y + 4;
  doc.rect(M - 4, b2y, W + 8, b2bottom - b2y).strokeColor('#999').lineWidth(0.5).stroke();
  doc.moveDown(0.7);

  // ── Box: Datenschutzrechtliche Hinweise ──────────────────────────────────
  const b3y = doc.y - 4;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000').text('Datenschutzrechtliche Hinweise', M);
  doc.font('Helvetica').fontSize(8).fillColor('#222');
  doc.moveDown(0.25);
  doc.text(`1.  Verantwortlicher: ${C.name}  GF ${C.gf}`, M);
  doc.text(`    Adresse: ${C.street}, ${C.zip} ${C.city}   Telefon: ${C.phone}`, { indent: 10 });
  doc.moveDown(0.15);
  doc.text('2.  Der Verantwortliche hat keinen Datenschutzbeauftragten bestellt.', M);
  doc.moveDown(0.15);
  doc.text(
    '3.  Die Rechtsgrundlage der Datenverarbeitung folgt aus einer erteilten Einwilligung, Art. 6 Abs. 1 lit. a DS-GVO ' +
    'und/oder aus der Erfüllung von vertraglichen Pflichten, Art. 6 Abs. 1 lit. b DS-GVO und/oder aufgrund ' +
    'gesetzlicher Vorgaben, Art. 6 Abs. 1 lit. c DS-GVO.',
    { width: W },
  );
  doc.moveDown(0.15);
  doc.text(
    '4.  Die angegebenen Daten werden gespeichert, solange es zur Erreichung des mit der Datenverarbeitung ' +
    'verfolgten Zwecks erforderlich ist und Sie nicht vorher die Löschung der Daten verlangt haben. ' +
    'Der Löschung der Daten können gesetzliche Aufbewahrungspflichten entgegenstehen.',
    { width: W },
  );
  doc.moveDown(0.15);
  doc.text(
    '5.  Betroffenenrechte: Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der ' +
    'Verarbeitung, sowie deren Widerspruch bei Verarbeitung Art. 6 Abs. 1 lit. f DS-GVO beim Vorliegen ' +
    'von „berechtigten Interessen" und Datenübertragbarkeit.',
    { width: W },
  );
  doc.moveDown(0.15);
  doc.text(
    '6.  Beschwerderechte: Sie haben das Recht auf Beschwerde bei einer Aufsichtsbehörde, wenn Sie der Ansicht sind, ' +
    'dass die Verarbeitung Ihrer Daten gegen die EU-Datenschutz-Grundverordnung oder andere Datenschutzvorschriften verstößt. ' +
    'Zuständig: Der Landesbeauftragte für den Datenschutz Sachsen-Anhalt, Leiterstr. 9, 39104 Magdeburg, ' +
    'Tel.: (0391) 81803-0, www.datenschutz.sachsen-anhalt.de',
    { width: W },
  );
  const b3bottom = doc.y + 4;
  doc.rect(M - 4, b3y, W + 8, b3bottom - b3y).strokeColor('#999').lineWidth(0.5).stroke();
  doc.moveDown(1.0);

  // ── Ort / Datum / Kunden-E-Mail ──────────────────────────────────────────
  doc.font('Helvetica').fontSize(9).fillColor('#000')
    .text(`Ort: ${location}`, M, doc.y, { continued: true });
  doc.text(`   Datum: ${date}`);
  if (job.customerEmail) {
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).text(`E-Mail-Adresse Kunde: ${job.customerEmail}`);
  }
  doc.moveDown(0.8);

  // ── Signature ────────────────────────────────────────────────────────────
  hline(doc, doc.y);
  doc.moveDown(0.4);
  const sigY = doc.y;
  trySig(doc, job.signatures?.privacy, M, sigY, 55);
  doc.font('Helvetica').fontSize(8).fillColor('#555')
    .text('Ich willige ein: Kunde', M, sigY + 60);

  doc.end();
  return { name: 'Datenschutzerklaerung.pdf', buffer: await buf };
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. HAFTUNGSAUSSCHLUSS
//    Template: "Haftungsausschluss Logo Auto Misselwitz" – Seite 1 (Formular)
//    + Seite 2 (Fahrerinstruktionen, statischer Text)
// ══════════════════════════════════════════════════════════════════════════════
export async function generateHaftungsausschlussPdf(job: any): Promise<PdfResult> {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'Haftungsausschluss' } });
  const buf = toBuffer(doc);
  const M   = 50;
  const W   = doc.page.width - M * 2;
  const C   = co(job.company);

  const date      = fmtDate(job.timestamps?.accepted);
  const location  = job.address || '–';
  const preDmg    = preDmgText(job.preDamages);
  const svcLabel  = job.serviceType === 'pannenhilfe' ? 'Pannen-/Unfallhilfe'
                  : job.serviceType === 'transport'   ? 'Abschleppen'
                  : 'Notöffnung / Türöffnung';

  // ── Page 1 — Formular ────────────────────────────────────────────────────
  tryLogo(doc, C.logo, doc.page.width - M - 130, M, 130);
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#000')
    .text('HAFTUNGSAUSSCHLUSS', M, M);
  doc.moveDown(1.5);

  // Feld 1
  doc.font('Helvetica-Bold').fontSize(10).text('1.  Abschleppunternehmen:', M);
  doc.moveDown(0.3);
  fl(doc, '    Unternehmen',   C.name,             M);
  fl(doc, '    Aktenzeichen',  job.orderId || '–', M);
  fl(doc, '    KFZ-Kennzeichen', job.licensePlate || '–', M);
  doc.moveDown(0.8);

  // Feld 2
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
    .text('2.  Leistungsart:  ', M, doc.y, { continued: true });
  doc.font('Helvetica').text(svcLabel);
  doc.moveDown(0.8);

  // Feld 3 – liabilityHelp
  doc.font('Helvetica-Bold').fontSize(10).text('3.  Hilfe kann nur wie folgt geleistet werden:', M);
  doc.moveDown(0.3);
  if (job.liabilityHelp?.trim()) {
    doc.font('Helvetica').fontSize(10).text(job.liabilityHelp, M, doc.y, { width: W });
    doc.moveDown(0.5);
  } else {
    blankLines(doc, 3, M);
  }
  doc.moveDown(0.4);

  // Feld 4 – Kunde + Adresse + Risiken
  const custName = job.ownerName || '–';
  const _billingLine1 = [job.customerStreet, job.customerHouseNum].filter(Boolean).join(' ');
  const _billingLine2 = [job.customerZip, job.customerCity].filter(Boolean).join(' ');
  const _billingFull  = [_billingLine1, _billingLine2].filter(Boolean).join(', ');
  const _sceneFull    = [job.address, job.zip, job.city].filter(Boolean).join(' ');
  const custAddr = _billingFull || _sceneFull || '–';
  doc.font('Helvetica-Bold').fontSize(10).text('4.  Frau/Herr ', M, doc.y, { continued: true });
  doc.font('Helvetica').text(custName);
  doc.font('Helvetica-Bold').fontSize(10).text('    Adresse ', M, doc.y, { continued: true });
  doc.font('Helvetica').text(custAddr);
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(10).text('    akzeptiert den Haftungsausschluss für folgende Risiken:', M);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).text(
    'Mechanische Beschädigungen an Dichtungen, Lack, Rahmen, Beschlägen, Schließzylinder, Schlossanlage oder ' +
    'angrenzenden Bauteilen, die bei einer Tür- oder Fensteröffnung trotz fachgerechter Durchführung entstehen können. ' +
    'Die gesetzliche Haftung bei Vorsatz, grober Fahrlässigkeit sowie bei Schäden aus der Verletzung von Leben, ' +
    'Körper oder Gesundheit bleibt unberührt.',
    M, doc.y, { width: W },
  );
  doc.moveDown(0.4);

  // Feld 5 – Vorschäden
  doc.font('Helvetica-Bold').fontSize(10).text('5.  Bereits vorhandene Vorschäden:', M);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).text(preDmg, M, doc.y, { width: W });
  doc.moveDown(0.3);
  blankLines(doc, 2, M);
  doc.moveDown(0.4);

  // Feld 6 – Einsatzort + Datum
  doc.font('Helvetica-Bold').fontSize(10)
    .text('6.  Einsatzort: ', M, doc.y, { continued: true });
  doc.font('Helvetica').text(location + '        ', { continued: true });
  doc.font('Helvetica-Bold').text('Datum: ', { continued: true });
  doc.font('Helvetica').text(date);
  doc.moveDown(1.5);

  // Signature row
  hline(doc, doc.y);
  doc.moveDown(0.5);
  const sigY  = doc.y;
  const halfW = (W - 20) / 2;

  trySig(doc, job.signatures?.liability,       M,            sigY, 55);
  trySig(doc, job.signatures?.liabilityDriver, M + halfW + 20, sigY, 55);

  doc.font('Helvetica').fontSize(8).fillColor('#444')
    .text('Datum/Unterschrift Versicherungsnehmer/Kunde', M, sigY + 60, { width: halfW });
  doc.text('Unterschrift Fahrer Abschleppunternehmen', M + halfW + 20, sigY + 60, { width: halfW });

  // Footer page 1
  doc.font('Helvetica').fontSize(7).fillColor('#888')
    .text('gültig ab: 31.08.2020   Änderungsstand: (08/2020)   Seite 1 von 2',
      M, doc.page.height - 40);

  // ── Page 2 — Fahrerinstruktionen (statischer Text aus Vorlage) ───────────
  doc.addPage();
  tryLogo(doc, C.logo, doc.page.width - M - 130, M, 130);
  doc.font('Helvetica').fontSize(10).fillColor('#000')
    .text('Sehr geehrte Fahrer,', M, M + 20);
  doc.moveDown(0.7);
  doc.text(
    'Sie helfen in vielen Fällen Versicherungsnehmern/Kunden nach technischen Pannen oder nach Unfällen ' +
    'mit Pannen- oder Unfallhilfen, Abschlepp- oder Bergungsleistungen.',
    { width: W },
  );
  doc.moveDown(0.6);
  doc.text(
    'Es kann vorkommen, dass Sie helfen möchten, aber auf Grund besonders schwieriger Umstände bereits ' +
    'vor Beginn Ihrer Arbeit erkennen, dass dies, auch bei Beachtung aller erdenklichen Sorgfalt, nicht ' +
    'möglich sein wird, ohne dass zusätzliche Schäden am Fahrzeug oder anderen Gütern des ' +
    'Versicherungsnehmers/Kunden entstehen.',
    { width: W },
  );
  doc.moveDown(0.6);
  doc.text(
    'Dieses Formular soll Ihnen helfen, unvermeidbare Schäden von der Haftung auszuschließen.',
    { width: W },
  );
  doc.font('Helvetica-Bold')
    .text('Ein Haftungsausschluss kann nur vor Beginn Ihrer Arbeit vereinbart werden.', { width: W });
  doc.font('Helvetica').moveDown(0.6);
  doc.text('Bitte beachten Sie folgende notwendige Angaben in den entsprechenden Feldern:', { width: W });
  doc.moveDown(0.4);

  const instructions = [
    'Tragen Sie Ihre Firmenbezeichnung das Aktenzeichen (soweit bekannt) sowie das KFZ-Kennzeichen ein.',
    'Kreuzen Sie die entsprechende Leistungsart an.',
    'Tragen Sie hier ein, wie im konkreten Fall Hilfe geleistet wird.\nBeispiel: Fahrzeug muss mit Gurten geborgen werden.',
    'Vermerken Sie hier den Namen und die Anschrift des Versicherungsnehmers/Kunden. Die Risiken sind bereits vorausgefüllt.',
    'Hier können Sie evtl. schon vorhandene Vorschäden festhalten.',
    'Das Haftungsausschluss-Formular muss vor Beginn Ihrer Arbeit vom Versicherungsnehmer/Kunden und von Ihnen unterschrieben werden. ' +
    'Bitte denken Sie daran, auch Datum und Einsatzort anzugeben.',
  ];
  instructions.forEach((s, i) => {
    doc.font('Helvetica').fontSize(10).text(`${i + 1}.  ${s}`, M, doc.y, { width: W });
    doc.moveDown(0.5);
  });
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(10)
    .text('Ein erst nach dem Einsatz unterschriebener Haftungsausschluss ist unwirksam.', { width: W });
  doc.font('Helvetica').moveDown(0.5);
  doc.text(
    'Ebenso unwirksam ist ein vorformulierter oder formularmäßiger Haftungsausschluss. Beschreiben Sie ' +
    'deswegen bitte genau die gegebene Einsatzsituation und die in diesem Einzelfall befürchteten Folgeschäden.',
    { width: W },
  );
  doc.font('Helvetica').fontSize(7).fillColor('#888')
    .text('Seite 2 von 2', M, doc.page.height - 40);

  doc.end();
  return { name: 'Haftungsausschluss.pdf', buffer: await buf };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. AUFTRAGSBESTÄTIGUNG
//    Vollständig aus App-Daten generiert – keine externe Vorlage
// ══════════════════════════════════════════════════════════════════════════════
export async function generateAuftragPdf(job: any): Promise<PdfResult> {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'Auftragsbestätigung' } });
  const buf = toBuffer(doc);
  const M   = 50;
  const W   = doc.page.width - M * 2;
  const C   = co(job.company);

  const svcLabel = job.serviceType === 'transport'   ? 'Transport'
                 : job.serviceType === 'pannenhilfe' ? 'Pannenhilfe'
                 : 'Notöffnung';
  const preDmg   = preDmgText(job.preDamages);

  // ── Header ──────────────────────────────────────────────────────────────
  tryLogo(doc, C.logo, doc.page.width - M - 130, M, 130);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#000')
    .text('AUFTRAGSBESTÄTIGUNG', M, M);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(8).fillColor('#666')
    .text(`${C.name}  ·  ${C.street}, ${C.zip} ${C.city}  ·  Tel: ${C.phone}`, { width: W - 150 });
  doc.fillColor('#000');
  doc.moveDown(0.9);
  hline(doc, doc.y);
  doc.moveDown(0.7);

  // ── Auftragsinformationen ────────────────────────────────────────────────
  secHeader(doc, 'Auftragsinformationen', M);
  fl(doc, 'Auftragsnummer',  job.orderId                      || '–', M);
  fl(doc, 'Erstellungsdatum', fmtDate(),                               M);
  fl(doc, 'Datum / Uhrzeit', fmtDateTime(job.timestamps?.accepted), M);
  fl(doc, 'Dienstleistung',  svcLabel,                                M);
  fl(doc, 'Fahrer',          job.driverName                   || '–', M);
  fl(doc, 'Einsatzfahrzeug', job.driverVehicle                || '–', M);
  doc.moveDown(0.5);

  // ── Kundendaten ──────────────────────────────────────────────────────────
  secHeader(doc, 'Kundendaten', M);
  fl(doc, 'Halter / Eigentümer', job.ownerName         || '–', M);
  fl(doc, 'Auftraggeber',        job.customerDriverName || job.ownerName || '–', M);
  fl(doc, 'Telefon',             job.phone             || '–', M);
  fl(doc, 'E-Mail',              job.customerEmail     || '–', M);
  const custBillingAddr = [job.customerStreet, job.customerHouseNum].filter(Boolean).join(' ');
  const custBillingCity = [job.customerZip, job.customerCity].filter(Boolean).join(' ');
  if (custBillingAddr) fl(doc, 'Rechnungsadresse', custBillingAddr, M);
  if (custBillingCity) fl(doc, 'PLZ / Ort', custBillingCity, M);
  doc.moveDown(0.5);

  // ── Fahrzeugdaten ────────────────────────────────────────────────────────
  secHeader(doc, 'Fahrzeugdaten', M);
  fl(doc, 'Kennzeichen',   job.licensePlate  || '–', M);
  fl(doc, 'Fahrzeugmodell', job.vehicleModel || '–', M);
  doc.moveDown(0.5);

  // ── Einsatzort ───────────────────────────────────────────────────────────
  secHeader(doc, 'Einsatzort', M);
  fl(doc, 'Adresse', [job.address, job.zip, job.city].filter(Boolean).join(' ') || '–', M);
  if (job.isSevereAccident) fl(doc, 'Schwerer Unfall', 'Ja', M);
  doc.moveDown(0.5);

  // ── Zielort (optional) ───────────────────────────────────────────────────
  if (job.destinationType) {
    secHeader(doc, 'Zielort', M);
    fl(doc, 'Art',     job.destinationType, M);
    if (job.destName)  fl(doc, 'Name', job.destName, M);
    const destAddr = [job.destStreet, job.destHouseNum, job.destZip, job.destCity]
      .filter(Boolean).join(' ');
    if (destAddr) fl(doc, 'Adresse', destAddr, M);
    doc.moveDown(0.5);
  }

  // ── Zeitstempel ──────────────────────────────────────────────────────────
  const ts = [
    ['Auftrag angenommen',       job.timestamps?.accepted],
    ['Auf dem Weg',              job.timestamps?.enRoute],
    ['Ankunft am Schadenort',    job.timestamps?.arrived],
    ['Dokumentation gestartet',  job.timestamps?.documenting],
    ['Auf dem Weg zum Zielort',  job.timestamps?.transport],
    ['Zielort erreicht',         job.timestamps?.atDest],
  ].filter(([, v]) => !!v);

  if (ts.length) {
    secHeader(doc, 'Zeitstempel', M);
    ts.forEach(([l, v]) => fl(doc, String(l), fmtDateTime(String(v)), M));
    doc.moveDown(0.5);
  }

  // ── Status & Notiz ───────────────────────────────────────────────────────
  secHeader(doc, 'Kunden-Status', M);
  fl(doc, 'Status', job.kundeDa || '–', M);
  doc.moveDown(0.5);

  // ── Vorschäden ───────────────────────────────────────────────────────────
  if (preDmg !== 'Keine Vorschäden') {
    secHeader(doc, 'Vorschäden', M);
    doc.font('Helvetica').fontSize(9).fillColor('#000').text(preDmg, M, doc.y, { width: W });
    doc.moveDown(0.8);
  }

  // ── Unterschrift ─────────────────────────────────────────────────────────
  // Ensure enough vertical space for the signature block (min 150pt)
  if (doc.y > doc.page.height - doc.page.margins.bottom - 160) {
    doc.addPage();
  }

  hline(doc, doc.y);
  doc.moveDown(0.6);
  doc.font('Helvetica').fontSize(9).fillColor('#333').text(
    'Hiermit bestätige ich, dass die oben genannte Dienstleistung ordnungsgemäß durchgeführt wurde ' +
    'und das Fahrzeug im dokumentierten Zustand übernommen/abgeholt wurde.',
    M, doc.y, { width: W, align: 'justify' },
  );
  doc.moveDown(1.0);

  const sigY  = doc.y;
  const halfW = (W - 20) / 2;

  if (job.waivedSignature) {
    // Show waiver reason instead of signature
    const reason = job.customerCrashed
      ? 'Kunde verunfallt / nicht ansprechbar'
      : job.refusedSignature
        ? 'Unterschrift verweigert (KVU)'
        : 'Kunde nicht vor Ort – Unterschrift entfällt';
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#cc0000').text(reason, M, sigY, { width: halfW });
  } else {
    trySig(doc, job.signatures?.order, M, sigY, 55);
  }
  hline(doc, sigY + 65, M);
  doc.font('Helvetica').fontSize(8).fillColor('#555')
    .text('Datum/Unterschrift Kunde', M, sigY + 70, { width: halfW });

  doc.end();
  return { name: 'Auftragsbestaetigung.pdf', buffer: await buf };
}

// ══════════════════════════════════════════════════════════════════════════════
// generateAllPdfs — Entry point used by server.ts
// Returns only PDFs that are applicable and have required data.
// ══════════════════════════════════════════════════════════════════════════════
export async function generateAllPdfs(job: any): Promise<PdfResult[]> {
  const results: PdfResult[] = [];

  // ── Datenschutzerklärung: nur wenn Kundenunterschrift vorhanden ───────────
  if (job.signatures?.privacy) {
    try {
      results.push(await generateDatenschutzPdf(job));
      console.log(`[PDF] ✓ Datenschutzerklaerung.pdf erzeugt (job ${job.id})`);
    } catch (e: any) {
      console.error(`[PDF] ✗ Datenschutzerklaerung.pdf FEHLER: ${e.message}`);
    }
  } else {
    console.log(`[PDF] – Datenschutzerklaerung.pdf übersprungen – keine Kundenunterschrift (job ${job.id})`);
  }

  // ── Haftungsausschluss: nur Notöffnung, nur wenn beide Unterschriften vorhanden
  if (job.serviceType === 'notoeffnung') {
    if (job.signatures?.liability && job.signatures?.liabilityDriver) {
      try {
        results.push(await generateHaftungsausschlussPdf(job));
        console.log(`[PDF] ✓ Haftungsausschluss.pdf erzeugt (job ${job.id})`);
      } catch (e: any) {
        console.error(`[PDF] ✗ Haftungsausschluss.pdf FEHLER: ${e.message}`);
      }
    } else {
      console.log(
        `[PDF] – Haftungsausschluss.pdf übersprungen – keine/unvollständige Unterschriften (job ${job.id})`
      );
    }
  }

  // ── Auftragsbestätigung: wenn Unterschrift vorhanden ODER KVU/nicht vor Ort
  if (job.signatures?.order || job.waivedSignature) {
    try {
      results.push(await generateAuftragPdf(job));
      console.log(`[PDF] ✓ Auftragsbestaetigung.pdf erzeugt (job ${job.id})`);
    } catch (e: any) {
      console.error(`[PDF] ✗ Auftragsbestaetigung.pdf FEHLER: ${e.message}`);
    }
  } else {
    console.log(
      `[PDF] – Auftragsbestaetigung.pdf übersprungen – keine Auftragsunterschrift (job ${job.id})`
    );
  }

  console.log(
    `[PDF] Gesamt: ${results.length} PDF(s) erzeugt: [${results.map(r => r.name).join(', ') || 'keine'}]`
  );
  return results;
}
