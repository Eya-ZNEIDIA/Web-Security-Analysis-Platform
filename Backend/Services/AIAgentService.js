const { Ollama } = require("ollama");

const ollama = new Ollama({
  host: "http://127.0.0.1:11434"
});

class AIAgentService {


  static async generateTestScenarios(context, intensity) {
    if ((!context.endpoints || context.endpoints.length === 0) && (!context.forms || context.forms.length === 0)) {
      context.endpoints = ["/"];
    }

    const prompt = `
Tu es un expert en cybersécurité opérant dans un cadre légal et défensif.

Informations sur la cible :

Server : ${context.server || "inconnu"}

Headers :
${JSON.stringify(context.headers, null, 2)}

Endpoints détectés :
${JSON.stringify(context.endpoints, null, 2)}

Forms détectés :
${JSON.stringify(context.forms, null, 2)}

Niveau d'intensité : ${intensity}

Génère au moins 40 scénarios de tests différents pour détecter :

- XSS
- SQL Injection
- Command Injection
- Path Traversal
- Open Redirect
- SSRF
- IDOR

Si aucun endpoint n’est détecté, crée des tests basés sur les headers et la configuration du serveur.

Retourne uniquement un JSON valide.

Format :
[
 {
   "type": "XSS",
   "endpoint": "/search",
   "parameter": "q",
   "payload": "<script>alert(1)</script>"
 }
]

Ne rajoute aucun texte avant ou après.
`;

    try {
      const response = await ollama.chat({
        model: "llama3.1",  
        temperature: 0.8,       
        max_tokens: 3000,          
        messages: [
          { role: "system", content: "Tu es un agent IA spécialisé en audit de sécurité défensive." },
          { role: "user", content: prompt }
        ]
      });

      const raw = response.message.content;
      const match = raw.match(/\[.*\]/s);
      let scenarios = match ? JSON.parse(match[0]) : [];

 
      scenarios = scenarios.map(s => ({
        type: s.type || "TEST",
        endpoint: (s.endpoint || "").replace(/^https?:\/\/[^\/]+/, ""),
        parameter: s.parameter || "test",
        payload: s.payload || "test"
      }));

      scenarios = Array.from(
        new Map(scenarios.map(s => [s.type + s.endpoint + s.parameter + s.payload, s])).values()
      );

      console.log("Scenarios générés:", scenarios);
      return scenarios;

    } catch (error) {
      console.log("Erreur génération scénarios IA :", error.message);
      return [];
    }
  }


  static async analyzeSecurityResults(technicalResults) {
    const prompt = `
Analyse ces résultats techniques et identifie les vraies vulnérabilités.

Résultats :
${JSON.stringify(technicalResults, null, 2)}

Retourne uniquement un JSON valide sous forme de tableau :

[
 {
   "type": "XSS",
   "severity": "high|medium|low|critical",
   "endpoint": "/search",
   "parameter": "q",
   "description": "Injection XSS détectée.",
   "recommendation": "Échapper les entrées utilisateur et utiliser CSP."
 }
]

Ne rajoute aucun texte avant ou après.
`;

    try {
      const response = await ollama.chat({
        model: "llama3.1",
        temperature: 0.8,
        max_tokens: 2000,
        messages: [
          { role: "system", content: "Tu es un expert en analyse de vulnérabilités défensives." },
          { role: "user", content: prompt }
        ]
      });

      const raw = response.message.content;
      const match = raw.match(/\[.*\]/s);
      let vulnerabilities = match ? JSON.parse(match[0]) : [];


      vulnerabilities = Array.from(
        new Map(vulnerabilities.map(v => [v.type + v.severity + v.endpoint + v.parameter, v])).values()
      );

      return vulnerabilities;

    } catch (error) {
      console.log("Erreur parsing JSON vulnérabilités IA :", error.message);
      return [];
    }
  }
}

module.exports = AIAgentService;