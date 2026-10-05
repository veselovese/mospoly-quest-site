import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Code2,
  Database,
  GitBranch,
  Network,
  RotateCcw,
  ShieldAlert,
  X,
} from 'lucide-react';

// ---------- Общие элементы интерфейса ----------

function Field({
  label,
  value,
  options,
  onChange,
  disabled = false,
}) {
  return (
    <label className="query-part">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Выберите вариант...</option>
        {options.map((option) => {
          const item =
            typeof option === 'string'
              ? { value: option, label: option }
              : option;

          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function HintBox({ hints }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const canReveal = visibleCount < hints.length;

  return (
    <aside className="hint-dock" aria-label="Подсказки">
      <button
        className="hint-trigger"
        disabled={!canReveal}
        onClick={() =>
          setVisibleCount((count) =>
            Math.min(count + 1, hints.length),
          )
        }
      >
        <AlertTriangle size={16} />
        {canReveal
          ? `Подсказка ${visibleCount}/${hints.length}`
          : 'Все подсказки открыты'}
      </button>

      {visibleCount > 0 && (
        <div className="hint-stack">
          {hints.slice(0, visibleCount).map((hint, index) => (
            <p key={hint}>
              <strong>{index + 1}</strong>
              {hint}
            </p>
          ))}
        </div>
      )}
    </aside>
  );
}

function Submit({
  correct,
  solved,
  onSolve,
  icon: Icon,
  children = 'Подтвердить улику',
}) {
  return (
    <button
      className="primary-action"
      disabled={!correct || solved}
      onClick={onSolve}
    >
      <Icon size={18} />
      {children}
    </button>
  );
}

function Result({ children }) {
  return (
    <div className="terminal-output">
      <span>Результат</span>
      <strong>{children}</strong>
    </div>
  );
}

function DataTable({ title, columns, rows }) {
  return (
    <div className="difficulty-table-block">
      {title && <div className="panel-title">{title}</div>}

      <div className="difficulty-table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map(([key, label]) => (
                <th key={key}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  Нет строк для выбранных условий.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id ?? index}>
                  {columns.map(([key]) => (
                    <td key={key}>{row[key]}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Flags({ items, selected, setSelected, solved }) {
  function toggle(value) {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  return (
    <div className="flag-list">
      {items.map((item) => {
        const picked = selected.includes(item.id);

        return (
          <button
            key={item.id}
            className={`flag-button ${picked ? 'selected' : ''}`}
            disabled={solved}
            aria-pressed={picked}
            onClick={() => toggle(item.id)}
          >
            {picked && (
              <b className="pick-order">
                {selected.indexOf(item.id) + 1}
              </b>
            )}
            {picked ? <Check size={16} /> : <X size={16} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function sameSet(selected, expected) {
  return (
    selected.length === expected.length &&
    expected.every((item) => selected.includes(item))
  );
}

function sameOrder(selected, expected) {
  return (
    selected.length === expected.length &&
    selected.every((item, index) => item === expected[index])
  );
}

function StepPool({ steps, selected, setSelected, solved }) {
  // Детерминированный порядок, отличающийся от правильной цепочки.
  const pool = steps
    .slice()
    .sort(
      (a, b) =>
        a.length - b.length || a.localeCompare(b, 'ru'),
    );

  function choose(step) {
    setSelected((current) =>
      current.includes(step) ? current : [...current, step],
    );
  }

  return (
    <>
      <div className="step-pool">
        {pool.map((step) => (
          <button
            key={step}
            className={`step-chip ${
              selected.includes(step) ? 'used' : ''
            }`}
            disabled={solved || selected.includes(step)}
            onClick={() => choose(step)}
          >
            {step}
          </button>
        ))}
      </div>

      <button
        className="ghost-action"
        disabled={solved}
        onClick={() => setSelected([])}
      >
        <RotateCcw size={16} />
        Начать заново
      </button>
    </>
  );
}

function Pipeline({ steps }) {
  return (
    <ol className="pipeline">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

function RouteStrip({ route }) {
  return (
    <div className="route-strip">
      {route.length === 0 && (
        <span className="muted">Ожидаем первый узел</span>
      )}
      {route.map((node, index) => (
        <span key={node}>
          {node}
          {index < route.length - 1 && (
            <ChevronRight size={16} />
          )}
        </span>
      ))}
    </div>
  );
}

function NetworkTopology({
    nodes,
    nodeLayout,
    route,
    onPick,
    solved,
    className = '',
  }) {
    return (
      <div className={`topology difficulty-topology ${className}`}>
        {nodes.map((node) => {
          const pickIndex = route.indexOf(node);
          const picked = pickIndex >= 0;
  
          return (
            <button
              key={node}
              type="button"
              className={`node ${picked ? 'picked' : ''}`}
              style={nodeLayout[node]}
              disabled={solved}
              aria-pressed={picked}
              aria-label={
                picked
                  ? `${node}, выбран шагом ${pickIndex + 1}`
                  : node
              }
              onClick={() => onPick(node)}
            >
              {picked && (
                <b className="pick-order">
                  {pickIndex + 1}
                </b>
              )}
  
              <Network size={22} />
              <span>{node}</span>
            </button>
          );
        })}
      </div>
    );
  }
  

// ---------- Простая сложность ----------

function EasySql({ onSolve, solved }) {
  const [fields, setFields] = useState('');
  const [filter, setFilter] = useState('');

  const sourceRows = [
    {
      id: 1,
      user_id: 'guest',
      room: 'Лобби',
      terminal: 'K-09',
    },
    {
      id: 2,
      user_id: 'orlov',
      room: 'Серверная C',
      terminal: 'B-14',
    },
    {
      id: 3,
      user_id: 'admin',
      room: 'Лаборатория 3',
      terminal: 'A-02',
    },
  ];

  const rows = filter
    ? sourceRows.filter((row) => row.user_id === filter)
    : [];

  const columns =
    fields === 'room, terminal'
      ? [
          ['room', 'место'],
          ['terminal', 'терминал'],
        ]
      : [['user_id', 'пользователь']];

  const correct =
    fields === 'room, terminal' && filter === 'orlov';

  return (
    <div className="two-column challenge-area">
      <HintBox
        hints={[
          'В этой выдержке есть только одна запись Орлова.',
          'Нужно показать room и terminal.',
          'Искомый пользователь — orlov.',
        ]}
      />

      <div className="workbench">
        <h2>Найдите запись Орлова</h2>
        <p>
          В короткой выдержке журнала выберите пользователя
          Орлова и покажите только место и терминал. Сортировка
          не нужна: запись Орлова здесь одна.
        </p>

        <div className="query-builder">
          <Field
            label="Какие поля показать"
            value={fields}
            options={['user_id', 'room, terminal']}
            onChange={setFields}
            disabled={solved}
          />
          <Field
            label="Кого ищем"
            value={filter}
            options={['guest', 'orlov', 'admin']}
            onChange={setFilter}
            disabled={solved}
          />
        </div>

        <pre className="code-window">{`SELECT ${fields || '...'}
FROM access_log
WHERE user_id = '${filter || '...'}';`}</pre>

        <Submit
          correct={correct}
          solved={solved}
          onSolve={onSolve}
          icon={Database}
        />
      </div>

      <div className="data-table">
        <DataTable
          title="Выдержка журнала"
          columns={[
            ['user_id', 'пользователь'],
            ['room', 'место'],
            ['terminal', 'терминал'],
          ]}
          rows={sourceRows}
        />

        {fields && filter && (
          <DataTable
            title="Предпросмотр результата"
            columns={columns}
            rows={rows}
          />
        )}
      </div>
    </div>
  );
}

function EasyPython({ onSolve, solved }) {
  const [joiner, setJoiner] = useState('');
  const [answer, setAnswer] = useState('');

  const outputs = {
    "''.join(parts)": 'NOVA17',
    "'-'.join(parts)": 'NOVA-17',
    'parts[0]': 'NOVA',
  };

  const correct =
    joiner === "'-'.join(parts)" &&
    answer.trim().toUpperCase() === 'NOVA-17';

  return (
    <div className="two-column challenge-area">
      <HintBox
        hints={[
          'В parts уже лежат две части метки.',
          'Между NOVA и 17 должен быть дефис.',
          'Выберите соединение через дефис и перепишите результат.',
        ]}
      />

      <div className="workbench">
        <h2>Соберите имя контейнера</h2>
        <p>
          Парсер уже выделил части метки. Осталось соединить их
          одним дефисом.
        </p>

        <pre className="code-window">{`parts = ["NOVA", "17"]
print(${joiner || '...'})`}</pre>

        <Field
          label="Как соединить части"
          value={joiner}
          options={[
            "''.join(parts)",
            "'-'.join(parts)",
            'parts[0]',
          ]}
          onChange={setJoiner}
          disabled={solved}
        />

        <Result>
          {joiner ? outputs[joiner] : 'Выберите выражение'}
        </Result>
      </div>

      <div className="workbench">
        <h2>Введите найденную метку</h2>
        <label className="query-part">
          <span>Имя контейнера</span>
          <input
            className="answer-input"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={solved}
            placeholder="Введите метку..."
            autoComplete="off"
          />
        </label>

        <Submit
          correct={correct}
          solved={solved}
          onSolve={onSolve}
          icon={Code2}
        >
          Записать в дело
        </Submit>
      </div>
    </div>
  );
}

const EASY_SECURITY_FLAGS = [
  {
    id: 'password',
    label: 'Отправитель просит сообщить пароль и код подтверждения',
  },
  {
    id: 'greeting',
    label: 'Письмо начинается с вежливого обращения',
  },
  {
    id: 'domain',
    label: 'Домен отправителя отличается от официального домена',
  },
  {
    id: 'ticket',
    label: 'В письме указан номер обращения',
  },
];

function EasySecurity({ onSolve, solved }) {
  const [selected, setSelected] = useState([]);
  const [action, setAction] = useState('');

  const correct =
    sameSet(selected, ['password', 'domain']) &&
    action === 'quarantine';

  return (
    <div className="two-column challenge-area">
      <HintBox
        hints={[
          'Официальный домен вуза — polytech.example.',
          'Служба поддержки не должна просить пароль или код подтверждения.',
          'Письмо нужно изолировать и передать службе безопасности.',
        ]}
      />

      <div className="mail-view">
        <div className="mail-header">
          <ShieldAlert size={18} />
          <span>support@polytech-help.example</span>
        </div>

        <h2>Обращение №104: восстановление доступа</h2>
        <p>
          Уважаемый разработчик! Откройте access_fix.zip.
          Затем пришлите нам пароль от аккаунта и код
          подтверждения, чтобы восстановить доступ.
        </p>

        <div className="attachment">
          <AlertTriangle size={18} />
          access_fix.zip
        </div>

        <div className="mini-log">
          <code>Официальный домен: polytech.example</code>
          <code>Вложение доступно только в учебной песочнице.</code>
        </div>
      </div>

      <div className="workbench">
        <h2>Отметьте опасные признаки из списка</h2>

        <Flags
          items={EASY_SECURITY_FLAGS}
          selected={selected}
          setSelected={setSelected}
          solved={solved}
        />

        <Field
          label="Что делать с письмом"
          value={action}
          options={[
            {
              value: 'reply',
              label: 'Отправить пароль и код',
            },
            {
              value: 'quarantine',
              label: 'Изолировать и сообщить службе безопасности',
            },
            {
              value: 'forward',
              label: 'Переслать вложение одногруппнику',
            },
          ]}
          onChange={setAction}
          disabled={solved}
        />

        <div className="difficulty-submit">
          <Submit
            correct={correct}
            solved={solved}
            onSolve={onSolve}
            icon={ShieldAlert}
          >
            Закрыть инцидент
          </Submit>
        </div>
      </div>
    </div>
  );
}

const EASY_ROUTE = [
  'ЛАБ-07',
  'Коммутатор лаборатории',
  'AURORA',
];

function EasyNetwork({ onSolve, solved }) {
    const [route, setRoute] = useState([]);
  
    const nodes = [
      'AURORA',
      'Интернет',
      'ЛАБ-07',
      'Коммутатор лаборатории',
    ];
  
    const nodeLayout = {
      AURORA: {
        right: '6%',
        top: '58%',
      },
      Интернет: {
        right: '6%',
        top: '14%',
      },
      'ЛАБ-07': {
        left: '6%',
        top: '58%',
      },
      'Коммутатор лаборатории': {
        left: '6%',
        top: '14%',
      },
    };
  
    const correct = sameOrder(route, EASY_ROUTE);
  
    function pick(node) {
      if (solved) return;
  
      setRoute((current) =>
        current.includes(node)
          ? current
          : [...current, node],
      );
    }
  
    return (
      <div className="network-layout challenge-area">
        <HintBox
          hints={[
            'Начните с компьютера ЛАБ-07.',
            'Сначала сигнал проходит через коммутатор.',
            'Правильная цепочка: ЛАБ-07 → Коммутатор лаборатории → AURORA.',
          ]}
        />
  
        <NetworkTopology
          nodes={nodes}
          nodeLayout={nodeLayout}
          route={route}
          onPick={pick}
          solved={solved}
        />
  
        <div className="workbench">
          <h2>Собранный маршрут</h2>
  
          <p>
            ЛАБ-07 подключён к коммутатору лаборатории,
            а тот — напрямую к внутреннему архиву AURORA.
            Интернет в этом маршруте не используется.
          </p>
  
          <RouteStrip route={route} />
  
          <div className="hint-grid">
            <code>Шагов в маршруте: 3</code>
            <code>Сегмент: лаборатория</code>
            <code>Цель: AURORA</code>
            <code>Правило: только внутри кампуса</code>
          </div>
  
          <div className="action-row">
            <button
              type="button"
              className="ghost-action"
              disabled={solved}
              onClick={() => setRoute([])}
            >
              <RotateCcw size={16} />
              Сбросить
            </button>
  
            <Submit
              correct={correct}
              solved={solved}
              onSolve={onSolve}
              icon={Network}
            >
              Восстановить маршрут
            </Submit>
          </div>
        </div>
      </div>
    );
  }
  

const EASY_WORKFLOW = [
'Создать отдельную ветку',
'Внести изменения',
'Создать коммит',
'Открыть Merge Request',
];

function EasyWorkflow({ onSolve, solved }) {
const [selected, setSelected] = useState([]);

const correct = sameOrder(selected, EASY_WORKFLOW);

return (
  <div className="two-column challenge-area">
    <HintBox
      hints={[
        'Не изменяйте основную ветку напрямую.',
        'Коммит создаётся после внесения изменений.',
        'Merge Request открывается после подготовки коммита.',
      ]}
    />

    <div className="workbench">
      <h2>Подготовьте изменение к проверке</h2>
      <p>
        Восстановите порядок работы разработчика.
        В этом задании публикация ветки на сервер
        выполняется автоматически при открытии Merge Request.
      </p>

      <StepPool
        steps={EASY_WORKFLOW}
        selected={selected}
        setSelected={setSelected}
        solved={solved}
      />
    </div>

    <div className="workbench">
      <h2>Ваш рабочий процесс</h2>
      <Pipeline steps={selected} />

      <Submit
        correct={correct}
        solved={solved}
        onSolve={onSolve}
        icon={GitBranch}
      >
        Восстановить процесс
      </Submit>
    </div>
  </div>
);
}

// ---------- Тяжёлая сложность ----------

const HARD_SQL_USERS = [
{ id: 1, login: 'orlov' },
{ id: 2, login: 'admin' },
];

const HARD_SQL_TERMINALS = [
{ id: 1, name: 'A-02', room: 'Лаборатория 3' },
{ id: 2, name: 'B-14', room: 'Серверная C' },
];

const HARD_SQL_LOGS = [
{
  id: 101,
  user_id: 1,
  terminal_id: 1,
  time: '22:31',
  status: 'success',
},
{
  id: 102,
  user_id: 2,
  terminal_id: 2,
  time: '22:47',
  status: 'success',
},
{
  id: 103,
  user_id: 1,
  terminal_id: 2,
  time: '22:48',
  status: 'success',
},
{
  id: 104,
  user_id: 1,
  terminal_id: 1,
  time: '22:48',
  status: 'denied',
},
{
  id: 105,
  user_id: 1,
  terminal_id: 1,
  time: '22:52',
  status: 'success',
},
];

function HardSql({ onSolve, solved }) {
const [joinColumn, setJoinColumn] = useState('');
const [login, setLogin] = useState('');
const [cutoff, setCutoff] = useState('');
const [order, setOrder] = useState('');

const ready = Boolean(joinColumn && login && cutoff && order);

const result = ready
  ? HARD_SQL_LOGS
      .filter((entry) => {
        const user = HARD_SQL_USERS.find(
          (item) => item.id === entry.user_id,
        );

        return (
          user?.login === login &&
          entry.status === 'success' &&
          entry.time < cutoff
        );
      })
      .map((entry) => {
        const terminal = HARD_SQL_TERMINALS.find(
          (item) => item.id === entry[joinColumn],
        );

        if (!terminal) return null;

        return {
          id: entry.id,
          time: entry.time,
          room: terminal.room,
          terminal: terminal.name,
        };
      })
      .filter(Boolean)
      .sort((a, b) =>
        order === 'DESC'
          ? b.time.localeCompare(a.time)
          : a.time.localeCompare(b.time),
      )
      .slice(0, 1)
  : [];

const correct =
  joinColumn === 'terminal_id' &&
  login === 'orlov' &&
  cutoff === '22:49' &&
  order === 'DESC';

return (
  <div className="two-column challenge-area">
    <HintBox
      hints={[
        'Терминал связан с журналом через terminal_id, а не user_id.',
        'Нужны только успешные посещения Орлова строго до 22:49.',
        'Сортировка DESC вместе с LIMIT 1 оставит самое позднее посещение.',
      ]}
    />

    <div className="workbench">
      <h2>Сопоставьте три таблицы</h2>
      <p>
        Найдите последнее успешное посещение Орлова строго
        до запуска контейнера в 22:49. Все события относятся
        к одному дню. Покажите время, помещение и терминал.
      </p>

      <div className="query-builder">
        <Field
          label="Связь терминала с журналом"
          value={joinColumn}
          options={[
            {
              value: 'user_id',
              label: 't.id = a.user_id',
            },
            {
              value: 'terminal_id',
              label: 't.id = a.terminal_id',
            },
          ]}
          onChange={setJoinColumn}
          disabled={solved}
        />

        <Field
          label="Логин пользователя"
          value={login}
          options={['admin', 'orlov']}
          onChange={setLogin}
          disabled={solved}
        />

        <Field
          label="Верхняя граница времени"
          value={cutoff}
          options={['23:00', '22:49']}
          onChange={setCutoff}
          disabled={solved}
        />

        <Field
          label="Порядок времени"
          value={order}
          options={['ASC', 'DESC']}
          onChange={setOrder}
          disabled={solved}
        />
      </div>

      <pre className="code-window">{`SELECT a.time, t.room, t.name AS terminal
FROM access_log AS a
JOIN users AS u ON u.id = a.user_id
JOIN terminals AS t ON t.id = a.${joinColumn || '...'}
WHERE u.login = '${login || '...'}'
AND a.status = 'success'
AND a.time < '${cutoff || '...'}'
ORDER BY a.time ${order || '...'}
LIMIT 1;`}</pre>

      <Submit
        correct={correct}
        solved={solved}
        onSolve={onSolve}
        icon={Database}
      />
    </div>

    <div className="data-table">
      <DataTable
        title="users"
        columns={[
          ['id', 'id'],
          ['login', 'login'],
        ]}
        rows={HARD_SQL_USERS}
      />

      <DataTable
        title="terminals"
        columns={[
          ['id', 'id'],
          ['name', 'name'],
          ['room', 'room'],
        ]}
        rows={HARD_SQL_TERMINALS}
      />

      <DataTable
        title="access_log"
        columns={[
          ['user_id', 'user_id'],
          ['terminal_id', 'terminal_id'],
          ['time', 'time'],
          ['status', 'status'],
        ]}
        rows={HARD_SQL_LOGS}
      />

      {ready && (
        <DataTable
          title="Результат запроса"
          columns={[
            ['time', 'время'],
            ['room', 'место'],
            ['terminal', 'терминал'],
          ]}
          rows={result}
        />
      )}
    </div>
  </div>
);
}

const HARD_PYTHON_EVENTS = [
{
  stream: 'nova',
  status: 'ok',
  seq: 1,
  attempt: 1,
  payload: '16',
},
{
  stream: 'debug',
  status: 'ok',
  seq: 2,
  attempt: 1,
  payload: 'TEST',
},
{
  stream: 'nova',
  status: 'ok',
  seq: 0,
  attempt: 1,
  payload: 'NOVA',
},
{
  stream: 'nova',
  status: 'ok',
  seq: 1,
  attempt: 2,
  payload: '17',
},
{
  stream: 'nova',
  status: 'error',
  seq: 2,
  attempt: 1,
  payload: 'ERROR',
},
];

function HardPython({ onSolve, solved }) {
const [filterMode, setFilterMode] = useState('');
const [duplicateMode, setDuplicateMode] = useState('');
const [sortMode, setSortMode] = useState('');
const [answer, setAnswer] = useState('');

const ready = Boolean(filterMode && duplicateMode && sortMode);

let output = '';

if (ready) {
  const filtered = HARD_PYTHON_EVENTS.filter((entry) => {
    if (filterMode === 'stream') {
      return entry.stream === 'nova';
    }

    if (filterMode === 'status') {
      return entry.status === 'ok';
    }

    return entry.stream === 'nova' && entry.status === 'ok';
  });

  let records;

  if (duplicateMode === 'all') {
    records = [...filtered];
  } else {
    const bySequence = new Map();

    for (const entry of filtered) {
      const previous = bySequence.get(entry.seq);

      if (
        !previous ||
        (duplicateMode === 'latest' &&
          entry.attempt > previous.attempt)
      ) {
        bySequence.set(entry.seq, entry);
      }
    }

    records = [...bySequence.values()];
  }

  records.sort((a, b) =>
    sortMode === 'asc' ? a.seq - b.seq : b.seq - a.seq,
  );

  output = records.map((entry) => entry.payload).join('-');
}

const filterCode = {
  stream: 'e["stream"] == "nova"',
  status: 'e["status"] == "ok"',
  both: 'e["stream"] == "nova" and e["status"] == "ok"',
};

const duplicateCode = {
  all: 'records = list(filtered)',
  first: `by_seq = {}
for e in filtered:
  by_seq.setdefault(e["seq"], e)
records = list(by_seq.values())`,
  latest: `by_seq = {}
for e in filtered:
  old = by_seq.get(e["seq"])
  if old is None or e["attempt"] > old["attempt"]:
      by_seq[e["seq"]] = e
records = list(by_seq.values())`,
};

const correct =
  filterMode === 'both' &&
  duplicateMode === 'latest' &&
  sortMode === 'asc' &&
  answer.trim().toUpperCase() === 'NOVA-17';

return (
  <div className="two-column challenge-area">
    <HintBox
      hints={[
        'Отберите одновременно stream = nova и status = ok.',
        'Повторная успешная попытка заменяет предыдущую запись с тем же seq.',
        'Для seq = 1 нужна attempt = 2. Затем отсортируйте seq по возрастанию.',
      ]}
    />

    <div className="workbench">
      <h2>Разберите перемешанные события</h2>
      <p>
        Отберите успешные записи потока nova. Для каждого
        seq сохраните успешную запись с наибольшим attempt.
        Затем расположите записи по возрастанию seq
        и соедините payload дефисом.
      </p>

      <Field
        label="Фильтрация"
        value={filterMode}
        options={[
          {
            value: 'stream',
            label: 'Только stream = nova',
          },
          {
            value: 'both',
            label: 'stream = nova и status = ok',
          },
          {
            value: 'status',
            label: 'Только status = ok',
          },
        ]}
        onChange={setFilterMode}
        disabled={solved}
      />

      <Field
        label="Повторные записи с одинаковым seq"
        value={duplicateMode}
        options={[
          {
            value: 'all',
            label: 'Оставить все записи',
          },
          {
            value: 'first',
            label: 'Оставить первую встреченную запись',
          },
          {
            value: 'latest',
            label: 'Оставить запись с максимальным attempt',
          },
        ]}
        onChange={setDuplicateMode}
        disabled={solved}
      />

      <Field
        label="Сортировка seq"
        value={sortMode}
        options={[
          {
            value: 'desc',
            label: 'По убыванию',
          },
          {
            value: 'asc',
            label: 'По возрастанию',
          },
        ]}
        onChange={setSortMode}
        disabled={solved}
      />

      <pre className="code-window">{`filtered = [
  e for e in events
  if ${filterCode[filterMode] || '...'}
]

${duplicateCode[duplicateMode] || '# Выберите обработку повторов'}

records.sort(
  key=lambda e: e["seq"],
  reverse=${sortMode === 'desc' ? 'True' : 'False'}
)

print("-".join(e["payload"] for e in records))`}</pre>

      <Result>
        {ready ? output : 'Выберите все параметры'}
      </Result>
    </div>

    <div className="workbench">
      <DataTable
        title="Входные события"
        columns={[
          ['stream', 'stream'],
          ['status', 'status'],
          ['seq', 'seq'],
          ['attempt', 'attempt'],
          ['payload', 'payload'],
        ]}
        rows={HARD_PYTHON_EVENTS}
      />

      <label className="query-part">
        <span>Восстановленное имя контейнера</span>
        <input
          className="answer-input"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={solved}
          placeholder="Введите метку..."
          autoComplete="off"
        />
      </label>

      <Submit
        correct={correct}
        solved={solved}
        onSolve={onSolve}
        icon={Code2}
      >
        Записать в дело
      </Submit>
    </div>
  </div>
);
}

const HARD_SECURITY_FLAGS = [
{
  id: 'replyto',
  label: 'Reply-To ведёт на посторонний домен',
},
{
  id: 'https',
  label: 'Ссылка использует HTTPS',
},
{
  id: 'redirect',
  label: 'Параметр next перенаправляет на посторонний сайт',
},
{
  id: 'mfa',
  label: 'Письмо требует передать одноразовый код входа',
},
{
  id: 'name',
  label: 'В поле From указано знакомое название службы',
},
{
  id: 'disable',
  label: 'Для вложения предлагают отключить защиту',
},
];

function HardSecurity({ onSolve, solved }) {
const [selected, setSelected] = useState([]);
const [action, setAction] = useState('');

const correct =
  sameSet(selected, [
    'replyto',
    'redirect',
    'mfa',
    'disable',
  ]) &&
  action === 'report';

return (
  <div className="two-column challenge-area">
    <HintBox
      hints={[
        'Имя отправителя и HTTPS сами по себе не подтверждают подлинность письма.',
        'Проверьте Reply-To и адрес назначения в параметре next.',
        'Нельзя передавать коды входа или отключать защиту ради вложения.',
      ]}
    />

    <div className="mail-view">
      <div className="mail-header">
        <ShieldAlert size={18} />
        <span>Служба безопасности кампуса</span>
      </div>

      <h2>Подтверждение защищённого доступа</h2>

      <div className="mini-log">
        <code>
          From: Security &lt;security@polytech.example&gt;
        </code>
        <code>
          Reply-To: operator@support-portal.example
        </code>
        <code>
          Официальный домен: polytech.example
        </code>
      </div>

      <p>
        Откройте страницу подтверждения доступа. Если
        защитное ПО блокирует вложение, временно отключите
        его. Ответным письмом отправьте одноразовый код
        входа для проверки аккаунта.
      </p>

      <pre className="code-window">{`https://polytech.example/redirect
?next=https%3A%2F%2Fsupport-portal.example%2Fverify`}</pre>

      <div className="attachment">
        <AlertTriangle size={18} />
        security_update.zip
      </div>

      <div className="mini-log">
        <code>[sandbox] вложение запущено изолированно</code>
        <code>[sandbox] внешнее соединение заблокировано</code>
        <code>[sandbox] пароль и код входа не передавались</code>
      </div>
    </div>

    <div className="workbench">
      <h2>Отметьте четыре опасных признака</h2>

      <Flags
        items={HARD_SECURITY_FLAGS}
        selected={selected}
        setSelected={setSelected}
        solved={solved}
      />

      <Field
        label="Дальнейшее действие"
        value={action}
        options={[
          {
            value: 'trust',
            label: 'Довериться имени службы и выполнить инструкции',
          },
          {
            value: 'report',
            label: 'Изолировать письмо и передать заголовки и логи службе безопасности',
          },
          {
            value: 'reply',
            label: 'Ответить отправителю кодом подтверждения',
          },
        ]}
        onChange={setAction}
        disabled={solved}
      />

      <div className="difficulty-submit">
        <Submit
          correct={correct}
          solved={solved}
          onSolve={onSolve}
          icon={ShieldAlert}
        >
          Зафиксировать инцидент
        </Submit>
      </div>
    </div>
  </div>
);
}

const HARD_NETWORK_LINKS = [
{
  from: 'ЛАБ-07',
  to: 'SW-07',
  state: 'active',
  scope: 'internal',
},
{
  from: 'SW-07',
  to: 'FW-01',
  state: 'active',
  scope: 'internal',
},
{
  from: 'SW-07',
  to: 'R-20',
  state: 'maintenance',
  scope: 'internal',
},
{
  from: 'FW-01',
  to: 'Интернет',
  state: 'active',
  scope: 'external',
},
{
  from: 'Интернет',
  to: 'AURORA',
  state: 'active',
  scope: 'external',
},
{
  from: 'FW-01',
  to: 'R-20',
  state: 'active',
  scope: 'internal',
},
{
  from: 'R-20',
  to: 'ARCHIVE-GW',
  state: 'active',
  scope: 'internal',
},
{
  from: 'ARCHIVE-GW',
  to: 'AURORA',
  state: 'active',
  scope: 'internal',
},
];

function HardNetwork({ onSolve, solved }) {
    const [route, setRoute] = useState([]);
  
    const nodes = [
      'AURORA',
      'R-20',
      'Интернет',
      'SW-07',
      'ARCHIVE-GW',
      'ЛАБ-07',
      'FW-01',
    ];
  
    const nodeLayout = {
      AURORA: {
        right: '6%',
        top: '74%',
      },
      'R-20': {
        left: '6%',
        top: '28%',
      },
      Интернет: {
        right: '6%',
        top: '5%',
      },
      'SW-07': {
        left: '6%',
        top: '51%',
      },
      'ARCHIVE-GW': {
        right: '6%',
        top: '28%',
      },
      'ЛАБ-07': {
        left: '6%',
        top: '5%',
      },
      'FW-01': {
        right: '6%',
        top: '51%',
      },
    };
  
    const selectedLinks = route.slice(1).map((node, index) =>
      HARD_NETWORK_LINKS.find(
        (link) =>
          link.from === route[index] &&
          link.to === node,
      ),
    );
  
    const validLinks = selectedLinks.every(
      (link) =>
        link &&
        link.state === 'active' &&
        link.scope === 'internal',
    );
  
    const correct =
      route.length > 1 &&
      route[0] === 'ЛАБ-07' &&
      route[route.length - 1] === 'AURORA' &&
      validLinks;
  
    function pick(node) {
      if (solved) return;
  
      setRoute((current) =>
        current.includes(node)
          ? current
          : [...current, node],
      );
    }
  
    const linkRows = HARD_NETWORK_LINKS.map((link, index) => ({
      id: index,
      from: link.from,
      to: link.to,
      state:
        link.state === 'active'
          ? 'Работает'
          : 'Обслуживание',
      scope:
        link.scope === 'internal'
          ? 'Внутренняя'
          : 'Внешняя',
    }));
  
    return (
      <div className="network-layout challenge-area">
        <HintBox
          hints={[
            'Соединения направленные: переходить можно только из столбца «Откуда» в «Куда».',
            'Прямой переход SW-07 → R-20 находится на обслуживании.',
            'От SW-07 нужно пройти через FW-01, затем R-20 и ARCHIVE-GW.',
          ]}
        />
  
        <NetworkTopology
          nodes={nodes}
          nodeLayout={nodeLayout}
          route={route}
          onPick={pick}
          solved={solved}
          className="topology--hard"
        />
  
        <div className="workbench">
          <h2>Собранный маршрут</h2>
  
          <p>
            Постройте маршрут от ЛАБ-07 до AURORA.
            Используйте только работающие внутренние
            соединения. Выход в интернет запрещён.
            Направления переходов указаны в таблице.
          </p>
  
          <RouteStrip route={route} />
  
          <div className="hint-grid">
            <code>Выбрано узлов: {route.length}</code>
            <code>Цель: AURORA</code>
            <code>Соединения: направленные</code>
            <code>Правило: только внутри кампуса</code>
          </div>
  
          {route.length > 1 && !validLinks && (
            <p className="difficulty-warning" role="status">
              В маршруте есть отсутствующее, отключённое
              или внешнее соединение.
            </p>
          )}
  
          <DataTable
            title="Соединения сети"
            columns={[
              ['from', 'Откуда'],
              ['to', 'Куда'],
              ['state', 'Состояние'],
              ['scope', 'Сеть'],
            ]}
            rows={linkRows}
          />
  
          <div className="action-row">
            <button
              type="button"
              className="ghost-action"
              disabled={solved}
              onClick={() => setRoute([])}
            >
              <RotateCcw size={16} />
              Сбросить
            </button>
  
            <Submit
              correct={correct}
              solved={solved}
              onSolve={onSolve}
              icon={Network}
            >
              Восстановить маршрут
            </Submit>
          </div>
        </div>
      </div>
    );
  }
  

const HARD_WORKFLOW = [
'Приостановить CI и развёртывания',
'Отозвать утёкший токен',
'Зафиксировать инцидент в закрытом журнале',
'Удалить секрет из файлов и истории Git',
'Проверить очищенную историю сканером секретов',
'Выдать новый токен через хранилище секретов',
'Возобновить CI и проверить развёртывание',
];

function HardWorkflow({ onSolve, solved }) {
const [selected, setSelected] = useState([]);

const correct = sameOrder(selected, HARD_WORKFLOW);

return (
  <div className="two-column challenge-area">
    <HintBox
      hints={[
        'Удаление строки из последнего коммита не отзывает токен и не очищает старые коммиты.',
        'Сначала остановите автоматизацию и отзовите токен. Затем зафиксируйте инцидент.',
        'После очистки истории нужен сканер. Новый токен выдаётся только после успешной проверки.',
      ]}
    />

    <div className="workbench">
      <h2>Восстановите аварийный Git-процесс</h2>
      <p>
        В репозиторий попал токен развёртывания. Соберите
        порядок действий по регламенту этой учебной команды.
        Сам секрет в журнал инцидента записывать нельзя.
      </p>

      <div className="mini-log">
        <code>
          1. До отзыва токена приостановить CI и развёртывания.
        </code>
        <code>
          2. После отзыва оформить закрытую запись об инциденте.
        </code>
        <code>
          3. После фиксации инцидента очистить файлы и историю.
        </code>
        <code>
          4. После очистки запустить сканер секретов.
        </code>
        <code>
          5. Новый токен выдать только после успешного сканирования.
        </code>
        <code>
          6. CI возобновить после настройки нового токена.
        </code>
      </div>

      <StepPool
        steps={HARD_WORKFLOW}
        selected={selected}
        setSelected={setSelected}
        solved={solved}
      />
    </div>

    <div className="workbench">
      <h2>План восстановления</h2>
      <Pipeline steps={selected} />

      <Submit
        correct={correct}
        solved={solved}
        onSolve={onSolve}
        icon={GitBranch}
      >
        Открыть финальный лог
      </Submit>
    </div>
  </div>
);
}

// ---------- Выбор компонентов по сложности ----------

const LEVEL_COMPONENTS = {
easy: {
  sql: EasySql,
  python: EasyPython,
  security: EasySecurity,
  network: EasyNetwork,
  workflow: EasyWorkflow,
},
hard: {
  sql: HardSql,
  python: HardPython,
  security: HardSecurity,
  network: HardNetwork,
  workflow: HardWorkflow,
},
};

export function LevelChallenge({
difficulty,
moduleId,
onSolve,
solved,
}) {
const Component = LEVEL_COMPONENTS[difficulty]?.[moduleId];

if (!Component) {
  return (
    <div className="workbench">
      <h2>Задание не найдено</h2>
      <p>
        Для выбранного уровня и модуля нет компонента задания.
        Выберите другой уровень сложности.
      </p>
    </div>
  );
}

return (
  <Component
    key={`${difficulty}-${moduleId}`}
    onSolve={onSolve}
    solved={solved}
  />
);
}

