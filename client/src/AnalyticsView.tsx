import { useState, useEffect } from "react";
import { Thermometer, Lightbulb, Volume2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface WeekDate {
  iso: string;
  label: string;
  isToday: boolean;
}

interface HistoryRow {
  temperature: number | null;
  brightness: string | null;
  noise_db: number | null;
}

interface DayPoint {
  iso: string;
  dayLabel: string;
  outsideAvg: number | null;
  atriumAvg: number | null;
  lightAvg: number | null;
  noiseAvg: number | null;
}

// Categorical brightness doesn't come with a lux number from the backend —
// this maps it to a rough 1-5 comfort scale just for charting purposes.
const BRIGHTNESS_SCALE: Record<string, number> = {
  dark: 1,
  dim: 2,
  "normal brightness": 3,
  bright: 4,
  "very bright": 5,
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

async function fetchHistory(
  apiUrl: string,
  location: "atrium" | "outside",
  date: string
): Promise<HistoryRow[]> {
  const res = await fetch(`${apiUrl}/api/history?location=${location}&date=${date}`);
  if (!res.ok) throw new Error(`Ошибка запроса истории: ${res.status}`);
  return res.json();
}

interface AnalyticsViewProps {
  apiUrl: string;
  weekDates: WeekDate[];
}

export default function AnalyticsView({ apiUrl, weekDates }: AnalyticsViewProps) {
  const [data, setData] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(weekDates[0]?.iso);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all(
      weekDates.map(async (day) => {
        const [outsideRows, atriumRows] = await Promise.all([
          fetchHistory(apiUrl, "outside", day.iso),
          fetchHistory(apiUrl, "atrium", day.iso),
        ]);

        const outsideAvg = average(
          outsideRows.map((r) => r.temperature).filter((v): v is number => v != null)
        );
        const atriumAvg = average(
          atriumRows.map((r) => r.temperature).filter((v): v is number => v != null)
        );
        const noiseAvg = average(
          atriumRows.map((r) => r.noise_db).filter((v): v is number => v != null)
        );
        const lightAvg = average(
          atriumRows
            .map((r) => (r.brightness ? BRIGHTNESS_SCALE[r.brightness.toLowerCase()] : null))
            .filter((v): v is number => v != null)
        );

        return {
          iso: day.iso,
          dayLabel: day.label,
          outsideAvg,
          atriumAvg,
          noiseAvg,
          lightAvg,
        } as DayPoint;
      })
    )
      .then((points) => {
        if (!cancelled) setData(points);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setError("Не удалось загрузить данные аналитики");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiUrl, weekDates]);

  const rangeLabel =
    weekDates.length > 0
      ? `${weekDates[0].label.split(" ")[0]} — ${weekDates[6].label.split(" ")[0]}`
      : "";

  return (
    <div>
      <div className="dash__filters">
        <div className="dash__filter">
          <span className="dash__filter-label">Период</span>
          <span className="dash__filter-value">{rangeLabel}</span>
        </div>
        <div className="dash__filter">
          <span className="dash__filter-label">Место</span>
          <span className="dash__filter-value">Все места</span>
        </div>
      </div>

      <div className="analytics__day-tabs">
        {weekDates.map((d) => (
          <button
            key={d.iso}
            className={`analytics__day-tab ${
              selectedDay === d.iso ? "analytics__day-tab--active" : ""
            }`}
            onClick={() => setSelectedDay(d.iso)}
          >
            <div>{d.label.split(" ")[1]?.replace(/[()]/g, "")}</div>
            <div className="analytics__day-tab-date">{d.label.split(" ")[0]}</div>
          </button>
        ))}
      </div>

      {loading && <div style={{ marginTop: 20, color: "#6b7280" }}>Загрузка данных...</div>}
      {error && <div style={{ marginTop: 20, color: "#e0522f" }}>{error}</div>}

      {!loading && !error && (
        <>
          <div className="analytics__card">
            <div className="analytics__card-header">
              <span>
                <Thermometer size={16} style={{ marginRight: 6 }} />
                Температура: улица vs атриум (°C)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="outsideAvg" name="Улица" fill="#f5a623" radius={[4, 4, 0, 0]} />
                <Bar dataKey="atriumAvg" name="Атриум" fill="#3d74e0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="analytics__card">
            <div className="analytics__card-header">
              <span>
                <Lightbulb size={16} style={{ marginRight: 6 }} />
                Уровень освещения (атриум, шкала 1–5)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="lightAvg" name="Освещение" fill="#2fa84f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="analytics__card">
            <div className="analytics__card-header">
              <span>
                <Volume2 size={16} style={{ marginRight: 6 }} />
                Уровень шума (атриум, dB)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="noiseAvg" name="Шум" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
