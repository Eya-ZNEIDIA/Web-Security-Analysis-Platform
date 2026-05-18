# Système de Génération de Rapports PDF - Guide Complet

## 📋 Vue d'ensemble

Le système de génération de rapports PDF a été complètement amélioré pour fournir des rapports professionnels, détaillés et structurés en cybersécurité/pentest.

### ✨ Caractéristiques principales

- ✅ **Design moderne et professionnel** - Style cybersécurité/pentest
- ✅ **Page de couverture dynamique** - Logo, score, risque, verdict
- ✅ **Contenu complet** - Toutes les données du rapport frontend
- ✅ **Analyse des headers HTTP** - Présents + absents avec risques
- ✅ **Vulnérabilités détaillées** - Endpoint, payload, preuve, recommandations
- ✅ **Couleurs par sévérité** - Visual hierarchy claire
- ✅ **Tableaux stylisés** - Statistiques et métriques formatées
- ✅ **Numérotation des pages** - Professionnalisme
- ✅ **Timeline de l'audit** - Phases et événements

---

## 📁 Structure des fichiers

### Services créés

```
Backend/
├── services/
│   ├── HeaderAnalysisService.js          # Analyse des headers HTTP
│   ├── PDFGeneratorService.js            # Génération des PDF
│   └── [autres services existants]
│
├── controllers/
│   └── rapportController.js              # Contrôleur mis à jour avec PDF
│
├── routes/
│   └── rapportRoutes.js                  # Routes PDF ajoutées
│
├── scripts/
│   └── generatePDFExample.js             # Exemple de génération
│
└── uploads/
    └── pdfs/                             # Dossier de sortie (auto-créé)
```

---

## 🔌 Services disponibles

### 1. HeaderAnalysisService

Analyse les en-têtes de sécurité HTTP.

#### Baseline d'en-têtes de sécurité

Le service inclut une baseline de 8 en-têtes de sécurité standards:

1. **Strict-Transport-Security (HSTS)** - Sécurité du transport
2. **Content-Security-Policy (CSP)** - Prévention des injections
3. **X-Frame-Options** - Protection clickjacking
4. **X-Content-Type-Options** - Prévention MIME-sniffing
5. **Referrer-Policy** - Divulgation d'informations
6. **Permissions-Policy** - Contrôle des fonctionnalités
7. **X-XSS-Protection** - Protection XSS (legacy)
8. **X-Permitted-Cross-Domain-Policies** - Politiques cross-domain

#### Utilisation

```javascript
const HeaderAnalysisService = require("./services/HeaderAnalysisService");

// Analyser les headers
const analysis = HeaderAnalysisService.analyzeHeaders(headersData);

// Résultats
console.log(analysis.stats.complianceScore);    // 75 (%)
console.log(analysis.present.length);           // Headers présents
console.log(analysis.absent.length);            // Headers manquants
console.log(analysis.stats.criticalMissing);    // Critiques manquants
```

#### Méthodes disponibles

```javascript
// Analyse complète
HeaderAnalysisService.analyzeHeaders(headersRaw)

// Grouper par catégorie
HeaderAnalysisService.getHeadersByCategory(analysis)

// Résumé textuel
HeaderAnalysisService.generateHeadersSummary(analysis)

// Score de sécurité (0-100)
HeaderAnalysisService.calculateSecurityScore(analysis)
```

---

### 2. PDFGeneratorService

Génère des rapports PDF complets.

#### Sections du rapport

1. **Page de couverture** - Titre, cible, date, score, risque
2. **Table des matières** - Navigation
3. **Résumé exécutif** - Statistiques clés, répartition par sévérité
4. **Analyse globale** - Informations d'audit, métriques, score détaillé
5. **Analyse des headers** - Score de conformité, headers présents/absents
6. **Vulnérabilités** - Détails complets de chaque vulnérabilité
7. **Recommandations** - Triées par sévérité (Critique/Élevé/Moyen)
8. **Timeline** - Phases d'audit et événements
9. **Conclusion** - Verdict et prochaines étapes

