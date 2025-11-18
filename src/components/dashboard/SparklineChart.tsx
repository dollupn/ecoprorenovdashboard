import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparklineChartProps {
  data: number[];
  height?: number;
  color?: string;
  gradient?: boolean;
}

export function SparklineChart({
  data,
  height = 60,
  color = "hsl(var(--primary))",
  gradient = true,
}: SparklineChartProps) {
  const chartData = data.map((value, index) => ({
    index,
    value,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <defs>
          <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          fill={gradient ? "url(#sparklineGradient)" : "none"}
          animationDuration={1000}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
