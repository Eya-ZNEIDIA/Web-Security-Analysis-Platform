import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Send,
  Plus,
  Menu,
  X,
  Archive,
  Trash2,
  Pin,
  Download,
  Settings,
  MessageSquare,
  Loader,
  AlertCircle
} from 'lucide-react';
import ChatMessage from './ChatMessage';

/**
 * Chat - Interface principale du chat IA pour cybersécurité
 */
const Chat = () => {
  // État principal
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  
  // UI State
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedModel, setSelectedModel] = useState('mistral');
  const [availableModels, setAvailableModels] = useState([]);
  const [error, setError] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState('checking');
  
  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const token = localStorage.getItem('token');

  // Scroll automatique vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  // Charger les conversations au démarrage
  useEffect(() => {
    fetchConversations();
    checkOllamaStatus();
    
    // Créer automatiquement une nouvelle conversation au chargement si aucune n'existe
    const initConversation = async () => {
      const res = await fetch('/api/chat/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.conversations && data.conversations.length === 0) {
        await createNewConversation();
      } else if (data.conversations && data.conversations.length > 0) {
        setCurrentConversation(data.conversations[0]);
        setMessages(data.conversations[0].messages || []);
      }
    };
    
    initConversation();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/chat/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (err) {
      console.error('Erreur chargement conversations:', err);
    }
  };

  const checkOllamaStatus = async () => {
    try {
      const res = await fetch('/api/chat/test-ollama', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableModels(data.models || []);
        setSelectedModel(data.models?.[0] || 'mistral');
        setOllamaStatus('connected');
        setError('');
      } else {
        setOllamaStatus('error');
        setError('Ollama non accessible. Assurez-vous qu\'Ollama est lancé sur http://localhost:11434');
      }
    } catch (err) {
      setOllamaStatus('error');
      setError('Erreur connexion Ollama');
    }
  };

  // Créer une nouvelle conversation
  const createNewConversation = async () => {
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: 'Nouvelle conversation',
          model: selectedModel
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentConversation(data.conversation);
        setMessages([]);
        setConversations([data.conversation, ...conversations]);
        inputRef.current?.focus();
        return data.conversation;
      }
    } catch (err) {
      setError('Erreur création conversation');
      return null;
    }
  };

  // Charger une conversation
  const loadConversation = async (conversationId) => {
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentConversation(data.conversation);
        setMessages(data.conversation.messages || []);
      }
    } catch (err) {
      setError('Erreur chargement conversation');
    }
  };

  // Envoyer un message avec streaming - VERSION CORRIGÉE
  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();
    
    // Debug logs
    console.log('=== TENTATIVE ENVOI ===');
    console.log('inputMessage:', inputMessage);
    console.log('currentConversation:', currentConversation);
    console.log('ollamaStatus:', ollamaStatus);
    console.log('token:', token ? 'Présent' : 'Absent');
    
    // Validation complète
    if (!inputMessage || !inputMessage.trim()) {
      setError('Veuillez saisir un message');
      return;
    }
    
    if (!currentConversation) {
      setError('Aucune conversation active. Créez une nouvelle conversation.');
      // Tenter de créer automatiquement une conversation
      const newConv = await createNewConversation();
      if (!newConv) {
        return;
      }
      setCurrentConversation(newConv);
      // Attendre que la conversation soit créée avant de continuer
      setTimeout(() => {
        handleSendMessage(e);
      }, 500);
      return;
    }
    
    if (ollamaStatus !== 'connected') {
      setError('Ollama n\'est pas connecté. Vérifiez que le service est lancé.');
      return;
    }

    setError('');
    setIsLoading(true);
    setStreamingMessage('');

    // Sauvegarder le message
    const messageToSend = inputMessage;
    const currentConvId = currentConversation._id;

    // Ajouter le message utilisateur immédiatement
    const userMessage = {
      role: 'user',
      content: messageToSend,
      createdAt: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    try {
      console.log('Envoi du message à:', `/api/chat/conversations/${currentConvId}/messages`);
      
      const res = await fetch(
        `/api/chat/conversations/${currentConvId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            message: messageToSend,
            model: selectedModel
          })
        }
      );

      console.log('Réponse HTTP:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Erreur réponse:', errorText);
        throw new Error(`Erreur HTTP ${res.status}: ${errorText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiMessage = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        buffer += chunk;
        
        // Traiter les lignes SSE
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6);
              const data = JSON.parse(jsonStr);
              console.log('Donnée reçue:', data);

              if (data.token) {
                aiMessage += data.token;
                setStreamingMessage(aiMessage);
              }

              if (data.done) {
                if (data.response) {
                  const assistantMessage = {
                    role: 'assistant',
                    content: data.response,
                    createdAt: new Date()
                  };
                  setMessages(prev => [...prev, assistantMessage]);
                  setStreamingMessage('');
                  await fetchConversations();
                } else if (aiMessage) {
                  const assistantMessage = {
                    role: 'assistant',
                    content: aiMessage,
                    createdAt: new Date()
                  };
                  setMessages(prev => [...prev, assistantMessage]);
                  setStreamingMessage('');
                  await fetchConversations();
                }
              }

              if (data.error) {
                setError(data.error);
              }
            } catch (e) {
              console.warn('Erreur parsing JSON:', e.message, 'Ligne:', trimmedLine);
            }
          }
        }
      }
    } catch (err) {
      console.error('Erreur envoi message:', err);
      setError(`Erreur: ${err.message}`);
      // Retirer le message utilisateur si l'envoi a échoué
      setMessages(prev => prev.filter(m => m.content !== messageToSend));
    } finally {
      setIsLoading(false);
    }

    inputRef.current?.focus();
  }, [inputMessage, currentConversation, selectedModel, token, ollamaStatus]);

  // Supprimer une conversation
  const deleteConversation = async (conversationId) => {
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const newConversations = conversations.filter((c) => c._id !== conversationId);
        setConversations(newConversations);
        if (currentConversation?._id === conversationId) {
          setCurrentConversation(newConversations[0] || null);
          setMessages(newConversations[0]?.messages || []);
        }
      }
    } catch (err) {
      setError('Erreur suppression conversation');
    }
  };

  return (
    <div className="flex h-screen bg-white text-gray-900">
      {/* Sidebar */}
      <div
        className={`${
          showSidebar ? 'w-64' : 'w-0'
        } bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-200 overflow-hidden`}
      >
        {/* Nouveau chat */}
        <button
          onClick={createNewConversation}
          className="flex items-center justify-center gap-2 m-4 p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
        >
          <Plus size={18} /> Nouveau chat
        </button>

        {/* Modèle sélectionné */}
        <div className="px-4 py-2 border-b border-gray-200">
          <label className="text-xs text-gray-500 uppercase">Modèle</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full mt-1 bg-white text-gray-900 text-sm px-2 py-1 rounded border border-gray-300 focus:border-green-500 focus:outline-none"
          >
            {availableModels.length === 0 ? (
              <option value="mistral">mistral (par défaut)</option>
            ) : (
              availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2">
            <p className="text-xs text-gray-500 uppercase mb-2">Conversations</p>
            {conversations.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Aucune conversation</p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv._id}
                  onClick={() => loadConversation(conv._id)}
                  className={`p-2 mb-2 rounded cursor-pointer flex items-center justify-between group ${
                    currentConversation?._id === conv._id
                      ? 'bg-green-100 border border-green-300'
                      : 'bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate text-gray-900">{conv.title}</p>
                    <p className="text-xs text-gray-500">
                      {conv.messageCount || conv.messages?.length || 0} messages
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv._id);
                      }}
                      className="p-1 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-gray-100 rounded text-gray-600"
            >
              {showSidebar ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900"> AI Security Assistant</h1>
              <p className="text-sm text-gray-500">Expert Cybersécurité</p>
            </div>
          </div>

          {/* Status Ollama */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                ollamaStatus === 'connected'
                  ? 'bg-green-500'
                  : ollamaStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-yellow-500 animate-pulse'
              }`}
            ></div>
            <span className="text-xs text-gray-500">
              {ollamaStatus === 'connected'
                ? 'Ollama connecté'
                : ollamaStatus === 'error'
                ? 'Erreur Ollama'
                : 'Connexion...'}
            </span>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {!currentConversation ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageSquare size={48} className="mb-4 opacity-50" />
              <p>Créez une nouvelle conversation pour commencer</p>
              <button
                onClick={createNewConversation}
                className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition"
              >
                Nouveau chat
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2 text-gray-700">Bienvenue dans AI Security Assistant</p>
                <p className="text-sm text-gray-500">Posez vos questions sur la cybersécurité, les vulnérabilités, OWASP, pentest...</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <ChatMessage key={idx} message={msg} isStreaming={false} />
              ))}
              {streamingMessage && (
                <ChatMessage
                  message={{ role: 'assistant', content: streamingMessage }}
                  isStreaming={true}
                />
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Erreur */}
        {error && (
          <div className="mx-6 mb-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            {error}
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="p-6 border-t border-gray-200 bg-white">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Posez votre question sur la cybersécurité..."
              className="flex-1 bg-gray-50 text-gray-900 px-4 py-3 rounded-lg border border-gray-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50 placeholder-gray-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center gap-2"
            >
              {isLoading ? (
                <Loader size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
          {ollamaStatus !== 'connected' && (
            <p className="text-xs text-red-500 mt-2">
               Ollama n'est pas connecté. Vérifiez qu'il est lancé avec `ollama serve`
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;