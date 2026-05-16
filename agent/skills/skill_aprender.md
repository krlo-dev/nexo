# Skill: Aprender y Actualizar Memoria

## Cuándo usar este skill
SIEMPRE al final de cada respuesta, sin excepción.

## Qué aprender y guardar

### Datos explícitos (el usuario los dice directamente):
- Nombre, ciudad, barrio, preferencias de precio, horarios preferidos

### Datos implícitos (inferidos del comportamiento):
- Buscó X tipo de servicio → agregar a "servicios de interés"
- Rechazó una recomendación → registrar preferencia negativa
- Repite el mismo tipo de servicio → marcarlo como frecuente
- Mencionó experiencia negativa con un negocio → registrarlo

### Aprendizaje semántico del usuario:
Si el usuario usó una expresión particular y el agente la interpretó (o el usuario corrigió la interpretación), guardar la equivalencia:
"El usuario usa '[expresión]' para referirse a [tipo de servicio]"

Esto permite que en conversaciones futuras el agente entienda al usuario de forma más precisa sin necesidad de preguntar.

## Formato del archivo de memoria

Guardar en `agent/memory/{userId}.md`:

```markdown
# Memoria del Usuario {userId}
**Última actualización:** {fecha ISO}

## Datos personales
- Nombre: {si fue mencionado, si no: "no especificado"}
- Ciudad: {ciudad o "no especificada"}
- Barrio: {si fue mencionado}

## Preferencias aprendidas
- Servicios de interés: {lista}
- Precio máximo habitual: {valor o "no especificado"}
- Horarios preferidos: {mañana / tarde / noche / no especificado}
- Negocios favoritos: {lista con razones si las hay}
- Negocios con experiencia negativa: {lista con razones}

## Vocabulario particular del usuario
- "{expresión usada por este usuario}" → {tipo de servicio que significa para él/ella}

## Historial de interacciones
- {fecha}: Buscó servicio de tipo "{servicio}" en {ciudad}
- {fecha}: Agendó cita con {negocio} para {servicio} el {fecha cita} a las {hora}
- {fecha}: Recomendación proactiva → {aceptada / rechazada}

## Notas adicionales
- {cualquier dato relevante no categorizado}
```

## Reglas críticas
- NUNCA eliminar entradas anteriores — solo agregar y actualizar
- Si un dato cambia (cambió de ciudad, etc.), actualizar el campo y añadir nota en historial
- La memoria es lo que convierte al agente en un asistente que realmente conoce al usuario
- Mantener el formato exacto para que futuras sesiones puedan leerla correctamente
- **NUNCA guardar en memoria qué tiendas encontraste o no encontraste en una búsqueda.** Esa información es dinámica: se consulta en tiempo real antes de cada respuesta. Guardarla causaría que el agente asuma que "no hay tiendas de X" cuando en realidad pueden haberse registrado nuevas.
- En el historial, registra solo la INTENCIÓN del usuario (qué tipo de servicio buscó, en qué ciudad) — nunca el conteo ni los nombres específicos de tiendas del resultado. Los negocios y sus servicios viven en la base de datos, no en la memoria.
