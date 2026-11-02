// Общая карта квестов: UI выбирается по ключу, который возвращает backend.
import {
  BLOCKS,
  QUEST_TASKS,
  SHIFT_START_LOG,
  getEnding,
  personalize as personalizeZoo,
} from './zooQuest';
import {
  ORLOV_BLOCKS,
  ORLOV_QUEST_TITLE,
  ORLOV_SHIFT_START_LOG,
  ORLOV_TASKS,
  getOrlovEnding,
  personalize as personalizeOrlov,
} from './orlovQuest';

export const QUEST_REGISTRY = {
  zoo: {
    key: 'zoo',
    title: 'Код манула',
    blocks: BLOCKS,
    tasks: QUEST_TASKS,
    shiftStartLog: SHIFT_START_LOG,
    personalize: personalizeZoo,
    getEnding,
    fallbackConfig: {
      key: 'zoo',
      title: 'Код манула',
      brand_label: 'Московский зоопарк · лаборатория генетики',
      welcome_lead: 'Ночная смена в лаборатории генетики Московского зоопарка.',
      welcome_text: 'У манула родился детёныш, а база ДНК-паспортов дала сбой. Помогите восстановить данные до утра.',
      duration_text: '20–30 минут',
      task_count: 7,
    },
  },
  orlov: {
    key: 'orlov',
    title: ORLOV_QUEST_TITLE,
    blocks: ORLOV_BLOCKS,
    tasks: ORLOV_TASKS,
    shiftStartLog: ORLOV_SHIFT_START_LOG,
    personalize: personalizeOrlov,
    getEnding: getOrlovEnding,
    fallbackConfig: {
      key: 'orlov',
      title: ORLOV_QUEST_TITLE,
      brand_label: 'Polytech Cyber Quest · расследование 07',
      welcome_lead: 'Цифровое расследование: восстановите цепочку следов Орлова.',
      welcome_text: 'После запуска NOVA-17 инженер Орлов исчез из журнала. Проверьте SQL-записи, восстановите парсер логов, разберите подозрительное письмо, маршрут сигнала и историю Git.',
      duration_text: '20–30 минут',
      task_count: 5,
    },
  },
};

export function normalizeQuestKey(key) {
  return key === 'orlov' ? 'orlov' : 'zoo';
}

export function getFallbackQuestConfig(key) {
  return QUEST_REGISTRY[normalizeQuestKey(key)].fallbackConfig;
}
