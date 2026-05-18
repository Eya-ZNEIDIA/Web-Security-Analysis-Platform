const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const chatController = require('../controllers/chatController');

// Test Ollama
router.get('/test-ollama', protect, chatController.testOllama);

// Modèles disponibles
router.get('/models', protect, chatController.getAvailableModels);

// Conversations
router.get('/conversations', protect, chatController.getConversations);
router.post('/conversations', protect, chatController.createConversation);
router.get('/conversations/:conversationId', protect, chatController.getConversation);
router.put('/conversations/:conversationId', protect, chatController.updateConversation);
router.delete('/conversations/:conversationId', protect, chatController.deleteConversation);

// Messages (streaming)
router.post('/conversations/:conversationId/messages', protect, chatController.sendMessage);

// Analyse audit
router.post('/analyze-audit', protect, chatController.analyzeAudit);

// Résumé
router.post('/summarize', protect, chatController.summarizeConversation);

module.exports = router;
