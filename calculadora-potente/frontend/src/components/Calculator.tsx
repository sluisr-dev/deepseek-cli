import React, { useState, useEffect } from "react";
import axios from "axios";
import "./Calculator.css";

interface CalculationResult {
  result: number | null;
  error: string | null;
  steps: string[];
}

const Calculator: React.FC = () => {
  const [expression, setExpression] = useState<string>("");
  const [result, setResult] = useState<CalculationResult>({ result: null, error: null, steps: [] });
  const [angleMode, setAngleMode] = useState<"degrees" | "radians">("radians");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleButtonClick = (value: string) => {
    if (value === "C") {
      setExpression("");
      setResult({ result: null, error: null, steps: [] });
    } else if (value === "⌫") {
      setExpression(prev => prev.slice(0, -1));
    } else if (value === "=") {
      calculate();
    } else {
      setExpression(prev => prev + value);
    }
  };

  const calculate = async () => {
    if (!expression.trim()) return;

    setIsLoading(true);
    try {
      const response = await axios.post("/api/calculate", {
        expression: expression.trim(),
        angleMode
      });

      setResult(response.data);
      
      // Guardar en historial
      if (response.data.result !== null) {
        await axios.post("/api/history", {
          expression: expression.trim(),
          result: response.data.result
        });
      }
    } catch (error: any) {
      setResult({
        result: null,
        error: error.response?.data?.error || "Error al calcular",
        steps: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const scientificButtons = [
    ["sin", "cos", "tan", "π", "e"],
    ["asin", "acos", "atan", "√", "^"],
    ["log", "ln", "!", "(", ")"],
    ["7", "8", "9", "/", "C"],
    ["4", "5", "6", "*", "⌫"],
    ["1", "2", "3", "-", "="],
    ["0", ".", "+", "deg/rad", ""]
  ];

  return (
    <div className="calculator">
      <div className="calculator-controls">
        <div className="mode-selector">
          <label>
            <input
              type="radio"
              name="angleMode"
              value="radians"
              checked={angleMode === "radians"}
              onChange={() => setAngleMode("radians")}
            />
            Radianes
          </label>
          <label>
            <input
              type="radio"
              name="angleMode"
              value="degrees"
              checked={angleMode === "degrees"}
              onChange={() => setAngleMode("degrees")}
            />
            Grados
          </label>
        </div>

        <div className="expression-display">
          <input
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="Ingresa una expresión (ej: sin(pi/2) + log10(100))"
            onKeyPress={(e) => e.key === "Enter" && calculate()}
          />
          <button className="calculate-btn" onClick={calculate} disabled={isLoading}>
            {isLoading ? "Calculando..." : "Calcular"}
          </button>
        </div>

        <div className="result-display">
          {result.error ? (
            <div className="error">{result.error}</div>
          ) : result.result !== null ? (
            <div className="success">
              <div className="result-value">= {result.result}</div>
              {result.steps.length > 0 && (
                <div className="steps">
                  {result.steps.map((step, index) => (
                    <div key={index} className="step">{step}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="placeholder">Resultado aparecerá aquí</div>
          )}
        </div>
      </div>

      <div className="keypad">
        {scientificButtons.map((row, rowIndex) => (
          <div key={rowIndex} className="keypad-row">
            {row.map((button, colIndex) => {
              if (button === "deg/rad") {
                return (
                  <button
                    key={colIndex}
                    className={`keypad-btn ${angleMode === "degrees" ? "active" : ""}`}
                    onClick={() => setAngleMode(angleMode === "degrees" ? "radians" : "degrees")}
                  >
                    {angleMode === "degrees" ? "DEG" : "RAD"}
                  </button>
                );
              }

              if (button === "") {
                return <div key={colIndex} className="empty-btn" />;
              }

              const isOperator = ["+", "-", "*", "/", "^", "=", "C", "⌫"].includes(button);
              const isScientific = ["sin", "cos", "tan", "asin", "acos", "atan", "log", "ln", "√", "π", "e", "!"].includes(button);
              const isNumber = !isNaN(Number(button)) || button === ".";

              return (
                <button
                  key={colIndex}
                  className={`keypad-btn ${
                    isOperator ? "operator" : 
                    isScientific ? "scientific" : 
                    isNumber ? "number" : ""
                  }`}
                  onClick={() => handleButtonClick(button)}
                  disabled={button === "=" && isLoading}
                >
                  {button}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="examples">
        <h3>Ejemplos:</h3>
        <div className="example-buttons">
          <button onClick={() => setExpression("sin(pi/2) + cos(0)")}>sin(π/2) + cos(0)</button>
          <button onClick={() => setExpression("log10(100) * ln(e^2)")}>log10(100) * ln(e²)</button>
          <button onClick={() => setExpression("sqrt(16) + 2^3")}>√16 + 2³</button>
          <button onClick={() => setExpression("(3 + 4) * 5 / 2")}>(3 + 4) × 5 ÷ 2</button>
        </div>
      </div>
    </div>
  );
};

export default Calculator;