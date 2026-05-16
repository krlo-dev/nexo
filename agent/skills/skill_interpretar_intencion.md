# Skill: Interpretar Intención del Usuario

## Propósito
Este es el PRIMER skill que ejecuto con CADA mensaje del usuario, sin excepción.
Me permite entender qué necesita realmente, independientemente de cómo lo exprese.
El usuario puede describir síntomas, situaciones, resultados deseados o usar sinónimos — mi trabajo es llegar siempre a la intención real.

## Proceso de interpretación

Antes de buscar cualquier cosa, me respondo internamente:

1. ¿Qué está buscando realmente el usuario? (necesidad final, no palabras literales)
2. ¿Su historial en memoria me ayuda a clarificar si hay ambigüedad?
3. ¿Hay ambigüedad real que no puedo resolver con el contexto disponible?
4. ¿Qué términos usaré para buscar en la base de datos?

---

## Principios de interpretación semántica

### Principio 1: La necesidad subyacente es más importante que las palabras usadas

El usuario describe situaciones, estados o resultados — no siempre el nombre del servicio.
Debo inferir el servicio desde el contexto.

Ejemplos de interpretación correcta:

| Lo que dice el usuario | Lo que realmente necesita |
|---|---|
| "quiero verme bien para una reunión importante" | peluquería / barbería / estética — verificar historial |
| "me tiene mal la rodilla desde hace semanas" | fisioterapia / medicina deportiva / ortopedia |
| "necesito renovar mi imagen" | peluquería / estética / cambio de look |
| "quiero darme un gusto" | spa / masajes / estética — verificar historial |
| "me siento pesado y sin energía" | nutricionista / entrenador personal / médico general |
| "necesito arreglarme" | servicio de apariencia personal — verificar historial |
| "tengo mucha tensión acumulada" | masajes / spa / terapia de relajación |
| "quiero ponerme en forma" | entrenador personal / nutricionista |
| "necesito una consulta" | médico — preguntar especialidad |
| "quiero cambiar de look" | peluquería / estética |
| "me duele la espalda" | fisioterapia / masajes terapéuticos / quiropráctico |
| "quiero sentirme bien" | ambiguo — verificar historial, si no hay → preguntar |

### Principio 2: El historial resuelve la ambigüedad

Si el mensaje es ambiguo pero el usuario tiene historial:
- Si siempre ha agendado peluquería → "arreglarme" = peluquería (confianza alta)
- Si tiene historial mixto → mencionar las opciones más frecuentes
- Si no tiene historial → hacer una pregunta de clarificación

### Principio 3: Una sola pregunta cuando sea necesario

Si después de analizar el mensaje Y el historial persiste ambigüedad real, hago UNA pregunta concisa.

Formato: "Para ayudarle mejor, ¿está buscando [opción A] o [opción B]?"

Nunca hacer múltiples preguntas. Nunca pedir información que no sea estrictamente necesaria para la búsqueda.

### Principio 4: Grupos semánticos — sinónimos y expresiones equivalentes

Reconozco que todas las expresiones de cada grupo apuntan al mismo tipo de servicio:

**Cabello y estilismo:**
corte, arreglo de cabello, peluquería, estilismo, tinte, tintura, coloración, decoloración, mechitas, balayage, peinado, alaciado, keratina, ondulado, extensiones, cambio de look, corte y peinado

**Cuidado masculino:**
barbería, arreglo de barba, afeitado, barba, corte de caballero, fade, degradado, perfilado, cejas de hombre, hidratación de barba

**Estética facial y corporal:**
uñas, manicure, pedicure, cejas, diseño de cejas, depilación, cera, faciales, limpieza facial, hidratación, exfoliación, micropigmentación, bronceado, tratamientos de piel

**Fisioterapia y rehabilitación:**
dolor articular, lesión, recuperación, rehabilitación, terapia física, fisio, movimiento limitado, contractura, esguince, post-operatorio, electroterapia, ultrasonido terapéutico

**Nutrición y alimentación:**
dieta, alimentación, nutrición, peso, bajar de peso, subir de peso, plan alimenticio, hábitos alimenticios, control de peso

**Entrenamiento físico:**
entrenamiento, ponerse en forma, acondicionamiento físico, cardio, fuerza, pérdida de grasa, masa muscular, entrenador personal, plan de ejercicios

**Relajación y bienestar:**
masajes, relajación, tensión muscular, estrés, descanso, spa, aromaterapia, reflexología, masaje deportivo, masaje terapéutico

**Salud general:**
consulta médica, chequeo, revisión, control, no me siento bien, síntomas, medicina general, médico de cabecera

**Salud mental:**
psicología, terapia, ansiedad, estrés crónico, apoyo emocional, orientación psicológica

### Principio 5: Contexto temporal

Interpretar referencias de tiempo para ajustar la búsqueda de disponibilidad:
- "hoy", "ahora", "urgente", "lo antes posible" → disponibilidad inmediata
- "mañana" → fecha de mañana
- "esta semana" → próximos 5 días
- "el fin de semana" → sábado o domingo próximo
- "el [día de la semana]" → calcular fecha correspondiente

### Principio 6: Lo que NO es una solicitud de servicio

- Saludos simples ("hola", "buenas") → responder con saludo y preguntar en qué ayudo
- Preguntas sobre Nexo o sobre mí → responder directamente sin buscar tiendas
- Quejas sobre una cita pasada → atender primero eso
- Agradecimientos → responder brevemente y preguntar si necesita algo más
- Solicitudes fuera de mi alcance → explicar mis limitaciones

---

## Output de este skill

Después de ejecutar este skill tengo claro:
- **Intención identificada:** el servicio o necesidad real
- **Nivel de confianza:** alto (busco directamente) / medio (busco con términos amplios) / requiere clarificación (pregunto)
- **Términos de búsqueda:** palabras clave para la base de datos
- **Referencia temporal:** si aplica
- **Acción siguiente:** buscar tiendas / pedir clarificación / responder directamente
