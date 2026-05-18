const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    tokens: { type: Number, default: 0 },
    model: { type: String, default: 'mistral' }
  },
  { timestamps: true }
);

const ChatConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: 'Nouvelle conversation' },
    messages: { type: [ChatMessageSchema], default: [] },
    
    // Métadonnées
    model: { type: String, default: 'mistral' },
    totalTokens: { type: Number, default: 0 },
    temperature: { type: Number, default: 0.7 },
    
    // Contexte audit
    relatedAuditId: { type: mongoose.Schema.Types.ObjectId, ref: 'Audit', default: null },
    auditContext: { type: mongoose.Schema.Types.Mixed, default: null },
    
    // État
    isArchived: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    
    // Stats
    messageCount: { type: Number, default: 0 },
    firstMessageAt: { type: Date, default: Date.now },
    lastMessageAt: { type: Date, default: Date.now }
  },
  { 
    timestamps: true 
  }
);

// Index pour performance
ChatConversationSchema.index({ userId: 1, createdAt: -1 });
ChatConversationSchema.index({ userId: 1, isPinned: -1, lastMessageAt: -1 });
ChatConversationSchema.index({ relatedAuditId: 1 });

// PAS DE MIDDLEWARE pre-save pour éviter l'erreur

module.exports = mongoose.model('ChatConversation', ChatConversationSchema);