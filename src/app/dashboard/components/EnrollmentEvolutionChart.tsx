'use client';

import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface EnrollmentEvolutionChartProps {
  data: { name: string; count: number }[];
}

export default function EnrollmentEvolutionChart({ data }: EnrollmentEvolutionChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0.0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--glass-border)', borderRadius: '8px' }}
          itemStyle={{ color: 'var(--text-primary)' }}
        />
        <Area 
          type="monotone" 
          dataKey="count" 
          name="Matriculados" 
          stroke="var(--accent-primary)" 
          strokeWidth={3} 
          fillOpacity={1} 
          fill="url(#colorCount)"
          dot={{ r: 4, fill: 'var(--accent-primary)', strokeWidth: 2, stroke: '#fff' }} 
          activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} 
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
