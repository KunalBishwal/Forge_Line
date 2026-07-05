import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ThroughputPoint } from "@/lib/types";

export function ThroughputChart({ data }: { data: ThroughputPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gComp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff7a45" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#ff7a45" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gFail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4d5e" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#ff4d5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="t" stroke="#8b879c" fontSize={11} tickLine={false} axisLine={false} interval={3} />
        <YAxis stroke="#8b879c" fontSize={11} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          contentStyle={{
            background: "rgba(15,13,22,0.9)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            color: "#e9e7f2",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 12,
          }}
        />
        <Area type="monotone" dataKey="completed" stroke="#ff7a45" strokeWidth={2} fill="url(#gComp)" name="Completed" />
        <Area type="monotone" dataKey="failed" stroke="#ff4d5e" strokeWidth={2} fill="url(#gFail)" name="Failed" />
      </AreaChart>
    </ResponsiveContainer>
  );
}