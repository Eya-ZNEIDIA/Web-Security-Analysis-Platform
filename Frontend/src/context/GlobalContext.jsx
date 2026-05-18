// src/context/GlobalContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import i18n from "../i18n";

const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [language, setLanguage] = useState(() => localStorage.getItem("language") || "fr");

  useEffect(() => {
    // Dark mode global
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    // Changement de langue
    i18n.changeLanguage(language);

    // RTL pour arabe
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";

    // Changement de police (optionnel pour arabe)
    document.documentElement.style.fontFamily = language === "ar" ? "Tahoma, Arial, sans-serif" : "sans-serif";

    localStorage.setItem("language", language);
  }, [language]);

  return (
    <GlobalContext.Provider value={{ darkMode, setDarkMode, language, setLanguage }}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobal = () => useContext(GlobalContext);