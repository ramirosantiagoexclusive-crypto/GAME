import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Database, Zap, Users, Skull, Package, 
  Map, Clock, Lock, Server, Layers, AlertTriangle,
  ChevronRight, CheckCircle2, Swords, Heart,
  FileCode, GitBranch, Cpu, Globe, Eye
} from 'lucide-react';

type Section = 'overview' | 'stack' | 'schema' | 'rules' | 'structure' | 'status';

const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Обзор', icon: <Eye size={18} /> },
  { id: 'stack', label: 'Стек', icon: <Layers size={18} /> },
  { id: 'schema', label: 'Схема БД', icon: <Database size={18} /> },
  { id: 'rules', label: 'Правила', icon: <Shield size={18} /> },
  { id: 'structure', label: 'Структура', icon: <FileCode size={18} /> },
  { id: 'status', label: 'Статус', icon: <CheckCircle2 size={18} /> },
];

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-gray-100 font-mono">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0d1220]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <Server size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">MMO Backend Architecture</h1>
              <p className="text-xs text-gray-500">2D Open-World Survival MMO • Server Design</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              v1.0 — Architecture Accepted
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar Navigation */}
        <nav className="w-56 shrink-0 hidden lg:block">
          <div className="sticky top-24 space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  activeSection === section.id
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Mobile Nav */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0d1220] border-t border-gray-800 z-50 px-2 py-2 flex gap-1 overflow-x-auto">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-all ${
                activeSection === section.id
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <main className="flex-1 min-w-0 pb-20 lg:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeSection === 'overview' && <OverviewSection />}
              {activeSection === 'stack' && <StackSection />}
              {activeSection === 'schema' && <SchemaSection />}
              {activeSection === 'rules' && <RulesSection />}
              {activeSection === 'structure' && <StructureSection />}
              {activeSection === 'status' && <StatusSection />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

/* ========== OVERVIEW SECTION ========== */
function OverviewSection() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Globe className="text-emerald-400" size={24} />
          Концепция Игры
        </h2>
        <p className="text-gray-400 mb-6">Браузерный 2D Open-World Survival MMO с персистентным миром</p>
        
        <div className="grid md:grid-cols-2 gap-4">
          <GameLoopCard />
          <CoreMechanicsCard />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <StatCard 
          icon={<Skull className="text-red-400" />} 
          title="Хардкор" 
          desc="Смерть = потеря инвентаря и экипировки" 
          color="red" 
        />
        <StatCard 
          icon={<Shield className="text-blue-400" />} 
          title="Сейф" 
          desc="Stash и Knowledge НЕ теряются" 
          color="blue" 
        />
        <StatCard 
          icon={<Package className="text-amber-400" />} 
          title="Экономика" 
          desc="100% предметов — крафт или админ-спавн" 
          color="amber" 
        />
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Cpu className="text-cyan-400" size={20} />
          Игровой Цикл
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          {['🏠 Хаб (Безопасная зона)', '→', '🎒 Подготовка', '→', '⚔️ Рейд (15 мин)', '→', '💰 Экстракция ИЛИ 💀 Смерть'].map((step, i) => (
            <span key={i} className={step === '→' ? 'text-gray-600 text-xl' : 'px-3 py-2 rounded-lg bg-gray-800/50 text-sm text-gray-200 border border-gray-700'}>
              {step}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function GameLoopCard() {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
      <h4 className="text-sm font-bold text-emerald-400 mb-3">Игровой Цикл</h4>
      <ul className="space-y-2 text-sm text-gray-300">
        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-emerald-400 mt-0.5 shrink-0" /> <span><strong className="text-white">Хаб</strong> — безопасная зона, крафт, торговля</span></li>
        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-emerald-400 mt-0.5 shrink-0" /> <span><strong className="text-white">Подготовка</strong> — экипировка, выбор рейда</span></li>
        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-emerald-400 mt-0.5 shrink-0" /> <span><strong className="text-white">Рейд</strong> — 15 минут, сбор ресурсов, PvP</span></li>
        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-emerald-400 mt-0.5 shrink-0" /> <span><strong className="text-white">Экстракция</strong> — портал-камень (одноразовый)</span></li>
      </ul>
    </div>
  );
}

function CoreMechanicsCard() {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
      <h4 className="text-sm font-bold text-cyan-400 mb-3">Ключевые Механики</h4>
      <ul className="space-y-2 text-sm text-gray-300">
        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-cyan-400 mt-0.5 shrink-0" /> <span><strong className="text-white">Режим Бога</strong> — Live Config, спавн, ивенты</span></li>
        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-cyan-400 mt-0.5 shrink-0" /> <span><strong className="text-white">Портальный камень</strong> — одноразовый, только в рейде</span></li>
        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-cyan-400 mt-0.5 shrink-0" /> <span><strong className="text-white">NPC/Боты</strong> — стейт-машина, свой инвентарь</span></li>
        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-cyan-400 mt-0.5 shrink-0" /> <span><strong className="text-white">Ресурсные узлы</strong> — ResourceNode с респавном</span></li>
      </ul>
    </div>
  );
}

function StatCard({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: string }) {
  const borderColor = {
    red: 'border-red-500/30',
    blue: 'border-blue-500/30',
    amber: 'border-amber-500/30',
  }[color] || 'border-gray-700';
  
  const bgColor = {
    red: 'bg-red-500/5',
    blue: 'bg-blue-500/5',
    amber: 'bg-amber-500/5',
  }[color] || 'bg-gray-900/50';

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-bold text-white text-sm">{title}</span>
      </div>
      <p className="text-xs text-gray-400">{desc}</p>
    </div>
  );
}

/* ========== STACK SECTION ========== */
function StackSection() {
  const stack = [
    { name: 'Node.js + TypeScript', version: 'Strict Mode', icon: <FileCode size={20} />, color: 'from-green-500 to-emerald-500', desc: 'Основной рантайм и язык' },
    { name: 'PostgreSQL', version: '16+', icon: <Database size={20} />, color: 'from-blue-500 to-indigo-500', desc: 'Персистентное хранилище' },
    { name: 'Prisma ORM', version: '5.x', icon: <Layers size={20} />, color: 'from-purple-500 to-violet-500', desc: 'Type-safe queries, migrations' },
    { name: 'Socket.io', version: '4.x', icon: <Zap size={20} />, color: 'from-yellow-500 to-orange-500', desc: 'WebSocket real-time коммуникация' },
    { name: 'Redis', version: '7+', icon: <Cpu size={20} />, color: 'from-red-500 to-rose-500', desc: 'Live Config, кэш, быстрые проверки' },
    { name: 'node-cron', version: '3.x', icon: <Clock size={20} />, color: 'from-cyan-500 to-teal-500', desc: 'Планировщик задач (респаун, AFK, ивенты)' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Layers className="text-purple-400" size={24} />
          Технологический Стек
        </h2>
        <p className="text-gray-400 mb-6">Production-ready стек для MMO сервера</p>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stack.map((tech) => (
            <div key={tech.name} className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 hover:border-gray-600 transition-colors">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tech.color} flex items-center justify-center text-white mb-3`}>
                {tech.icon}
              </div>
              <h4 className="font-bold text-white text-sm">{tech.name}</h4>
              <p className="text-xs text-gray-500 mb-1">v{tech.version}</p>
              <p className="text-xs text-gray-400">{tech.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-6">
        <h3 className="text-lg font-bold text-white mb-4">Архитектура Потока Данных</h3>
        <div className="rounded-lg bg-gray-900 border border-gray-700 p-4 overflow-x-auto">
          <pre className="text-xs text-gray-300 whitespace-pre">
{`┌─────────────┐     WebSocket      ┌──────────────────┐
│   Client    │◄──────────────────►│   Socket.io      │
│  (Browser)  │    JSON Events     │   Gateway        │
└─────────────┘                    └────────┬─────────┘
                                            │
                              ┌─────────────┼─────────────┐
                              ▼             ▼             ▼
                     ┌──────────────┐ ┌──────────┐ ┌──────────┐
                     │  Game Logic  │ │  Auth    │ │  God     │
                     │  Services    │ │  Module  │ │  Mode    │
                     └──────┬───────┘ └──────────┘ └──────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────┐
     │  PostgreSQL  │ │  Redis   │ │  Cron    │
     │  (Prisma)    │ │  (Cache) │ │  (Jobs)  │
     └──────────────┘ └──────────┘ └──────────┘`}
          </pre>
        </div>
      </div>
    </div>
  );
}

/* ========== SCHEMA SECTION ========== */
function SchemaSection() {
  const models = [
    { name: 'User', fields: ['id', 'email', 'passwordHash', 'role'], color: 'border-blue-500/40', icon: <Users size={14} /> },
    { name: 'Character', fields: ['id', 'name', 'x, y, zone', 'status, hp', 'maxStashSlots', 'currentRaidId', 'bagId'], color: 'border-emerald-500/40', icon: <Heart size={14} /> },
    { name: 'Bag', fields: ['id', 'name', 'tier', 'inventorySlots', 'stashUnlock'], color: 'border-amber-500/40', icon: <Package size={14} /> },
    { name: 'ItemTemplate', fields: ['id', 'name', 'type', 'maxDurability', 'defaultStats', 'salvageYield'], color: 'border-purple-500/40', icon: <FileCode size={14} /> },
    { name: 'ItemInstance', fields: ['id', 'templateId', 'currentDurability', 'customStats'], color: 'border-pink-500/40', icon: <Package size={14} /> },
    { name: 'InventorySlot', fields: ['id', 'characterId', 'itemInstanceId', 'quantity', 'slotIndex'], color: 'border-cyan-500/40', icon: <Package size={14} /> },
    { name: 'StashSlot', fields: ['id', 'characterId', 'itemInstanceId', 'quantity', 'slotIndex'], color: 'border-teal-500/40', icon: <Lock size={14} /> },
    { name: 'EquipmentSlot', fields: ['id', 'characterId', 'itemInstanceId', 'slotType'], color: 'border-orange-500/40', icon: <Swords size={14} /> },
    { name: 'Recipe', fields: ['id', 'name', 'requiredResources', 'resultTemplateId', 'resultQuantity'], color: 'border-violet-500/40', icon: <GitBranch size={14} /> },
    { name: 'PlayerKnowledge', fields: ['id', 'characterId', 'recipeId', 'unlockedAt'], color: 'border-indigo-500/40', icon: <Eye size={14} /> },
    { name: 'DroppedLoot', fields: ['id', 'itemInstanceId', 'quantity', 'x, y, zone', 'expiresAt'], color: 'border-yellow-500/40', icon: <Package size={14} /> },
    { name: 'ResourceNode', fields: ['id', 'zone', 'x, y', 'resourceTemplateId', 'respawnAt', 'isDepleted'], color: 'border-green-500/40', icon: <Map size={14} /> },
    { name: 'RaidInstance', fields: ['id', 'zoneId', 'startTime', 'endTime', 'status'], color: 'border-red-500/40', icon: <Swords size={14} /> },
    { name: 'Npc', fields: ['id', 'templateId', 'zone', 'x, y', 'hp, maxHp', 'state', 'targetId'], color: 'border-rose-500/40', icon: <AlertTriangle size={14} /> },
    { name: 'NpcInventorySlot', fields: ['id', 'npcId', 'itemInstanceId', 'quantity'], color: 'border-rose-400/40', icon: <Package size={14} /> },
    { name: 'WorldState', fields: ['id', 'currentTick', 'globalBuffs', 'lastDungeonReset', 'lastHubEvent'], color: 'border-gray-500/40', icon: <Globe size={14} /> },
    { name: 'GodAction', fields: ['id', 'userId', 'actionType', 'targetId', 'parameters'], color: 'border-fuchsia-500/40', icon: <Zap size={14} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Database className="text-blue-400" size={24} />
          Схема Базы Данных (Prisma)
        </h2>
        <p className="text-gray-400 mb-6">17 моделей • Единая точка истины • Не менять без веской причины</p>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {models.map((model) => (
            <div key={model.name} className={`rounded-lg border ${model.color} bg-gray-900/30 p-3`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-400">{model.icon}</span>
                <span className="font-bold text-white text-xs">{model.name}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {model.fields.map((field) => (
                  <span key={field} className="px-1.5 py-0.5 text-[10px] rounded bg-gray-800 text-gray-400 border border-gray-700">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="text-amber-400" size={18} />
          Ключевые Разделения
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
            <h4 className="text-sm font-bold text-purple-400 mb-2">ItemTemplate (Статичные)</h4>
            <p className="text-xs text-gray-400">Имя, тип, рецепт, базовый лут при переработке. Не меняется в рантайме.</p>
          </div>
          <div className="rounded-lg border border-pink-500/30 bg-pink-500/5 p-4">
            <h4 className="text-sm font-bold text-pink-400 mb-2">ItemInstance (Уникальные)</h4>
            <p className="text-xs text-gray-400">Текущая прочность, кастомные статы. Каждый экземпляр уникален.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========== RULES SECTION ========== */
function RulesSection() {
  const rules = [
    {
      id: 1,
      title: 'Разделение предметов',
      severity: 'critical',
      desc: 'Чёткое разделение на ItemTemplate (статичные данные) и ItemInstance (уникальный экземпляр с прочностью и статами).',
      detail: 'Инвентарь хранит ссылки на ItemInstance через InventorySlot.'
    },
    {
      id: 2,
      title: 'Парадокс сумки решён',
      severity: 'critical',
      desc: 'maxStashSlots — необратимая мета-прогрессия. Крутая сумка навсегда увеличивает слоты сейфа.',
      detail: 'При смерти теряется сумка, но содержимое сейфа остаётся нетронутым.'
    },
    {
      id: 3,
      title: 'Disconnect (AFK) — Рейд',
      severity: 'high',
      desc: 'Статус afk, таймер 2 минуты. После: телепорт в хаб, инвентарь и экипировка выпадают как DroppedLoot.',
      detail: 'Хардкор: потеря всего надетого и носимого.'
    },
    {
      id: 4,
      title: 'Disconnect (AFK) — Хаб',
      severity: 'medium',
      desc: 'Статус afk, таймер 5 минут. После: безопасный выход с сохранением координат.',
      detail: 'Никаких потерь в безопасной зоне.'
    },
    {
      id: 5,
      title: 'Race Condition — Подбор лута',
      severity: 'critical',
      desc: 'Любая операция инвентаря/подбора лута — Prisma Transaction с Serializable или SELECT FOR UPDATE.',
      detail: 'Блокировка строки DroppedLoot для предотвращения дуплирования.'
    },
    {
      id: 6,
      title: 'Портальный камень',
      severity: 'high',
      desc: 'Одноразовый (type: "portal_stone"). Работает ТОЛЬКО в рейдовых зонах. При использовании — уничтожается.',
      detail: 'ItemInstance удаляется из БД после успешной экстракции.'
    },
    {
      id: 7,
      title: 'PvP в хабе отключён',
      severity: 'critical',
      desc: 'Серверная валидация блокирует любые боевые действия в zone === "hub".',
      detail: 'Проверка ДО обработки урона, не после.'
    },
    {
      id: 8,
      title: 'TTL Лута',
      severity: 'high',
      desc: 'DroppedLoot имеет expiresAt (now + 10 минут). Cron удаляет просроченный лут.',
      detail: 'Индекс [zone, expiresAt] для быстрого поиска.'
    },
    {
      id: 9,
      title: 'Крафт и Переработка',
      severity: 'high',
      desc: 'Обязательная проверка свободных слотов. Запрет salvage предметов в EquipmentSlot.',
      detail: 'Валидация ДО начала операции, не в процессе.'
    },
    {
      id: 10,
      title: 'Ресурсные узлы',
      severity: 'medium',
      desc: 'Ресурсы в хабе — ResourceNode (x, y, zone, respawnAt, isDepleted).',
      detail: 'При добыче: isDepleted=true, обновление respawnAt.'
    },
  ];

  const severityStyles = {
    critical: 'border-red-500/40 bg-red-500/5',
    high: 'border-amber-500/40 bg-amber-500/5',
    medium: 'border-blue-500/40 bg-blue-500/5',
  };

  const severityBadge = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Shield className="text-red-400" size={24} />
          Критические Правила (STRICT MODE)
        </h2>
        <p className="text-gray-400 mb-6">10 правил, нарушение которых ведёт к эксплойтам и багам</p>
        
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className={`rounded-lg border ${severityStyles[rule.severity as keyof typeof severityStyles]} p-4`}>
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-300 border border-gray-700">
                  {rule.id}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-bold text-white text-sm">{rule.title}</h4>
                    <span className={`px-2 py-0.5 text-[10px] rounded border ${severityBadge[rule.severity as keyof typeof severityBadge]}`}>
                      {rule.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mb-1">{rule.desc}</p>
                  <p className="text-xs text-gray-500 italic">{rule.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
        <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
          <AlertTriangle size={20} />
          Защита от Эксплойтов
        </h3>
        <div className="grid md:grid-cols-2 gap-3 text-xs text-gray-300">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <span>Все операции инвентаря — в транзакциях с Serializable isolation</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <span>Сервер — единственный источник истины (клиент не доверяется)</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <span>PvP проверка ДО обработки урона, не после</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <span>AFK таймеры на сервере, не на клиенте</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <span>Портальный камень удаляется атомарно с экстракцией</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <span>Cron-очистка лута предотвращает накопление мусора в БД</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========== STRUCTURE SECTION ========== */
function StructureSection() {
  const folders = [
    { path: 'src/', type: 'folder', desc: 'Исходный код сервера' },
    { path: 'src/config/', type: 'folder', desc: 'Конфигурация (env, constants)' },
    { path: 'src/modules/', type: 'folder', desc: 'Бизнес-логика по доменам' },
    { path: 'src/modules/auth/', type: 'folder', desc: 'Регистрация, логин, JWT' },
    { path: 'src/modules/character/', type: 'folder', desc: 'Создание, движение, статус' },
    { path: 'src/modules/inventory/', type: 'folder', desc: 'Инвентарь, экипировка, сейф' },
    { path: 'src/modules/combat/', type: 'folder', desc: 'PvP, PvE, урон, смерть' },
    { path: 'src/modules/crafting/', type: 'folder', desc: 'Крафт, переработка, рецепты' },
    { path: 'src/modules/raid/', type: 'folder', desc: 'Рейды, экстракция, таймеры' },
    { path: 'src/modules/world/', type: 'folder', desc: 'Ресурсные узлы, лут, NPC' },
    { path: 'src/modules/god/', type: 'folder', desc: 'Режим Бога, Live Config' },
    { path: 'src/socket/', type: 'folder', desc: 'Socket.io handlers & middleware' },
    { path: 'src/services/', type: 'folder', desc: 'Общие сервисы (Redis, Cron, Prisma)' },
    { path: 'src/middleware/', type: 'folder', desc: 'Auth, rate-limit, zone-check' },
    { path: 'src/utils/', type: 'folder', desc: 'Утилиты, хелперы, типы' },
    { path: 'prisma/', type: 'folder', desc: 'Schema.prisma, миграции, сиды' },
    { path: 'src/index.ts', type: 'file', desc: 'Точка входа сервера' },
    { path: 'src/socket/index.ts', type: 'file', desc: 'Инициализация Socket.io' },
    { path: 'src/services/prisma.ts', type: 'file', desc: 'Prisma Client singleton' },
    { path: 'src/services/redis.ts', type: 'file', desc: 'Redis Client singleton' },
    { path: 'src/services/cron.ts', type: 'file', desc: 'Cron jobs (AFK, loot TTL, respawn)' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <FileCode className="text-cyan-400" size={24} />
          Структура Серверного Проекта
        </h2>
        <p className="text-gray-400 mb-6">Модульная архитектура с разделением по доменам</p>
        
        <div className="rounded-lg bg-gray-900 border border-gray-700 overflow-hidden">
          {folders.map((item, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-2 ${i !== folders.length - 1 ? 'border-b border-gray-800' : ''} hover:bg-gray-800/30 transition-colors`}>
              <span className={`text-xs ${item.type === 'folder' ? 'text-amber-400' : 'text-blue-400'}`}>
                {item.type === 'folder' ? '📁' : '📄'}
              </span>
              <code className="text-xs text-gray-200 font-mono">{item.path}</code>
              <span className="text-xs text-gray-500 ml-auto hidden sm:block">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-6">
        <h3 className="text-lg font-bold text-white mb-4">Socket.io Events</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {[
            { event: 'character:move', dir: 'C→S', desc: 'Движение персонажа' },
            { event: 'character:attack', dir: 'C→S', desc: 'Атака цели' },
            { event: 'inventory:pickup', dir: 'C→S', desc: 'Подбор лута' },
            { event: 'inventory:equip', dir: 'C→S', desc: 'Экипировать предмет' },
            { event: 'craft:start', dir: 'C→S', desc: 'Начать крафт' },
            { event: 'craft:salvage', dir: 'C→S', desc: 'Переработать предмет' },
            { event: 'raid:enter', dir: 'C→S', desc: 'Войти в рейд' },
            { event: 'raid:extract', dir: 'C→S', desc: 'Использовать портал-камень' },
            { event: 'resource:harvest', dir: 'C→S', desc: 'Добыть ресурс' },
            { event: 'world:state', dir: 'S→C', desc: 'Обновление мира (broadcast)' },
            { event: 'combat:hit', dir: 'S→C', desc: 'Результат атаки' },
            { event: 'loot:dropped', dir: 'S→C', desc: 'Новый лут на земле' },
            { event: 'character:died', dir: 'S→C', desc: 'Персонаж мёртв' },
            { event: 'god:spawn', dir: 'G→S', desc: 'Спавн предметов/NPC' },
            { event: 'god:config', dir: 'G→S', desc: 'Изменить Live Config' },
          ].map((ev) => (
            <div key={ev.event} className="flex items-center gap-2 px-3 py-2 rounded bg-gray-900 border border-gray-700">
              <span className={`px-1.5 py-0.5 text-[10px] rounded font-bold ${
                ev.dir === 'C→S' ? 'bg-blue-500/20 text-blue-400' : 
                ev.dir === 'S→C' ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-purple-500/20 text-purple-400'
              }`}>{ev.dir}</span>
              <code className="text-xs text-gray-200">{ev.event}</code>
              <span className="text-[10px] text-gray-500 ml-auto">{ev.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========== STATUS SECTION ========== */
function StatusSection() {
  const tasks = [
    { name: 'Архитектура принята', status: 'done', detail: 'Схема, правила, стек — утверждены' },
    { name: 'Prisma Schema', status: 'done', detail: '17 моделей, индексы, связи' },
    { name: 'Базовый каркас сервера', status: 'pending', detail: 'Express + Socket.io + Prisma + Redis' },
    { name: 'Auth модуль', status: 'pending', detail: 'Регистрация, логин, JWT, role guard' },
    { name: 'Character модуль', status: 'pending', detail: 'Создание, движение, координаты' },
    { name: 'Inventory модуль', status: 'pending', detail: 'Слоты, экипировка, сейф, сумка' },
    { name: 'Combat модуль', status: 'pending', detail: 'PvP/PvE, урон, смерть, лут-дроп' },
    { name: 'Crafting модуль', status: 'pending', detail: 'Рецепты, крафт, salvage' },
    { name: 'Raid модуль', status: 'pending', detail: 'Вход, таймер, экстракция, вайп' },
    { name: 'World модуль', status: 'pending', detail: 'ResourceNode, DroppedLoot, NPC AI' },
    { name: 'God Mode', status: 'pending', detail: 'Live Config, спавн, ивенты' },
    { name: 'Cron Jobs', status: 'pending', detail: 'AFK, loot TTL, resource respawn' },
    { name: 'Anti-Exploit', status: 'pending', detail: 'Transactions, zone validation, rate-limit' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <CheckCircle2 className="text-emerald-400" size={24} />
          Статус Разработки
        </h2>
        <p className="text-gray-400 mb-6">Итеративная разработка — готов к генерации production-ready кода</p>
        
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.name} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
              task.status === 'done' 
                ? 'border-emerald-500/30 bg-emerald-500/5' 
                : 'border-gray-700 bg-gray-900/30'
            }`}>
              {task.status === 'done' ? (
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              ) : (
                <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-600 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${task.status === 'done' ? 'text-emerald-300' : 'text-gray-200'}`}>
                  {task.name}
                </span>
                <p className="text-xs text-gray-500">{task.detail}</p>
              </div>
              <span className={`px-2 py-0.5 text-[10px] rounded border ${
                task.status === 'done' 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                  : 'bg-gray-700/50 text-gray-400 border-gray-600'
              }`}>
                {task.status === 'done' ? 'DONE' : 'TODO'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
        <h3 className="text-lg font-bold text-emerald-400 mb-3">🟢 Готовность к Разработке</h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p>✅ Архитектура усвоена полностью</p>
          <p>✅ Схема Prisma принята как единая точка истины</p>
          <p>✅ Все 10 критических правил зафиксированы</p>
          <p>✅ Защита от эксплойтов учтена на уровне дизайна</p>
          <p>✅ Готов генерировать production-ready TypeScript код</p>
          <p className="pt-2 text-emerald-400 font-medium">→ Жду указаний по первой итерации разработки</p>
        </div>
      </div>
    </div>
  );
}
