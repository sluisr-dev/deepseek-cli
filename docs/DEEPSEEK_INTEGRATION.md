# DeepSeek Native Integration — Decisiones y Problemas Clave

## Qué se implementó

Integración nativa de DeepSeek API en Gemini CLI, permitiendo usar `deepseek-chat` y `deepseek-reasoner` como backends alternativos a Gemini, con soporte completo de tool calling y routing adaptativo.

---

## Archivos modificados / creados

| Archivo | Cambio |
|---|---|
| `packages/cli/src/gemini.tsx` | Override de auth a `USE_DEEPSEEK` si `DEEPSEEK_API_KEY` presente (modo interactivo) |
| `packages/cli/src/ui/auth/useAuth.ts` | Mismo override para el hook React de startup |
| `packages/cli/src/validateNonInterActiveAuth.ts` | Detección de `DEEPSEEK_API_KEY` en modo no-interactivo |
| `packages/core/src/config/models.ts` | Agregados `DEEPSEEK_CHAT_MODEL`, `DEEPSEEK_REASONER_MODEL`; eliminados de `VALID_GEMINI_MODELS`; `resolveClassifierModel` DeepSeek-aware |
| `packages/core/src/core/deepseekContentGenerator.ts` | Generador completo: tool calling, streaming, mapping Gemini↔OpenAI |
| `packages/core/src/core/contentGenerator.ts` | `AuthType.USE_DEEPSEEK` y factory |
| `packages/core/src/routing/strategies/deepseekClassifierStrategy.ts` | Nueva estrategia de routing DeepSeek |
| `packages/core/src/routing/modelRouterService.ts` | Registro de `DeepSeekClassifierStrategy` |
| `packages/core/src/agents/codebase-investigator.ts` | Auth-aware: usa `deepseek-chat` nativo cuando `USE_DEEPSEEK` |

---

## Cómo usar

```bash
DEEPSEEK_API_KEY=sk-xxx node packages/cli/dist/index.js
```

El CLI detecta la variable y usa DeepSeek automáticamente. No se necesita configuración adicional.

Para forzar un modelo específico:
```bash
DEEPSEEK_API_KEY=sk-xxx node packages/cli/dist/index.js --model deepseek-reasoner
```

---

## Problemas encontrados y soluciones

### 1. Auth sobreescrita por settings guardados
**Problema:** El settings guardaba `LOGIN_WITH_GOOGLE` y lo restauraba al iniciar, ignorando `DEEPSEEK_API_KEY`.  
**Solución:** Override en `gemini.tsx` y `useAuth.ts` — si `DEEPSEEK_API_KEY` existe, fuerza `USE_DEEPSEEK` antes del `refreshAuth`.

### 2. `VALID_GEMINI_MODELS` causaba error incorrecto
**Problema:** Los modelos DeepSeek estaban en `VALID_GEMINI_MODELS`, generando el mensaje "admin disabled access" en lugar de un error real.  
**Solución:** Eliminarlos del set.

### 3. Tool calling — `Duplicate value for 'tool_call_id'`
**Problema:** `toolCallIdMap` usaba el nombre de función como clave. Si `run_shell_command` se llamaba dos veces, ambas respuestas obtenían el mismo `tool_call_id` → error 400 de DeepSeek.  
**Solución:** Reemplazado por lista FIFO de llamadas pendientes (`pendingCalls: Array<{name, id}>`). Cada respuesta hace `findIndex` + `splice` para consumir la primera coincidencia.

### 4. Classifier no llegaba a ejecutarse (`OverrideStrategy` cortaba primero)
**Problema:** El orden era `FallbackStrategy → OverrideStrategy → DeepSeekClassifierStrategy`. `OverrideStrategy` ve `deepseek-chat` (no es `auto`) y retorna inmediatamente.  
**Solución:** Mover `DeepSeekClassifierStrategy` antes de `OverrideStrategy`.

### 5. Classifier siempre retornaba `null` por check incorrecto
**Problema:** Teníamos `if (context.requestedModel?.startsWith('deepseek-')) return null` pensando que detectaba overrides explícitos del usuario. Pero `client.ts` siempre setea `requestedModel = config.getModel()` = `'deepseek-chat'` → siempre null.  
**Solución:** Eliminar ese check. Usar solo `config.getModel()`.

### 6. Subagentes mostraban `gemini-3-flash-preview` en telemetría
**Problema:** `codebase-investigator.ts` usaba `PREVIEW_GEMINI_FLASH_MODEL` como nombre de modelo, que la telemetría registraba tal cual. La llamada real sí iba a DeepSeek (via `resolveDeepSeekModel`), pero el summary era confuso.  
**Solución:** Detect auth en el investigator: si `USE_DEEPSEEK` → usar `DEEPSEEK_CHAT_MODEL` directamente como string de modelo. También elimina el `thinkingConfig` de Gemini que no aplica.

### 7. DeepSeek "necio" — no accedía a paths fuera del workspace
**Problema:** El modelo respondía "no tengo acceso a `/home/sluisr/Proyectos`" en lugar de ejecutar `ls /home/sluisr/Proyectos` con shell.  
**Solución:** Añadida regla explícita en `DEEPSEEK_TOOL_ENFORCEMENT`: *"run_shell_command puede acceder a CUALQUIER path del filesystem"*.

---

## Arquitectura del routing adaptativo

```
Cada request pasa por:

FallbackStrategy          → si modelo no disponible, busca alternativa
DeepSeekClassifierStrategy → solo si config.getModel() starts with 'deepseek-'
  ├── Llama deepseek-chat con JSON prompt (score 1-100)
  ├── score < 50  → deepseek-chat  (simple: listar archivos, preguntas directas)
  └── score ≥ 50  → deepseek-reasoner (complejo: análisis, arquitectura, debugging)
OverrideStrategy          → si --model explícito
ApprovalModeStrategy      → si hay plan activo
ClassifierStrategy        → solo Gemini (isCustomModel → null para DeepSeek)
NumericalClassifierStrategy → solo Gemini 3
DefaultStrategy           → fallback final (deepseek-chat)
```

El classifier hace una llamada extra a DeepSeek por cada mensaje del usuario (~200-500 tokens de overhead).

---

## Modelos y cuándo se usan

| Modelo | Cuándo |
|---|---|
| `deepseek-chat` | Tareas simples (score < 50): listar archivos, preguntas directas, ediciones simples |
| `deepseek-chat` | Subagentes (codebase_investigator, investigación de código) |
| `deepseek-chat` | Clasificación de complejidad (utility_router) |
| `deepseek-reasoner` | Tareas complejas (score ≥ 50): análisis arquitectural, debugging profundo, diseño de sistemas |

---

## Costo estimado (DeepSeek pricing)

| Modelo | Input | Output |
|---|---|---|
| deepseek-chat (cache miss) | $0.27/1M tokens | $1.10/1M tokens |
| deepseek-chat (cache hit) | $0.07/1M tokens | $1.10/1M tokens |
| deepseek-reasoner | $0.55/1M tokens | $2.19/1M tokens |

Los subagentes son caros porque leen muchos archivos y acumulan contexto. Una sesión de análisis de arquitectura puede costar ~1.1M tokens de entrada.

---

## Pendiente

- Token caching (DeepSeek soporta prefix caching, actualmente `Cache Reads: 0`)
- Exposición del routing decision en la UI (qué modelo se eligió y por qué)
