import React, { useState, useEffect } from "react";
import axios from "axios";
import "./History.css";

interface CalculationEntry {
  expression: string;
  result: number;
  timestamp: string;
}

const History: React.FC = () => {
  const [history, setHistory] = useState<CalculationEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get("/api/history");
      setHistory(response.data);
    } catch (error: any) {
      setError("Error al cargar el historial");
      console.error("Error fetching history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    if (window.confirm("¿Estás seguro de que quieres borrar todo el historial?")) {
      try {
        // En una implementación real, necesitaríamos un endpoint DELETE
        // Por ahora, simplemente limpiamos el estado local
        setHistory([]);
      } catch (error) {
        setError("Error al borrar el historial");
      }
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Copiado al portapapeles!");
    });
  };

  const useInCalculator = (expression: string) => {
    // Esta función sería manejada por el componente padre
    // Por ahora, solo mostramos un mensaje
    alert(`Expresión "${expression}" lista para usar en la calculadora`);
  };

  if (isLoading) {
    return (
      <div className="history">
        <div className="history-header">
          <h2>📜 Historial de Cálculos</h2>
          <button className="refresh-btn" onClick={fetchHistory} disabled>
            Actualizando...
          </button>
        </div>
        <div className="loading">Cargando historial...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="history">
        <div className="history-header">
          <h2>📜 Historial de Cálculos</h2>
          <button className="refresh-btn" onClick={fetchHistory}>
            Reintentar
          </button>
        </div>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="history">
      <div className="history-header">
        <h2>📜 Historial de Cálculos</h2>
        <div className="history-actions">
          <button className="refresh-btn" onClick={fetchHistory}>
            🔄 Actualizar
          </button>
          <button className="clear-btn" onClick={clearHistory} disabled={history.length === 0}>
            🗑️ Borrar Todo
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="empty-history">
          <p>No hay cálculos en el historial todavía.</p>
          <p>¡Usa la calculadora para empezar a crear historial!</p>
        </div>
      ) : (
        <>
          <div className="history-stats">
            <div className="stat">
              <span className="stat-label">Total:</span>
              <span className="stat-value">{history.length} cálculos</span>
            </div>
            <div className="stat">
              <span className="stat-label">Más reciente:</span>
              <span className="stat-value">{history[0] ? formatDate(history[0].timestamp) : "N/A"}</span>
            </div>
          </div>

          <div className="history-list">
            {history.map((entry, index) => (
              <div key={index} className="history-item">
                <div className="entry-number">#{index + 1}</div>
                <div className="entry-content">
                  <div className="entry-expression">
                    <strong>Expresión:</strong> {entry.expression}
                  </div>
                  <div className="entry-result">
                    <strong>Resultado:</strong> {entry.result}
                  </div>
                  <div className="entry-timestamp">
                    <small>{formatDate(entry.timestamp)}</small>
                  </div>
                </div>
                <div className="entry-actions">
                  <button
                    className="action-btn copy-btn"
                    onClick={() => copyToClipboard(entry.expression)}
                    title="Copiar expresión"
                  >
                    📋
                  </button>
                  <button
                    className="action-btn use-btn"
                    onClick={() => useInCalculator(entry.expression)}
                    title="Usar en calculadora"
                  >
                    🧮
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="history-export">
            <button
              className="export-btn"
              onClick={() => {
                const historyText = history
                  .map((entry, i) => 
                    `#${i + 1}: ${entry.expression} = ${entry.result} (${formatDate(entry.timestamp)})`
                  )
                  .join("\\n");
                copyToClipboard(historyText);
              }}
            >
              📄 Exportar Historial como Texto
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default History;