import { useState, useEffect } from "react";
import {
  Bell,
  Calendar,
  MapPin,
  Clock,
  Thermometer,
  Sun,
  Lightbulb,
  Volume2,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import "./Dashboard.css";
import AnalyticsView from "./AnalyticsView";

const API_URL = import.meta.env.VITE_API_URL;

interface StatusInfo {
  label: string;
  comment: string;
}

interface ReadingResponse {
  location: "atrium" | "outside";
  temperature: number | null;
  temp_status: StatusInfo;
  brightness: string | null;
  light_status: StatusInfo | null;
  noise_db: number | null;
  noise_status: StatusInfo | null;
  updated_at: string | null;
}

const NAV_ITEMS = ["Главная", "История", "Аналитика", "Уведомления", "О приложении"];
const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentWeekDates() {
  const today = new Date();
  const jsDay = today.getDay();
  const diffToMonday = (jsDay + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = toLocalISODate(d);
    const label = `${String(d.getDate()).padStart(2, "0")}.${String(
      d.getMonth() + 1
    ).padStart(2, "0")} (${WEEKDAY_LABELS[i]})`;
    const isToday = d.toDateString() === today.toDateString();
    return { iso, label, isToday };
  });
}

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

const PLACES = [
  { value: "atrium", label: "Атриум" },
  { value: "outside", label: "На улице" },
];

const GOOD_TEMP_LABELS = ["Комфортно"];
const GOOD_LIGHT_LABELS = ["Хорошее освещение", "Нормальное освещение"];
const GOOD_NOISE_LABELS = ["Тихо", "Оптимально"];

function isOptimalStudyTime(atrium: ReadingResponse | null): boolean {
  if (!atrium || !atrium.light_status || !atrium.noise_status) return false;
  return (
    GOOD_TEMP_LABELS.includes(atrium.temp_status.label) &&
    GOOD_LIGHT_LABELS.includes(atrium.light_status.label) &&
    GOOD_NOISE_LABELS.includes(atrium.noise_status.label)
  );
}

async function fetchReading(location: "atrium" | "outside", date: string, time: string) {
  const res = await fetch(
    `${API_URL}/api/reading?location=${location}&date=${date}&time=${time}`
  );
  if (!res.ok) throw new Error(`Ошибка запроса: ${res.status}`);
  return (await res.json()) as ReadingResponse;
}

