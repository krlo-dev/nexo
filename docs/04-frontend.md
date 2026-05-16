# 04 — Frontend — React y Vite

## Por qué React y Vite

React permite construir interfaces como un árbol de **componentes reutilizables** — la tarjeta de una tienda, el modal de reserva, el chatbot flotante. Cada componente gestiona su propio estado y se actualiza solo cuando sus datos cambian, sin recargar la página completa.

Vite reemplaza a Create React App como herramienta de desarrollo. Su ventaja principal es el **Hot Module Replacement (HMR)**: cuando guardas un archivo, el navegador actualiza solo el componente que cambió en milisegundos, sin perder el estado de la aplicación. Hace que el ciclo de desarrollo sea muy fluido.

---

## Estructura de carpetas

```
frontend/src/
├── pages/
│   ├── public/          # Landing, Explore, StoreProfile — sin autenticación requerida
│   ├── auth/            # Login, Register
│   ├── client/          # Dashboard del cliente, lista de citas
│   ├── entrepreneur/    # Dashboard del emprendedor, gestión de tienda y servicios
│   └── admin/           # Dashboard de admin, gestión de usuarios y tiendas
├── components/          # Componentes reutilizables entre páginas
└── lib/
    ├── axios.js         # Cliente HTTP con interceptor JWT automático
    ├── api.js           # Re-exporta la instancia de axios
    └── auth.js          # Helpers: getToken, setToken, clearToken, getUser
```

---

## Routing con React Router v6 y rutas protegidas

Toda la configuración de rutas vive en `App.jsx`. Las rutas privadas usan `<ProtectedRoute role="..." />`:

```jsx
// Rutas públicas — cualquiera puede acceder
<Route path="/" element={<Landing />} />
<Route path="/explore" element={<Explore />} />
<Route path="/store/:slug" element={<StoreProfile />} />

// Rutas protegidas por rol
<Route path="/client/*" element={
  <ProtectedRoute role="cliente">
    <ClientDashboard />
  </ProtectedRoute>
} />

<Route path="/entrepreneur/*" element={
  <ProtectedRoute role="emprendedor">
    <EntrepreneurDashboard />
  </ProtectedRoute>
} />
```

`<ProtectedRoute>` verifica que haya un token válido en `localStorage` y que el rol del usuario coincida. Si no, redirige a `/auth/login`.

### El problema del refresh en SPAs

Cuando el usuario está en `/store/salon-valentina` y presiona F5, el navegador hace una petición GET al servidor pidiendo literalmente la ruta `/store/salon-valentina`. Nginx no tiene ningún archivo en esa ruta — solo existe el `index.html` en la raíz.

La solución está en `nginx.conf`:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

`try_files` intenta servir el archivo exacto (`$uri`), luego una carpeta con ese nombre (`$uri/`), y si no encuentra nada, sirve `index.html`. React Router recibe la URL completa y renderiza el componente correcto. Sin esta línea, el refresh en cualquier ruta que no sea `/` retornaría un 404.

---

## Autenticación en el frontend

### Guardar el token

Tras un login exitoso, el token JWT se guarda en `localStorage`:

```js
// lib/auth.js
export const setToken = (token) => localStorage.setItem('nexo_token', token);
export const clearToken = () => localStorage.removeItem('nexo_token');

export const getUser = () => {
  const token = getToken();
  if (!token) return null;
  const payload = JSON.parse(atob(token.split('.')[1])); // decodifica el payload
  if (payload.exp * 1000 < Date.now()) { clearToken(); return null; } // verifica expiración
  return payload; // { id, role, email, full_name }
};
```

### Interceptor de Axios — JWT automático

En lugar de agregar el token manualmente en cada llamada a la API, el interceptor lo hace de forma transparente:

```js
// lib/axios.js
const api = axios.create({ baseURL: '/api' });

// Antes de cada request: agrega el token si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexo_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si el servidor responde 401 (token expirado): logout automático
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nexo_token');
      window.location.href = '/auth/login';
    }
    return Promise.reject(err);
  }
);
```

El resultado: en cualquier componente puedes hacer `api.get('/appointments')` sin preocuparte por el token. Si el token expiró mientras el usuario tenía la pestaña abierta, el interceptor lo detecta en la siguiente llamada y lo redirige al login.

---

## React Query — qué problema resuelve

Sin React Query, cargar datos de la API requiere gestionar manualmente tres estados en cada componente:

```jsx
// Sin React Query — repetitivo y propenso a bugs
const [stores, setStores] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  setLoading(true);
  api.get('/stores')
    .then(res => setStores(res.data.data))
    .catch(err => setError(err))
    .finally(() => setLoading(false));
}, []);
```

Con React Query esto se simplifica y ganas cache automático, revalidación en background, y manejo de estados integrado:

