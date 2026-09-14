import type { InventorySlotData } from '../App';
import { getRecipes, getTemplates } from '../mock/server';

interface Props {
  inventory: InventorySlotData[];
  onCraft: (recipeId: string) => void;
  onSalvage: (slotIndex: number) => void;
}

export function CraftingPanel({ inventory, onCraft, onSalvage }: Props) {
  const recipes = getRecipes();
  const templates = getTemplates();

  const getInventoryCount = (templateId: string) => {
    return inventory
      .filter(s => s.templateId === templateId)
      .reduce((sum, s) => sum + s.quantity, 0);
  };

  const canCraft = (recipe: ReturnType<typeof getRecipes>[0]) => {
    return Object.entries(recipe.requiredResources).every(([templateId, required]) => {
      return getInventoryCount(templateId) >= required;
    });
  };

  return (
    <div className="space-y-4">
      {/* Recipes */}
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-4">
        <h2 className="text-lg font-bold text-white mb-3">🔨 Рецепты</h2>
        <div className="space-y-2">
          {recipes.map(recipe => {
            const result = templates.find(t => t.id === recipe.resultTemplateId);
            const available = canCraft(recipe);
            return (
              <div
                key={recipe.id}
                className={`rounded-lg border p-3 ${
                  available ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-700 bg-gray-900/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium text-white">{recipe.name}</div>
                    <div className="text-[10px] text-gray-400">Результат: {result?.name} ×{recipe.resultQuantity}</div>
                  </div>
                  <button
                    onClick={() => onCraft(recipe.id)}
                    disabled={!available}
                    className={`px-3 py-1.5 text-xs rounded-lg ${
                      available
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Создать
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(recipe.requiredResources).map(([templateId, required]) => {
                    const template = templates.find(t => t.id === templateId);
                    const have = getInventoryCount(templateId);
                    const enough = have >= required;
                    return (
                      <span
                        key={templateId}
                        className={`px-2 py-0.5 text-[10px] rounded ${
                          enough ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {template?.name}: {have}/{required}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Salvage */}
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-4">
        <h2 className="text-lg font-bold text-white mb-3">♻️ Переработка</h2>
        <p className="text-xs text-gray-400 mb-3">Разобрать предметы на ресурсы</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {inventory.map(slot => {
            const template = templates.find(t => t.id === slot.templateId);
            const canSalvage = template?.salvageYield && Object.keys(template.salvageYield).length > 0;
            return (
              <div key={slot.slotIndex} className="rounded-lg border border-gray-700 bg-gray-900/30 p-2">
                <div className="text-xs text-white truncate">{slot.templateName}</div>
                <div className="text-[10px] text-gray-400 mb-1">×{slot.quantity}</div>
                {canSalvage && (
                  <button
                    onClick={() => onSalvage(slot.slotIndex)}
                    className="w-full px-2 py-1 text-[10px] rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                  >
                    Разобрать
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
