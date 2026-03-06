import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Check } from "lucide-react";
import { format } from "date-fns";

interface SlotColumnProps {
  items: { value: number; label: string }[];
  selected: number;
  onSelect: (value: number) => void;
  height?: number;
}

function SlotColumn({ items, selected, onSelect, height = 200 }: SlotColumnProps) {
  const itemH = 40;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selectedIdx = items.findIndex((i) => i.value === selected);
  const isScrolling = React.useRef(false);
  const scrollTimeout = React.useRef<ReturnType<typeof setTimeout>>();

  const scrollToIndex = React.useCallback((idx: number, smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    const target = idx * itemH;
    el.scrollTo({ top: target, behavior: smooth ? "smooth" : "auto" });
  }, []);

  React.useEffect(() => {
    if (!isScrolling.current) {
      scrollToIndex(selectedIdx >= 0 ? selectedIdx : 0, false);
    }
  }, [selectedIdx, scrollToIndex]);

  const handleScroll = () => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    isScrolling.current = true;
    scrollTimeout.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / itemH);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      scrollToIndex(clamped);
      if (items[clamped] && items[clamped].value !== selected) {
        onSelect(items[clamped].value);
      }
      isScrolling.current = false;
    }, 80);
  };

  // Visible area shows 5 items, selected in center
  const visibleItems = 5;
  const paddingItems = Math.floor(visibleItems / 2);
  const totalH = visibleItems * itemH;

  return (
    <div className="relative" style={{ height: totalH }}>
      {/* Selection highlight */}
      <div
        className="absolute left-0 right-0 pointer-events-none z-10 rounded-md border border-primary/40 bg-primary/10"
        style={{ top: paddingItems * itemH, height: itemH }}
      />
      {/* Fade top */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-popover to-transparent z-20 pointer-events-none rounded-t-md" />
      {/* Fade bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-popover to-transparent z-20 pointer-events-none rounded-b-md" />
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-hide scroll-smooth"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
        onScroll={handleScroll}
      >
        {/* Top padding */}
        {Array.from({ length: paddingItems }).map((_, i) => (
          <div key={`pad-top-${i}`} style={{ height: itemH }} />
        ))}
        {items.map((item, idx) => {
          const isSelected = item.value === selected;
          return (
            <div
              key={item.value}
              className={cn(
                "flex items-center justify-center cursor-pointer transition-all duration-150 select-none",
                isSelected
                  ? "text-foreground font-semibold text-sm scale-105"
                  : "text-muted-foreground text-xs opacity-50 hover:opacity-75"
              )}
              style={{
                height: itemH,
                scrollSnapAlign: "start",
              }}
              onClick={() => {
                onSelect(item.value);
                scrollToIndex(idx);
              }}
            >
              {item.label}
            </div>
          );
        })}
        {/* Bottom padding */}
        {Array.from({ length: paddingItems }).map((_, i) => (
          <div key={`pad-bot-${i}`} style={{ height: itemH }} />
        ))}
      </div>
    </div>
  );
}

interface SlotDatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  fromYear?: number;
  toYear?: number;
  className?: string;
  disabled?: boolean;
}

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function SlotDatePicker({
  date,
  onDateChange,
  placeholder = "Selecione...",
  fromYear = 1940,
  toYear = 2040,
  className,
  disabled,
}: SlotDatePickerProps) {
  const now = new Date();
  const [day, setDay] = React.useState(date ? date.getDate() : now.getDate());
  const [month, setMonth] = React.useState(date ? date.getMonth() : now.getMonth());
  const [year, setYear] = React.useState(date ? date.getFullYear() : now.getFullYear());
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (date) {
      setDay(date.getDate());
      setMonth(date.getMonth());
      setYear(date.getFullYear());
    }
  }, [date]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(day, daysInMonth);

  const dayItems = Array.from({ length: daysInMonth }, (_, i) => ({
    value: i + 1,
    label: String(i + 1).padStart(2, "0"),
  }));

  const monthItems = MONTHS.map((m, i) => ({ value: i, label: m }));

  const yearItems = Array.from({ length: toYear - fromYear + 1 }, (_, i) => ({
    value: fromYear + i,
    label: String(fromYear + i),
  }));

  const handleConfirm = () => {
    const finalDay = Math.min(clampedDay, daysInMonth);
    onDateChange(new Date(year, month, finalDay));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 min-w-[60px]">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground text-center mb-1 font-semibold">Dia</p>
              <SlotColumn items={dayItems} selected={clampedDay} onSelect={setDay} />
            </div>
            <div className="flex-1 min-w-[60px]">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground text-center mb-1 font-semibold">Mês</p>
              <SlotColumn items={monthItems} selected={month} onSelect={setMonth} />
            </div>
            <div className="flex-1 min-w-[70px]">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground text-center mb-1 font-semibold">Ano</p>
              <SlotColumn items={yearItems} selected={year} onSelect={setYear} />
            </div>
          </div>
          <Button size="sm" className="w-full gap-1.5" onClick={handleConfirm}>
            <Check className="w-3.5 h-3.5" /> Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
