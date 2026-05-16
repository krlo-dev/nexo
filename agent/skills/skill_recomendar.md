# Skill: Recomendar Proactivamente

## Cuándo usar este skill
- El usuario saluda sin solicitar algo específico Y tiene historial previo
- Han pasado más de 21 días desde la última cita en memoria
- El usuario pregunta "¿qué me recomienda?" o similar

## Proceso
1. Leer historial del usuario en memoria
2. Identificar patrones: frecuencia, servicios preferidos, negocios usados, rango de precio
3. Formular sugerencia proactiva y personalizada
4. Usar `verificar_disponibilidad` para el negocio sugerido y fecha próxima

## Formato de recomendación
"Bienvenido/a de nuevo. Basado en sus visitas anteriores, han transcurrido [X semanas] desde su última cita con [nombre negocio]. ¿Le gustaría que verifique disponibilidad para esta semana?"

## Qué guardar en memoria
- Si el usuario aceptó o rechazó la recomendación
- Cualquier nueva preferencia expresada
