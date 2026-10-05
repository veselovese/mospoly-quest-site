import { useCallback, useEffect, useState } from 'react';

const LEGACY_STORAGE_KEY = 'polytech-cyber-quest-progress';
const STORAGE_KEY = 'polytech-cyber-quest-progress-v2';

const MODULE_IDS = ['sql', 'python', 'security', 'network', 'workflow'];

export const DIFFICULTIES = [
  { id: 'easy', label: 'Простая' },
  { id: 'medium', label: 'Средняя' },
  { id: 'hard', label: 'Тяжёлая' },
];

const DIFFICULTY_IDS = DIFFICULTIES.map((item) => item.id);

const STORY_KEYS = MODULE_IDS.flatMap((id) => [
  `${id}-intro`,
  `${id}-outcome`,
]);

function createProgress() {
  return {
    active: 0,
    solved: [],
    showBriefing: true,
    readStories: [],
  };
}

function createState() {
  return {
    version: 2,
    difficulty: 'medium',
    levels: {
      easy: createProgress(),
      medium: createProgress(),
      hard: createProgress(),
    },
  };
}

// Восстанавливаем только допустимые значения.
// Решённые задания должны образовывать последовательную цепочку.
function normalizeProgress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createProgress();
  }

  const savedSolved = Array.isArray(value.solved)
    ? value.solved.filter((id) => MODULE_IDS.includes(id))
    : [];

  const solved = [];

  for (const id of MODULE_IDS) {
    if (!savedSolved.includes(id)) break;
    solved.push(id);
  }

  const savedActive = Number.isInteger(value.active) ? value.active : 0;

  const active = Math.min(
    Math.max(savedActive, 0),
    MODULE_IDS.length - 1,
    solved.length,
  );

  const readStories = Array.isArray(value.readStories)
    ? [...new Set(value.readStories.filter((key) => STORY_KEYS.includes(key)))]
    : [];

  return {
    active,
    solved,
    showBriefing:
      typeof value.showBriefing === 'boolean' ? value.showBriefing : true,
    readStories,
  };
}

function readStorage(key) {
  try {
    if (typeof window === 'undefined') return null;

    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadState() {
  const initial = createState();
  const saved = readStorage(STORAGE_KEY);

  if (
    saved &&
    saved.version === 2 &&
    saved.levels &&
    typeof saved.levels === 'object'
  ) {
    return {
      version: 2,
      difficulty: DIFFICULTY_IDS.includes(saved.difficulty)
        ? saved.difficulty
        : 'medium',
      levels: {
        easy: normalizeProgress(saved.levels.easy),
        medium: normalizeProgress(saved.levels.medium),
        hard: normalizeProgress(saved.levels.hard),
      },
    };
  }

  // Старый квест соответствует средней сложности.
  const legacy = readStorage(LEGACY_STORAGE_KEY);

  if (legacy) {
    initial.levels.medium = normalizeProgress(legacy);
  }

  return initial;
}

export function useQuestProgress() {
  const [state, setState] = useState(loadState);
  const difficulty = state.difficulty;
  const progress = state.levels[difficulty];

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // При недоступном хранилище квест работает в памяти.
    }
  }, [state]);

  const setDifficulty = useCallback((nextDifficulty) => {
    if (!DIFFICULTY_IDS.includes(nextDifficulty)) return;

    setState((current) => {
      if (current.difficulty === nextDifficulty) return current;

      return {
        ...current,
        difficulty: nextDifficulty,
      };
    });
  }, []);

  const updateProgress = useCallback(
    (field, value) => {
      setState((current) => {
        // Старый callback не должен менять другой уровень после переключения.
        if (current.difficulty !== difficulty) return current;

        const currentProgress = current.levels[difficulty];
        const nextValue =
          typeof value === 'function'
            ? value(currentProgress[field])
            : value;

        const nextProgress = normalizeProgress({
          ...currentProgress,
          [field]: nextValue,
        });

        return {
          ...current,
          levels: {
            ...current.levels,
            [difficulty]: nextProgress,
          },
        };
      });
    },
    [difficulty],
  );

  const setActive = useCallback(
    (value) => updateProgress('active', value),
    [updateProgress],
  );

  const setSolved = useCallback(
    (value) => updateProgress('solved', value),
    [updateProgress],
  );

  const setShowBriefing = useCallback(
    (value) => updateProgress('showBriefing', value),
    [updateProgress],
  );

  const setReadStories = useCallback(
    (value) => updateProgress('readStories', value),
    [updateProgress],
  );

  const resetProgress = useCallback(() => {
    setState((current) => {
      if (current.difficulty !== difficulty) return current;

      return {
        ...current,
        levels: {
          ...current.levels,
          [difficulty]: createProgress(),
        },
      };
    });
  }, [difficulty]);

  return {
    difficulty,
    setDifficulty,
    active: progress.active,
    setActive,
    solved: progress.solved,
    setSolved,
    showBriefing: progress.showBriefing,
    setShowBriefing,
    readStories: progress.readStories,
    setReadStories,
    resetProgress,
  };
}
