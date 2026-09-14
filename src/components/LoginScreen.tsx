import { useState } from 'react';

interface Props {
  onLogin: (email: string, password: string, characterName?: string) => void;
}

export function LoginScreen({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [characterName, setCharacterName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register') {
      onLogin(email, password, characterName);
    } else {
      onLogin(email, password);
    }
  };

  const fillTest = (type: 'player' | 'god') => {
    if (type === 'player') {
      setEmail('player@test.local');
      setPassword('player12345');
    } else {
      setEmail('god@mmo.local');
      setPassword('god12345');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-gray-100 font-mono flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
            <span className="text-4xl">⚔️</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">MMO Survival</h1>
          <p className="text-sm text-gray-400">Браузерная 2D Open-World Survival MMO</p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-gray-200 border border-gray-700'
              }`}
            >
              Вход
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-gray-200 border border-gray-700'
              }`}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Имя персонажа</label>
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="MyHero"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="player@test.local"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium text-sm hover:opacity-90 transition-opacity"
            >
              {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-3">Тестовые аккаунты:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => fillTest('player')}
                className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-400 hover:bg-blue-500/20"
              >
                👤 Player
              </button>
              <button
                onClick={() => fillTest('god')}
                className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-400 hover:bg-purple-500/20"
              >
                👑 God Mode
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Mock Server — все данные в памяти браузера</p>
          <p className="mt-1">Первая регистрация создаст нового персонажа</p>
        </div>
      </div>
    </div>
  );
}
