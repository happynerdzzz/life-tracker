"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

export type ChartPoint = {
  date: string;
  topWeight: number | null;
  epley1rm: number | null;
  maxReps: number;
};

type Props = {
  points: ChartPoint[];
  isBodyweight: boolean;
};

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default function ExerciseProgressionChart({ points, isBodyweight }: Props) {
  const minWidth = points.length > 14 ? points.length * 40 : 0;

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div style={minWidth ? { minWidth } : {}}>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              labelFormatter={(l) => fmtDate(String(l))}
              formatter={(value, name) => {
                const v = Number(value);
                if (name === "topWeight") return [`${v} kg`, "Top set"];
                if (name === "epley1rm") return [`${v} kg`, "Est. 1RM"];
                if (name === "maxReps") return [`${v} reps`, "Max reps"];
                return [value, name];
              }}
            />
            <Legend
              formatter={(value) => {
                if (value === "topWeight") return "Top set (kg)";
                if (value === "epley1rm") return "Est. 1RM (kg)";
                if (value === "maxReps") return "Max reps";
                return value;
              }}
              wrapperStyle={{ fontSize: 12 }}
            />
            {isBodyweight ? (
              <Line
                type="monotone"
                dataKey="maxReps"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            ) : (
              <>
                <Line
                  type="monotone"
                  dataKey="topWeight"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#2563eb" }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="epley1rm"
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ r: 3, fill: "#d97706" }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
