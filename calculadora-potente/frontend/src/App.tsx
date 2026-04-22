import React, { useState, useEffect } from "react";
import Calculator from "./components/Calculator";
import History from "./components/History";
import Variables from "./components/Variables";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<"calculator" | "history" | "variables">("calculator");
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDarkMode(prefersDark);
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className={`app ${isDarkMode ? "dark" : "light"}`}>
      <header className="app-header">
        <h1>🧮 Calculadora Científica Potente</h1>
        <button className="theme-toggle" onClick={toggleTheme}>
          {isDarkMode ? "☀️" : "🌙"}
        </button>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${activeTab === "calculator" ? "active" : ""}`}
          onClick={() => setActiveTab("calculator")}
        >
          Calculadora
        </button>
        <button
          className={`tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Historial
        </button>
        <button
          className={`tab ${activeTab === "variables" ? "active" : ""}`}
          onClick={() => setActiveTab("variables")}
        >
          Variables
        </button>
      </nav>

      <main className="main-content">
        {activeTab === "calculator" && <Calculator />}
        {activeTab === "history" && <History />}
        {activeTab === "variables" && <Variables />}
      </main>

      <footer className="app-footer">
        <p>Calculadora científica con funciones avanzadas • Desarrollada con React + Node.js</p>
      </footer>
    </div>
  );
}

export default App;