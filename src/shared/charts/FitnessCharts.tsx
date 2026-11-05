import { format, parseISO } from 'date-fns'
import { Activity } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { number } from '..'
import {
  nutrientKeys,
  nutrientLabels,
  nutritionSeries,
  summarizeNutrition,
  type Meal,
} from '../../domain'
import { Empty } from '../ui'

const shortDate = (value: string) => format(parseISO(value), 'd MMM')

export function NutritionChart({
  meals,
  metric = 'calories',
}: {
  meals: Meal[]
  metric?: (typeof nutrientKeys)[number]
}) {
  const series = nutritionSeries(meals)
  if (!series.length) return <Empty title="No food data in this period" icon={<Activity />} />
  return (
    <div
      className="chart"
      role="img"
      aria-label={`${nutrientLabels[metric]} across ${series.length} logged days; total ${number(summarizeNutrition(meals)[metric])} ${metric === 'calories' ? 'kcal' : 'grams'}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tickLine={false}
            axisLine={false}
            minTickGap={25}
            tick={{ fontSize: 12, fill: 'var(--muted)' }}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} />
          <Tooltip
            labelFormatter={(value) => shortDate(String(value))}
            formatter={(value) => [
              `${number(Number(value), 1)} ${metric === 'calories' ? 'kcal' : 'g'}`,
              nutrientLabels[metric],
            ]}
            cursor={{ fill: 'var(--subtle-surface)' }}
            contentStyle={{
              background: 'var(--surface)',
              borderColor: 'var(--line)',
              color: 'var(--ink)',
            }}
            labelStyle={{ color: 'var(--ink)' }}
            itemStyle={{ color: 'var(--chart-green)' }}
          />
          <Bar
            dataKey={metric}
            fill="var(--chart-green)"
            radius={[4, 4, 0, 0]}
            maxBarSize={35}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TrendChart({
  points,
  metric,
  unit,
  color,
}: {
  points: { date: string; value: number }[]
  metric: string
  unit: string
  color: string
}) {
  if (!points.length) return <Empty title={`No ${metric.toLowerCase()} records in this period`} />
  return (
    <div
      className="chart"
      role="img"
      aria-label={`${metric}: ${points.length} recorded values; latest ${number(points.at(-1)!.value, 1)} ${unit}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            axisLine={false}
            tickLine={false}
            minTickGap={25}
            tick={{ fontSize: 12, fill: 'var(--muted)' }}
          />
          <YAxis
            domain={['auto', 'auto']}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--muted)' }}
          />
          <Tooltip
            labelFormatter={(value) => shortDate(String(value))}
            formatter={(value) => [`${number(Number(value), 1)} ${unit}`, metric]}
            contentStyle={{
              background: 'var(--surface)',
              borderColor: 'var(--line)',
              color: 'var(--ink)',
            }}
            labelStyle={{ color: 'var(--ink)' }}
            itemStyle={{ color }}
          />
          <Line
            type="linear"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
