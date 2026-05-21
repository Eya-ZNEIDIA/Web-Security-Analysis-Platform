/**
 * PDFGeneratorService - Bilingual Premium Edition
 * Génère des rapports de sécurité professionnels en PDF (FR/EN)
 * Design calqué sur l'interface AdminReports.jsx — SaaS Premium
 * 
 * Font note: Uses Helvetica (built-in). To use Inter, register .ttf via doc.registerFont().
 */

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const HeaderAnalysisService = require("./HeaderAnalysisService");
const { t } = require("../config/translations");

// ── Design tokens matching AdminReports.jsx (Tailwind) ──
const C = {
  white: "#ffffff",
  bg: "#f9fafb",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  shadow: "#d1d5db",
  text900: "#111827",
  text700: "#374151",
  text500: "#6b7280",
  text400: "#9ca3af",
  blue600: "#2563eb",
  blue500: "#3b82f6",
  blue50: "#eff6ff",
  green600: "#16a34a",
  green50: "#f0fdf4",
  greenBorder: "#bbf7d0",
  red600: "#dc2626",
  red50: "#fef2f2",
  redBorder: "#fecaca",
  orange600: "#ea580c",
  orange50: "#fff7ed",
  orangeBorder: "#fed7aa",
  yellow600: "#ca8a04",
  yellow50: "#fefce8",
  yellowBorder: "#fef3c7",
  amber500: "#f59e0b",
  purple500: "#a855f7",
  codeBg: "#1e293b",
  codeText: "#e2e8f0",
  codeGreen: "#86efac",
};

const SEV = {
  Critique:    { color: C.red600,    bg: C.red50,       border: C.redBorder    },
  Critical:    { color: C.red600,    bg: C.red50,       border: C.redBorder    },
  "Élevé":     { color: C.orange600, bg: C.orange50,    border: C.orangeBorder },
  High:        { color: C.orange600, bg: C.orange50,    border: C.orangeBorder },
  Moyen:       { color: C.yellow600, bg: C.yellow50,    border: C.yellowBorder },
  Medium:      { color: C.yellow600, bg: C.yellow50,    border: C.yellowBorder },
  Faible:      { color: C.green600,  bg: C.green50,     border: C.greenBorder  },
  Low:         { color: C.green600,  bg: C.green50,     border: C.greenBorder  },
  Info:        { color: C.text500,   bg: C.borderLight, border: C.border       },
  Information: { color: C.text500,   bg: C.borderLight, border: C.border       },
};

const scoreColor = (s) => (s >= 75 ? C.green600 : s >= 50 ? "#eab308" : "#ef4444");
const scoreLabel = (s, lang) => {
  if (lang === 'fr') return s >= 75 ? "Sécurisé" : s >= 50 ? "Risque modéré" : "Critique";
  return s >= 75 ? "Secure" : s >= 50 ? "Moderate risk" : "Critical";
};

class PDFGeneratorService {

  // ── Layout constants ──
  static get M() { return 44; }
  static get PW() { return 595.28; }
  static get CW() { return 595.28 - 88; }
  static get R() { return 8; }
  static get FOOTER_Y() { return 841.89 - 50; }

