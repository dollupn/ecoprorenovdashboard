import { useEffect, useState } from "react";

interface GaugeChartProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showValue?: boolean;
}

export function GaugeChart({
  percentage,
  size = 120,
  strokeWidth = 8,
  showValue = true,
}: GaugeChartProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedPercentage / 100) * circumference;

  // Determine color based on percentage
  const getColor = () => {
    if (percentage >= 80) return "hsl(var(--primary))";
    if (percentage >= 60) return "hsl(142, 76%, 36%)"; // green
    if (percentage >= 40) return "hsl(48, 96%, 53%)"; // yellow
    return "hsl(0, 84%, 60%)"; // red
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          opacity={0.2}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{
            filter: "drop-shadow(0 0 4px currentColor)",
          }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-foreground">
            {Math.round(animatedPercentage)}%
          </span>
        </div>
      )}
    </div>
  );
}
