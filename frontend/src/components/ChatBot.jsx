import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUser } from '../lib/auth';
import api from '../lib/axios';

const WELCOME = 'Hola! Soy el asistente de Nexo. Dime qué servicio buscas, en qué ciudad y cuándo, y te ayudo a encontrar el lugar perfecto.';

export default function ChatBot() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();

  const hidden =
    !user ||
    location.pathname.startsWith('/auth') ||
    location.pathname.startsWith('/admin');

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'bot', content: WELCOME }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  if (hidden) return null;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const history = messages.slice(-10).map((m) => ({
      role: m.role === 'bot' ? 'assistant' : 'user',
      content: m.content,
    }));

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsLoading(true);

    try {
      const { data } = await api.post('/chat', { message: text, history });
      if (data.success) {
        setMessages((prev) => [
          ...prev,
          { role: 'bot', content: data.data.response, stores: data.data.stores },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'bot', content: data.error || 'Ocurrió un error, intenta de nuevo.' },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', content: 'No pude conectarme. Intenta de nuevo en un momento.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div
          className="bg-white rounded-2xl flex flex-col overflow-hidden"
          style={{
            width: 380,
            height: 520,
            boxShadow: '0 4px 24px rgba(232,34,58,0.15)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ backgroundColor: '#E8223A' }}
          >
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-white font-semibold text-sm">Asistente Nexo</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:opacity-70 text-xl leading-none w-6 h-6 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className="rounded-xl px-3 py-2 text-sm max-w-[85%] leading-relaxed"
                  style={{
                    backgroundColor: msg.role === 'user' ? '#E8223A' : '#F5F5F5',
                    color: msg.role === 'user' ? '#fff' : '#0F0F0F',
                  }}
                >
                  {msg.content}
                </div>

                {msg.stores && msg.stores.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2 w-full">
                    {msg.stores.map((store) => {
                      const prices = (store.matchedServices || store.services || [])
                        .map((s) => parseFloat(s.price))
                        .filter((p) => p > 0);
                      const minPrice = prices.length ? Math.min(...prices) : null;
                      return (
                        <button
                          key={store.id}
                          onClick={() => { navigate(`/store/${store.slug}`); setIsOpen(false); }}
                          className="text-left bg-white rounded-xl p-3 hover:border-[#E8223A] transition-colors"
                          style={{ border: '1px solid #EBEBEB' }}
                        >
                          <div className="font-semibold text-sm" style={{ color: '#0F0F0F' }}>
                            {store.name}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: '#8A8A8A' }}>
                            {store.city}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-medium" style={{ color: '#E8223A' }}>
                              ★ {parseFloat(store.avg_rating || 0).toFixed(1)}
                            </span>
                            {minPrice && (
                              <span className="text-xs" style={{ color: '#3D3D3D' }}>
                                Desde ${minPrice.toLocaleString('es-CO')}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start">
                <div className="rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: '#F5F5F5', color: '#8A8A8A' }}>
                  <span className="inline-flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="animate-bounce inline-block"
                        style={{ animationDelay: `${delay}ms` }}
                      >
                        •
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 flex gap-2 shrink-0" style={{ borderTop: '1px solid #EBEBEB' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ej: quiero cortarme el cabello mañana en Barranquilla..."
              disabled={isLoading}
              className="flex-1 text-sm rounded-lg px-3 py-2 outline-none"
              style={{
                border: '1px solid #EBEBEB',
                color: '#0F0F0F',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="px-3 py-2 rounded-lg text-white text-base font-bold disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: '#E8223A' }}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-14 h-14 rounded-full text-white flex items-center justify-center hover:opacity-90 transition-opacity"
        style={{
          backgroundColor: '#E8223A',
          boxShadow: '0 4px 16px rgba(232,34,58,0.4)',
        }}
        aria-label="Abrir asistente"
      >
        {isOpen ? (
          <span className="text-2xl leading-none">×</span>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
