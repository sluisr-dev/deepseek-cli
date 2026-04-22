# DeepSeek CLI Adaptation - Cambios Realizados

Este documento resume todas las modificaciones hechas para adaptar el Gemini CLI original al DeepSeek CLI.

## Autenticación - Solo DeepSeek API Key

### Archivos modificados:
- `packages/cli/src/gemini.tsx` (líneas 407-418)
  - Pre-auth antes de UI: Solo acepta `USE_DEEPSEEK`, ignora Google/Gemini guardados
  
- `packages/cli/src/core/initializer.ts` (líneas 44-54)
  - Inicializador pre-React: Filtro para solo pasar `USE_DEEPSEEK` a `performInitialAuth`
  
- `packages/cli/src/ui/auth/AuthDialog.tsx` (líneas 37-60)
  - UI de selección: Solo muestra "Use DeepSeek API Key", eliminó Google, Gemini, Cloud Shell, Vertex AI
  
- `packages/cli/src/ui/auth/ApiAuthDialog.tsx` (línea 37)
  - Diálogo de API key: Default `authType` cambiado de `USE_GEMINI` a `USE_DEEPSEEK`
  
- `packages/cli/src/ui/auth/useAuth.ts` (líneas 112-128)
  - Hook de auth: Ignora cualquier `selectedType` que no sea `USE_DEEPSEEK`

- `packages/cli/src/ui/AppContainer.tsx` (líneas 891, 2460)
  - Fallback de auth: Cambiado de `USE_GEMINI` a `USE_DEEPSEEK` en `resolvedAuthType`
  - `pendingAuthType` en UI state: Ahora usa `authContext.pendingAuthType` también

## Branding - DeepSeek en lugar de Gemini

### Archivos modificados:
- `packages/cli/src/ui/components/AppHeader.tsx` (líneas 112-125)
  - Banner: "Gemini CLI" → "DeepSeek CLI"
  - Mensaje de auth: "Signed in with Google" → "Authenticated with deepseek-api-key"

- `packages/core/src/prompts/snippets.ts` (líneas 174-175, 818, 33-36)
  - Preamble del system prompt: Ahora se identifica como "DeepSeek CLI, adaptación no oficial de Gemini CLI por sluisr"
  - Instrucción de memoria: Reforzada para que llame `save_memory` proactivamente
  - `DEFAULT_CONTEXT_FILENAME`: "GEMINI.md" → "DEEPSEEK.md"
  - `MEMORY_SECTION_HEADER`: "## Gemini Added Memories" → "## DeepSeek Added Memories"

## Aislamiento Total de Configuración

### Problema resuelto:
Ambos CLIs (oficial Gemini CLI y este fork) compartían `~/.gemini/settings.json`. Cuando el oficial guardaba `selectedType: google`, el DeepSeek CLI lo leía y pedía la API key de nuevo cada vez.

### Archivos modificados:
- `packages/core/src/utils/paths.ts` (línea 13)
  - `GEMINI_DIR`: `'.gemini'` → `'.deepseek'`
  - Todos los archivos de config/settings/auth ahora van a `~/.deepseek/` (separado del oficial)

## Archivo de Memoria - Nueva Ubicación

### Archivos modificados:
- `packages/core/src/tools/memoryTool.ts` (líneas 70-72)
  - `getGlobalMemoryFilePath()`: Usa `Storage.getGlobalGeminiDir()` que ahora apunta a `~/.deepseek/`
  - Archivo: `GEMINI.md` → `DEEPSEEK.md`

- `packages/cli/src/config/config.ts` (línea 561)
  - Forzado: `setServerGeminiMdFilename('DEEPSEEK.md')` siempre, ignorando settings del usuario

## Modelo por Defecto - Siempre DeepSeek

### Problema resuelto:
El footer mostraba `auto-gemini-3` en el primer inicio porque el modelo se resolvía antes de que el usuario entrara la API key.

### Archivos modificados:
- `packages/cli/src/config/config.ts` (línea 799)
  - `defaultModel`: Siempre `DEEPSEEK_CHAT_MODEL`, eliminada la condición `isDeepSeekAuth`

## UI - Textos DeepSeek

### Archivos modificados:
- `packages/cli/src/ui/components/Tips.tsx`
  - Tip inicial: "Create `GEMINI.md` files" → "Create `DEEPSEEK.md` files"

- `packages/cli/src/ui/hooks/useFolderTrust.ts`
  - Mensaje untrusted: "GEMINI.md files will not be applied" → "DEEPSEEK.md files will not be applied"

- `packages/cli/src/ui/components/FolderTrustDialog.tsx`
  - Diálogo de trust: "Gemini CLI" → "DeepSeek CLI"

## Notificaciones de Actualización - Desactivadas

### Archivos modificados:
- `packages/cli/src/interactiveCli.tsx` (líneas 170-190, 25-45)
  - Removidas llamadas a `checkForUpdates()` y `handleAutoUpdate()`
  - Eliminados imports relacionados

## Cómo Verificar

1. Iniciar CLI: Debe mostrar "DeepSeek CLI" en el banner
2. Autenticación: Solo debe mostrar opción "Use DeepSeek API Key"
3. Diálogo API key: Debe decir "Enter DeepSeek API Key" con link a platform.deepseek.com
4. Memoria: Al decir "recuerda...", debe guardar en `~/.deepseek/DEEPSEEK.md`
5. Footer: Debe mostrar "1 DEEPSEEK.md file" en lugar de "GEMINI.md"

## Comandos Útiles

```bash
# Build
npm run build --workspace=packages/core --workspace=packages/cli

# Ejecutar
node packages/cli/dist/index.js

# Verificar ubicación de memoria
ls -la ~/.deepseek/DEEPSEEK.md
```

## Notas

- El modelo DeepSeek-chat requiere instrucciones más explícitas en el system prompt que Gemini-2.x para llamar herramientas proactivamente
- La autenticación Google queda completamente bloqueada en todos los puntos de entrada
- Cualquier setting previo de Gemini auth es ignorado, forzando al usuario a usar DeepSeek
