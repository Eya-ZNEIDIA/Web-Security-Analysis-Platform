import React, { useState } from 'react';
import { Download, X, Loader, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * PDFExportModal - Composant pour exporter un rapport d'audit en PDF multi-langue
 * Supporté les langues: Français (fr) et English (en)
 */
const PDFExportModal = ({ isOpen, onClose, reportId, reportTitle = 'Security Audit Report' }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('fr');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [exportHistory, setExportHistory] = useState([]);

  const languages = [
    { code: 'fr', label: '🇫🇷 Français', name: 'French' },
    { code: 'en', label: '🇬🇧 English', name: 'English' }
  ];

  const handleDownloadPDF = async () => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      // Appel API pour télécharger le PDF
      const response = await fetch(
        `/api/rapports/${reportId}/download-pdf?language=${selectedLanguage}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      // Créer un blob et télécharger le fichier
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport-audit-${new Date().getTime()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Ajouter à l'historique
      const now = new Date();
      setExportHistory([
        {
          id: Date.now(),
          language: selectedLanguage,
          timestamp: now.toLocaleString(),
          status: 'success'
        },
        ...exportHistory.slice(0, 4) // Garder les 5 derniers
      ]);

      setSuccess(
        selectedLanguage === 'fr'
          ? 'Rapport PDF téléchargé avec succès!'
          : 'PDF report downloaded successfully!'
      );

      // Fermer le modal après 2 secondes
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Erreur lors du téléchargement du PDF:', err);
      setError(
        selectedLanguage === 'fr'
          ? `Erreur: ${err.message}`
          : `Error: ${err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Download className="w-5 h-5" />
            {selectedLanguage === 'fr' ? 'Télécharger Rapport' : 'Download Report'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Sélecteur de langue */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              {selectedLanguage === 'fr' ? 'Sélectionner la langue' : 'Select language'}
            </label>
            <div className="space-y-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setSelectedLanguage(lang.code);
                    setError('');
                    setSuccess('');
                  }}
                  className={`w-full p-3 rounded-lg border-2 text-left transition ${
                    selectedLanguage === lang.code
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">{lang.label}</div>
                  <div className="text-xs text-gray-500">{lang.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* Informations */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-900">
              {selectedLanguage === 'fr'
                ? `Le rapport sera généré en ${selectedLanguage === 'fr' ? 'français' : 'anglais'} avec tous les détails de l'audit.`
                : `The report will be generated in ${selectedLanguage === 'fr' ? 'French' : 'English'} with all audit details.`}
            </p>
          </div>

          {/* Historique d'exports */}
          {exportHistory.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {selectedLanguage === 'fr' ? 'Historique récent' : 'Recent exports'}
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {exportHistory.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded"
                  >
                    <span className="text-gray-600">{exp.timestamp}</span>
                    <span className="text-gray-400">
                      {exp.language === 'fr' ? '🇫🇷' : '🇬🇧'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            {selectedLanguage === 'fr' ? 'Annuler' : 'Cancel'}
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition disabled:bg-gray-400 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                {selectedLanguage === 'fr' ? 'Génération...' : 'Generating...'}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {selectedLanguage === 'fr' ? 'Télécharger PDF' : 'Download PDF'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDFExportModal;
