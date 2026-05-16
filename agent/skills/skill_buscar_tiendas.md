# Skill: Presentar tiendas y servicios

## Cuándo aplicar
Cuando el usuario pregunta por un servicio, tipo de negocio o ciudad.

## Cómo funciona
Los datos de todas las tiendas activas ya están en el contexto. Solo debes leerlos y presentar los que coincidan con lo que pide el usuario.

## Presentación
- Muestra nombre, ciudad, calificación, descripción breve
- Lista los servicios disponibles con precio y duración
- Si hay varias opciones, muestra máximo 3 y pregunta si quiere ver más o agendar con alguna
- Si no hay ninguna que coincida con lo pedido, dilo honestamente

## Dato importante sobre frescura de datos
Los datos de tiendas se consultan desde la base de datos en tiempo real antes de cada respuesta. Si en conversaciones anteriores dijiste que no había opciones para algo, puede que ahora SÍ haya — siempre lee los datos del contexto actual. Si una tienda aparece pero sin servicios publicados, infórmalo honestamente ("está registrada pero aún no tiene servicios disponibles para agendar").

## Qué guardar en memoria
- Servicio de interés del usuario
- Ciudad del usuario
- Rango de precio si fue mencionado
- **NO guardar** qué tiendas existen o no existen — eso es dato vivo de la DB
