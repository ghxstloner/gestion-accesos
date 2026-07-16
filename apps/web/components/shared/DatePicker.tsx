"use client"

import * as React from "react"
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3,
} from "lucide-react"
import {
  format,
  isValid,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const WEEKDAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"]
const MONTHS = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2020, i, 1), "MMM", { locale: es }),
)
const CURRENT_YEAR = new Date().getFullYear()

function buildCalendarDays(year: number, month: number): Date[] {
  const first = startOfMonth(new Date(year, month))
  const last = endOfMonth(first)
  // semana empieza el lunes (weekStartsOn: 1)
  return eachDayOfInterval({
    start: startOfWeek(first, { weekStartsOn: 1 }),
    end: endOfWeek(last, { weekStartsOn: 1 }),
  })
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disabled,
  className,
  minYear = 1920,
  maxYear = CURRENT_YEAR + 10,
  defaultMonth,
}: {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  minYear?: number
  maxYear?: number
  defaultMonth?: Date
}) {
  const [open, setOpen] = React.useState(false)

  const parsed = value ? parseISO(value.slice(0, 10)) : undefined
  const date = parsed && isValid(parsed) ? parsed : undefined

  const [visibleMonth, setVisibleMonth] = React.useState<Date>(
    date ?? defaultMonth ?? new Date(),
  )

  const years = React.useMemo(
    () =>
      Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i),
    [maxYear, minYear],
  )

  const days = React.useMemo(
    () => buildCalendarDays(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth],
  )

  const choose = (day: Date) => {
    onChange(format(day, "yyyy-MM-dd"))
    setOpen(false)
  }

  const shiftMonth = (dir: -1 | 1) => {
    setVisibleMonth((cur) => {
      const next = new Date(cur.getFullYear(), cur.getMonth() + dir, 1)
      if (next.getFullYear() < minYear) return new Date(minYear, 0, 1)
      if (next.getFullYear() > maxYear) return new Date(maxYear, 11, 1)
      return next
    })
  }

  const atStart =
    visibleMonth.getFullYear() === minYear && visibleMonth.getMonth() === 0
  const atEnd =
    visibleMonth.getFullYear() === maxYear && visibleMonth.getMonth() === 11

  const handleOpenChange = (next: boolean) => {
    if (next) setVisibleMonth(date ?? defaultMonth ?? new Date())
    setOpen(next)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          id="date"
          type="button"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start rounded-lg border-border bg-surface px-3 text-left text-sm font-normal text-text-primary shadow-none transition-colors hover:border-brand-400 hover:bg-surface focus-visible:ring-1 focus-visible:ring-brand-300",
            !date && "text-text-muted",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-3.5 shrink-0 text-text-muted" />
          {date ? (
            <span className="text-text-primary">
              {format(date, "d 'de' MMMM, yyyy", { locale: es })}
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronDownIcon className="ml-auto size-3.5 shrink-0 text-text-disabled opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
        style={{ backgroundColor: "#ffffff" }}
        align="start"
        sideOffset={6}
        collisionPadding={8}
      >
        {/* ── Navegación ── */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => shiftMonth(-1)}
            disabled={atStart}
            className="inline-flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeftIcon className="size-4" />
          </button>

          <div className="flex items-center gap-1 text-sm font-semibold text-gray-800">
            <select
              aria-label="Mes"
              value={visibleMonth.getMonth()}
              onChange={(e) =>
                setVisibleMonth(
                  new Date(visibleMonth.getFullYear(), Number(e.target.value), 1),
                )
              }
              className="cursor-pointer appearance-none bg-transparent capitalize outline-none"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>

            <select
              aria-label="Año"
              value={visibleMonth.getFullYear()}
              onChange={(e) =>
                setVisibleMonth(
                  new Date(Number(e.target.value), visibleMonth.getMonth(), 1),
                )
              }
              className="cursor-pointer appearance-none bg-transparent outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => shiftMonth(1)}
            disabled={atEnd}
            className="inline-flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>

        {/* ── Cabecera días semana ── */}
        <div className="mb-1 grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[11px] font-medium uppercase tracking-wide text-gray-400"
            >
              {d}
            </div>
          ))}
        </div>

        {/* ── Grid de días ── */}
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((day) => {
            const isCurrentMonth = isSameMonth(day, visibleMonth)
            const isSelected = date ? isSameDay(day, date) : false
            const isTodayDay = isToday(day)

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => choose(day)}
                className={cn(
                  "mx-auto flex size-8 items-center justify-center rounded-full text-sm transition-colors",
                  // días fuera del mes
                  !isCurrentMonth && "text-gray-300",
                  // día normal dentro del mes
                  isCurrentMonth && !isSelected && !isTodayDay &&
                    "text-gray-700 hover:bg-gray-100",
                  // hoy (sin seleccionar)
                  isTodayDay && !isSelected &&
                    "font-semibold text-gray-900 underline decoration-dotted underline-offset-2",
                  // seleccionado
                  isSelected &&
                    "bg-gray-900 font-semibold text-white hover:bg-gray-800",
                )}
              >
                {format(day, "d")}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

const TIMES = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2)
  const minute = index % 2 ? "30" : "00"
  const value = `${String(hour).padStart(2, "0")}:${minute}`
  const label = new Intl.DateTimeFormat("es-PA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(2020, 0, 1, hour, Number(minute)))
  return { value, label }
})

export function TimePicker({
  value,
  onChange,
  placeholder = "Seleccionar hora",
  className,
}: {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-10 rounded-xl bg-surface shadow-sm", className)}>
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
  )
}

