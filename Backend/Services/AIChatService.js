// services/AIChatService.js - VERSION CORRIGÉE
const OllamaService = require('./OllamaService');

class AIChatService {
  constructor() {
    this.maxHistoryLength = 20;
    this.conversationCache = new Map();
  }

  getConversation(userId) {
    if (!this.conversationCache.has(userId)) {
      this.conversationCache.set(userId, []);
    }
    return this.conversationCache.get(userId);
  }

  addMessage(userId, role, content) {
    const conversation = this.getConversation(userId);
    conversation.push({ role, content, timestamp: new Date() });
    if (conversation.length > this.maxHistoryLength) {
      conversation.shift();
    }
    return conversation;
  }

  // ⚠️ Cette méthode n'est PAS utilisée par votre controller
  // Votre controller appelle directement OllamaService.generateStreamingResponse
  // Gardez-la pour compatibilité mais elle n'est plus critique
  async processMessage(userId, userMessage, model = null) {
    this.addMessage(userId, 'user', userMessage);
    const conversation = this.getConversation(userId);
    
    const history = conversation
      .slice(-10)
      .map(msg => ({ role: msg.role, content: msg.content }));

    const fullResponse = await OllamaService.generateResponse(
      userMessage,
      history,
      model
    );
    
    this.addMessage(userId, 'assistant', fullResponse);
    
    return {
      response: fullResponse,
      conversationLength: this.getConversation(userId).length
    };
  }

  getHistory(userId, limit = 50) {
    const conversation = this.getConversation(userId);
    return conversation.slice(-limit);
  }

  clearConversation(userId) {
    this.conversationCache.delete(userId);
  }

  validateMessage(message) {
    if (!message || typeof message !== 'string') {
      throw new Error('Message invalide');
    }
    if (message.length > 10000) {
      throw new Error('Message trop long (max 10000 caractères)');
    }
    if (message.trim().length === 0) {
      throw new Error('Message vide');
    }
    return true;
  }

  async generateConversationTitle(userId) {
    const history = this.getHistory(userId, 3);
    if (history.length === 0) {
      return 'Nouvelle conversation';
    }
    const firstMessage = history[0].content.substring(0, 100);
    const prompt = `Générer un titre court (3-5 mots) pour cette conversation:\n${firstMessage}\n\nTitre:`;
    const title = await OllamaService.generateResponse(prompt, []);
    return title.substring(0, 50).trim();
  }

  async summarizeConversation(userId) {
    const history = this.getHistory(userId, 20);
    if (history.length === 0) {
      return 'Aucune conversation';
    }
    const historyText = history
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');
    const prompt = `Résumer cette conversation en 2-3 phrases:\n\n${historyText}\n\nRésumé:`;
    return OllamaService.generateResponse(prompt, []);
  }
}

module.exports = new AIChatService();