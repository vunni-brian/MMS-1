import { Area, Bar, AreaChart, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { cn } from "@/lib/utils";

const areaData = [
  { label: "1 May", value: 28 },
  { label: "8 May", value: 45 },
  { label: "15 May", value: 58 },
  { label: "22 May", value: 35 },
  { label: "31 May", value: 62 },
];

const barData = [
  { label: "1 May", value: 48 },
  { label: "8 May", value: 35 },
  { label: "15 May", value: 56 },
  { label: "22 May", value: 43 },
  { label: "31 May", value: 52 },
];

export const MiniAreaChart = ({ className }: { className?: string }) => (
  <div className={cn("h-full min-h-[180px] w-full", className)}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={areaData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
        <Area type="monotone" dataKey="value" stroke="currentColor" strokeWidth="3" fill="url(#areaFill)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export const MiniBarChart = ({ className }: { className?: string }) => (
  <div className={cn("h-full min-h-[180px] w-full", className)}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={barData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
        <Bar dataKey="value" fill="currentColor" radius={[3, 3, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);
