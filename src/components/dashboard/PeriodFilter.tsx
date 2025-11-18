import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subWeeks, subMonths, subQuarters } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

export type PeriodType = "week" | "month" | "quarter" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

interface PeriodFilterProps {
  periodType: PeriodType;
  dateRange: DateRange;
  onPeriodChange: (type: PeriodType, range: DateRange) => void;
}

export function PeriodFilter({ periodType, dateRange, onPeriodChange }: PeriodFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePeriodTypeChange = (type: PeriodType) => {
    const now = new Date();
    let newRange: DateRange;

    switch (type) {
      case "week":
        newRange = {
          from: startOfWeek(now, { locale: fr }),
          to: endOfWeek(now, { locale: fr }),
        };
        break;
      case "month":
        newRange = {
          from: startOfMonth(now),
          to: endOfMonth(now),
        };
        break;
      case "quarter":
        newRange = {
          from: startOfQuarter(now),
          to: endOfQuarter(now),
        };
        break;
      default:
        newRange = dateRange;
    }

    onPeriodChange(type, newRange);
  };

  const handleDateSelect = (range: { from?: Date; to?: Date }) => {
    if (range.from && range.to) {
      onPeriodChange("custom", { from: range.from, to: range.to });
      setIsOpen(false);
    }
  };

  const getPreviousPeriod = () => {
    let newRange: DateRange;
    
    switch (periodType) {
      case "week":
        newRange = {
          from: startOfWeek(subWeeks(dateRange.from, 1), { locale: fr }),
          to: endOfWeek(subWeeks(dateRange.to, 1), { locale: fr }),
        };
        break;
      case "month":
        newRange = {
          from: startOfMonth(subMonths(dateRange.from, 1)),
          to: endOfMonth(subMonths(dateRange.to, 1)),
        };
        break;
      case "quarter":
        newRange = {
          from: startOfQuarter(subQuarters(dateRange.from, 1)),
          to: endOfQuarter(subQuarters(dateRange.to, 1)),
        };
        break;
      default:
        const diff = dateRange.to.getTime() - dateRange.from.getTime();
        newRange = {
          from: new Date(dateRange.from.getTime() - diff),
          to: new Date(dateRange.to.getTime() - diff),
        };
    }

    onPeriodChange(periodType, newRange);
  };

  const getNextPeriod = () => {
    let newRange: DateRange;
    
    switch (periodType) {
      case "week":
        newRange = {
          from: startOfWeek(subWeeks(dateRange.from, -1), { locale: fr }),
          to: endOfWeek(subWeeks(dateRange.to, -1), { locale: fr }),
        };
        break;
      case "month":
        newRange = {
          from: startOfMonth(subMonths(dateRange.from, -1)),
          to: endOfMonth(subMonths(dateRange.to, -1)),
        };
        break;
      case "quarter":
        newRange = {
          from: startOfQuarter(subQuarters(dateRange.from, -1)),
          to: endOfQuarter(subQuarters(dateRange.to, -1)),
        };
        break;
      default:
        const diff = dateRange.to.getTime() - dateRange.from.getTime();
        newRange = {
          from: new Date(dateRange.from.getTime() + diff),
          to: new Date(dateRange.to.getTime() + diff),
        };
    }

    onPeriodChange(periodType, newRange);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      <Tabs value={periodType} onValueChange={(v) => handlePeriodTypeChange(v as PeriodType)}>
        <TabsList className="grid w-full sm:w-auto grid-cols-4">
          <TabsTrigger value="week">Semaine</TabsTrigger>
          <TabsTrigger value="month">Mois</TabsTrigger>
          <TabsTrigger value="quarter">Trimestre</TabsTrigger>
          <TabsTrigger value="custom">Personnalisé</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={getPreviousPeriod}>
          ←
        </Button>
        
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal min-w-[240px]",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from && dateRange?.to ? (
                <>
                  {format(dateRange.from, "dd MMM", { locale: fr })} - {format(dateRange.to, "dd MMM yyyy", { locale: fr })}
                </>
              ) : (
                <span>Sélectionner une période</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={handleDateSelect}
              locale={fr}
              numberOfMonths={2}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" onClick={getNextPeriod}>
          →
        </Button>
      </div>
    </div>
  );
}