function formatUpdatedAt(iso: string | null) {
  if (!iso) return "нет данных";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState("Главная");

  const weekDates = getCurrentWeekDates();
  const todayIso = weekDates.find((d) => d.isToday)?.iso ?? weekDates[0].iso;

  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [selectedHour, setSelectedHour] = useState(HOURS[new Date().getHours()]);
  const [selectedPlace, setSelectedPlace] = useState<"atrium" | "outside">("atrium");

  const [atrium, setAtrium] = useState<ReadingResponse | null>(null);
  const [outside, setOutside] = useState<ReadingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchReading("atrium", selectedDate, selectedHour),
      fetchReading("outside", selectedDate, selectedHour),
    ])
      .then(([atriumData, outsideData]) => {
        if (cancelled) return;
        setAtrium(atriumData);
        setOutside(outsideData);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Ошибка загрузки данных:", err);
        setError("Не удалось загрузить данные с сервера");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedHour]);

  const lastUpdated = atrium?.updated_at || outside?.updated_at || null;
  const studyTimeOptimal = isOptimalStudyTime(atrium);

  const toggleNotifications = () => {
    setActiveNav("Уведомления");
    setShowNotifications((v) => !v);
  };

  const handleNavClick = (item: string) => {
    if (item === "Уведомления") {
      toggleNotifications();
    } else {
      setActiveNav(item);
      setShowNotifications(false);
    }
  };

  return (
    <div className="dash">
      <aside className="dash__sidebar">
        <div className="dash__logo">
          <span className="dash__logo-mark">N</span>
          <span className="dash__logo-text">
            NAZARBAYEV
            <br />
            UNIVERSITY
          </span>
        </div>

        <nav className="dash__nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              className={`dash__nav-item ${activeNav === item ? "dash__nav-item--active" : ""}`}
              onClick={() => handleNavClick(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="dash__weather">
          <div className="dash__weather-temp">
            <Sun size={18} />
            <span>31°</span>
          </div>
          <div className="dash__weather-label">Ясно</div>
          <div className="dash__weather-city">
            <MapPin size={12} />
            <span>Astana</span>
          </div>
        </div>
      </aside>

      <main className="dash__main">
        <header className="dash__header">
          <div>
            <h1>
              {activeNav === "Аналитика"
                ? "Аналитика"
                : activeNav === "О приложении"
                ? "О приложении"
                : "Мониторинг среды НУ"}
            </h1>
            <p>
              {activeNav === "Аналитика"
                ? "Анализ показателей среды за неделю в атриуме и на улице"
                : activeNav === "О приложении"
                ? "Как устроен и для чего нужен этот сервис"
                : "Актуальные данные о комфорте в атриуме и на улице"}
            </p>
          </div>
          <div style={{ position: "relative" }}>
            <button
              className="dash__bell"
              aria-label="Уведомления"
              onClick={toggleNotifications}
            >
              <Bell size={20} />
              {studyTimeOptimal && <span className="dash__bell-dot" />}
            </button>

            {showNotifications && (
              <div className="dash__notifications">
                <div className="dash__notifications-title">Уведомления</div>
                {studyTimeOptimal ? (
                  <div className="dash__notification-item">
                    <div className="dash__notification-item-title">
                      Отличное время для учёбы
                    </div>
                    <div className="dash__notification-item-text">
                      В атриуме сейчас комфортная температура, хорошее освещение и
                      приемлемый уровень шума — самое время учиться.
                    </div>
                  </div>
                ) : (
                  <div className="dash__notification-empty">
                    Пока нет новых уведомлений
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {activeNav === "Аналитика" ? (
          <AnalyticsView apiUrl={API_URL} weekDates={weekDates} />
        ) : activeNav === "О приложении" ? (
          <div className="about">
            <p className="about__lead">
              «Мониторинг среды НУ» — сервис для студентов и сотрудников Nazarbayev
              University, который в реальном времени показывает условия в атриуме и на
              улице кампуса: температуру, уровень освещения и уровень шума.
            </p>

            <div className="about__section">
              <h3>Откуда берутся данные</h3>
              <p>
                Датчики публикуют показания в закрытый Telegram-канал. Бэкенд сервиса
                слушает канал и автоматически сохраняет каждое новое сообщение —
                поэтому данные на главном экране обновляются практически сразу после
                публикации, без ручного вмешательства.
              </p>
            </div>

            <div className="about__section">
              <h3>Что можно посмотреть</h3>
              <ul>
                <li>
                  <strong>Главная</strong> — текущие показатели за выбранные дату, время
                  и локацию (атриум или улица)
                </li>
                <li>
                  <strong>Аналитика</strong> — графики изменения температуры, освещения
                  и шума за неделю
                </li>
                <li>
                  <strong>Уведомления</strong> — сервис подсказывает, когда в атриуме
                  одновременно комфортная температура, хорошее освещение и низкий
                  уровень шума — то есть подходящее время для учёбы
                </li>
              </ul>
            </div>

            <div className="about__section">
              <h3>Для кого</h3>
              <p>
                Приложение создано в рамках Smart Campus для студентов и сотрудников
                НУ, чтобы помочь выбрать комфортное время и место для учёбы или работы
                в течение дня.
              </p>
            </div>
          </div>
        ) : (
          <>
        <div className="dash__filters">
          <label className="dash__filter">
            <span className="dash__filter-label">Дата</span>
            <span className="dash__filter-value">
              <Calendar size={16} />
              <select
                className="dash__filter-select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                {weekDates.map((d) => (
                  <option key={d.iso} value={d.iso}>
                    {d.label}
                    {d.isToday ? " · сегодня" : ""}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="dash__filter">
            <span className="dash__filter-label">Место</span>
            <span className="dash__filter-value">
              <MapPin size={16} />
              <select
                className="dash__filter-select"
                value={selectedPlace}
                onChange={(e) => setSelectedPlace(e.target.value as "atrium" | "outside")}
              >
                {PLACES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="dash__filter">
            <span className="dash__filter-label">Время</span>
            <span className="dash__filter-value">
              <Clock size={16} />
              <select
                className="dash__filter-select"
                value={selectedHour}
                onChange={(e) => setSelectedHour(e.target.value)}
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>

        <div className="dash__status">
          <span className="dash__status-time">
            <Clock size={14} />
            Последнее обновление
            <strong style={{ marginLeft: 4 }}>{formatUpdatedAt(lastUpdated)}</strong>
          </span>
          <span className="dash__status-badge">
            <span className="dash__status-dot" />
            {loading ? "Загрузка..." : error ? "Ошибка" : "Данные актуальны"}
          </span>
        </div>

        {error && (
          <div style={{ color: "#e0522f", marginTop: 12, fontSize: 14 }}>{error}</div>
        )}

        <div className="dash__grid">
          {selectedPlace === "atrium" && (
            <>
              <div className="dash__card">
                <div className="dash__card-icon dash__card-icon--orange">
                  <Thermometer size={22} />
                </div>
                <div className="dash__card-body">
                  <div className="dash__card-label">Температура в атриуме</div>
                  <div className="dash__card-value">
                    {atrium?.temperature ?? "—"} <span>°C</span>
                  </div>
                  <span className="dash__card-status dash__card-status--good">
                    {atrium?.temp_status.label ?? "Нет данных"}
                  </span>
                  <div className="dash__card-desc">{atrium?.temp_status.comment}</div>
                </div>
              </div>

              <div className="dash__card">
                <div className="dash__card-icon dash__card-icon--green">
                  <Lightbulb size={22} />
                </div>
                <div className="dash__card-body">
                  <div className="dash__card-label">Уровень освещения</div>
                  <div className="dash__card-value">{atrium?.brightness ?? "—"}</div>
                  <span className="dash__card-status dash__card-status--good">
                    {atrium?.light_status?.label ?? "Нет данных"}
                  </span>
                  <div className="dash__card-desc">{atrium?.light_status?.comment}</div>
                </div>
              </div>

              <div className="dash__card">
                <div className="dash__card-icon dash__card-icon--blue">
                  <Volume2 size={22} />
                </div>
                <div className="dash__card-body">
                  <div className="dash__card-label">Уровень шума</div>
                  <div className="dash__card-value">
                    {atrium?.noise_db ?? "—"} <span>dB</span>
                  </div>
                  <span className="dash__card-status dash__card-status--good">
                    {atrium?.noise_status?.label ?? "Нет данных"}
                  </span>
                  <div className="dash__card-desc">{atrium?.noise_status?.comment}</div>
                </div>
              </div>
            </>
          )}

          {selectedPlace === "outside" && (
            <div className="dash__card">
              <div className="dash__card-icon dash__card-icon--yellow">
                <Sun size={22} />
              </div>
              <div className="dash__card-body">
                <div className="dash__card-label">Температура на улице</div>
                <div className="dash__card-value">
                  {outside?.temperature ?? "—"} <span>°C</span>
                </div>
                <span className="dash__card-status dash__card-status--warn">
                  {outside?.temp_status.label ?? "Нет данных"}
                </span>
                <div className="dash__card-desc">{outside?.temp_status.comment}</div>
              </div>
            </div>
          )}
        </div>

        <div className="dash__history">
          <div className="dash__history-icon">
            <TrendingUp size={20} />
          </div>
          <div className="dash__history-text">
            <div className="dash__history-title">Посмотрите историю измерений</div>
            <div className="dash__history-sub">Анализируйте изменения среды во времени</div>
          </div>
          <button className="dash__history-btn">
            Открыть историю
            <ArrowRight size={16} />
          </button>
        </div>
          </>
        )}

        <footer className="dash__footer">Nazarbayev University · Smart Campus</footer>
      </main>
    </div>
  );
}