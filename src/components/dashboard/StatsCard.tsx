import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: "default" | "filled" | "outline"
  className?: string
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: StatsCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group",
        variant === "filled" && "bg-slate-500 text-white border-slate-500",
        variant === "outline" && "border-2 border-dashed border-slate-300",
        className
      )}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div className="absolute inset-0 pattern-dots" />
      </div>

      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-wider",
                variant === "filled"
                  ? "text-white/70"
                  : "text-slate-500"
              )}
            >
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-4xl font-bold tracking-tight animate-fade-in",
                  variant === "filled" ? "text-white" : "text-slate-900"
                )}
              >
                {value}
              </span>
              {trend && (
                <span
                  className={cn(
                    "text-sm font-medium px-2 py-0.5 rounded-full",
                    trend.isPositive
                      ? "bg-slate-100 text-slate-700"
                      : "bg-slate-50 text-slate-500"
                  )}
                >
                  {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {description && (
              <p
                className={cn(
                  "text-sm",
                  variant === "filled"
                    ? "text-white/80"
                    : "text-slate-500"
                )}
              >
                {description}
              </p>
            )}
          </div>

          {Icon && (
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
                variant === "filled"
                  ? "bg-white/15"
                  : "bg-slate-100"
              )}
            >
              <Icon
                className={cn(
                  "h-6 w-6",
                  variant === "filled"
                    ? "text-white/90"
                    : "text-slate-500"
                )}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
