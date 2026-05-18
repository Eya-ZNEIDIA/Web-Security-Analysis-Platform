/**
 * useLanguageToggle Hook
 * Gère la sélection de langue pour les rapports PDF
 */

import { useState, useEffect } from 'react';

export const useLanguageToggle = () => {
  const [reportLanguage, setReportLanguage] = useState('en');

  // Charger la langue sauvegardée
  useEffect(() => {
    const savedLanguage = localStorage.getItem('reportLanguage') || 'en';
    setReportLanguage(savedLanguage);
  }, []);

  // Sauvegarder la langue sélectionnée
  const handleLanguageChange = (lang) => {
    setReportLanguage(lang);
    localStorage.setItem('reportLanguage', lang);
  };

  return {
    reportLanguage,
    handleLanguageChange,
    issFrench: reportLanguage === 'fr',
    isEnglish: reportLanguage === 'en'
  };
};

export default useLanguageToggle;
