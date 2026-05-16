# Skill: Agendar cita

## Cuándo aplicar
Cuando el usuario confirme explícitamente que quiere agendar.

## Información necesaria (pedir de a una si falta)
1. Tienda y servicio (pueden venir de la conversación previa)
2. Fecha deseada
3. Horario (mostrar los slots disponibles del contexto inyectado para que el usuario elija)

## Cómo funciona
La disponibilidad ya está en el contexto si el usuario mencionó una fecha. Muestra los slots disponibles y cuando el usuario elija uno, usa la herramienta `agendar_cita` con:
- `storeId`: el ID exacto de la tienda de los datos inyectados
- `serviceId`: el ID exacto del servicio de los datos inyectados
- `startTime`: la fecha y hora en formato `YYYY-MM-DDThh:mm:00Z`

## Confirmación
Después de crear la cita, confirma: nombre del negocio, servicio, fecha, hora y precio.

## Qué guardar en memoria
- Negocio y servicio con el que agendó
- Fecha, hora y precio