```jsx
// Con React Query
const { data: stores, isLoading, error } = useQuery({
  queryKey: ['stores'],
  queryFn: () => api.get('/stores').then(res => res.data.data)
});
```

Beneficios concretos en Nexo:
- Si el usuario navega de la landing a la tienda y vuelve, los datos de la landing se sirven del cache instantáneamente (sin nueva petición a la API).
- `useMutation` para crear citas invalida automáticamente el cache de citas, actualizando la lista sin reload.
- Estados de carga y error disponibles sin código extra.

---

## Formularios con React Hook Form + Zod

El problema con formularios usando `useState` es que cada campo necesita su propio estado, y cada keystroke re-renderiza el componente entero. Para un formulario de 10 campos esto genera 10x más renders de lo necesario.

**React Hook Form** accede a los valores del DOM directamente a través de refs, evitando los re-renders. El componente solo se re-renderiza al validar o al enviar.

**Zod** define la forma y validación del formulario como un schema:

```js
const registerSchema = z.object({
  full_name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(['cliente', 'emprendedor'])
});
```

React Hook Form y Zod se integran vía `@hookform/resolvers`:

```jsx
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(registerSchema)
});
```

Los mensajes de error de Zod se muestran automáticamente en `errors.email.message`, `errors.password.message`, etc.

---

## Sistema de diseño Nexo

Los colores del proyecto están definidos en `tailwind.config.js` bajo el namespace `nexo`:

| Token | Valor hex | Uso |
|-------|-----------|-----|
| `nexo-red` | `#E8223A` | Botones primarios, CTAs, navbar activo, chatbot |
| `nexo-red-dark` | `#C41A2E` | Hover de botones rojos |
| `nexo-red-light` | `#FDEAED` | Fondos de badges, burbujas del bot |
| `nexo-black` | `#0F0F0F` | Texto principal |
| `nexo-gray-light` | `#F5F5F5` | Fondo de páginas |
| `nexo-border` | `#EBEBEB` | Bordes de cards e inputs |

Uso en componentes:
```jsx
<button className="bg-nexo-red hover:bg-nexo-red-dark text-white">
  Agendar cita
</button>
```

**Tipografía:** Inter (400/500/600/700)
**Border radius:** 12px en cards, 8px en inputs, 999px en pills/badges

---

## El componente ChatBot

`<ChatBot />` es un botón flotante fijo en la esquina inferior derecha que abre un panel de 380×520px. Se muestra en todas las páginas excepto en rutas `/auth/*` y `/admin/*`.

### Estado interno

```js
const [isOpen, setIsOpen] = useState(false);      // panel abierto/cerrado
const [messages, setMessages] = useState([...]);   // historial de mensajes
const [isLoading, setIsLoading] = useState(false); // spinner de "pensando..."
const [input, setInput] = useState('');            // campo de texto
```

Cada mensaje en el array tiene esta forma:
```js
{ role: 'user' | 'bot', content: 'texto', stores: [] }
```

### Por qué `stores.length > 0` es crítico

El backend siempre retorna `stores: []` cuando no hay resultados relevantes (score < 0.60). Si el componente renderizara las cards sin verificar que el array tiene elementos, mostraría un bloque vacío en cada respuesta del bot. La condición correcta:

```jsx
{msg.stores && msg.stores.length > 0 && (
  <div className="flex flex-col gap-2 mt-2 w-full">
    {msg.stores.map((store) => ( ... ))}
  </div>
)}
```

### Cold start de Ollama

La primera petición al chatbot después de levantar los contenedores puede tardar 30–60 segundos mientras Ollama carga el modelo `qwen2.5:0.5b` en memoria. El spinner de "pensando..." (puntos animados) cubre ese tiempo. Las peticiones siguientes tardan ~1–3 segundos.

---

## DEV vs Producción

| Aspecto | DEV (Vite) | PRD (Nginx) |
|---------|-----------|-------------|
| Puerto | 5173 | 80 (mapeado a 3000 en Docker) |
| Código fuente | Servido directamente con HMR | Compilado y minificado en `/dist` |
| Requests a la API | Vite proxy `/api` → `backend:4000` | Nginx proxy `/api` → `backend:4000` |
| Build necesario | No | `npm run build` genera `/dist` |
| Tiempo de arranque | ~1 segundo | ~1 segundo (Nginx ya tiene los archivos) |

En producción, el `Dockerfile` del frontend hace un multi-stage build:

```dockerfile
# Etapa 1: compilar
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build      # genera /app/dist

# Etapa 2: servir con Nginx (imagen mucho más pequeña)
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

La imagen final solo contiene Nginx y los archivos estáticos — no tiene Node.js ni el código fuente. Esto la hace significativamente más pequeña y segura.

---

## ¿Qué sigue?

Entender el modelo de datos → [05 — Base de Datos](./05-base-de-datos.md)
