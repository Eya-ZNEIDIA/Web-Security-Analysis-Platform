/**
 * OllamaService - Intégration avec Ollama local
 * Gère la communication avec Ollama pour les réponses IA
 * VERSION CORRIGÉE - Streaming fonctionnel
 */

const http = require('http');
const url = require('url');

class OllamaService {
  constructor() {
    this.ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || 'ollama';
    this.timeout = parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10);
  }

  /**
   * Teste la connexion à Ollama
   */
  async testConnection() {
    try {
      const response = await this._makeRequest('/api/tags', 'GET');
      return response;
    } catch (err) {
      throw new Error(`Ollama non accessible: ${err.message}`);
    }
  }

  /**
   * Récupère la liste des modèles disponibles
   */
  async getAvailableModels() {
    try {
      const response = await this._makeRequest('/api/tags', 'GET');
      return response?.models || [];
    } catch (err) {
      console.error('Erreur récupération modèles:', err.message);
      return [];
    }
  }

  /**
   * Streaming des réponses IA - VERSION CORRIGÉE
   * @param {string} prompt - Question utilisateur
   * @param {Array} conversationHistory - Historique conversation
   * @param {string} model - Modèle à utiliser
   * @param {Function} onToken - Callback pour chaque token
   * @returns {Promise<string>} Réponse complète
   */
  async generateStreamingResponse(
    prompt,
    conversationHistory = [],
    model = this.defaultModel,
    onToken = null
  ) {
    try {
      // Construire le prompt complet avec contexte
      const messages = this._buildMessages(prompt, conversationHistory);
      
      let fullResponse = '';
      let errorOccurred = null;

      return new Promise((resolve, reject) => {
        const requestData = JSON.stringify({
          model: model,
          messages: messages,
          stream: true,
          temperature: 0.7,
          top_p: 0.95,
          top_k: 40,
          num_predict: 2048
        });

        // Parser l'URL
        const parsedUrl = url.parse(`${this.ollamaHost}/api/chat`);
        
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 11434,
          path: parsedUrl.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData)
          },
          timeout: this.timeout
        };

        const req = http.request(options, (res) => {
          let buffer = '';

          res.on('data', (chunk) => {
            buffer += chunk.toString();
            
            // Traiter les lignes complètes
            let lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Garder la dernière ligne incomplète

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine) {
                try {
                  const json = JSON.parse(trimmedLine);
                  
                  // Vérifier si c'est un message valide
                  if (json.message && json.message.content) {
                    const token = json.message.content;
                    fullResponse += token;
                    if (onToken && typeof onToken === 'function') {
                      onToken(token);
                    }
                  }
                  
                  // Vérifier les erreurs
                  if (json.error) {
                    errorOccurred = json.error;
                    reject(new Error(json.error));
                  }
                  
                } catch (e) {
                  // Ignorer les erreurs de parsing JSON partiel
                  if (process.env.NODE_ENV === 'development') {
                    console.debug('Parse error (normal pour streaming):', e.message);
                  }
                }
              }
            }
          });

          res.on('end', () => {
            // Traiter le dernier buffer
            if (buffer.trim()) {
              try {
                const json = JSON.parse(buffer);
                if (json.message && json.message.content) {
                  const token = json.message.content;
                  fullResponse += token;
                  if (onToken && typeof onToken === 'function') {
                    onToken(token);
                  }
                }
              } catch (e) {
                // Ignorer
              }
            }
            
            if (fullResponse.length === 0 && !errorOccurred) {
              reject(new Error('Aucune réponse générée par Ollama'));
            } else {
              resolve(fullResponse);
            }
          });

          res.on('error', (err) => {
            reject(new Error(`Erreur réponse: ${err.message}`));
          });
        });

        req.on('error', (err) => {
          reject(new Error(`Erreur requête: ${err.message}`));
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error(`Timeout après ${this.timeout}ms`));
        });

        req.write(requestData);
        req.end();
      });
    } catch (err) {
      throw new Error(`Erreur génération réponse: ${err.message}`);
    }
  }

  /**
   * Génère une réponse simple (non-streaming)
   */
  async generateResponse(
    prompt,
    conversationHistory = [],
    model = this.defaultModel
  ) {
    try {
      const messages = this._buildMessages(prompt, conversationHistory);
      
      const requestData = JSON.stringify({
        model: model,
        messages: messages,
        stream: false,
        temperature: 0.7,
        top_p: 0.95,
        top_k: 40
      });

      const response = await this._makeRequest('/api/chat', 'POST', requestData);
      
      if (response && response.message && response.message.content) {
        return response.message.content;
      } else if (response && response.response) {
        // Fallback pour l'ancienne API /generate
        return response.response;
      }
      
      throw new Error('Format de réponse invalide');
    } catch (err) {
      throw new Error(`Erreur génération réponse: ${err.message}`);
    }
  }

  /**
   * Construit les messages pour l'API chat d'Ollama
   */
  _buildMessages(prompt, conversationHistory) {
    const messages = [];
    
    // Ajouter le prompt système
    messages.push({
      role: 'system',
      content: this._buildSystemPrompt()
    });
    
    // Ajouter l'historique de conversation
    for (const msg of conversationHistory) {
      if (msg.role && msg.content) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }
    
    // Ajouter le message utilisateur actuel
    messages.push({
      role: 'user',
      content: prompt
    });
    
    return messages;
  }

  /**
   * Analyse un rapport de sécurité
   */
  async analyzeSecurityReport(reportData) {
    const prompt = `Analyse ce rapport de sécurité et fournit :
1. Résumé des vulnérabilités critiques
2. Niveau de risque global (Faible/Moyen/Élevé/Critique)
3. Top 3 priorités de remédiation
4. Recommandations principales

Rapport:
${JSON.stringify(reportData, null, 2)}`;

    return this.generateResponse(prompt, []);
  }

  /**
   * Explique une vulnérabilité
   */
  async explainVulnerability(vulnerability) {
    const prompt = `Explique cette vulnérabilité de sécurité en détail :

Vulnérabilité: ${vulnerability.type || 'Unknown'}
Sévérité: ${vulnerability.severity || 'Unknown'}
Description: ${vulnerability.description || 'N/A'}
Endpoint: ${vulnerability.endpoint || 'N/A'}
Payload: ${vulnerability.payload || 'N/A'}

Fournis:
1. Explication claire et technique
2. Impact potentiel
3. Étapes de reproduction
4. Correction recommandée
5. Références OWASP/CWE si applicable`;

    return this.generateResponse(prompt, []);
  }

  /**
   * Génère des recommandations de remédiation
   */
  async generateRemediationAdvice(vulnerability) {
    const prompt = `En tant qu'expert en sécurité, fournis un guide de remédiation détaillé pour :

Type: ${vulnerability.type}
Sévérité: ${vulnerability.severity}
Détails: ${vulnerability.description}

Le guide doit inclure:
1. Causes racines
2. Étapes de correction (code + configuration)
3. Tests de validation
4. Prévention future
5. Références sécurité`;

    return this.generateResponse(prompt, []);
  }

  /**
   * Analyse des headers HTTP
   */
  async analyzeHTTPHeaders(headers) {
    const prompt = `Analyse ces headers HTTP de sécurité et fournis un audit:

Headers présents:
${Object.entries(headers || {})
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')}

Fournis:
1. Headers de sécurité manquants critiques
2. Configurations incorrectes
3. Risques associés
4. Recommandations de correction`;

    return this.generateResponse(prompt, []);
  }

  /**
   * Vérifie si un modèle est disponible
   */
  async isModelAvailable(modelName) {
    const models = await this.getAvailableModels();
    return models.some(m => m.name === modelName || m === modelName);
  }

  /**
   * Récupère les informations d'un modèle
   */
  async getModelInfo(modelName) {
    try {
      const response = await this._makeRequest('/api/show', 'POST', JSON.stringify({
        name: modelName
      }));
      return response;
    } catch (err) {
      console.error('Erreur récupération infos modèle:', err.message);
      return null;
    }
  }

  // ─────────────────────────────────────────
  // Prompts système pour cybersécurité
  // ─────────────────────────────────────────

  _buildSystemPrompt() {
    return `Tu es un assistant expert en cybersécurité spécialisé dans:
- La sécurité des applications web
- Les tests d'intrusion
- L'analyse des vulnérabilités
- L'OWASP Top 10
- La sécurité des API
- Les headers de sécurité HTTP
- L'authentification et l'autorisation
- Les bases de la cryptographie
- L'analyse d'audit de sécurité
- Le scoring CVSS
- La classification CWE
- La réponse aux incidents

Tu es un analyste sécurité professionnel avec 15+ ans d'expérience.

Directives:
1. Fournis toujours des conseils précis et techniquement corrects
2. Explique les concepts clairement avec des exemples
3. Référence OWASP, CWE, CVE quand pertinent
4. Concentre-toi sur des recommandations pratiques
5. Considère l'impact business en plus des aspects techniques
6. Évite les faux positifs et les spéculations
7. Soutiens tes recommandations par un raisonnement
8. Utilise un formatage clair
9. Sois objectif et impartial
10. Priorise les bonnes pratiques de sécurité

Format de réponse:
- Utilise Markdown pour la clarté
- Inclus des exemples de code quand pertinent
- Utilise ### pour les sections
- Utilise \`\`\` pour les blocs de code
- Utilise **gras** pour l'emphase
- Utilise des puces pour les listes
- Utilise des tableaux pour les comparaisons

Réponds toujours en français sauf pour les termes techniques.`;

  }

  /**
   * Requête HTTP interne améliorée
   */
  async _makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(`${this.ollamaHost}${path}`);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 11434,
        path: parsedUrl.path,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      };

      const req = http.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk.toString();
        });

        res.on('end', () => {
          if (responseData.trim()) {
            try {
              const parsed = JSON.parse(responseData);
              resolve(parsed);
            } catch (e) {
              if (method === 'GET' && path === '/api/tags') {
                // Essayer de parser différemment pour /api/tags
                try {
                  const lines = responseData.split('\n').filter(l => l.trim());
                  const models = [];
                  for (const line of lines) {
                    try {
                      const parsed = JSON.parse(line);
                      if (parsed.models) {
                        resolve(parsed);
                        return;
                      }
                    } catch (e2) {}
                  }
                } catch (e2) {}
              }
              reject(new Error(`Réponse JSON invalide: ${responseData.substring(0, 200)}`));
            }
          } else {
            resolve(null);
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Requête échouée: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout après ${this.timeout}ms`));
      });

      if (data) {
        req.write(data);
      }

      req.end();
    });
  }
}

module.exports = new OllamaService();