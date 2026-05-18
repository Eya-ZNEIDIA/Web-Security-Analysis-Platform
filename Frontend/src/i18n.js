// src/i18n.js
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  fr: {
    translation: {
      // Dashboard / général
      dashboard: "Tableau de bord",
      statistics: "Statistiques",
      labs: "Labs",
      settings: "Paramètres",
      logout: "Déconnexion",
      welcome: "Bienvenue",
      user: "Utilisateur",
      dashboard_intro: "Voici votre tableau de bord personnalisé",
      tests_completed: "Tests Complétés",
      available_labs: "Labs Disponibles",
      progress: "Progression",
      my_profile: "Mon Profil",
      edit: "Modifier",
      save: "Enregistrer",
      cancel: "Annuler",
      last_name: "Nom",
      first_name: "Prénom",
      email: "Email",
      dark_mode: "Mode Sombre",
      language: "Langue",
      others: "Autres paramètres",
      // Labs
      scan_lab_title: "Scanner un Lab",
      scan_lab_desc: "Entrez l’URL de votre Lab et lancez le scan.",
      scan_lab_placeholder: "Ex: https://votre-lab.com",
      scan_lab_button: "Scanner",
      // Statistics
      statistics_advanced_title: "Statistiques Avancées",
      cumulative_progress: "Progression Cumulative",
      lab_scores: "Scores par Lab",
      follow_progress_desc: "Suivez votre progression et vos scores cumulés",
    }
  },
  en: {
    translation: {
      dashboard: "Dashboard",
      statistics: "Statistics",
      labs: "Labs",
      settings: "Settings",
      logout: "Logout",
      welcome: "Welcome",
      user: "User",
      dashboard_intro: "Here is your personalized dashboard",
      tests_completed: "Completed Tests",
      available_labs: "Available Labs",
      progress: "Progress",
      my_profile: "My Profile",
      edit: "Edit",
      save: "Save",
      cancel: "Cancel",
      last_name: "Last Name",
      first_name: "First Name",
      email: "Email",
      dark_mode: "Dark Mode",
      language: "Language",
      others: "Other settings",
      scan_lab_title: "Scan a Lab",
      scan_lab_desc: "Enter your Lab URL and start the scan.",
      scan_lab_placeholder: "Ex: https://your-lab.com",
      scan_lab_button: "Scan",
      statistics_advanced_title: "Advanced Statistics",
      cumulative_progress: "Cumulative Progress",
      lab_scores: "Lab Scores",
      follow_progress_desc: "Track your progress and cumulative scores",
    }
  },
  ar: {
    translation: {
      dashboard: "لوحة التحكم",
      statistics: "الإحصائيات",
      labs: "المختبرات",
      settings: "الإعدادات",
      logout: "تسجيل الخروج",
      welcome: "مرحبًا",
      user: "المستخدم",
      dashboard_intro: "هذه لوحة التحكم الخاصة بك",
      tests_completed: "الاختبارات المكتملة",
      available_labs: "المختبرات المتاحة",
      progress: "التقدم",
      my_profile: "ملفي الشخصي",
      edit: "تعديل",
      save: "حفظ",
      cancel: "إلغاء",
      last_name: "الاسم",
      first_name: "الاسم الأول",
      email: "البريد الإلكتروني",
      dark_mode: "الوضع الليلي",
      language: "اللغة",
      others: "إعدادات أخرى",
      scan_lab_title: "مسح مختبر",
      scan_lab_desc: "أدخل رابط مختبرك وابدأ عملية المسح.",
      scan_lab_placeholder: "مثال: https://مختبري.com",
      scan_lab_button: "ابدأ المسح",
      statistics_advanced_title: "الإحصائيات المتقدمة",
      cumulative_progress: "التقدم التراكمي",
      lab_scores: "درجات المختبر",
      follow_progress_desc: "تابع تقدمك والدرجات التراكمية",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem("language") || "fr",
    fallbackLng: "fr",
    interpolation: { escapeValue: false }
  });

export default i18n;