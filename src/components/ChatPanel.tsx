import { useState, useRef, useEffect } from 'react';
import type { CharacterData, ChatMessage } from '../App';

interface Props {
  messages: ChatMessage[];
  character: CharacterData;
  onSend: (channel: 'global' | 'zone' | 'private', message: string) => void;
}

export function ChatPanel({ messages, character, onSend }: Props) {
  const [channel, setChannel] = useState<'global' | 'zone' | 'private'>('global');
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSend(channel, message.trim());
    setMessage('');
  };

  const getChannelColor = (ch: string) => {
    switch (ch) {
      case 'global': return 'text-blue-400';
      case 'zone': return 'text-emerald-400';
      case 'private': return 'text-purple-400';
      case 'system': return 'text-amber-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-4 flex flex-col h-[600px]">
      <h2 className="text-lg font-bold text-white mb-3">💬 Чат</h2>

      {/* Channel selector */}
      <div className="flex gap-2 mb-3">
        {(['global', 'zone', 'private'] as const).map(ch => (
          <button
            key={ch}
            onClick={() => setChannel(ch)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
              channel === ch
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-gray-400 border border-gray-700 hover:text-gray-200'
            }`}
          >
            {ch === 'global' ? '🌍 Глобальный' : ch === 'zone' ? '📍 Зона' : '👤 Личный'}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-lg bg-gray-900/50 border border-gray-700 p-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-8">Нет сообщений</p>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="text-xs">
              <span className={`${getChannelColor(msg.channel)} font-medium`}>
                [{msg.channel.toUpperCase()}]
              </span>{' '}
              {msg.senderName && (
                <span className="text-white font-medium">{msg.senderName}: </span>
              )}
              <span className="text-gray-300">{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Введите сообщение..."
          maxLength={200}
          className="flex-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm hover:bg-emerald-500/30"
        >
          Отправить
        </button>
      </form>
    </div>
  );
}
