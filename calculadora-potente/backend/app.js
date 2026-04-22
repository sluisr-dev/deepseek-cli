const express = require("express");
const cors = require("cors");
const math = require("mathjs");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Evaluar expresión matemática
app.post("/api/calculate", (req, res) => {
  try {
    const { expression, angleMode = "radians" } = req.body;
    
    if (!expression || typeof expression !== "string") {
      return res.status(400).json({ error: "Expresión inválida" });
    }

    // Configurar modo de ángulo
    const config = {
      angle: angleMode === "degrees" ? "deg" : "rad"
    };

    // Evaluar expresión usando mathjs
    const result = math.evaluate(expression, config);
    
    res.json({
      result,
      error: null,
      steps: [`${expression} = ${result}`]
    });
  } catch (error) {
    res.status(400).json({
      result: null,
      error: error.message,
      steps: []
    });
  }
});

// Historial de cálculos (en memoria por ahora)
let calculationHistory = [];

app.get("/api/history", (req, res) => {
  res.json(calculationHistory);
});

app.post("/api/history", (req, res) => {
  const { expression, result } = req.body;
  if (expression && result !== undefined) {
    calculationHistory.unshift({
      expression,
      result,
      timestamp: new Date().toISOString()
    });
    // Mantener solo los últimos 50 cálculos
    calculationHistory = calculationHistory.slice(0, 50);
  }
  res.json({ success: true });
});

// Variables definidas por usuario
let userVariables = {};

app.get("/api/variables", (req, res) => {
  res.json(userVariables);
});

app.post("/api/variables", (req, res) => {
  const { name, value } = req.body;
  if (name && value !== undefined) {
    userVariables[name] = value;
  }
  res.json({ success: true });
});

app.delete("/api/variables/:name", (req, res) => {
  const { name } = req.params;
  delete userVariables[name];
  res.json({ success: true });
});

// Endpoint de salud
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Servidor backend ejecutándose en http://localhost:${PORT}`);
});