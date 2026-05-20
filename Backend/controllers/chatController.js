// controllers/chatController.js - CORRIGÉ POUR VOTRE MODÈLE

const ChatConversation = require('../models/Chat'); // Assurez-vous que le chemin est correct
const Audit = require('../models/Audit');
const Vulnerabilite = require('../models/Vulnerabilite');
const AIChatService = require('../services/AIChatService');
const OllamaService = require('../services/OllamaService');

// ─── Audit context detection ───────────────────────────────────────────────────

const AUDIT_KEYWORDS = [
  'audit', 'scan', 'vulnerability', 'vulnerabilit', 'vulnérabilit',
  'xss', 'sql injection', 'sqli', 'csrf', 'ssrf', 'rce',
  'injection', 'cross-site', 'header', 'cookie', 'session',
  'owasp', 'cwe', 'cvss', 'endpoint', 'payload',
  'critical', 'high', 'medium', 'low',
  'rapport', 'report', 'score', 'risque', 'risk',
  'sécurité', 'security', 'faille', 'breach'
];

/**
 * Detects if a user message is asking about their audit data
 */
function isAuditRelatedQuery(message) {
  const lower = message.toLowerCase();
  return AUDIT_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Fetches relevant audit context for the user based on their message.
 * When a specific vuln type is mentioned (e.g. IDOR, XSS), searches
 * ALL user vulnerabilities first, then resolves the related audits.
 */
async function fetchAuditContext(userId, message) {
  const lower = message.toLowerCase();

  // If the user mentions a specific vulnerability type, search vulns first across ALL audits
  const vulnTypes = ['xss', 'sql injection', 'sqli', 'csrf', 'ssrf', 'rce', 'injection', 'open redirect', 'idor'];
  const mentionedType = vulnTypes.find(t => lower.includes(t));

  if (mentionedType) {
    // Strategy: search vulnerabilities directly, then resolve audits
    console.log(`[AuditContext] Specific type "${mentionedType}" detected for userId: ${userId}, searching all user vulns...`);

    // Get ALL audit IDs for this user
    const userAuditIds = await Audit.find({ userId }).distinct('_id');
    if (!userAuditIds || userAuditIds.length === 0) return null;

    const typeRegex = new RegExp(mentionedType, 'i');
    const vulnFilter = {
      auditId: { $in: userAuditIds },
      $or: [
        { type: typeRegex },
        { technique: typeRegex },
        { owasp_category: typeRegex },
        { description: typeRegex },
        { category: typeRegex }
      ]
    };

    const vulnerabilities = await Vulnerabilite.find(vulnFilter)
      .sort({ detected_at: -1 })
      .limit(20)
      .lean();

    console.log(`[AuditContext] Found ${vulnerabilities.length} "${mentionedType}" vulnerabilities across ${userAuditIds.length} audits`);

    if (vulnerabilities.length === 0) {
      // No vulns of this type — still return audit summary so bot can say "none found"
      const recentAudits = await Audit.find({ userId }).sort({ date: -1 }).limit(5).lean();
      return {
        audits: recentAudits.map(a => ({
          id: a._id.toString(), url: a.urlCible, date: a.date,
          score: a.scoreGlobal, status: a.statut,
          totalVulnerabilities: a.totalVulnerabilities, intensity: a.intensity
        })),
        vulnerabilities: []
      };
    }

    // Resolve the affected audits
    const affectedAuditIds = [...new Set(vulnerabilities.map(v => v.auditId?.toString()))];
    const relevantAudits = await Audit.find({ _id: { $in: affectedAuditIds }, userId }).lean();

    const auditSummaries = relevantAudits.map(a => ({
      id: a._id.toString(),
      url: a.urlCible,
      date: a.date,
      score: a.scoreGlobal,
      status: a.statut,
      totalVulnerabilities: a.totalVulnerabilities,
      intensity: a.intensity
    }));

    const vulnSummaries = vulnerabilities.map(v => ({
      auditId: v.auditId?.toString(),
      type: v.type,
      severity: v.severity || v.niveauRisque,
      endpoint: v.endpoint,
      description: v.description,
      technique: v.technique,
      owasp: v.owasp_category,
      cwe: v.cwe,
      cvss: v.cvss_score,
      payload: v.payload,
      fix: v.fix_recommendation || v.recommandation
    }));

    return { audits: auditSummaries, vulnerabilities: vulnSummaries };
  }

  // General audit query (no specific type) — fetch recent audits + all their vulns
  const audits = await Audit.find({ userId })
    .sort({ date: -1 })
    .limit(10)
    .lean();

  console.log(`[AuditContext] Found ${audits?.length || 0} audits for user ${userId}`);

  if (!audits || audits.length === 0) return null;

  const auditIds = audits.map(a => a._id);
  const vulnerabilities = await Vulnerabilite.find({ auditId: { $in: auditIds } })
    .sort({ detected_at: -1 })
    .limit(20)
    .lean();

  console.log(`[AuditContext] Found ${vulnerabilities.length} vulnerabilities (general query)`);

  const auditSummaries = audits.map(a => ({
    id: a._id.toString(),
    url: a.urlCible,
    date: a.date,
    score: a.scoreGlobal,
    status: a.statut,
    totalVulnerabilities: a.totalVulnerabilities,
    intensity: a.intensity
  }));

  const vulnSummaries = vulnerabilities.map(v => ({
    auditId: v.auditId?.toString(),
    type: v.type,
    severity: v.severity || v.niveauRisque,
    endpoint: v.endpoint,
    description: v.description,
    technique: v.technique,
    owasp: v.owasp_category,
    cwe: v.cwe,
    cvss: v.cvss_score,
    payload: v.payload,
    fix: v.fix_recommendation || v.recommandation
  }));

  return { audits: auditSummaries, vulnerabilities: vulnSummaries };
}

/**
 * Builds a context prompt to inject audit data into the conversation
 */
function buildAuditContextPrompt(auditData) {
  if (!auditData) return '';

  if (auditData.vulnerabilities.length === 0) {
    return "Aucun audit ne contient ce type de vulnérabilité.";
  }

  // Group vulnerabilities by audit URL + date
  const auditMap = new Map();
  for (const audit of auditData.audits) {
    auditMap.set(audit.id, { url: audit.url, date: new Date(audit.date).toLocaleDateString('fr-FR') });
  }

  // Build a flat table: URL | Date | Endpoint
  const rows = [];
  for (const vuln of auditData.vulnerabilities) {
    const audit = auditMap.get(vuln.auditId);
    rows.push({
      url: audit?.url || 'N/A',
      date: audit?.date || 'N/A',
      endpoint: vuln.endpoint || 'N/A'
    });
  }

  // Deduplicate rows
  const seen = new Set();
  const uniqueRows = rows.filter(r => {
    const key = `${r.url}|${r.date}|${r.endpoint}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let response = `Voici les audits contenant cette vulnérabilité :\n\n`;
  response += `| URL | Date | Endpoint |\n`;
  response += `|-----|------|----------|\n`;
  for (const r of uniqueRows) {
    response += `| ${r.url} | ${r.date} | ${r.endpoint} |\n`;
  }

  return response;
}

/**
 * Builds a strict system prompt for audit-related queries.
 * This overrides the default cybersecurity expert prompt so the model
 * ONLY responds with the user's real audit data from the DB.
 */
function buildAuditSystemPrompt() {
  return `Tu es un assistant qui retourne des données d'audit. Tes réponses doivent être UNIQUEMENT le tableau Markdown fourni dans les données, sans aucun texte avant ou après.

RÈGLES:
- Copie EXACTEMENT le tableau (URL, Date, Endpoint) fourni dans les données.
- N'ajoute RIEN d'autre : pas d'introduction, pas d'explication, pas de conseil, pas de commentaire.
- Si les données indiquent "AUCUNE VULNÉRABILITÉ", réponds uniquement : "Aucun audit ne contient ce type de vulnérabilité."
- Réponds en français.`;
}

/**
 * GET /api/chat/models
 * Récupère les modèles disponibles dans Ollama
 */
exports.getAvailableModels = async (req, res) => {
  try {
    const models = await OllamaService.getAvailableModels();
    res.json({
      success: true,
      models: models.map(m => m.name || m),
      default: process.env.OLLAMA_MODEL || 'mistral'
    });
  } catch (err) {
    console.error('Erreur récupération modèles:', err);
    res.status(500).json({
      success: false,
      error: 'Impossible de récupérer les modèles',
      message: err.message
    });
  }
};

/**
 * GET /api/chat/conversations
 * Liste les conversations de l'utilisateur
 */
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { archived = false, limit = 50, skip = 0 } = req.query;

    console.log('Récupération conversations pour userId:', userId);

    const filter = {
      userId,
      isArchived: archived === 'true'
    };

    const conversations = await ChatConversation.find(filter)
      .select('_id title model messageCount isPinned createdAt lastMessageAt')
      .sort({ isPinned: -1, lastMessageAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await ChatConversation.countDocuments(filter);

    res.json({
      success: true,
      conversations,
      total,
      hasMore: skip + conversations.length < total
    });
  } catch (err) {
    console.error('Erreur récupération conversations:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

/**
 * POST /api/chat/conversations
 * Crée une nouvelle conversation
 */
/**
 * POST /api/chat/conversations
 * Crée une nouvelle conversation - VERSION SIMPLIFIÉE
 */
exports.createConversation = async (req, res) => {
  try {
    console.log('=== CRÉATION CONVERSATION ===');
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false,
        error: 'Utilisateur non authentifié' 
      });
    }

    const userId = req.user.id;
    const { title, model } = req.body;

    // Création TRÈS SIMPLE
    const conversation = new ChatConversation({
      userId: userId,
      title: title || 'Nouvelle conversation',
      model: model || 'mistral',
      messages: []
    });

    console.log('Sauvegarde en cours...');
    await conversation.save();
    console.log('Sauvegarde réussie, ID:', conversation._id);

    res.status(201).json({
      success: true,
      conversation: {
        _id: conversation._id,
        title: conversation.title,
        model: conversation.model,
        messageCount: 0,
        isPinned: false,
        isArchived: false,
        createdAt: conversation.createdAt,
        lastMessageAt: conversation.lastMessageAt,
        messages: []
      }
    });
  } catch (err) {
    console.error('ERREUR DÉTAILLÉE:', err);
    console.error('STACK:', err.stack);
    
    res.status(500).json({ 
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

/**
 * GET /api/chat/conversations/:conversationId
 * Récupère une conversation complète
 */
exports.getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    console.log('Récupération conversation:', conversationId);

    const conversation = await ChatConversation.findOne({
      _id: conversationId,
      userId
    });

    if (!conversation) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation non trouvée' 
      });
    }

    res.json({
      success: true,
      conversation
    });
  } catch (err) {
    console.error('Erreur récupération conversation:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

/**
 * POST /api/chat/conversations/:conversationId/messages
 * Ajoute un message et récupère la réponse IA
 */
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { message, model } = req.body;
    const userId = req.user.id;

    console.log('=== ENVOI MESSAGE ===');
    console.log('conversationId:', conversationId);
    console.log('message:', message?.substring(0, 50));
    console.log('userId:', userId);

    // Validation
    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Message requis' 
      });
    }

    // Récupérer la conversation
    let conversation = await ChatConversation.findOne({
      _id: conversationId,
      userId
    });

    if (!conversation) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation non trouvée' 
      });
    }

    // Ajouter le message utilisateur
    conversation.messages.push({
      role: 'user',
      content: message,
      model: model || conversation.model,
      tokens: message.split(/\s+/).length
    });

    // Mettre à jour les stats
    conversation.messageCount = conversation.messages.length;
    conversation.lastMessageAt = new Date();

    await conversation.save();

    // ─── Audit context injection ─────────────────────────────
    let enrichedMessage = message;
    let auditDirectResponse = null;

    if (isAuditRelatedQuery(message)) {
      console.log('[Chat] Audit-related query detected, fetching context...');
      try {
        const auditData = await fetchAuditContext(userId, message);
        if (auditData) {
          auditDirectResponse = buildAuditContextPrompt(auditData);
          console.log(`[Chat] Direct audit response built: ${auditData.audits.length} audits, ${auditData.vulnerabilities.length} vulns`);
        } else {
          auditDirectResponse = "Vous n'avez pas encore d'audits dans le système. Lancez d'abord un audit pour pouvoir consulter vos données.";
        }
      } catch (ctxErr) {
        console.error('[Chat] Error fetching audit context:', ctxErr.message);
      }
    }
    // ─── End audit context ───────────────────────────────────────────────

    // Configurer le streaming SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    let aiResponse = '';
    let tokenCount = 0;

    try {
      // If audit data found, return it DIRECTLY (bypass Ollama — the model ignores context)
      if (auditDirectResponse) {
        aiResponse = auditDirectResponse;
        tokenCount = aiResponse.split(/\s+/).length;
        // Stream the response token by token for consistent UX
        const words = aiResponse.split(' ');
        for (const word of words) {
          const token = word + ' ';
          res.write(`data: ${JSON.stringify({ token, done: false })}\n\n`);
        }
      } else {
        // Normal flow — use Ollama for non-audit queries
        const history = conversation.messages.slice(-10).map((msg) => ({
          role: msg.role,
          content: msg.content
        }));

        await OllamaService.generateStreamingResponse(
          enrichedMessage,
          history.slice(0, -1),
          model || conversation.model,
          (token) => {
            aiResponse += token;
            tokenCount++;
            res.write(`data: ${JSON.stringify({ token, done: false })}\n\n`);
          }
        );
      }

      // Ajouter la réponse IA à la conversation
      conversation.messages.push({
        role: 'assistant',
        content: aiResponse,
        model: model || conversation.model,
        tokens: tokenCount
      });

      conversation.messageCount = conversation.messages.length;
      conversation.totalTokens = (conversation.totalTokens || 0) + tokenCount;

      // Générer un titre automatique si c'est le premier message
      if (conversation.messages.length === 2 && conversation.title === 'Nouvelle conversation') {
        const firstMessage = conversation.messages[0]?.content?.substring(0, 50);
        if (firstMessage) {
          conversation.title = firstMessage.length > 40 ? firstMessage.substring(0, 40) + '...' : firstMessage;
        }
      }

      await conversation.save();

      // Envoyer la fin du streaming
      res.write(`data: ${JSON.stringify({ 
        done: true, 
        response: aiResponse,
        conversationId: conversation._id 
      })}\n\n`);
      res.end();

    } catch (streamErr) {
      console.error('Erreur streaming:', streamErr);
      res.write(`data: ${JSON.stringify({ 
        error: streamErr.message, 
        done: true 
      })}\n\n`);
      res.end();
    }
  } catch (err) {
    console.error('Erreur sendMessage:', err);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: err.message 
      });
    } else {
      res.end();
    }
  }
};

/**
 * DELETE /api/chat/conversations/:conversationId
 * Supprime une conversation
 */
exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const result = await ChatConversation.findOneAndDelete({
      _id: conversationId,
      userId
    });

    if (!result) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation non trouvée' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Conversation supprimée' 
    });
  } catch (err) {
    console.error('Erreur suppression conversation:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

/**
 * PUT /api/chat/conversations/:conversationId
 * Met à jour une conversation
 */
exports.updateConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { title, isArchived, isPinned } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (isArchived !== undefined) updateData.isArchived = isArchived;
    if (isPinned !== undefined) updateData.isPinned = isPinned;

    const conversation = await ChatConversation.findOneAndUpdate(
      { _id: conversationId, userId },
      updateData,
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation non trouvée' 
      });
    }

    res.json({ 
      success: true, 
      conversation 
    });
  } catch (err) {
    console.error('Erreur update conversation:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

/**
 * GET /api/chat/test-ollama
 * Teste la connexion Ollama
 */
exports.testOllama = async (req, res) => {
  try {
    await OllamaService.testConnection();
    const models = await OllamaService.getAvailableModels();

    res.json({
      success: true,
      status: 'Ollama connecté',
      modelsCount: models.length,
      models: models.map((m) => m.name || m)
    });
  } catch (err) {
    console.error('Erreur test Ollama:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      hint: 'Assurez-vous qu\'Ollama est lancé sur http://localhost:11434'
    });
  }
};

/**
 * POST /api/chat/analyze-audit
 * Analyse un audit avec IA
 */
exports.analyzeAudit = async (req, res) => {
  try {
    const userId = req.user.id;
    const { auditId } = req.body;

    const audit = await Audit.findById(auditId).lean();

    if (!audit) {
      return res.status(404).json({ 
        success: false,
        error: 'Audit non trouvé' 
      });
    }

    const conversation = new ChatConversation({
      userId,
      title: `Audit - ${audit.urlCible || 'analyse'}`,
      relatedAuditId: auditId,
      messages: [],
      auditContext: {
        url: audit.urlCible,
        score: audit.scoreGlobal,
        vulnerabilitiesCount: audit.vulnerabilitiesCount
      }
    });

    const analysis = await OllamaService.analyzeSecurityReport({
      url: audit.urlCible,
      score: audit.scoreGlobal,
      vulnerabilities: audit.totalVulnerabilities
    });

    conversation.messages.push({
      role: 'assistant',
      content: analysis,
      tokens: analysis.split(/\s+/).length
    });

    conversation.messageCount = conversation.messages.length;
    conversation.totalTokens = analysis.split(/\s+/).length;

    await conversation.save();

    res.json({
      success: true,
      conversation,
      analysis
    });
  } catch (err) {
    console.error('Erreur analyzeAudit:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

/**
 * POST /api/chat/summarize
 * Résumé d'une conversation
 */
exports.summarizeConversation = async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.id;

    const conversation = await ChatConversation.findOne({
      _id: conversationId,
      userId
    });

    if (!conversation) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation non trouvée' 
      });
    }

    const summary = await AIChatService.summarizeConversation(userId);

    res.json({
      success: true,
      summary,
      messageCount: conversation.messages.length
    });
  } catch (err) {
    console.error('Erreur summarize:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};