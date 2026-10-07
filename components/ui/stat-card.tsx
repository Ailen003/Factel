import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconBgColor = "bg-primary",
  iconColor = "text-primary-foreground",
  trend,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "border-border/60 bg-card",
        "shadow-sm",
        className
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              iconBgColor
            )}
          >
            <Icon
              className={cn("h-5 w-5", iconColor)}
              aria-hidden="true"
            />
          </div>
          
          <div className="flex-1 space-y-0.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider sm:text-xs">
              {title}
            </p>
            <p className="text-xl font-semibold text-foreground leading-none sm:text-2xl">
              {value}
            </p>
            {trend && (
              <div className="flex items-center gap-1 text-[10px] mt-1 sm:text-xs">
                <span
                  className={cn(
                    "font-medium",
                    trend.isPositive ? "text-green-600" : "text-red-600"
                  )}
                >
                  {trend.isPositive ? "+" : "-"}
                  {Math.abs(trend.value)}%
                </span>
                <span className="text-muted-foreground text-[10px] sm:text-xs">vs last period</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
