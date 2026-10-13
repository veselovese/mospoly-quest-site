import { useEffect, useState } from 'react';

// Ключ для сохранения прогресса квеста в localStorage
const STORAGE_KEY = 'polytech-cyber-quest-progress';

// Начальное состояние квеста
const DEFAULT_PROGRESS = {
  active: 0,
  solved: [],
  showBriefing: true,
  readStories: [],
};

// Функция загрузки прогресса из localStorage
function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_PROGRESS;

    const parsed = JSON.parse(saved);

    // Проверяем сохранённые данные и восстанавливаем только корректные значения
    return {
      active: Number.isInteger(parsed.active) && parsed.active >= 0 ? parsed.active : 0,
      solved: Array.isArray(parsed.solved) ? parsed.solved : [],
      showBriefing: typeof parsed.showBriefing === 'boolean' ? parsed.showBriefing : true,
      readStories: Array.isArray(parsed.readStories) ? parsed.readStories : [],
    };
  } catch {
    // При ошибке возвращаем начальное состояние
    return DEFAULT_PROGRESS;
  }
}

// Управляет состоянием и сохраняет прогресс квеста после каждого изменения
export function useQuestProgress() {
  const [progress, setProgress] = useState(loadProgress);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // если недоступно localStorage, квест продолжает работать в памяти.
    }
  }, [progress]);

  // Сбрасывает прогресс квеста и удаляет сохранённые данные
  function resetProgress() {
    setProgress(DEFAULT_PROGRESS);

    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    // Текущий этап квеста
    active: progress.active,
    setActive: (active) => setProgress((current) => ({ ...current, active })),

    // Выполненные задания
    solved: progress.solved,
    setSolved: (solved) =>
      setProgress((current) => ({
        ...current,
        solved: typeof solved === 'function' ? solved(current.solved) : solved,
      })),

    // Состояние вводного брифинга
    showBriefing: progress.showBriefing,
    setShowBriefing: (showBriefing) =>
      setProgress((current) => ({ ...current, showBriefing })),

    // Прочитанные истории
    readStories: progress.readStories,
    setReadStories: (readStories) =>
      setProgress((current) => ({
        ...current,
        readStories: typeof readStories === 'function' ? readStories(current.readStories) : readStories,
      })),

    resetProgress,
  };
}
