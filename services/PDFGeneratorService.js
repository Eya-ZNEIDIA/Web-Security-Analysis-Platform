/**
 * PDFGeneratorService - Bilingual Edition
 * Génère des rapports de sécurité professionnels en PDF (FR/EN)
 * Format moderne, détaillé, cybersécurité/pentest
 */

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const HeaderAnalysisService = require("./HeaderAnalysisService");
const { t } = require("../config/translations");

class PDFGeneratorService {
  /**
   * Génère un rapport PDF complet pour un audit
   * @param {Object} auditData - Données complètes de l'audit
   * @param {Object} reportData - Données du rapport
   * @param {Array} vulnerabilities - Liste des vulnérabilités
   * @param {string} outputPath - Chemin de sortie du fichier PDF
   * @param {string} language - Langue du rapport ('fr' ou 'en', défaut 'en')
   */
  static async generateFullReport(auditData, reportData, vulnerabilities, outputPath, language = 'en') {
    return new Promise((resolve, reject) => {
      try {
        const titleText = t(language, 'documentTitle');
        const doc = new PDFDocument({
          size: "A4",
          margin: 40,
          bufferPages: true,
          info: {
            Title: `${titleText} - ${auditData.urlCible}`,
            Author: "Plateforme d'Audit Sécurité",
            Creator: "Security Audit Platform"
          }
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Générer le rapport
        this._generateCoverPage(doc, auditData, reportData, vulnerabilities, language);
        this._generateTableOfContents(doc, language);
        this._generateExecutiveSummary(doc, auditData, reportData, vulnerabilities, language);
        this._generateGlobalAnalysis(doc, auditData, reportData, vulnerabilities, language);
        this._generateHeadersAnalysis(doc, auditData, reportData, language);
        this._generateVulnerabilities(doc, vulnerabilities, reportData, language);
        this._generateRecommendations(doc, vulnerabilities, reportData, language);
        this._generateTimeline(doc, reportData, language);
        this._generateConclusion(doc, reportData, language);

        // Ajouter les numéros de page
        this._addPageNumbers(doc, language);

        doc.end();

        stream.on("finish", () => {
          resolve(outputPath);
        });

        stream.on("error", reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Page de couverture - Améliorée et professionnelle
   */
  static _generateCoverPage(doc, auditData, reportData, vulnerabilities = [], language = 'en') {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Fond dégradé
    doc.rect(0, 0, pageWidth, pageHeight).fill("#0f172a");
    doc.rect(0, 0, pageWidth, 250).fill("#1e293b");

    // Logo / Titre principal
    doc
      .fillColor("#3b82f6")
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("[SECURITY AUDIT PLATFORM]", 60, 80, { align: "left" });

    doc
      .fillColor("#ffffff")
      .fontSize(48)
      .font("Helvetica-Bold")
      .text(t(language, 'coverTitle'), 60, 120);

    // Ligne de séparation
    doc
      .moveTo(60, 250)
      .lineTo(pageWidth - 60, 250)
      .stroke("#3b82f6");

    // Informations principales
    const y = 290;
    doc.fontSize(13).fillColor("#e5e7eb").font("Helvetica-Bold");

    const lineHeight = 24;
    const col1 = 60;
    const col2 = 350;

    // Colonne 1
    doc.text(t(language, 'coverTarget'), col1, y);
    doc.fontSize(11).font("Helvetica").fillColor("#cbd5e1");
    doc.text(auditData.urlCible || 'N/A', col1, y + 22);

    doc.fontSize(13).font("Helvetica-Bold").fillColor("#e5e7eb");
    doc.text(t(language, 'coverDate'), col1, y + lineHeight * 3);
    doc.fontSize(11).font("Helvetica").fillColor("#cbd5e1");
    const auditDate = new Date(auditData.dateAudit || Date.now());
    doc.text(auditDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US'), col1, y + lineHeight * 3 + 22);

    // Colonne 2 - Scores
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#e5e7eb");
    doc.text(t(language, 'globalScore'), col2, y);
    doc.fontSize(20).font("Helvetica-Bold").fillColor("#3b82f6");
    doc.text(`${Math.round(auditData.scoreGlobal || 0)}/100`, col2, y + 20);

    // Statut et niveau de risque
    const vulnCount = vulnerabilities.length;
    const criticalCount = vulnerabilities.filter(v => ['Critique', 'Critical'].includes(v.severite || v.severity)).length;
    const highCount = vulnerabilities.filter(v => ['Élevé', 'High'].includes(v.severite || v.severity)).length;

    const statusColor = criticalCount > 0 ? "#dc2626" : highCount > 0 ? "#ea580c" : "#16a34a";
    const statusText = criticalCount > 0 ? t(language, 'criticalRisk') : highCount > 0 ? t(language, 'highRisk') : t(language, 'lowRisk');
    const statusBg = criticalCount > 0 ? "#7f1d1d" : highCount > 0 ? "#7c2d12" : "#15803d";

    doc.fontSize(13).font("Helvetica-Bold").fillColor("#e5e7eb");
    doc.text(t(language, 'overallRiskLevel'), col2, y + lineHeight * 3);
    doc.rect(col2, y + lineHeight * 3 + 15, 100, 30).fill(statusBg);
    doc.fontSize(14).font("Helvetica-Bold").fillColor(statusColor);
    doc.text(statusText, col2 + 5, y + lineHeight * 3 + 20);

    // Résumé des vulnérabilités
    const summaryY = y + lineHeight * 6;
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#e5e7eb");
    doc.text(t(language, 'summaryStats'), 60, summaryY);

    doc.fontSize(11).fillColor("#cbd5e1").font("Helvetica");
    doc.text(`• ${t(language, 'totalVulnerabilities')}: ${vulnCount}`, 80, summaryY + 25);
    doc.text(`• ${t(language, 'criticalCount')}: ${criticalCount}`, 80, summaryY + 45);
    doc.text(`• ${t(language, 'highCount')}: ${highCount}`, 80, summaryY + 65);

    // Métriques d'audit
    const metricsY = summaryY;
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#e5e7eb");
    doc.text(t(language, 'auditMetrics'), col2, metricsY);

    doc.fontSize(11).fillColor("#cbd5e1").font("Helvetica");
    doc.text(`• ${t(language, 'auditDuration')}: ${Math.round((auditData.durationMs || 0) / 1000)}s`, col2, metricsY + 25);
    doc.text(`• ${t(language, 'totalEndpoints')}: ${auditData.totalEndpoints || 0}`, col2, metricsY + 45);
    doc.text(`• ${t(language, 'totalRequests')}: ${auditData.totalRequests || 0}`, col2, metricsY + 65);

    // Footer
    doc
      .fontSize(10)
      .fillColor("#64748b")
      .text(t(language, 'footerConfidential'), 60, pageHeight - 60);

    doc.fontSize(9).fillColor("#64748b");
    doc.text(`${t(language, 'generatedOn')}: ${new Date().toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}`, 60, pageHeight - 40);

    doc.addPage();
  }

  /**
   * Table des matières
   */
  static _generateTableOfContents(doc, language = 'en') {
    doc.fontSize(18).font("Helvetica-Bold").fillColor("#000000");
    doc.text(t(language, 'tableOfContents'), { y: 50 });

    const sections = [
      { name: t(language, 'executiveSummary'), page: 3 },
      { name: t(language, 'globalAnalysis'), page: 4 },
      { name: t(language, 'headersAnalysis'), page: 5 },
      { name: t(language, 'vulnerabilities'), page: 6 },
      { name: t(language, 'recommendations'), page: 7 },
      { name: t(language, 'timeline'), page: 8 },
      { name: t(language, 'conclusion'), page: 9 }
    ];

    let y = 120;
    doc.fontSize(12).fillColor("#333333").font("Helvetica");

    sections.forEach((section) => {
      doc.text(`${section.name}`, { y });
      y += 25;
    });

    doc.addPage();
  }

  /**
   * Résumé exécutif
   */
  static _generateExecutiveSummary(doc, auditData, reportData, vulnerabilities, language = 'en') {
    this._addSectionTitle(doc, t(language, 'executiveSummary'), language);

    // Introduction
    doc
      .fontSize(11)
      .fillColor("#333333")
      .font("Helvetica");

    doc.text(t(language, 'summaryIntro'), { width: 500, align: "left" });

    // Statistiques générales
    this._addSubsection(doc, t(language, 'summaryStats'), language);

    const vulnCount = vulnerabilities.length;
    const criticalCount = vulnerabilities.filter(v => v.severite === 'Critique').length;
    const highCount = vulnerabilities.filter(v => v.severite === 'Élevé' || v.severite === 'High').length;
    const mediumCount = vulnerabilities.filter(v => v.severite === 'Moyen' || v.severite === 'Medium').length;
    const lowCount = vulnerabilities.filter(v => v.severite === 'Faible' || v.severite === 'Low').length;
    const infoCount = vulnerabilities.filter(v => v.severite === 'Information' || v.severite === 'Info').length;

    const statsData = [
      [t(language, 'totalVulnerabilities'), vulnCount.toString()],
      [t(language, 'criticalCount'), criticalCount.toString()],
      [t(language, 'highCount'), highCount.toString()],
      [t(language, 'mediumCount'), mediumCount.toString()],
      [t(language, 'lowCount'), lowCount.toString()],
      [t(language, 'infoCount'), infoCount.toString()]
    ];

    this._drawTable(doc, statsData, [200, 80], 60, language);

    // Niveau de risque global
    this._addSubsection(doc, t(language, 'summaryRisk'), language);
    const riskLevel = criticalCount > 0 ? t(language, 'criticalRisk') : highCount > 0 ? t(language, 'highRisk') : t(language, 'lowRisk');
    const riskColor = criticalCount > 0 ? "#dc2626" : highCount > 0 ? "#ea580c" : "#16a34a";

    doc.fillColor(riskColor).fontSize(14).font("Helvetica-Bold");
    doc.text(riskLevel, { y: doc.y + 10 });

    doc.addPage();
  }

  /**
   * Analyse globale - Améliorée avec tous les détails
   */
  static _generateGlobalAnalysis(doc, auditData, reportData, vulnerabilities, language = 'en') {
    this._addSectionTitle(doc, t(language, 'globalAnalysis'), language);

    doc.fontSize(11).fillColor("#333333").font("Helvetica");
    doc.text(t(language, 'analysisDescription'), { width: 500 });
    doc.moveDown(10);

    // Audit Information
    this._addSubsection(doc, t(language, 'auditInformation'), language);

    const auditInfoData = [
      [t(language, 'auditTarget'), auditData.urlCible || 'N/A'],
      [t(language, 'auditDate'), new Date(auditData.dateAudit || Date.now()).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')],
      [t(language, 'auditDuration'), `${Math.round((auditData.durationMs || 0) / 1000)}s`],
      [t(language, 'auditIntensity'), auditData.intensity || 'medium'],
      [t(language, 'auditStatus'), auditData.statut || 'completed']
    ];

    this._drawDetailTable(doc, auditInfoData, [150, 180], 60, language);

    // Métriques de l'audit
    this._addSubsection(doc, t(language, 'auditMetrics'), language);

    const metricsData = [
      [t(language, 'totalEndpoints'), (auditData.totalEndpoints || 0).toString()],
      [t(language, 'totalRequests'), (auditData.totalRequests || 0).toString()],
      [t(language, 'totalVulnerabilities'), (auditData.totalVulnerabilities || vulnerabilities.length).toString()],
      [t(language, 'globalScore'), `${Math.round(auditData.scoreGlobal || 0)}/100`]
    ];

    this._drawDetailTable(doc, metricsData, [150, 180], 60, language);

    // Résumé par sévérité
    this._addSubsection(doc, t(language, 'severitySummary'), language);

    const vulnCount = vulnerabilities.length;
    const criticalCount = vulnerabilities.filter(v => ['Critique', 'Critical'].includes(v.severite || v.severity)).length;
    const highCount = vulnerabilities.filter(v => ['Élevé', 'High'].includes(v.severite || v.severity)).length;
    const mediumCount = vulnerabilities.filter(v => ['Moyen', 'Medium'].includes(v.severite || v.severity)).length;
    const lowCount = vulnerabilities.filter(v => ['Faible', 'Low'].includes(v.severite || v.severity)).length;
    const infoCount = vulnerabilities.filter(v => ['Information', 'Info'].includes(v.severite || v.severity)).length;

    const analysisData = [
      [t(language, 'criticalRisk'), criticalCount.toString()],
      [t(language, 'highRisk'), highCount.toString()],
      [t(language, 'mediumRisk'), mediumCount.toString()],
      [t(language, 'lowRisk'), lowCount.toString()],
      [t(language, 'infoRisk'), infoCount.toString()]
    ];

    this._drawDetailTable(doc, analysisData, [150, 180], 60, language);

    // Verdict
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#333333");
    doc.text(t(language, 'verdict'), { y: doc.y + 15 });

    const riskLevel = criticalCount > 0 ? 'critical' : highCount > 0 ? 'high' : mediumCount > 0 ? 'medium' : 'low';
    const verdictData = this._getRiskLevel(riskLevel, language);

    doc.fontSize(14).font("Helvetica-Bold").fillColor(verdictData.color);
    doc.text(verdictData.title, { y: doc.y + 5 });

    doc.fontSize(10).font("Helvetica").fillColor("#666666");
    doc.text(verdictData.description, { width: 500 });

    doc.addPage();
  }

  /**
   * Analyse des en-têtes HTTP - Améliorée et détaillée
   */
  static _generateHeadersAnalysis(doc, auditData, reportData, language = 'en') {
    this._addSectionTitle(doc, t(language, 'headersAnalysis'), language);

    const headersRaw = auditData.headersRaw || auditData.headers || {};
    const analysis = HeaderAnalysisService.analyzeHeaders(headersRaw, language);

    // Score de conformité - Barre de progression
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#333333");
    doc.text(`${t(language, 'headersComplianceScore')}: ${analysis.stats.complianceScore}%`, { y: doc.y + 10 });

    // Barre de progression
    const barWidth = 300;
    const scorePercentage = (analysis.stats.complianceScore / 100);
    const barFillWidth = barWidth * scorePercentage;
    const scoreColor = scorePercentage >= 0.75 ? "#16a34a" : scorePercentage >= 0.5 ? "#d97706" : "#dc2626";

    doc.rect(60, doc.y + 15, barWidth, 20).stroke("#e5e7eb").fill("#f3f4f6");
    doc.rect(60, doc.y + 15, barFillWidth, 20).fill(scoreColor);
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#ffffff");
    doc.text(`${analysis.stats.complianceScore}%`, 60 + barFillWidth / 2 - 10, doc.y + 18);
    doc.moveDown(30);

    // En-têtes PRÉSENTS
    this._addSubsection(doc, `${t(language, 'headersPresent')} (${analysis.present.length})`, language);

    if (analysis.present.length > 0) {
      const presentData = analysis.present.map(h => [
        h.name,
        h.value ? (h.value.length > 50 ? h.value.substring(0, 47) + '...' : h.value) : '✓'
      ]);
      this._drawDetailTable(doc, presentData, [180, 150], 60, language);
      
      doc.fontSize(8).font("Helvetica").fillColor("#16a34a");
      doc.text(`✓ ${analysis.stats.presentCount} ${t(language, 'headersImplementedCorrectly')}`, { width: 500 });
      doc.moveDown(5);
    } else {
      doc.fontSize(10).fillColor("#999999").text(language === 'fr' ? "Aucun header de sécurité détecté" : "No security headers detected");
      doc.moveDown(5);
    }

    // En-têtes MANQUANTS - Critiques
    const criticalMissing = analysis.absent.filter(h => h.severity === 'critical');
    if (criticalMissing.length > 0) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#dc2626");
      doc.text(`${t(language, 'headersCriticalMissing')} (${criticalMissing.length})`, { y: doc.y + 10 });

      const criticalData = criticalMissing.map(h => [
        h.name,
        h.risk || 'Missing critical security header'
      ]);
      this._drawDetailTable(doc, criticalData, [180, 150], 60, language);
      doc.moveDown(3);
    }

    // En-têtes MANQUANTS - Importants
    const highMissing = analysis.absent.filter(h => h.severity === 'high');
    if (highMissing.length > 0) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#ea580c");
      doc.text(`${t(language, 'headersHighMissing')} (${highMissing.length})`, { y: doc.y + 10 });

      const highData = highMissing.map(h => [
        h.name,
        h.risk || 'Missing important security header'
      ]);
      this._drawDetailTable(doc, highData, [180, 150], 60, language);
      doc.moveDown(3);
    }

    // Résumé des en-têtes manquants
    if (analysis.absent.length > 0) {
      this._addSubsection(doc, `${t(language, 'headersAbsent')} - ${t(language, 'remediationAdvice')}`, language);

      analysis.absent.forEach((header, idx) => {
        if (doc.y > 700) doc.addPage();

        doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
        doc.text(`${idx + 1}. ${header.name}`, { y: doc.y + 5 });
        doc.moveDown(3);

        const remediationData = [];
        if (header.description) {
          remediationData.push([t(language, 'headersDescription'), header.description]);
        }
        if (header.recommended) {
          remediationData.push([t(language, 'headersRecommended'), header.recommended]);
        }
        if (header.risk) {
          remediationData.push([t(language, 'headersRisk'), header.risk]);
        }
        if (header.remediation) {
          remediationData.push([t(language, 'headersRemediation'), header.remediation]);
        }

        this._drawDetailTable(doc, remediationData, [140, 190], 70, language);
        doc.moveDown(3);
      });
    }

    // Résumé d'impact
    if (analysis.stats.presentCount > 0 || analysis.stats.absentCount > 0) {
      this._addSubsection(doc, t(language, 'headersSummary'), language);

      const summaryData = [
        [t(language, 'headersPresent'), analysis.stats.presentCount.toString()],
        [t(language, 'headersAbsent'), analysis.stats.absentCount.toString()],
        [t(language, 'headersComplianceScore'), `${analysis.stats.complianceScore}%`],
        [t(language, 'headersMostCriticalRisk'), analysis.stats.absentCount > 0 ? "High" : "None"]
      ];

      this._drawDetailTable(doc, summaryData, [180, 150], 60, language);
    }

    doc.addPage();
  }

  /**
   * Vulnérabilités - Version complète et détaillée
   */
  static _generateVulnerabilities(doc, vulnerabilities, reportData, language = 'en') {
    this._addSectionTitle(doc, t(language, 'vulnerabilities'), language);

    if (vulnerabilities.length === 0) {
      doc.fontSize(11).fillColor("#333333").text(language === 'fr' ? "Aucune vulnérabilité détectée" : "No vulnerabilities detected");
      doc.addPage();
      return;
    }

    const severityOrder = ['Critique', 'Critical', 'Élevé', 'High', 'Moyen', 'Medium', 'Faible', 'Low', 'Information', 'Info'];
    const grouped = {};
    severityOrder.forEach(severity => {
      grouped[severity] = vulnerabilities.filter(v => v.severite === severity);
    });

    let vulnIndex = 1;

    Object.entries(grouped).forEach(([severity, vulns]) => {
      if (vulns.length === 0) return;

      const severityTextMap = {
        'Critique': t(language, 'criticalRisk'),
        'Critical': t(language, 'criticalRisk'),
        'Élevé': t(language, 'highRisk'),
        'High': t(language, 'highRisk'),
        'Moyen': t(language, 'mediumRisk'),
        'Medium': t(language, 'mediumRisk'),
        'Faible': t(language, 'lowRisk'),
        'Low': t(language, 'lowRisk'),
        'Information': t(language, 'infoRisk'),
        'Info': t(language, 'infoRisk')
      };

      const severityText = severityTextMap[severity] || severity;
      this._addSubsection(doc, `${severityText} (${vulns.length})`, language);

      vulns.forEach((vuln, idx) => {
        // Ajouter une nouvelle page si nécessaire
        if (doc.y > 650) doc.addPage();

        // Titre de la vulnérabilité
        const vulnTitle = vuln.titre || vuln.title || vuln.technique || 'Vulnerability';
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a");
        doc.text(`${vulnIndex}. ${vulnTitle}`, { y: doc.y + 5 });
        vulnIndex++;

        doc.moveDown(5);

        // Informations générales - Tableau
        const generalInfoData = [];
        
        if (vuln.severity || vuln.severite) {
          const sev = vuln.severity || vuln.severite;
          const severityColor = this._getSeverityColor(sev);
          generalInfoData.push([t(language, 'vulnerabilitySeverity'), sev]);
        }
        
        if (vuln.cvss_score) {
          generalInfoData.push([t(language, 'vulnerabilityCVSSScore'), `${vuln.cvss_score}/10`]);
        }
        
        if (vuln.cvss_vector) {
          generalInfoData.push([t(language, 'vulnerabilityCVSSVector'), vuln.cvss_vector]);
        }
        
        if (vuln.owasp_category) {
          generalInfoData.push([t(language, 'vulnerabilityOWASP'), vuln.owasp_category]);
        }
        
        if (vuln.cwe) {
          generalInfoData.push([t(language, 'vulnerabilityCWE'), vuln.cwe]);
        }
        
        if (vuln.ai_confidence) {
          const confidence = Math.round(vuln.ai_confidence * 100);
          generalInfoData.push([t(language, 'vulnerabilityAIConfidence'), `${confidence}%`]);
        }

        if (generalInfoData.length > 0) {
          doc.fontSize(8).font("Helvetica");
          this._drawDetailTable(doc, generalInfoData, [150, 130], 60, language);
        }

        doc.moveDown(3);

        // Description technique
        if (vuln.description || vuln.technical_details) {
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
          doc.text(t(language, 'vulnerabilityDescription'));
          doc.fontSize(8).font("Helvetica").fillColor("#555555");
          doc.text(vuln.description || vuln.technical_details, { width: 500 });
          doc.moveDown(3);
        }

        // Contexte technique
        const technicalContext = [];

        if (vuln.endpoint) {
          technicalContext.push([t(language, 'vulnerabilityEndpoint'), vuln.endpoint]);
        }
        
        if (vuln.method) {
          technicalContext.push([t(language, 'vulnerabilityMethod'), vuln.method]);
        }
        
        if (vuln.parameter) {
          technicalContext.push([t(language, 'vulnerabilityParameter'), vuln.parameter]);
        }
        
        if (vuln.payload) {
          // Limiter la longueur du payload affiché
          const payloadDisplay = vuln.payload.length > 100 
            ? vuln.payload.substring(0, 97) + '...' 
            : vuln.payload;
          technicalContext.push([t(language, 'vulnerabilityPayload'), payloadDisplay]);
        }

        if (technicalContext.length > 0) {
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
          doc.text(t(language, 'vulnerabilityTechnicalContext'));
          this._drawDetailTable(doc, technicalContext, [120, 160], 60, language);
          doc.moveDown(3);
        }

        // Evidence / Preuve
        if (vuln.evidence) {
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
          doc.text(t(language, 'vulnerabilityEvidence'));
          doc.fontSize(8).font("Helvetica").fillColor("#555555");
          const evidenceDisplay = vuln.evidence.length > 200 
            ? vuln.evidence.substring(0, 197) + '...' 
            : vuln.evidence;
          doc.text(evidenceDisplay, { width: 500 });
          doc.moveDown(3);
        }

        // Response snippet
        if (vuln.http_response_snippet) {
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
          doc.text(t(language, 'vulnerabilityResponseSnippet'));
          doc.fontSize(7).font("Courier").fillColor("#333333");
          doc.rect(60, doc.y, 480, 60).stroke("#cccccc");
          doc.text(vuln.http_response_snippet, 65, doc.y + 5, { width: 470, height: 50 });
          doc.moveDown(65);
        }

        // Impact
        const impacts = [];
        if (vuln.business_impact) {
          impacts.push([t(language, 'vulnerabilityBusinessImpact'), vuln.business_impact]);
        }
        if (vuln.impact) {
          impacts.push([t(language, 'vulnerabilityImpact'), vuln.impact]);
        }

        if (impacts.length > 0) {
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
          doc.text(t(language, 'vulnerabilityImpactSection'));
          this._drawDetailTable(doc, impacts, [150, 160], 60, language);
          doc.moveDown(3);
        }

        // Reproduction
        if (vuln.reproduction_steps && vuln.reproduction_steps.length > 0) {
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
          doc.text(t(language, 'vulnerabilityReproductionSteps'));
          doc.fontSize(8).font("Helvetica").fillColor("#555555");
          
          vuln.reproduction_steps.forEach((step, stepIdx) => {
            doc.text(`${stepIdx + 1}. ${step}`, { width: 500 });
          });
          doc.moveDown(3);
        }

        // Recommandations
        const recommendations = [];
        if (vuln.fix_recommendation) {
          recommendations.push([t(language, 'vulnerabilityFixRecommendation'), vuln.fix_recommendation]);
        }
        if (vuln.recommandation) {
          recommendations.push([t(language, 'vulnerabilityRecommendation'), vuln.recommandation]);
        }

        if (recommendations.length > 0) {
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#16a34a");
          doc.text(t(language, 'vulnerabilityRemediations'));
          this._drawDetailTable(doc, recommendations, [140, 170], 60, language);
          doc.moveDown(3);
        }

        // Code exemple sécurisé
        if (vuln.secure_code_example) {
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
          doc.text(t(language, 'vulnerabilitySecureCodeExample'));
          doc.fontSize(7).font("Courier").fillColor("#16a34a");
          doc.rect(60, doc.y, 480, 60).stroke("#16a34a");
          doc.text(vuln.secure_code_example, 65, doc.y + 5, { width: 470, height: 50 });
          doc.moveDown(65);
        }

        // Headers recommandés
        if (vuln.headers_to_add && Object.keys(vuln.headers_to_add).length > 0) {
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
          doc.text(t(language, 'vulnerabilityHeadersToAdd'));
          const headersData = Object.entries(vuln.headers_to_add).map(([key, val]) => [key, String(val)]);
          this._drawDetailTable(doc, headersData, [150, 160], 60, language);
          doc.moveDown(3);
        }

        doc.moveDown(8);
      });

      doc.addPage();
    });
  }

  /**
   * Recommandations
   */
  static _generateRecommendations(doc, vulnerabilities, reportData, language = 'en') {
    this._addSectionTitle(doc, t(language, 'recommendations'), language);

    const recommendations = {
      [t(language, 'recommendationCritical')]: vulnerabilities.filter(v => ['Critique', 'Critical'].includes(v.severite)),
      [t(language, 'recommendationHigh')]: vulnerabilities.filter(v => ['Élevé', 'High'].includes(v.severite)),
      [t(language, 'recommendationMedium')]: vulnerabilities.filter(v => ['Moyen', 'Medium'].includes(v.severite)),
      [t(language, 'recommendationLow')]: vulnerabilities.filter(v => ['Faible', 'Low'].includes(v.severite))
    };

    Object.entries(recommendations).forEach(([category, vulns]) => {
      if (vulns.length === 0) return;

      this._addSubsection(doc, `${category} (${vulns.length})`, language);

      vulns.forEach((vuln, index) => {
        if (doc.y > 700) doc.addPage();

        doc.fontSize(9).font("Helvetica").fillColor("#333333");
        doc.text(`${index + 1}. ${vuln.titre || vuln.title}`, { width: 500 });
        doc.moveDown(2);
      });
    });

    doc.addPage();
  }

  /**
   * Chronologie
   */
  static _generateTimeline(doc, reportData, language = 'en') {
    this._addSectionTitle(doc, t(language, 'timeline'), language);

    doc.fontSize(11).fillColor("#333333").font("Helvetica");

    const startDate = reportData.dateDebut || new Date();
    const endDate = reportData.dateFin || new Date();

    const events = [
      {
        label: t(language, 'timelineStart'),
        date: new Date(startDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')
      },
      {
        label: t(language, 'timelineEnd'),
        date: new Date(endDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')
      }
    ];

    events.forEach((event, i) => {
      doc.fontSize(10).font("Helvetica-Bold").text(`• ${event.label}`, { y: doc.y + 10 });
      doc.fontSize(9).font("Helvetica").fillColor("#666666");
      doc.text(`  ${event.date}`, { y: doc.y + 2 });
      doc.fillColor("#333333");
    });

    doc.addPage();
  }

  /**
   * Conclusion
   */
  static _generateConclusion(doc, reportData, language = 'en') {
    this._addSectionTitle(doc, t(language, 'conclusion'), language);

    doc
      .fontSize(11)
      .fillColor("#333333")
      .font("Helvetica");

    doc.text(t(language, 'conclusionIntro'), { width: 500 });

    doc.moveDown(10);
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text(t(language, 'conclusionNextStepsDetail'));

    const steps = [
      t(language, 'conclusionPrioritize'),
      t(language, 'conclusionImplement'),
      t(language, 'conclusionMonitor'),
      t(language, 'conclusionRetest'),
      t(language, 'conclusionContinue')
    ];

    doc.fontSize(9).font("Helvetica").fillColor("#666666");
    steps.forEach(step => {
      doc.text(`• ${step}`, { width: 500 });
    });
  }

  /**
   * Ajouter les numéros de page
   */
  static _addPageNumbers(doc, language = 'en') {
    const pages = doc.bufferedPageRange().count;
    for (let i = 0; i < pages; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(9)
        .fillColor("#9ca3af")
        .text(`${t(language, 'footerPageOf')} ${i + 1}/${pages}`, 50, doc.page.height - 30, {
          align: "center"
        });
    }
  }

  /**
   * Ajouter un titre de section
   */
  static _addSectionTitle(doc, title, language = 'en') {
    doc.addPage();
    doc.fontSize(18).font("Helvetica-Bold").fillColor("#0f172a");
    doc.text(title, { y: 50 });

    doc
      .moveTo(50, doc.y + 10)
      .lineTo(doc.page.width - 50, doc.y + 10)
      .stroke("#3b82f6");

    doc.moveDown(15);
  }

  /**
   * Ajouter un sous-titre
   */
  static _addSubsection(doc, subtitle, language = 'en') {
    doc.moveDown(10);
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#333333");
    doc.text(subtitle);
    doc.moveDown(5);
  }

  /**
   * Dessiner une table détaillée (2 colonnes : label + valeur)
   */
  static _drawDetailTable(doc, data, columnWidths, startX, language = 'en') {
    const rowHeight = 20;
    let y = doc.y + 5;

    doc.fontSize(8).font("Helvetica").fillColor("#333333");

    data.forEach((row, i) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      let x = startX;
      
      // Colonne 1 : Label (gris)
      doc.fillColor("#666666").font("Helvetica-Bold");
      doc.rect(x, y, columnWidths[0], rowHeight).stroke("#e5e7eb");
      doc.text(String(row[0]), x + 5, y + 3, { width: columnWidths[0] - 10 });

      // Colonne 2 : Valeur
      doc.fillColor("#333333").font("Helvetica");
      doc.rect(x + columnWidths[0], y, columnWidths[1], rowHeight).stroke("#e5e7eb");
      const valueText = String(row[1] || '');
      const wrappedText = doc.heightOfString(valueText, { width: columnWidths[1] - 10 });
      doc.text(valueText, x + columnWidths[0] + 5, y + 3, { width: columnWidths[1] - 10 });

      y += rowHeight;
    });

    doc.y = y + 5;
  }

  /**
   * Dessiner une table
   */
  static _drawTable(doc, data, columnWidths, startX, language = 'en') {
    const rowHeight = 25;
    let y = doc.y + 10;

    doc.fontSize(9).font("Helvetica").fillColor("#333333");

    // En-têtes
    if (data.length > 0 && Array.isArray(data[0])) {
      let x = startX;
      data[0].forEach((cell, i) => {
        doc
          .rect(x, y, columnWidths[i], rowHeight)
          .stroke("#cccccc");
        doc.text(cell, x + 5, y + 5, { width: columnWidths[i] - 10 });
        x += columnWidths[i];
      });

      // Lignes de données
      y += rowHeight;
      for (let i = 1; i < data.length; i++) {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        let x = startX;
        data[i].forEach((cell, j) => {
          doc
            .rect(x, y, columnWidths[j], rowHeight)
            .stroke("#e5e7eb");
          doc.text(String(cell), x + 5, y + 5, { width: columnWidths[j] - 10 });
          x += columnWidths[j];
        });
        y += rowHeight;
      }
    }

    doc.y = y + 10;
  }

  /**
   * Obtenir la couleur en fonction de la sévérité
   */
  static _getSeverityColor(severity) {
    const severityMap = {
      'Critique': '#dc2626',
      'Critical': '#dc2626',
      'Élevé': '#ea580c',
      'High': '#ea580c',
      'Moyen': '#d97706',
      'Medium': '#d97706',
      'Faible': '#16a34a',
      'Low': '#16a34a',
      'Information': '#6b7280',
      'Info': '#6b7280'
    };
    return severityMap[severity] || '#6b7280';
  }

  /**
   * Obtenir le niveau de risque
   */
  static _getRiskLevel(level, language = 'en') {
    const levels = {
      critical: {
        title: t(language, 'criticalVerdictTitle'),
        description: t(language, 'criticalVerdictDesc'),
        color: '#dc2626'
      },
      high: {
        title: t(language, 'highVerdictTitle'),
        description: t(language, 'highVerdictDesc'),
        color: '#ea580c'
      },
      medium: {
        title: t(language, 'mediumVerdictTitle'),
        description: t(language, 'mediumVerdictDesc'),
        color: '#d97706'
      },
      low: {
        title: t(language, 'lowVerdictTitle'),
        description: t(language, 'lowVerdictDesc'),
        color: '#16a34a'
      }
    };
    return levels[level] || levels.low;
  }

  /**
   * Obtenir le texte du verdict
   */
  static _getVerdictText(criticalCount, highCount, language = 'en') {
    if (criticalCount > 0) {
      return t(language, 'criticalVerdictTitle');
    } else if (highCount > 0) {
      return t(language, 'highVerdictTitle');
    }
    return t(language, 'lowVerdictTitle');
  }
}

module.exports = PDFGeneratorService;
