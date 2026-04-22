import React, { useState, useEffect } from "react";
import axios from "axios";
import "./Variables.css";

interface Variable {
  name: string;
  value: number;
}

const Variables: React.FC = () => {
  const [variables, setVariables] = useState<Variable[]>([]);
  const [newVariable, setNewVariable] = useState({ name: "", value: "" });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  useEffect(() => {
    fetchVariables();
  }, []);

  const fetchVariables = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get("/api/variables");
      const vars = Object.entries(response.data).map(([name, value]) => ({
        name,
        value: value as number
      }));
      setVariables(vars);
    } catch (error: any) {
      setError("Error al cargar las variables");
      console.error("Error fetching variables:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addVariable = async () => {
    if (!newVariable.name.trim() || !newVariable.value.trim()) {
      setError("Nombre y valor son requeridos");
      return;
    }

    const value = parseFloat(newVariable.value);
    if (isNaN(value)) {
      setError("El valor debe ser un número válido");
      return;
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newVariable.name)) {
      setError("Nombre de variable inválido. Debe empezar con letra o _ y contener solo letras, números y _");
      return;
    }

    try {
      await axios.post("/api/variables", {
        name: newVariable.name.trim(),
        value
      });

      setNewVariable({ name: "", value: "" });
      setError(null);
      fetchVariables();
    } catch (error: any) {
      setError(error.response?.data?.error || "Error al agregar variable");
    }
  };

  const updateVariable = async (name: string) => {
    const value = parseFloat(editValue);
    if (isNaN(value)) {
      setError("El valor debe ser un número válido");
      return;
    }

    try {
      await axios.post("/api/variables", { name, value });
      setEditMode(null);
      setEditValue("");
      setError(null);
      fetchVariables();
    } catch (error: any) {
      setError(error.response?.data?.error || "Error al actualizar variable");
    }
  };

  const deleteVariable = async (name: string) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar la variable "${name}"?`)) {
      try {
        await axios.delete(`/api/variables/${name}`);
        fetchVariables();
      } catch (error: any) {
        setError(error.response?.data?.error || "Error al eliminar variable");
      }
    }
  };

  const useVariableInCalculator = (name: string) => {
    alert(`Variable "${name}" lista para usar en la calculadora`);
  };

  const copyVariableValue = (name: string, value: number) => {
    navigator.clipboard.writeText(value.toString()).then(() => {
      alert(`Valor de "${name}" copiado al portapapeles!`);
    });
  };

  const startEdit = (variable: Variable) => {
    setEditMode(variable.name);
    setEditValue(variable.value.toString());
  };

  const cancelEdit = () => {
    setEditMode(null);
    setEditValue("");
  };

  if (isLoading) {
    return (
      <div className="variables">
        <div className="variables-header">
          <h2>📊 Variables Definidas</h2>
          <button className="refresh-btn" onClick={fetchVariables} disabled>
            Actualizando...
          </button>
        </div>
        <div className="loading">Cargando variables...</div>
      </div>
    );
  }

  return (
    <div className="variables">
      <div className="variables-header">
        <h2>📊 Variables Definidas</h2>
        <button className="refresh-btn" onClick={fetchVariables}>
          🔄 Actualizar
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="add-variable">
        <h3>➕ Agregar Nueva Variable</h3>
        <div className="add-form">
          <input
            type="text"
            placeholder="Nombre (ej: x, y, radio)"
            value={newVariable.name}
            onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
          />
          <input
            type="text"
            placeholder="Valor (ej: 3.14, 100, -5)"
            value={newVariable.value}
            onChange={(e) => setNewVariable({ ...newVariable, value: e.target.value })}
            onKeyPress={(e) => e.key === "Enter" && addVariable()}
          />
          <button className="add-btn" onClick={addVariable}>
            Agregar
          </button>
        </div>
        <div className="variable-help">
          <p><strong>Consejo:</strong> Usa estas variables en la calculadora (ej: "x^2 + y")</p>
          <p><small>Los nombres deben empezar con letra o _ y contener solo letras, números y _</small></p>
        </div>
      </div>

      {variables.length === 0 ? (
        <div className="empty-variables">
          <p>No hay variables definidas todavía.</p>
          <p>¡Agrega algunas variables para usarlas en tus cálculos!</p>
        </div>
      ) : (
        <>
          <div className="variables-stats">
            <div className="stat">
              <span className="stat-label">Total:</span>
              <span className="stat-value">{variables.length} variables</span>
            </div>
            <div className="stat">
              <span className="stat-label">Valor promedio:</span>
              <span className="stat-value">
                {(variables.reduce((sum, v) => sum + v.value, 0) / variables.length).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="variables-list">
            {variables.map((variable) => (
              <div key={variable.name} className="variable-item">
                <div className="variable-name">
                  <strong>{variable.name}</strong>
                  <span className="variable-type">(número)</span>
                </div>

                {editMode === variable.name ? (
                  <div className="variable-edit">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && updateVariable(variable.name)}
                    />
                    <div className="edit-actions">
                      <button className="save-btn" onClick={() => updateVariable(variable.name)}>
                        💾 Guardar
                      </button>
                      <button className="cancel-btn" onClick={cancelEdit}>
                        ❌ Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="variable-value">
                    <span className="value-display">{variable.value}</span>
                    <div className="value-actions">
                      <button
                        className="action-btn edit-btn"
                        onClick={() => startEdit(variable)}
                        title="Editar valor"
                      >
                        ✏️
                      </button>
                      <button
                        className="action-btn copy-btn"
                        onClick={() => copyVariableValue(variable.name, variable.value)}
                        title="Copiar valor"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                )}

                <div className="variable-actions">
                  <button
                    className="action-btn use-btn"
                    onClick={() => useVariableInCalculator(variable.name)}
                    title="Usar en calculadora"
                  >
                    🧮
                  </button>
                  <button
                    className="action-btn delete-btn"
                    onClick={() => deleteVariable(variable.name)}
                    title="Eliminar variable"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="variables-export">
            <button
              className="export-btn"
              onClick={() => {
                const variablesText = variables
                  .map(v => `${v.name} = ${v.value}`)
                  .join("\\n");
                navigator.clipboard.writeText(variablesText).then(() => {
                  alert("Variables copiadas al portapapeles!");
                });
              }}
            >
              📄 Exportar Variables como Texto
            </button>
            <button
              className="clear-btn"
              onClick={() => {
                if (window.confirm("¿Estás seguro de que quieres eliminar todas las variables?")) {
                  // En una implementación real, necesitaríamos un endpoint para borrar todas
                  // Por ahora, mostramos un mensaje
                  alert("Esta funcionalidad requiere implementación adicional en el backend");
                }
              }}
            >
              🗑️ Borrar Todas las Variables
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Variables;