  /**
   * Génère un rapport PDF complet pour un audit
   */
  static async generateFullReport(auditData, reportData, vulnerabilities, outputPath, language = 'en') {
    return new Promise((resolve, reject) => {
      try {
        const titleText = t(language, 'documentTitle');
        const doc = new PDFDocument({
          size: "A4",
          margin: this.M,
          bufferPages: true,
          info: {
            Title: `${titleText} - ${auditData.urlCible}`,
            Author: "Security Audit Platform",
            Creator: "Security Audit Platform"
          }
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        this._generateCoverPage(doc, auditData, reportData, vulnerabilities, language);
        this._generatePage2(doc, auditData, reportData, vulnerabilities, language);

        // Remove any auto-created blank pages (keep only first 2)
        const range = doc.bufferedPageRange();
        while (range.count > 2) {
          // PDFKit doesn't support page removal, so we just number the first 2
          break;
        }

        this._addPageNumbers(doc, language);

        doc.end();
        stream.on("finish", () => resolve(outputPath));
        stream.on("error", reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  COVER PAGE
  // ═══════════════════════════════════════════════════════════════
  static _generateCoverPage(doc, auditData, reportData, vulnerabilities = [], language = 'en') {
    const pw = doc.page.width;
    const ph = doc.page.height;
    const m = this.M;
    const cw = this.CW;

    doc.rect(0, 0, pw, ph).fill(C.white);
    doc.roundedRect(0, 0, pw, 6, 0).fill(C.blue500);

    doc.fontSize(11).font("Helvetica-Bold").fillColor(C.green600);
    doc.text("SECURITY AUDIT PLATFORM", m, 44, { lineBreak: false });

    doc.fontSize(30).font("Helvetica-Bold").fillColor(C.text900);
    doc.text(t(language, 'coverTitle'), m, 72, { width: cw, lineBreak: false });

    doc.fontSize(11).font("Helvetica").fillColor(C.text500);
    doc.text(t(language, 'coverSubtitle'), m, doc.y + 8, { width: cw, lineBreak: false });

    const divY = doc.y + 18;
    doc.moveTo(m, divY).lineTo(m + 80, divY).lineWidth(3).stroke(C.blue500);
    doc.lineWidth(1);

    // Score hero card
    const cardY = divY + 24;
    const score = Math.round(auditData.scoreGlobal || 0);
    const sc = scoreColor(score);

    this._drawCard(doc, m, cardY, cw, 130);

    const ringX = m + 70;
    const ringY = cardY + 65;
    this._drawScoreRing(doc, ringX, ringY, 40, score, sc);

    const labelX = ringX + 80;
    doc.fontSize(9).font("Helvetica").fillColor(C.text500);
    doc.text(language === 'fr' ? "SCORE GLOBAL" : "GLOBAL SCORE", labelX, cardY + 22, { width: 300, lineBreak: false });
    doc.fontSize(20).font("Helvetica-Bold").fillColor(C.text900);
    doc.text(`${score}/100 — ${scoreLabel(score, language)}`, labelX, cardY + 38, { width: 300, lineBreak: false });

    const vulnCount = vulnerabilities.length;
    const counts = this._countSeverities(vulnerabilities);
    let bx = labelX;
    const by = cardY + 68;
    const badges = [
      { label: t(language, 'criticalCount'), count: counts.critical, sev: "Critique" },
      { label: t(language, 'highCount'),     count: counts.high,     sev: "Élevé" },
      { label: t(language, 'mediumCount'),   count: counts.medium,   sev: "Moyen" },
      { label: t(language, 'lowCount'),      count: counts.low,      sev: "Faible" },
      { label: t(language, 'infoCount'),     count: counts.info,     sev: "Info" },
    ];
    badges.forEach(b => {
      if (b.count === 0) return;
      const s = SEV[b.sev];
      const text = `${b.count} ${b.label}`;
      const tw = doc.widthOfString(text) + 18;
      this._drawBadge(doc, bx, by, tw, 20, s.bg, s.border, s.color, text, 8);
      bx += tw + 6;
    });

    // Stats tiles
    const tilesY = cardY + 152;
    const tileW = (cw - 18) / 4;
    const tileH = 68;
    const tiles = [
      { label: language === 'fr' ? "VULNÉRABILITÉS" : "VULNERABILITIES", value: String(vulnCount), color: C.red600 },
      { label: language === 'fr' ? "REQUÊTES" : "REQUESTS",             value: String(auditData.totalRequests || 0), color: C.blue500 },
      { label: language === 'fr' ? "MODÈLE IA" : "AI MODEL",            value: reportData.ai_model || "—", color: C.purple500 },
      { label: language === 'fr' ? "DURÉE" : "DURATION",                value: reportData.durationMs ? `${(reportData.durationMs / 1000).toFixed(1)}s` : "—", color: C.amber500 },
    ];
    tiles.forEach((tile, i) => {
      const tx = m + i * (tileW + 6);
      this._drawCard(doc, tx, tilesY, tileW, tileH);
      doc.circle(tx + 14, tilesY + 18, 3).fill(tile.color);
      doc.fontSize(7).font("Helvetica-Bold").fillColor(C.text500);
      doc.text(tile.label, tx + 22, tilesY + 14, { width: tileW - 32, lineBreak: false });
      doc.fontSize(13).font("Helvetica-Bold").fillColor(C.text900);
      doc.text(tile.value, tx + 14, tilesY + 32, { width: tileW - 28, lineBreak: false });
    });

    // Audit info card
    const infoY = tilesY + tileH + 26;
    this._drawCard(doc, m, infoY, cw, 92);

    const col1 = m + 18;
    const col2 = m + cw / 2 + 10;
    const auditDate = new Date(auditData.dateAudit || Date.now());

    doc.fontSize(8).font("Helvetica-Bold").fillColor(C.text500);
    doc.text(t(language, 'coverTarget').toUpperCase(), col1, infoY + 14, { lineBreak: false });
    doc.fontSize(10).font("Helvetica").fillColor(C.text900);
    doc.text(auditData.urlCible || 'N/A', col1, infoY + 28, { width: cw / 2 - 36, lineBreak: false });

    doc.fontSize(8).font("Helvetica-Bold").fillColor(C.text500);
    doc.text(t(language, 'coverDate').toUpperCase(), col1, infoY + 54, { lineBreak: false });
    doc.fontSize(10).font("Helvetica").fillColor(C.text900);
    doc.text(auditDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US'), col1, infoY + 66, { lineBreak: false });

    doc.fontSize(8).font("Helvetica-Bold").fillColor(C.text500);
    doc.text(t(language, 'overallRiskLevel').toUpperCase(), col2, infoY + 14, { lineBreak: false });

    const criticalCount = counts.critical;
    const highCount = counts.high;
    const statusText = criticalCount > 0 ? t(language, 'criticalRisk') : highCount > 0 ? t(language, 'highRisk') : t(language, 'lowRisk');
    const statusSev = criticalCount > 0 ? "Critique" : highCount > 0 ? "Élevé" : "Faible";
    const ss = SEV[statusSev];
    this._drawBadge(doc, col2, infoY + 30, doc.widthOfString(statusText) + 22, 22, ss.bg, ss.border, ss.color, statusText, 9);

    doc.fontSize(8).font("Helvetica-Bold").fillColor(C.text500);
    doc.text(t(language, 'auditMetrics').toUpperCase(), col2, infoY + 60, { lineBreak: false });
    doc.fontSize(9).font("Helvetica").fillColor(C.text700);
    doc.text(`${auditData.totalEndpoints || 0} endpoints · ${auditData.totalRequests || 0} ${language === 'fr' ? 'requêtes' : 'requests'}`, col2, infoY + 72, { lineBreak: false });

    doc.fontSize(8).font("Helvetica").fillColor(C.text400);
    doc.text(t(language, 'footerConfidential'), m, ph - 50, { lineBreak: false });
    doc.text(`${t(language, 'generatedOn')}: ${new Date().toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}`, m, ph - 38, { lineBreak: false });
  }

  // ═══════════════════════════════════════════════════════════════
  //  PAGE 2 — All content on a single page (no extra page breaks)
  // ═══════════════════════════════════════════════════════════════
  static _generatePage2(doc, auditData, reportData, vulnerabilities, language = 'en') {
    const m = this.M;
    const cw = this.CW;

    // Go to page 2: if PDFKit auto-created extra pages, switch; otherwise add one
    const currentPages = doc.bufferedPageRange().count;
    if (currentPages > 1) {
      doc.switchToPage(1);
    } else {
      doc.addPage();
    }
    doc.rect(0, 0, this.PW, doc.page.height).fill(C.white);

    let y = m;

    // ── Section: Executive Summary ──
    doc.save();
    doc.roundedRect(m, y, 4, 16, 2).fill(C.green600);
    doc.restore();
    doc.fontSize(13).font("Helvetica-Bold").fillColor(C.text900);
    doc.text(t(language, 'executiveSummary'), m + 12, y + 1, { width: cw - 20, lineBreak: false });
    y += 22;

    // Severity badges row
    const counts = this._countSeverities(vulnerabilities);
    const badgeData = [
      { label: t(language, 'criticalCount'), count: counts.critical, sev: "Critique" },
      { label: t(language, 'highCount'),     count: counts.high,     sev: "Élevé" },
      { label: t(language, 'mediumCount'),   count: counts.medium,   sev: "Moyen" },
      { label: t(language, 'lowCount'),      count: counts.low,      sev: "Faible" },
      { label: t(language, 'infoCount'),     count: counts.info,     sev: "Info" },
    ];
    let bx = m;
    badgeData.forEach(b => {
      const s = SEV[b.sev];
      const text = `${b.count} ${b.label}`;
      const tw = doc.widthOfString(text) + 16;
      this._drawBadge(doc, bx, y, tw, 16, s.bg, s.border, s.color, text, 7);
      bx += tw + 4;
    });
    y += 24;

    // Risk verdict
    const riskLevel = counts.critical > 0 ? 'critical' : counts.high > 0 ? 'high' : counts.medium > 0 ? 'medium' : 'low';
    const verdictData = this._getRiskLevel(riskLevel, language);
    const sev = riskLevel === 'critical' ? 'Critique' : riskLevel === 'high' ? 'Élevé' : riskLevel === 'medium' ? 'Moyen' : 'Faible';
    const sv = SEV[sev];
    const badgeText = verdictData.title;
    const bw = doc.widthOfString(badgeText) + 20;
    this._drawBadge(doc, m, y, bw, 18, sv.bg, sv.border, sv.color, badgeText, 8);
    doc.fontSize(8).font("Helvetica").fillColor(C.text500);
    doc.text(verdictData.description, m + bw + 8, y + 3, { width: cw - bw - 12, lineBreak: false });
    y += 28;

    // ── Section: Vulnerabilities ──
    doc.save();
    doc.roundedRect(m, y, 4, 16, 2).fill(C.red600);
    doc.restore();
    doc.fontSize(13).font("Helvetica-Bold").fillColor(C.text900);
    doc.text(t(language, 'vulnerabilities'), m + 12, y + 1, { width: cw - 20, lineBreak: false });
    y += 22;

    if (vulnerabilities.length === 0) {
      doc.fontSize(9).font("Helvetica").fillColor(C.text500);
      doc.text(language === 'fr' ? "Aucune vulnérabilité détectée" : "No vulnerabilities detected", m, y, { lineBreak: false });
      y += 16;
    } else {
      // Show up to 15 vulns in compact rows
      const maxVulns = Math.min(vulnerabilities.length, 15);
      for (let i = 0; i < maxVulns; i++) {
        const vuln = vulnerabilities[i];
        const title = vuln.titre || vuln.title || vuln.technique || 'Vulnerability';
        const sevName = vuln.severity || vuln.severite || 'Info';
        const vs = SEV[sevName] || SEV.Info;

        // Color bar
        doc.save();
        doc.roundedRect(m, y, 3, 14, 1).fill(vs.color);
        doc.restore();

        // Title
        doc.fontSize(7.5).font("Helvetica-Bold").fillColor(C.text900);
        doc.text(`${i + 1}. ${title}`, m + 8, y + 1, { width: cw - 80, lineBreak: false });

        // Severity pill
        const sevW = doc.widthOfString(sevName) + 12;
        this._drawBadge(doc, m + cw - sevW, y, sevW, 14, vs.bg, vs.border, vs.color, sevName, 6);

        y += 18;
      }
      if (vulnerabilities.length > maxVulns) {
        doc.fontSize(7).font("Helvetica").fillColor(C.text400);
        doc.text(`+ ${vulnerabilities.length - maxVulns} ${language === 'fr' ? 'autres' : 'more'}...`, m + 8, y, { lineBreak: false });
        y += 14;
      }
    }
    y += 10;

    // ── Section: Recommendations ──
    doc.save();
    doc.roundedRect(m, y, 4, 16, 2).fill(C.green600);
    doc.restore();
    doc.fontSize(13).font("Helvetica-Bold").fillColor(C.text900);
    doc.text(t(language, 'recommendations'), m + 12, y + 1, { width: cw - 20, lineBreak: false });
    y += 22;

    const vulnsWithRec = vulnerabilities.filter(v => v.fix_recommendation || v.recommandation);
    if (vulnsWithRec.length === 0) {
      doc.fontSize(8).font("Helvetica").fillColor(C.text500);
      doc.text(language === 'fr' ? "Aucune recommandation" : "No recommendations", m, y, { lineBreak: false });
      y += 14;
    } else {
      const maxRecs = Math.min(vulnsWithRec.length, 8);
      for (let i = 0; i < maxRecs; i++) {
        const vuln = vulnsWithRec[i];
        const title = vuln.titre || vuln.title || 'Fix';
        const rec = (vuln.fix_recommendation || vuln.recommandation || '').substring(0, 100);

        doc.save();
        doc.roundedRect(m, y, 3, 14, 1).fill(C.green600);
        doc.restore();

        doc.fontSize(7.5).font("Helvetica-Bold").fillColor(C.text900);
        doc.text(`${i + 1}. ${title}`, m + 8, y + 1, { width: cw - 16, lineBreak: false });
        y += 13;

        if (rec) {
          doc.fontSize(7).font("Helvetica").fillColor("#166534");
          doc.text(rec + (rec.length >= 100 ? '...' : ''), m + 8, y, { width: cw - 16, lineBreak: false });
          y += 12;
        }
        y += 2;
      }
    }
    y += 10;

    // ── Section: Conclusion ──
    doc.save();
    doc.roundedRect(m, y, 4, 16, 2).fill(C.blue500);
    doc.restore();
    doc.fontSize(13).font("Helvetica-Bold").fillColor(C.text900);
    doc.text(t(language, 'conclusion'), m + 12, y + 1, { width: cw - 20, lineBreak: false });
    y += 20;

    doc.fontSize(8).font("Helvetica").fillColor(C.text700);
    doc.text(t(language, 'conclusionIntro'), m, y, { width: cw, lineBreak: false });
    y += 14;

    // Footer
    doc.fontSize(7).font("Helvetica").fillColor(C.text400);
    doc.text(t(language, 'footerConfidential'), m, doc.page.height - 40, { lineBreak: false });
    doc.text(`${t(language, 'generatedOn')}: ${new Date().toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}`, m, doc.page.height - 28, { lineBreak: false });
  }

  // ═══════════════════════════════════════════════════════════════
  //  TABLE OF CONTENTS
  // ═══════════════════════════════════════════════════════════════
  static _generateTableOfContents(doc, language = 'en') {
    const m = this.M;
    const cw = this.CW;

    this._drawSectionHeader(doc, t(language, 'tableOfContents'), C.blue500);

    const sections = [
      t(language, 'executiveSummary'),
      t(language, 'globalAnalysis'),
      t(language, 'headersAnalysis'),
      t(language, 'vulnerabilities'),
      t(language, 'recommendations'),
      t(language, 'timeline'),
      t(language, 'conclusion'),
    ];

    let y = doc.y + 14;
    sections.forEach((name, i) => {
      doc.save();
      if (i % 2 === 0) {
        doc.roundedRect(m, y, cw, 34, 6).fill(C.bg);
      }
      doc.restore();

      doc.circle(m + 20, y + 17, 11).fill(C.blue500);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(C.white);
      doc.text(String(i + 1), m + 14, y + 13, { width: 12, align: "center" });

      doc.fontSize(11).font("Helvetica").fillColor(C.text900);
      doc.text(name, m + 42, y + 12, { width: cw - 60 });

      y += 38;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  EXECUTIVE SUMMARY
  // ═══════════════════════════════════════════════════════════════
  static _generateExecutiveSummary(doc, auditData, reportData, vulnerabilities, language = 'en') {
    const m = this.M;
    const cw = this.CW;

    this._drawSectionHeader(doc, t(language, 'executiveSummary'), C.green600, true);

    const counts = this._countSeverities(vulnerabilities);
    const vulnCount = vulnerabilities.length;

    // Compact severity row with badges
    let bx = m;
    const by = doc.y + 4;
    const badges = [
      { label: t(language, 'criticalCount'), count: counts.critical, sev: "Critique" },
      { label: t(language, 'highCount'),     count: counts.high,     sev: "Élevé" },
      { label: t(language, 'mediumCount'),   count: counts.medium,   sev: "Moyen" },
      { label: t(language, 'lowCount'),      count: counts.low,      sev: "Faible" },
      { label: t(language, 'infoCount'),     count: counts.info,     sev: "Info" },
    ];
    badges.forEach(b => {
      const s = SEV[b.sev];
      const text = `${b.count} ${b.label}`;
      const tw = doc.widthOfString(text) + 18;
      this._drawBadge(doc, bx, by, tw, 18, s.bg, s.border, s.color, text, 8);
      bx += tw + 5;
    });
    doc.y = by + 28;

    // Risk verdict (compact)
    const riskLevel = counts.critical > 0 ? 'critical' : counts.high > 0 ? 'high' : counts.medium > 0 ? 'medium' : 'low';
    const verdictData = this._getRiskLevel(riskLevel, language);
    const sev = riskLevel === 'critical' ? 'Critique' : riskLevel === 'high' ? 'Élevé' : riskLevel === 'medium' ? 'Moyen' : 'Faible';
    const sv = SEV[sev];

    const badgeText = verdictData.title;
    const bw = doc.widthOfString(badgeText) + 22;
    this._drawBadge(doc, m, doc.y, bw, 20, sv.bg, sv.border, sv.color, badgeText, 9);
    doc.fontSize(8).font("Helvetica").fillColor(C.text500);
    doc.text(verdictData.description, m + bw + 10, doc.y + 4, { width: cw - bw - 14 });
    doc.y += 14;
  }

  // ═══════════════════════════════════════════════════════════════
  //  GLOBAL ANALYSIS
  // ═══════════════════════════════════════════════════════════════
  static _generateGlobalAnalysis(doc, auditData, reportData, vulnerabilities, language = 'en') {
    const m = this.M;
    const cw = this.CW;

    this._drawSectionHeader(doc, t(language, 'globalAnalysis'), C.blue500);

    doc.fontSize(10).font("Helvetica").fillColor(C.text700);
    doc.text(t(language, 'analysisDescription'), m, doc.y + 6, { width: cw, lineGap: 3 });

    const cardY1 = doc.y + 14;
    const auditDate = new Date(auditData.dateAudit || Date.now());

    const infoRows = [
      [t(language, 'auditTarget'),    auditData.urlCible || 'N/A'],
      [t(language, 'auditDate'),      auditDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')],
      [t(language, 'auditDuration'),  `${Math.round((auditData.durationMs || 0) / 1000)}s`],
      [t(language, 'auditIntensity'), auditData.intensity || 'medium'],
      [t(language, 'auditStatus'),    auditData.statut || 'completed'],
    ];

    this._drawStyledTable(doc, t(language, 'auditInformation'), infoRows, m, cardY1, cw);

    const metricsRows = [
      [t(language, 'totalEndpoints'),      (auditData.totalEndpoints || 0).toString()],
      [t(language, 'totalRequests'),        (auditData.totalRequests || 0).toString()],
      [t(language, 'totalVulnerabilities'), (auditData.totalVulnerabilities || vulnerabilities.length).toString()],
      [t(language, 'globalScore'),          `${Math.round(auditData.scoreGlobal || 0)}/100`],
    ];

    this._drawStyledTable(doc, t(language, 'auditMetrics'), metricsRows, m, doc.y + 12, cw);

    const counts = this._countSeverities(vulnerabilities);
    const sevRows = [
      [t(language, 'criticalRisk'), counts.critical.toString()],
      [t(language, 'highRisk'),     counts.high.toString()],
      [t(language, 'mediumRisk'),   counts.medium.toString()],
      [t(language, 'lowRisk'),      counts.low.toString()],
      [t(language, 'infoRisk'),     counts.info.toString()],
    ];

    this._drawStyledTable(doc, t(language, 'severitySummary'), sevRows, m, doc.y + 12, cw);

    this._ensureSpace(doc, 70);
    const vy = doc.y + 14;
    const riskLevel = counts.critical > 0 ? 'critical' : counts.high > 0 ? 'high' : counts.medium > 0 ? 'medium' : 'low';
    const verdictData = this._getRiskLevel(riskLevel, language);

    this._drawCard(doc, m, vy, cw, 52);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(C.text500);
    doc.text(t(language, 'verdict').toUpperCase(), m + 18, vy + 12);
    doc.fontSize(12).font("Helvetica-Bold").fillColor(verdictData.color);
    doc.text(verdictData.title, m + 18, vy + 26);
    doc.fontSize(8).font("Helvetica").fillColor(C.text500);
    doc.text(verdictData.description, m + 200, vy + 28, { width: cw - 224 });
    doc.y = vy + 58;
  }

  // ═══════════════════════════════════════════════════════════════
  //  HEADERS ANALYSIS — Card-based layout matching the app
  // ═══════════════════════════════════════════════════════════════
  static _generateHeadersAnalysis(doc, auditData, reportData, language = 'en') {
    const m = this.M;
    const cw = this.CW;

    this._drawSectionHeader(doc, t(language, 'headersAnalysis'), C.blue500);

    const headersRaw = auditData.headersRaw || auditData.headers || {};
    const analysis = HeaderAnalysisService.analyzeHeaders(headersRaw, language);

    // Compliance score card
    const csY = doc.y + 8;
    this._drawCard(doc, m, csY, cw, 56);
    doc.fontSize(10).font("Helvetica-Bold").fillColor(C.text900);
    doc.text(`${t(language, 'headersComplianceScore')}`, m + 18, csY + 12);

    const barW = cw - 120;
    const pct = analysis.stats.complianceScore / 100;
    const barColor = pct >= 0.75 ? C.green600 : pct >= 0.5 ? C.amber500 : C.red600;

    doc.roundedRect(m + 18, csY + 34, barW, 10, 5).fill(C.borderLight);
    if (pct > 0) doc.roundedRect(m + 18, csY + 34, barW * pct, 10, 5).fill(barColor);

    doc.fontSize(11).font("Helvetica-Bold").fillColor(barColor);
    doc.text(`${analysis.stats.complianceScore}%`, m + barW + 30, csY + 32);

    doc.y = csY + 70;

    // Present headers
    if (analysis.present.length > 0) {
      const presentRows = analysis.present.map(h => [
        h.name,
        h.value ? (h.value.length > 50 ? h.value.substring(0, 47) + '...' : h.value) : '---'
      ]);
      this._drawStyledTable(doc, `${t(language, 'headersPresent')} (${analysis.present.length})`, presentRows, m, doc.y, cw, C.green600);

      doc.fontSize(8).font("Helvetica").fillColor(C.green600);
      doc.text(`${analysis.stats.presentCount} ${t(language, 'headersImplementedCorrectly')}`, m + 18, doc.y + 4);
      doc.y += 18;
    }

    // Critical missing headers
    const criticalMissing = analysis.absent.filter(h => h.severity === 'critical');
    if (criticalMissing.length > 0) {
      this._ensureSpace(doc, 80);
      const rows = criticalMissing.map(h => [h.name, h.risk || 'Missing']);
      this._drawStyledTable(doc, `${t(language, 'headersCriticalMissing')} (${criticalMissing.length})`, rows, m, doc.y + 8, cw, C.red600);
    }

    // High missing headers
    const highMissing = analysis.absent.filter(h => h.severity === 'high');
    if (highMissing.length > 0) {
      this._ensureSpace(doc, 80);
      const rows = highMissing.map(h => [h.name, h.risk || 'Missing']);
      this._drawStyledTable(doc, `${t(language, 'headersHighMissing')} (${highMissing.length})`, rows, m, doc.y + 8, cw, C.orange600);
    }

    // Remediation details
    if (analysis.absent.length > 0) {
      analysis.absent.forEach((header, idx) => {
        const remRows = [];
        if (header.description) remRows.push([t(language, 'headersDescription'), header.description]);
        if (header.recommended) remRows.push([t(language, 'headersRecommended'), header.recommended]);
        if (header.risk) remRows.push([t(language, 'headersRisk'), header.risk]);
        if (header.remediation) remRows.push([t(language, 'headersRemediation'), header.remediation]);

        if (remRows.length > 0) {
          this._ensureSpace(doc, 60 + remRows.length * 30);
          this._drawStyledTable(doc, `${idx + 1}. ${header.name}`, remRows, m, doc.y + 6, cw);
        }
      });
    }

    // Summary card
    if (analysis.stats.presentCount > 0 || analysis.stats.absentCount > 0) {
      this._ensureSpace(doc, 120);
      const summaryRows = [
        [t(language, 'headersPresent'), analysis.stats.presentCount.toString()],
        [t(language, 'headersAbsent'), analysis.stats.absentCount.toString()],
        [t(language, 'headersComplianceScore'), `${analysis.stats.complianceScore}%`],
        [t(language, 'headersMostCriticalRisk'), analysis.stats.absentCount > 0 ? "High" : "None"]
      ];
      this._drawStyledTable(doc, t(language, 'headersSummary'), summaryRows, m, doc.y + 8, cw);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  VULNERABILITIES — Card design matching VulnerabilityCard.jsx
  // ═══════════════════════════════════════════════════════════════
  static _generateVulnerabilities(doc, vulnerabilities, reportData, language = 'en') {
    const m = this.M;
    const cw = this.CW;
    const R = this.R;

    this._ensureSpace(doc, 40);
    doc.save();
    doc.roundedRect(m, doc.y, cw, 4, 2).fill(C.red600);
    doc.restore();
    doc.y += 8;
    doc.fontSize(11).font("Helvetica-Bold").fillColor(C.text900);
    doc.text(t(language, 'vulnerabilities'), m, doc.y);
    doc.y += 6;

    if (vulnerabilities.length === 0) {
      doc.fontSize(9).font("Helvetica").fillColor(C.text500);
      doc.text(language === 'fr' ? "Aucune vulnérabilité détectée" : "No vulnerabilities detected", m, doc.y);
      doc.y += 14;
      return;
    }

    // Compact vulnerability list — one row per vuln
    vulnerabilities.forEach((vuln, idx) => {
      this._ensureSpace(doc, 28);

      const vulnTitle = vuln.titre || vuln.title || vuln.technique || 'Vulnerability';
      const sev = vuln.severity || vuln.severite || 'Info';
      const vs = SEV[sev] || SEV.Info;
      const rowY = doc.y;

      // Color bar left
      doc.save();
      doc.roundedRect(m, rowY, 4, 22, 2).fill(vs.color);
      doc.restore();

      // Title
      doc.fontSize(8).font("Helvetica-Bold").fillColor(C.text900);
      doc.text(`${idx + 1}. ${vulnTitle}`, m + 10, rowY + 3, { width: cw - 100 });

      // Severity badge
      const sevText = sev;
      const sevW = doc.widthOfString(sevText) + 14;
      this._drawBadge(doc, m + cw - sevW - 4, rowY + 2, sevW, 16, vs.bg, vs.border, vs.color, sevText, 7);

      // Short description if space
      const desc = vuln.description || vuln.technical_details || '';
      if (desc) {
        doc.fontSize(7).font("Helvetica").fillColor(C.text500);
        doc.text(desc.substring(0, 90) + (desc.length > 90 ? '...' : ''), m + 10, rowY + 14, { width: cw - 20 });
      }

      doc.y = rowY + (desc ? 26 : 22) + 2;
    });

    doc.y += 6;
  }

  // ═══════════════════════════════════════════════════════════════
  //  RECOMMENDATIONS — Green gradient card matching AdminReports
  // ═══════════════════════════════════════════════════════════════
  static _generateRecommendations(doc, vulnerabilities, reportData, language = 'en') {
    const m = this.M;
    const cw = this.CW;

    this._ensureSpace(doc, 40);
    doc.save();
    doc.roundedRect(m, doc.y, cw, 4, 2).fill(C.green600);
    doc.restore();
    doc.y += 8;
    doc.fontSize(11).font("Helvetica-Bold").fillColor(C.text900);
    doc.text(t(language, 'recommendations'), m, doc.y);
    doc.y += 6;

    const vulnsWithRec = vulnerabilities.filter(v => v.fix_recommendation || v.recommandation);
    if (vulnsWithRec.length === 0) {
      doc.fontSize(8).font("Helvetica").fillColor(C.text500);
      doc.text(language === 'fr' ? "Aucune recommandation" : "No recommendations", m, doc.y);
      doc.y += 14;
      return;
    }

    vulnsWithRec.forEach((vuln, idx) => {
      this._ensureSpace(doc, 24);
      const vulnTitle = vuln.titre || vuln.title || 'Fix';
      const recText = (vuln.fix_recommendation || vuln.recommandation || '').substring(0, 120);
      const rowY = doc.y;

      doc.save();
      doc.roundedRect(m, rowY, 4, 18, 2).fill(C.green600);
      doc.restore();

      doc.fontSize(8).font("Helvetica-Bold").fillColor(C.text900);
      doc.text(`${idx + 1}. ${vulnTitle}`, m + 10, rowY + 2, { width: cw - 20 });

      if (recText) {
        doc.fontSize(7).font("Helvetica").fillColor("#166534");
        doc.text(recText + (recText.length >= 120 ? '...' : ''), m + 10, doc.y + 1, { width: cw - 20 });
      }

      doc.y += 4;
    });

    doc.y += 8;
  }

  // ═══════════════════════════════════════════════════════════════
  //  TIMELINE — Dot + vertical line matching AdminReports timeline
  // ═══════════════════════════════════════════════════════════════
  static _generateTimeline(doc, reportData, language = 'en') {
    const m = this.M;
    const cw = this.CW;

    this._drawSectionHeader(doc, t(language, 'timeline'), C.amber500);

    const cardY = doc.y + 10;
    this._drawCard(doc, m, cardY, cw, 168);

    const startDate = reportData.dateDebut || new Date();
    const endDate = reportData.dateFin || new Date();

    const events = [
      { label: t(language, 'timelineStart'),                date: new Date(startDate).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US'), level: "info" },
      { label: t(language, 'timelineVulnerabilitiesFound'), date: "",                                                                        level: "warn" },
      { label: t(language, 'timelineAnalysisCompleted'),    date: "",                                                                        level: "info" },
      { label: t(language, 'timelineEnd'),                  date: new Date(endDate).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US'),   level: "info" },
    ];

    let ey = cardY + 20;
    events.forEach((evt, i) => {
      const dotColor = evt.level === "error" ? C.red600 : evt.level === "warn" ? C.amber500 : C.green600;

      // Vertical connector
      if (i < events.length - 1) {
        doc.moveTo(m + 28, ey + 10).lineTo(m + 28, ey + 34).lineWidth(2).stroke(C.borderLight);
      }

      // Dot
      doc.circle(m + 28, ey + 6, 5).fill(dotColor);

      doc.fontSize(9).font("Helvetica-Bold").fillColor(C.text700);
      doc.text(evt.label, m + 46, ey, { width: cw - 68 });
      if (evt.date) {
        doc.fontSize(8).font("Helvetica").fillColor(C.text500);
        doc.text(evt.date, m + 46, doc.y + 2, { width: cw - 68 });
      }

      ey += 36;
    });

    doc.y = cardY + 178;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CONCLUSION
  // ═══════════════════════════════════════════════════════════════
  static _generateConclusion(doc, reportData, language = 'en') {
    const m = this.M;
    const cw = this.CW;

    this._ensureSpace(doc, 80);

    doc.save();
    doc.roundedRect(m, doc.y, cw, 4, 2).fill(C.blue500);
    doc.restore();
    doc.y += 8;

    doc.fontSize(9).font("Helvetica-Bold").fillColor(C.text900);
    doc.text(t(language, 'conclusion'), m, doc.y);
    doc.y += 4;

    doc.fontSize(8).font("Helvetica").fillColor(C.text700);
    doc.text(t(language, 'conclusionIntro'), m, doc.y, { width: cw, lineGap: 2 });
    doc.y += 6;

    doc.fontSize(8).font("Helvetica").fillColor(C.text400);
    doc.text(t(language, 'footerConfidential'), m, doc.y);
  }

  // ═══════════════════════════════════════════════════════════════
  //  PAGE NUMBERS
  // ═══════════════════════════════════════════════════════════════
  static _addPageNumbers(doc, language = 'en') {
    const pages = doc.bufferedPageRange().count;
    const maxPages = Math.min(pages, 2);
    for (let i = 0; i < maxPages; i++) {
      doc.switchToPage(i);

      if (i > 0) {
        doc.save();
        doc.rect(0, 0, this.PW, 3).fill(C.blue500);
        doc.restore();
      }

      doc.fontSize(8).font("Helvetica").fillColor(C.text400);
      doc.text(
        `${t(language, 'footerPageOf')} ${i + 1} / ${maxPages}`,
        this.M,
        doc.page.height - 24,
        { width: this.CW, align: "center", lineBreak: false }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  DRAWING HELPERS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Ensure enough vertical space; if not, add a new page.
   */
  static _ensureSpace(doc, needed = 120) {
    if (doc.y + needed > doc.page.height - 60) {
      doc.addPage();
      doc.rect(0, 0, this.PW, doc.page.height).fill(C.white);
      doc.y = this.M;
    }
  }

  /**
   * Add a new page with white background
   */
  static _newPage(doc) {
    doc.addPage();
    doc.rect(0, 0, this.PW, doc.page.height).fill(C.white);
    doc.y = this.M;
    return this.M;
  }

  /**
   * Section header — new page + accent bar + title + underline
   */
  static _drawSectionHeader(doc, title, accentColor = C.blue500, newPage = true) {
    const m = this.M;
    const cw = this.CW;

    if (newPage) this._newPage(doc);

    doc.save();
    doc.roundedRect(m, m + 4, 5, 20, 2).fill(accentColor);
    doc.restore();

    doc.fontSize(16).font("Helvetica-Bold").fillColor(C.text900);
    doc.text(title, m + 16, m + 6, { width: cw - 24 });

    const uy = doc.y + 8;
    doc.moveTo(m, uy).lineTo(m + cw, uy).lineWidth(0.5).stroke(C.border);
    doc.lineWidth(1);
    doc.y = uy + 14;
  }

  /**
   * Card with rounded corners and subtle shadow (Tailwind shadow-sm)
   */
  static _drawCard(doc, x, y, w, h) {
    const R = this.R;
    // Shadow (offset down-right)
    doc.save();
    doc.roundedRect(x + 1, y + 2, w, h, R).fill(C.shadow);
    doc.restore();
    // Card body
    doc.save();
    doc.roundedRect(x, y, w, h, R).fill(C.white);
    doc.lineWidth(1).strokeColor(C.border).roundedRect(x, y, w, h, R).stroke();
    doc.restore();
  }

  /**
   * Badge (rounded pill) — proper save/restore, no double fill/stroke
   */
  static _drawBadge(doc, x, y, w, h, bgColor, borderColor, textColor, text, fontSize = 8) {
    const r = h / 2;
    doc.save();
    doc.roundedRect(x, y, w, h, r).fill(bgColor);
    doc.restore();
    doc.save();
    doc.lineWidth(1).strokeColor(borderColor).roundedRect(x, y, w, h, r).stroke();
    doc.restore();
    doc.fontSize(fontSize).font("Helvetica-Bold").fillColor(textColor);
    doc.text(text, x + 4, y + (h - fontSize) / 2, { width: w - 8, align: "center", lineBreak: false });
  }

  /**
   * Code block with rounded corners, dark background, internal padding
   */
  static _drawCodeBlock(doc, text, x, y, w, h, textColor) {
    const R = 6;
    textColor = textColor || C.codeText;
    doc.save();
    doc.roundedRect(x, y, w, h, R).fill(C.codeBg);
    doc.restore();
    doc.fontSize(7).font("Courier").fillColor(textColor);
    doc.text(text, x + 10, y + 6, { width: w - 20, height: h - 12 });
  }

  /**
   * Score ring using arc path
   */
  static _drawScoreRing(doc, cx, cy, r, score, color) {
    const strokeW = r / 4.5;

    // Background track
    doc.save();
    doc.circle(cx, cy, r).lineWidth(strokeW).strokeOpacity(0.2).stroke(C.border);
    doc.restore();

    // Score arc
    if (score > 0) {
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (2 * Math.PI * Math.min(score, 100)) / 100;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
      const pathStr = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;

      doc.save();
      doc.path(pathStr).lineWidth(strokeW).strokeOpacity(1).stroke(color);
      doc.restore();
    }

    // Score text
    doc.fontSize(r / 2).font("Helvetica-Bold").fillColor(color);
    doc.text(String(score), cx - r, cy - r / 3.5, { width: r * 2, align: "center", lineBreak: false });
    doc.fontSize(r / 5).font("Helvetica").fillColor(C.text400);
    doc.text("/100", cx - r, cy + r / 5, { width: r * 2, align: "center", lineBreak: false });
  }

  /**
   * Styled table with dynamic row heights, rounded card, accent header
   */
  static _drawStyledTable(doc, title, rows, x, y, w, accentColor = C.blue500) {
    if (!rows || rows.length === 0) return;

    const R = this.R;
    const headerH = 30;
    const col1W = Math.round(w * 0.4);
    const col2W = w - col1W;
    const padding = 14;

    // Pre-calculate row heights
    const rowHeights = rows.map(row => {
      const t1 = String(row[0] || '');
      const t2 = String(row[1] || '');
      const h1 = doc.heightOfString(t1, { width: col1W - 20, fontSize: 8 });
      const h2 = doc.heightOfString(t2, { width: col2W - 20, fontSize: 8 });
      return Math.max(24, Math.max(h1, h2) + 12);
    });

    const totalRowH = rowHeights.reduce((a, b) => a + b, 0);
    const totalH = headerH + totalRowH + 6;

    if (y + totalH > doc.page.height - 60) {
      this._newPage(doc);
      y = this.M;
    }

    // Card background
    doc.save();
    doc.roundedRect(x, y, w, totalH, R).fill(C.white);
    doc.lineWidth(1).strokeColor(C.border).roundedRect(x, y, w, totalH, R).stroke();
    doc.restore();

    // Header bar
    doc.save();
    doc.roundedRect(x, y, w, headerH, R).fill(C.bg);
    doc.roundedRect(x, y, 4, headerH, 2).fill(accentColor);
    doc.restore();
    doc.fontSize(9).font("Helvetica-Bold").fillColor(C.text900);
    doc.text(title, x + padding, y + 9, { width: w - padding * 2 });

    // Rows
    let ry = y + headerH;
    rows.forEach((row, i) => {
      const rh = rowHeights[i];

      if (ry + rh > doc.page.height - 50) {
        this._newPage(doc);
        ry = this.M;
      }

      // Alternating bg
      if (i % 2 !== 0) {
        doc.save();
        doc.rect(x + 2, ry, w - 4, rh).fill(C.bg);
        doc.restore();
      }

      // Separator
      doc.moveTo(x + 4, ry).lineTo(x + w - 4, ry).lineWidth(0.5).stroke(C.borderLight);

      // Key
      doc.fontSize(8).font("Helvetica-Bold").fillColor(C.text500);
      doc.text(String(row[0] || ''), x + padding, ry + 6, { width: col1W - 20 });

      // Value
      doc.fontSize(8).font("Helvetica").fillColor(C.text900);
      doc.text(String(row[1] || ''), x + col1W + 6, ry + 6, { width: col2W - 20 });

      ry += rh;
    });

    doc.lineWidth(1);
    doc.y = ry + 8;
  }

  /**
   * Vulnerability sub-section header (colored dot + bold label)
   */
  static _drawVulnSection(doc, label, color, x, y) {
    doc.circle(x + 18, y + 6, 4).fill(color);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(C.text900);
    doc.text(label, x + 28, y + 1, { width: this.CW - 44 });
  }

  /**
   * Count severities
   */
  static _countSeverities(vulnerabilities) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    (vulnerabilities || []).forEach(v => {
      const s = (v.severite || v.severity || '').toLowerCase();
      if (['critique', 'critical'].includes(s)) counts.critical++;
      else if (['élevé', 'eleve', 'high'].includes(s)) counts.high++;
      else if (['moyen', 'medium'].includes(s)) counts.medium++;
      else if (['faible', 'low'].includes(s)) counts.low++;
      else counts.info++;
    });
    return counts;
  }

  /**
   * Get risk level data
   */
  static _getRiskLevel(level, language = 'en') {
    const levels = {
      critical: { title: t(language, 'criticalVerdictTitle'), description: t(language, 'criticalVerdictDesc'), color: C.red600 },
      high:     { title: t(language, 'highVerdictTitle'),     description: t(language, 'highVerdictDesc'),     color: C.orange600 },
      medium:   { title: t(language, 'mediumVerdictTitle'),   description: t(language, 'mediumVerdictDesc'),   color: C.yellow600 },
      low:      { title: t(language, 'lowVerdictTitle'),      description: t(language, 'lowVerdictDesc'),      color: C.green600 },
    };
    return levels[level] || levels.low;
  }

  static _getSeverityColor(severity) {
    return (SEV[severity] || SEV.Info).color;
  }
}

module.exports = PDFGeneratorService;