#### Utilisation

```javascript
const PDFGeneratorService = require("./services/PDFGeneratorService");

await PDFGeneratorService.generateFullReport(
  auditData,        // Données de l'audit
  reportData,       // Données du rapport
  vulnerabilities,  // Tableau de vulnérabilités
  outputPath        // Chemin du fichier PDF
);
```

#### Structure des données

```javascript
// auditData
{
  urlCible: "https://example.com",
  date: Date,
  statut: "terminé",
  intensity: "medium",
  headers: [Array] // Headers HTTP
}

// reportData
{
  scoreGlobal: 75,
  durationMs: 15000,
  ai_model: "llama3.1",
  ai_prompt_version: "v2.0",
  risk_breakdown: { critical: 0, high: 2, medium: 5, low: 8, info: 3 },
  statistics: {
    total_endpoints: 24,
    total_requests: 342,
    total_payloads: 156,
    total_vulnerabilities: 18,
    true_positives: 18,
    suppressed_false_positives: 14,
    avg_confidence: 0.87,
    avg_cvss: 5.2
  },
  timeline: [Array], // Timeline des phases
  recommendations: [Array]
}

// vulnerabilities
[
  {
    severity: "high",
    type: "SQL Injection",
    description: "...",
    endpoint: "/api/users",
    method: "GET",
    parameter: "id",
    payload: "' OR '1'='1",
    evidence: "...",
    owasp_category: "A03:2021-Injection",
    cwe: "CWE-89",
    cvss_score: 7.5,
    ai_confidence: 0.92,
    fix_recommendation: "...",
    secure_code_example: "...",
    business_impact: "...",
    reproduction_steps: [...],
    detection_source: "hybrid"
  }
  // ...
]
```

---

## 🌐 Endpoints API

### 1. Télécharger le PDF

**Endpoint:** `GET /api/rapports/:id/download-pdf`

**Authentification:** Bearer token (required)

**Description:** Génère et télécharge le PDF du rapport

**Réponse:** Fichier PDF

**Exemple cURL:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/rapports/123/download-pdf \
  -o rapport.pdf
```

### 2. Obtenir l'URL du PDF

**Endpoint:** `GET /api/rapports/:id/pdf-url`

**Authentification:** Bearer token (required)

**Description:** Génère le PDF et retourne son URL

**Réponse JSON:**
```json
{
  "success": true,
  "pdfUrl": "/uploads/pdfs/rapport-audit-1716367234.pdf",
  "fileName": "rapport-audit-1716367234.pdf",
  "timestamp": 1716367234
}
```

**Exemple cURL:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/rapports/123/pdf-url
```

### 3. Récupérer le rapport JSON (existant)

**Endpoint:** `GET /api/rapports/:id`

**Réponse:** Données du rapport (JSON)

---

## 🧪 Exemple de test

### Exécuter le script de test

```bash
# Depuis le dossier Backend
node scripts/generatePDFExample.js
```

Cela générera un fichier `test-rapport.pdf` dans le dossier courant.

### Exemple de code

```javascript
const PDFGeneratorService = require("./services/PDFGeneratorService");
const Rapport = require("./models/Rapport");
const Audit = require("./models/Audit");

async function generateReportPDF(auditId) {
  try {
    // Récupérer les données
    const audit = await Audit.findById(auditId);
    const rapport = await Rapport.findById(audit.rapport)
      .populate("vulnerabilites");

    // Générer le PDF
    await PDFGeneratorService.generateFullReport(
      {
        urlCible: audit.urlCible,
        date: audit.date,
        statut: audit.statut,
        intensity: audit.intensity,
        headers: audit.headers || []
      },
      {
        scoreGlobal: rapport.scoreGlobal,
        durationMs: rapport.durationMs,
        ai_model: rapport.ai_model,
        ai_prompt_version: rapport.ai_prompt_version,
        risk_breakdown: rapport.risk_breakdown,
        statistics: rapport.statistics,
        timeline: rapport.timeline,
        recommendations: rapport.recommendations
      },
      rapport.vulnerabilites || [],
      "./mon-rapport.pdf"
    );

    console.log("✅ Rapport généré!");
  } catch (err) {
    console.error("❌ Erreur:", err);
  }
}
```

