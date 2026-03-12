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
}

function SlotColumn({ items, selected, onSelect }: SlotColumnProps) {
  const ITEM_HEIGHT = 42;
  const VISIBLE = 5;
  const CENTER = Math.floor(VISIBLE / 2);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isDragging = React.useRef(false);
  const startY = React.useRef(0);
  const startOffset = React.useRef(0);
  const [offset, setOffset] = React.useState(0);
  const animFrame = React.useRef<number>();
  const velocity = React.useRef(0);
  const lastY = React.useRef(0);
  const lastTime = React.useRef(0);

  const selectedIdx = React.useMemo(
    () => items.findIndex((i) => i.value === selected),
    [items, selected]
  );

  // Sync offset when selected changes externally
  React.useEffect(() => {
    const idx = selectedIdx >= 0 ? selectedIdx : 0;
    setOffset(-idx * ITEM_HEIGHT);
  }, [selectedIdx]);

  const clampOffset = (o: number) => {
    const min = -(items.length - 1) * ITEM_HEIGHT;
    return Math.max(min, Math.min(0, o));
  };

  const snapToNearest = (currentOffset: number, vel: number = 0) => {
    // Project forward based on velocity
    let projected = currentOffset + vel * 8;
    projected = clampOffset(projected);
    const idx = Math.round(-projected / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    const target = -clamped * ITEM_HEIGHT;

    // Animate to target
    const animate = () => {
      setOffset((prev) => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.5) {
          if (items[clamped] && items[clamped].value !== selected) {
            onSelect(items[clamped].value);
          }
          return target;
        }
        const next = prev + diff * 0.2;
        animFrame.current = requestAnimationFrame(animate);
        return next;
      });
    };
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    animFrame.current = requestAnimationFrame(animate);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    isDragging.current = true;
    startY.current = e.clientY;
    startOffset.current = offset;
    lastY.current = e.clientY;
    lastTime.current = Date.now();
    velocity.current = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dy = e.clientY - startY.current;
    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
      velocity.current = (e.clientY - lastY.current) / dt;
    }
    lastY.current = e.clientY;
    lastTime.current = now;
    setOffset(clampOffset(startOffset.current + dy));
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    snapToNearest(offset, velocity.current * 100);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    const newOffset = clampOffset(offset - e.deltaY);
    setOffset(newOffset);
    snapToNearest(newOffset);
  };

  const handleClick = (idx: number) => {
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    const target = -idx * ITEM_HEIGHT;
    onSelect(items[idx].value);

    const animate = () => {
      setOffset((prev) => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.5) return target;
        animFrame.current = requestAnimationFrame(animate);
        return prev + diff * 0.2;
      });
    };
    animFrame.current = requestAnimationFrame(animate);
  };

  React.useEffect(() => {
    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, []);

  const totalHeight = VISIBLE * ITEM_HEIGHT;

  return (
    <div
      className="relative select-none touch-none overflow-hidden"
      style={{ height: totalHeight }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Center selection highlight */}
      <div
        className="absolute left-1 right-1 z-10 pointer-events-none rounded-lg"
        style={{
          top: CENTER * ITEM_HEIGHT,
          height: ITEM_HEIGHT,
          background: "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.06))",
          border: "1.5px solid hsl(var(--primary) / 0.45)",
          boxShadow: "0 0 10px hsl(var(--primary) / 0.1), inset 0 1px 0 hsl(var(--primary) / 0.08)",
        }}
      />
      {/* Top fade */}
      <div
        className="absolute top-0 left-0 right-0 z-20 pointer-events-none"
        style={{
          height: CENTER * ITEM_HEIGHT,
          background: "linear-gradient(to bottom, hsl(var(--popover)), hsl(var(--popover) / 0.6), transparent)",
        }}
      />
      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
        style={{
          height: CENTER * ITEM_HEIGHT,
          background: "linear-gradient(to top, hsl(var(--popover)), hsl(var(--popover) / 0.6), transparent)",
        }}
      />
      {/* Items */}
      <div
        className="absolute left-0 right-0"
        style={{
          top: CENTER * ITEM_HEIGHT,
          transform: `translateY(${offset}px)`,
          willChange: "transform",
        }}
      >
        {items.map((item, idx) => {
          // Calculate visual distance from center for 3D effect
          const itemCenter = idx * ITEM_HEIGHT + ITEM_HEIGHT / 2;
          const viewCenter = -offset;
          const dist = (itemCenter - viewCenter) / ITEM_HEIGHT;
          const absDist = Math.abs(dist);

          const rotateX = Math.max(-60, Math.min(60, dist * -20));
          const scale = Math.max(0.7, 1 - absDist * 0.08);
          const itemOpacity = Math.max(0.1, 1 - absDist * 0.35);
          const isCenter = absDist < 0.6;

          return (
            <div
              key={`${item.value}-${item.label}`}
              className={cn(
                "flex items-center justify-center cursor-pointer",
                isCenter
                  ? "text-foreground font-bold"
                  : "text-muted-foreground"
              )}
              style={{
                height: ITEM_HEIGHT,
                fontSize: isCenter ? "0.9rem" : "0.75rem",
                opacity: itemOpacity,
                transform: `perspective(200px) rotateX(${rotateX}deg) scale(${scale})`,
                transformOrigin: "center center",
                transition: isDragging.current ? "none" : "transform 0.08s ease-out",
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleClick(idx);
              }}
            >
              {item.label}
            </div>
          );
        })}
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
    if (date && !isNaN(date.getTime())) {
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
        <div
          className="p-4 space-y-3 rounded-lg"
          style={{
            background: "linear-gradient(145deg, hsl(var(--popover)), hsl(var(--card)))",
            boxShadow: "0 8px 32px hsl(var(--primary) / 0.08), 0 0 0 1px hsl(var(--border))",
          }}
        >
          <div className="flex gap-1">
            <div className="flex-1 min-w-[58px]">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-1 font-semibold">
                Dia
              </p>
              <SlotColumn items={dayItems} selected={clampedDay} onSelect={setDay} />
            </div>
            <div
              className="w-px self-stretch my-6"
              style={{ background: "hsl(var(--border) / 0.4)" }}
            />
            <div className="flex-1 min-w-[58px]">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-1 font-semibold">
                Mês
              </p>
              <SlotColumn items={monthItems} selected={month} onSelect={setMonth} />
            </div>
            <div
              className="w-px self-stretch my-6"
              style={{ background: "hsl(var(--border) / 0.4)" }}
            />
            <div className="flex-1 min-w-[68px]">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-1 font-semibold">
                Ano
              </p>
              <SlotColumn items={yearItems} selected={year} onSelect={setYear} />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={handleConfirm}
            style={{
              boxShadow: "0 4px 14px hsl(var(--primary) / 0.25)",
            }}
          >
            <Check className="w-3.5 h-3.5" /> Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
