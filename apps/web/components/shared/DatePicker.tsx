"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Clock3 } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MONTHS = Array.from({ length: 12 }, (_, month) =>
  format(new Date(2020, month, 1), "MMMM", { locale: es }),
);

export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disabled,
  className,
  showToday = true,
  minYear = 1920,
  maxYear = new Date().getFullYear() + 10,
}: {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showToday?: boolean;
  minYear?: number;
  maxYear?: number;
}) {
  const parsed = value ? parseISO(value.slice(0, 10)) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(selected ?? new Date());
  const years = useMemo(
    () =>
      Array.from(
        { length: maxYear - minYear + 1 },
        (_, index) => maxYear - index,
      ),
    [maxYear, minYear],
  );

  const choose = (day: Date) => {
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setVisibleMonth(selected ?? new Date());
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 text-left text-sm shadow-sm transition hover:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-100 disabled:opacity-50",
            !selected && "text-text-muted",
            className,
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-brand-600" />
          <span className="min-w-0 flex-1 truncate">
            {selected
              ? format(selected, "d 'de' MMMM, yyyy", { locale: es })
              : placeholder}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-disabled" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-border p-0 shadow-2xl"
      >
        <div className="grid grid-cols-2 gap-2 border-b border-border-subtle bg-brand-50/70 p-3">
          <label className="min-w-0">
            <span className="sr-only">Mes</span>
            <select
              aria-label="Mes"
              value={visibleMonth.getMonth()}
              onChange={(event) =>
                setVisibleMonth(
                  new Date(
                    visibleMonth.getFullYear(),
                    Number(event.target.value),
                    1,
                  ),
                )
              }
              className="h-9 w-full rounded-lg border border-brand-200 bg-white px-2 text-sm font-semibold capitalize text-text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className="sr-only">Año</span>
            <select
              aria-label="Año"
              value={visibleMonth.getFullYear()}
              onChange={(event) =>
                setVisibleMonth(
                  new Date(
                    Number(event.target.value),
                    visibleMonth.getMonth(),
                    1,
                  ),
                )
              }
              className="h-9 w-full rounded-lg border border-brand-200 bg-white px-2 text-sm font-semibold text-text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Calendar
          mode="single"
          month={visibleMonth}
          onMonthChange={setVisibleMonth}
          selected={selected}
          onSelect={(day) => day && choose(day)}
          locale={es}
          hideNavigation
          className="mx-auto p-3"
          classNames={{ month_caption: "hidden" }}
          autoFocus
        />

        <div className="flex items-center justify-between gap-2 border-t border-border-subtle bg-surface-muted/70 p-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            disabled={!value}
          >
            Limpiar
          </Button>
          {showToday && (
            <Button type="button" size="sm" onClick={() => choose(new Date())}>
              <CalendarDays className="mr-1.5 h-4 w-4" />
              Hoy
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const TIMES = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 ? "30" : "00";
  const value = `${String(hour).padStart(2, "0")}:${minute}`;
  const label = new Intl.DateTimeFormat("es-PA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(2020, 0, 1, hour, Number(minute)));
  return { value, label };
});

export function TimePicker({
  value,
  onChange,
  placeholder = "Seleccionar hora",
  className,
}: {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn("h-10 rounded-xl bg-surface shadow-sm", className)}
      >
        <Clock3 className="mr-2 h-4 w-4 text-brand-600" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72 rounded-xl">
        {TIMES.map((time) => (
          <SelectItem key={time.value} value={time.value}>
            {time.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
