/**
 * Hook React personnalisé pour télécharger le rapport PDF
 * Utilisation: const { downloadPDF, loading, error } = useDownloadPDF();
 * Avec langue: downloadPDF(reportId, 'fr')
 */

import { useState } from 'react';

export const useDownloadPDF = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const downloadPDF = async (reportId, language = 'en') => {
    if (!reportId) {
      setError('ID du rapport manquant');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      // Construire l'URL avec le paramètre language
      const url = new URL(`${apiUrl}/api/rapports/${reportId}/download-pdf`);
      url.searchParams.append('language', language);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const urlObject = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlObject;
      const langSuffix = language === 'fr' ? 'fr' : 'en';
      link.download = `rapport-audit-${langSuffix}-${new Date().getTime()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(urlObject);
    } catch (err) {
      console.error('Erreur lors du téléchargement du PDF:', err);
      setError(err.message || 'Erreur lors du téléchargement');
    } finally {
      setLoading(false);
    }
  };

  return { downloadPDF, loading, error };
};

export default useDownloadPDF;
