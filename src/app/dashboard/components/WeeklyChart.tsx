'use client';

import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface WeeklyChartProps {
  data: { name: string; ai: number; human: number }[];
}

export default function WeeklyChart({ data }: WeeklyChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--glass-border)', borderRadius: '8px' }}
          itemStyle={{ color: 'var(--text-primary)' }}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
        <Line type="monotone" dataKey="ai" name="Agente IA" stroke="var(--accent-secondary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="human" name="Entrada Manual" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
