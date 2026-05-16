import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getUser } from '../lib/auth';
import api from '../lib/axios';

const WELCOME = 'Bienvenido a Nexo AI. ¿En qué puedo ayudarle hoy?';

export default function AgentChat() {
  const location = useLocation();
  const user = getUser();

  const hidden =
    !user ||
    location.pathname.startsWith('/auth') ||
    location.pathname.startsWith('/admin');

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }]);
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
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsLoading(true);

    try {
      const { data } = await api.post('/agent/chat', { message: text, history });
      if (data.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.data.response }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.error || 'Hubo un problema. Por favor intente nuevamente.' },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Hubo un problema. Por favor intente nuevamente.' },
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
          style={{ width: 380, height: 520, boxShadow: '0 4px 24px rgba(232,34,58,0.15)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ backgroundColor: '#E8223A' }}
          >
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                <circle cx="12" cy="16" r="1" fill="white" />
              </svg>
              <span className="text-white font-semibold text-sm">Nexo AI</span>
              <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#4ade80', boxShadow: '0 0 4px #4ade80', animation: 'pulse 2s infinite' }}
                />
                En línea
              </span>
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
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="rounded-xl px-3 py-2 text-sm max-w-[85%] leading-relaxed whitespace-pre-wrap"
                  style={{
                    backgroundColor: msg.role === 'user' ? '#E8223A' : '#F5F5F5',
                    color: msg.role === 'user' ? '#fff' : '#0F0F0F',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
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
              placeholder="Escribe tu mensaje..."
              disabled={isLoading}
              className="flex-1 text-sm rounded-lg px-3 py-2 outline-none"
              style={{ border: '1px solid #EBEBEB', color: '#0F0F0F' }}
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
        style={{ backgroundColor: '#E8223A', boxShadow: '0 4px 16px rgba(232,34,58,0.4)' }}
        aria-label="Abrir Nexo AI"
      >
        {isOpen ? (
          <span className="text-2xl leading-none">×</span>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <circle cx="12" cy="16" r="1" fill="white" />
          </svg>
        )}
      </button>
    </div>
  );
}
