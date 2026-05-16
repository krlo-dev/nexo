# Nexo — Corrección Final del Chatbot (Umbral 0.60)

> **Propósito:** Corregir el umbral de similitud coseno de 0.35 a 0.60 y eliminar cualquier fallback que permita mostrar tiendas no relevantes. Esta corrección está basada en scores reales medidos:
> - "corte cabello" → Salón Valentina: 0.7633 ✅
> - "fisioterapia" → Dr. Martínez: 0.6628 ✅  
> - "xbox" → máximo 0.5839 → ninguna tienda debe aparecer ✅

---

## Regla Absoluta

**Si ninguna tienda supera score >= 0.60, retornar mensaje de "no encontrado" sin mostrar ninguna tienda. Sin excepciones. Sin fallbacks. Sin mostrar tiendas random.**

---

## 1. Cambios en `backend/src/services/chat.service.js`

Cambiar exactamente esta línea:
```js
const SIMILARITY_THRESHOLD = 0.35;
```

Por:
```js
const SIMILARITY_THRESHOLD = 0.60;
```

No cambiar nada más en este archivo.

---

## 2. Cambios en `backend/src/controllers/chat.controller.js`

### 2a. Verificar que el filtro del umbral NO tiene ningún fallback

Buscar el bloque donde se aplica el filtro de similitud. Debe verse exactamente así:

```js
const scoredStores = storesResult.rows
  .map(store => {
    let storeEmbedding;
    try {
      storeEmbedding = typeof store.embedding === 'string'
        ? JSON.parse(store.embedding)
        : store.embedding;
    } catch (e) {
      return null;
    }
    const score = cosineSimilarity(searchEmbedding, storeEmbedding);
    return { ...store, score };
  })
  .filter(store => store !== null)
  .filter(store => store.score >= SIMILARITY_THRESHOLD)  // <-- umbral estricto
  .sort((a, b) => b.score - a.score)
  .slice(0, MAX_RESULTS);
```

**Si hay cualquier otra lógica después de este bloque que agregue tiendas adicionales, que haga una segunda consulta a la DB, o que use tiendas de respaldo cuando `scoredStores` está vacío — ELIMINARLA COMPLETAMENTE.**

### 2b. Verificar que el bloque "sin resultados" retorna inmediatamente

Buscar el bloque que maneja `scoredStores.length === 0`. Debe retornar inmediatamente sin hacer nada más:

```js
if (scoredStores.length === 0) {
  const serviceMsg = intent.searchText || message.trim();
  const cityMsg = intent.city ? ` en ${intent.city}` : '';
  return res.json({
    success: true,
    data: {
      response: buildNotFoundMessage(serviceMsg, cityMsg),
      stores: []
    }
  });
}
```

**Verificar que después del `return` no hay ningún código que se ejecute de todas formas.**

### 2c. Agregar función `buildNotFoundMessage` para mensajes personalizados

Agregar esta función al inicio del archivo, antes de la función `chat`:

```js
const buildNotFoundMessage = (serviceText, cityText) => {
  const service = serviceText ? `"${serviceText}"` : 'ese servicio';
  const city = cityText || '';

  const messages = [
    `Busqué ${service}${city} en Nexo pero no encontré negocios que ofrezcan eso por el momento. ¿Quizás buscas algo diferente? Puedes explorar todas las tiendas en /explore.`,
    `Hmm, no tenemos ${service}${city} disponible en Nexo todavía. Puedes ver todos los servicios disponibles en /explore, ¡quizás encuentras algo que te guste!`,
    `No encontré coincidencias para ${service}${city} en nuestra plataforma. Si conoces un negocio que ofrezca ese servicio, ¡invítalos a unirse a Nexo! Mientras tanto, explora en /explore.`
  ];

  // Elegir mensaje basado en hash simple del texto para que no sea siempre el mismo
  const index = (serviceText || '').length % messages.length;
  return messages[index];
};
```

---

## 3. Verificación del Frontend `frontend/src/components/ChatBot.jsx`

Buscar el bloque donde se renderizan las cards de tiendas. Debe tener esta condición exacta:

```jsx
{msg.stores && msg.stores.length > 0 && (
  <div>
    {msg.stores.map(store => (
      // card de tienda
    ))}
  </div>
)}
```

**Si la condición es solo `{msg.stores && ...}` sin el `msg.stores.length > 0`, agregar el `.length > 0` para que un array vacío no renderice nada.**

---

## 4. Casos de Prueba Esperados Después del Fix

| Usuario dice | Score esperado | Resultado esperado |
|---|---|---|
| "quiero cortarme el pelo" | Salón Valentina: 0.76 | Solo Salón Valentina |
| "me duele la pierna, fisioterapia" | Dr. Martínez: 0.66 | Solo Dr. Martínez |
| "quiero arreglar mi celular" | TechFix: >0.60 | Solo TechFix |
| "venta de xbox 360" | Máximo 0.58 | "No encontré ese servicio" |
| "quiero pizza" | Máximo ~0.50 | "No encontré ese servicio" |
| "cuánto es 2+2" | N/A | "Solo puedo ayudarte con servicios locales" |

---

## 5. Instrucciones para Claude Code

1. En `backend/src/services/chat.service.js`: cambiar `SIMILARITY_THRESHOLD` de `0.35` a `0.60`
2. En `backend/src/controllers/chat.controller.js`:
   - Agregar función `buildNotFoundMessage` antes de la función `chat`
   - Verificar que el filtro `.filter(store => store.score >= SIMILARITY_THRESHOLD)` no tiene fallbacks
   - Verificar que el bloque `scoredStores.length === 0` usa `buildNotFoundMessage` y retorna inmediatamente
   - Eliminar cualquier lógica que agregue tiendas cuando no hay resultados relevantes
3. En `frontend/src/components/ChatBot.jsx`: verificar que el renderizado de cards tiene `msg.stores.length > 0`

**No tocar ningún otro archivo. No cambiar modelos. No cambiar el schema de DB.**

Después de aplicar los cambios, el backend NO necesita rebuild completo. Solo reiniciar el contenedor:
```bash
docker compose restart backend
```

---

*Nexo Chatbot Fix v0.3.0 — Umbral calibrado con scores reales*
