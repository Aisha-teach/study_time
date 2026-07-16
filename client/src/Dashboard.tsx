import { useState } from "react";
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

interface Metric {
  id: string;
  label: string;
  value: string;
  unit: string;
  status: string;
  statusTone: "good" | "warn";
  description: string;
  icon: React.ReactNode;
  iconTone: "orange" | "yellow" | "green" | "blue";
}

const METRICS: Metric[] = [
  {
    id: "temp-atrium",
    label: "Температура в атриуме",
    value: "24.3",
    unit: "°C",
    status: "Комфортно",
    statusTone: "good",
    description: "Оптимальная температура",
    icon: <Thermometer size={22} />,
    iconTone: "orange",
  },
  {
    id: "temp-outside",
    label: "Температура на улице",
    value: "31.5",
    unit: "°C",
    status: "Жарко",
    statusTone: "warn",
    description: "Рекомендуется пить больше воды",
    icon: <Sun size={22} />,
    iconTone: "yellow",
  },
  {
    id: "light",
    label: "Уровень освещения",
    value: "480",
    unit: "lux",
    status: "Хорошее освещение",
    statusTone: "good",
    description: "Оптимальный уровень",
    icon: <Lightbulb size={22} />,
    iconTone: "green",
  },
  {
    id: "noise",
    label: "Уровень шума",
    value: "42",
    unit: "dB",
    status: "Тихо",
    statusTone: "good",
    description: "Комфортный уровень шума",
    icon: <Volume2 size={22} />,
    iconTone: "blue",
  },
];

const NAV_ITEMS = [
  "Главная",
  "История",
  "Аналитика",
  "Уведомления",
  "О приложении",
];

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function getCurrentWeekDates() {
  const today = new Date();
  const jsDay = today.getDay();
  const diffToMonday = (jsDay + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const label = `${String(d.getDate()).padStart(2, "0")}.${String(
      d.getMonth() + 1
    ).padStart(2, "0")} (${WEEKDAY_LABELS[i]})`;
    const isToday = d.toDateString() === today.toDateString();
    return { iso, label, isToday };
  });
}

const HOURS = Array.from(
  { length: 24 },
  (_, h) => `${String(h).padStart(2, "0")}:00`
);

const PLACES = [
  { value: "atrium", label: "Атриум" },
  { value: "outside", label: "На улице" },
];

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState("Главная");

  const weekDates = getCurrentWeekDates();
  const todayIso = weekDates.find((d) => d.isToday)?.iso ?? weekDates[0].iso;

  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [selectedPlace, setSelectedPlace] = useState(PLACES[0].value);
  const [selectedHour, setSelectedHour] = useState(HOURS[new Date().getHours()]);

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
              className={`dash__nav-item ${
                activeNav === item ? "dash__nav-item--active" : ""
              }`}
              onClick={() => setActiveNav(item)}
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
            <h1>Мониторинг среды НУ</h1>
            <p>Актуальные данные о комфорте в атриуме и на улице</p>
          </div>
          <button className="dash__bell" aria-label="Уведомления">
            <Bell size={20} />
          </button>
        </header>

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
                onChange={(e) => setSelectedPlace(e.target.value)}
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
            <strong>21 июня 2026, 14:35</strong>
          </span>
          <span className="dash__status-badge">
            <span className="dash__status-dot" />
            Данные актуальны
          </span>
        </div>

        <div className="dash__grid">
          {METRICS.map((m) => (
            <div className="dash__card" key={m.id}>
              <div className={`dash__card-icon dash__card-icon--${m.iconTone}`}>
                {m.icon}
              </div>
              <div className="dash__card-body">
                <div className="dash__card-label">{m.label}</div>
                <div className="dash__card-value">
                  {m.value} <span>{m.unit}</span>
                </div>
                <span
                  className={`dash__card-status dash__card-status--${m.statusTone}`}
                >
                  {m.status}
                </span>
                <div className="dash__card-desc">{m.description}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="dash__history">
          <div className="dash__history-icon">
            <TrendingUp size={20} />
          </div>
          <div className="dash__history-text">
            <div className="dash__history-title">
              Посмотрите историю измерений
            </div>
            <div className="dash__history-sub">
              Анализируйте изменения среды во времени
            </div>
          </div>
          <button className="dash__history-btn">
            Открыть историю
            <ArrowRight size={16} />
          </button>
        </div>

        <footer className="dash__footer">Nazarbayev University · Smart Campus</footer>
      </main>
    </div>
  );
}