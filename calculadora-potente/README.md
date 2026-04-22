# 🧮 Calculadora Científica Potente

Una calculadora web científica moderna con backend Node.js y frontend React TypeScript.

## ✨ Características

### 🧮 Calculadora Científica
- Operaciones básicas: +, -, ×, ÷, ^, √
- Funciones trigonométricas: sin, cos, tan, asin, acos, atan
- Funciones logarítmicas: log, ln, log10
- Exponenciales: e^x, 10^x, 2^x
- Constantes: π, e, φ
- Paréntesis y precedencia de operadores
- Modos grados/radianes

### 📜 Historial de Cálculos
- Almacena hasta 50 cálculos recientes
- Exporta historial como texto
- Copia expresiones al portapapeles
- Reutiliza cálculos anteriores

### 📊 Variables Definidas
- Define variables personalizadas (ej: x = 5, y = 10)
- Edita y elimina variables
- Usa variables en expresiones matemáticas
- Exporta variables como texto

### 🎨 Interfaz de Usuario
- Diseño responsive (móvil y escritorio)
- Modos claro/oscuro
- Teclado virtual científico
- Animaciones y transiciones suaves
- Feedback visual inmediato

## 🚀 Instalación y Ejecución

### Backend (Node.js)
```bash
cd backend
npm install
npm start
# o para desarrollo con recarga automática
npm run dev
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

## 📁 Estructura del Proyecto

```
calculadora-potente/
├── backend/
│   ├── app.js              # Servidor Express principal
│   ├── package.json        # Dependencias Node.js
│   └── node_modules/       # Dependencias instaladas
├── frontend/
│   ├── src/
│   │   ├── components/     # Componentes React
│   │   │   ├── Calculator.tsx
│   │   │   ├── History.tsx
│   │   │   └── Variables.tsx
│   │   ├── App.tsx        # Componente principal
│   │   └── main.tsx       # Punto de entrada
│   ├── index.html         # HTML principal
│   ├── package.json       # Dependencias React
│   └── vite.config.ts     # Configuración Vite
└── README.md              # Esta documentación
```

## 🔧 API del Backend

### `POST /api/calculate`
Evalúa una expresión matemática.

**Request:**
```json
{
  "expression": "sin(pi/2) + log10(100)",
  "angleMode": "radians"
}
```

**Response:**
```json
{
  "result": 2.0,
  "error": null,
  "steps": ["sin(π/2) = 1", "log10(100) = 2", "1 + 2 = 3"]
}
```

### `GET /api/history`
Obtiene el historial de cálculos.

### `POST /api/history`
Agrega un cálculo al historial.

### `GET /api/variables`
Obtiene variables definidas.

### `POST /api/variables`
Define o actualiza una variable.

### `DELETE /api/variables/:name`
Elimina una variable.

## 🛠️ Tecnologías Utilizadas

### Backend
- **Node.js** - Entorno de ejecución JavaScript
- **Express** - Framework web minimalista
- **CORS** - Middleware para Cross-Origin Resource Sharing
- **Math.js** - Biblioteca matemática avanzada

### Frontend
- **React 18** - Biblioteca para interfaces de usuario
- **TypeScript** - Superset tipado de JavaScript
- **Vite** - Bundler y servidor de desarrollo rápido
- **Axios** - Cliente HTTP para llamadas a API
- **CSS Modules** - Estilos modularizados

## 🎯 Uso

1. **Abre la aplicación** en `http://localhost:3000`
2. **Usa la calculadora**:
   - Escribe expresiones directamente o usa el teclado virtual
   - Cambia entre grados y radianes según necesites
   - Haz clic en "Calcular" o presiona Enter
3. **Consulta el historial**:
   - Ve a la pestaña "Historial"
   - Copia o reutiliza cálculos anteriores
4. **Define variables**:
   - Ve a la pestaña "Variables"
   - Agrega variables con nombres y valores
   - Usa variables en expresiones (ej: "x^2 + y")

## 📱 Responsive Design

La aplicación se adapta a:
- **Escritorio**: Diseño completo con todas las funciones visibles
- **Tablet**: Layout optimizado para pantallas medianas
- **Móvil**: Interfaz simplificada con navegación por pestañas

## 🎨 Temas

- **Modo claro**: Fondo degradado púrpura/azul
- **Modo oscuro**: Fondo degradado gris oscuro
- Cambia entre temas con el botón ☀️/🌙 en la esquina superior derecha

## 🔒 Seguridad

- Validación de expresiones matemáticas
- Sanitización de entrada de usuario
- Limitación de complejidad de expresiones
- Manejo de errores robusto

## 🧪 Pruebas

Para ejecutar pruebas (pendiente de implementación):
```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## 🤝 Contribuir

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🙏 Créditos

Desarrollado con ❤️ usando:
- [Math.js](https://mathjs.org/) - Para evaluación matemática
- [React](https://reactjs.org/) - Para la interfaz de usuario
- [Vite](https://vitejs.dev/) - Para el desarrollo rápido

---

**¡Disfruta calculando!** 🧮✨