---

## 🎨 Personnalisation

### Couleurs par sévérité

```javascript
CRITICAL: #dc2626 (rouge)
HIGH:     #ea580c (orange)
MEDIUM:   #d97706 (jaune)
LOW:      #16a34a (vert)
INFO:     #6b7280 (gris)
```

### Thème couleurs

```javascript
Primary:   #0f172a (bleu foncé)
Accent:    #3b82f6 (bleu)
Text:      #374151 (gris foncé)
Border:    #e5e7eb (gris clair)
```

---

## 📊 Contenu détaillé du PDF

### Page de couverture
- Logo/Titre
- Cible auditée
- Date du rapport
- Score global (0-100)
- Niveau de risque
- Verdict de sécurité

### Résumé exécutif
- Statistiques clés (endpoints, requêtes, payloads)
- Répartition par sévérité
- Score de confiance IA
- Faux positifs supprimés

### Analyse des headers HTTP
- Score de conformité (%)
- Headers présents avec catégories
- Headers manquants avec:
  - Sévérité (Critical/High/Medium/Low)
  - Risque associé
  - Impact potentiel
  - Recommandation de remédiation

### Vulnérabilités
Pour chaque vulnérabilité:
- Sévérité et ID unique
- Type et titre
- Description technique
- Endpoint HTTP (méthode, URL, paramètre)
- Payload utilisé
- Preuve/Évidence
- Classification (OWASP, CWE)
- Score CVSS
- Confiance IA
- Recommandations de correction
- Code d'exemple sécurisé
- Impact métier

### Recommandations
- Triées par sévérité
- Actions immédiatement requises (Critique)
- Actions prioritaires (Élevé)
- Actions recommandées (Moyen)

---

## ⚙️ Configuration

### Variables d'environnement

```env
# Backend/.env
NODE_ENV=production
PORT=3000
OLLAMA_MODEL=llama3.1
```

### Dossiers

```
Backend/uploads/pdfs/    # Génération des PDF
```

Les PDFs sont auto-supprimés:
- **Téléchargement direct:** 30 secondes après l'envoi
- **Génération d'URL:** 1 heure après la création

---

## 🔧 Dépannage

### Le PDF ne se génère pas

1. ✅ Vérifier que le dossier `uploads/pdfs/` existe
2. ✅ Vérifier les permissions de lecture/écriture
3. ✅ Vérifier que `pdfkit` est installé
4. ✅ Vérifier les logs du serveur

### Les données sont incomplètes

1. ✅ S'assurer que le rapport est complètement peuplé
2. ✅ Vérifier que les vulnérabilités sont populées
3. ✅ Vérifier que l'audit est lié au rapport

### Les headers ne s'affichent pas

1. ✅ Vérifier que `auditData.headers` est défini
2. ✅ Vérifier le format des headers (Array ou Object)

---

## 📝 Notes

- Les PDFs sont générés à la demande (pas de cache)
- Les fichiers temporaires sont auto-supprimés
- Compatible avec tous les détails d'audit existants
- Support complet des formats de vulnérabilités (anciens et nouveaux)

---

## 📞 Support

Pour toute question ou problème, consultez:
- `Backend/services/PDFGeneratorService.js` - Génération
- `Backend/services/HeaderAnalysisService.js` - Analyse des headers
- `Backend/controllers/rapportController.js` - Routes API
- `Backend/scripts/generatePDFExample.js` - Exemple d'utilisation
