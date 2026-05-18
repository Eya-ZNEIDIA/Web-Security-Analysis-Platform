import Sidebar from "../components/Sidebar";
import { useGlobal } from "../context/GlobalContext";

const DashboardLayout = ({ children }) => {
  const { darkMode } = useGlobal();

  return (
    <div
      className={`min-h-screen flex ${
        darkMode
          ? "bg-gray-900 text-gray-100"
          : "bg-gradient-to-br from-green-50 via-white to-green-100"
      }`}
    >
      <Sidebar />

      <main className="flex-1 p-10">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;