"use client";

import { useEffect, useRef, useState } from "react";
import { FiCalendar, FiChevronLeft, FiChevronRight } from "react-icons/fi";

type DatePickerInputProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
};

function getTodayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function toLocalDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }

  return new Date(year, month - 1, day);
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseLocalDateValue(value || getTodayInputValue()));
}

export default function DatePickerInput({
  value,
  onChange,
  label = "Ngày",
  placeholder = "Chưa chọn",
  className = "",
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseLocalDateValue(value || getTodayInputValue()));
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const selectedValue = value || getTodayInputValue();
  const todayValue = getTodayInputValue();
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const leadingBlanks = firstDay === 0 ? 6 : firstDay - 1;
  const calendarDays = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const moveMonth = (amount: number) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const handleSelectDate = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  const togglePicker = () => {
    setOpen((current) => {
      if (!current) {
        setViewDate(parseLocalDateValue(selectedValue));
      }

      return !current;
    });
  };

  return (
    <div ref={pickerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={togglePicker}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-orange-300"
      >
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wide text-orange-600">
            {label}
          </span>
          <span className="mt-1 block text-sm font-bold text-slate-900">
            {value ? formatLongDate(selectedValue) : placeholder}
          </span>
        </span>
        <FiCalendar className="h-5 w-5 text-orange-600" />
      </button>

      {open ? (
        <div className="absolute left-0 z-30 mt-2 w-[320px] rounded-3xl border border-orange-100 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="rounded-xl p-2 text-slate-600 hover:bg-orange-50 hover:text-orange-700"
              aria-label="Tháng trước"
            >
              <FiChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-900">
                Tháng {viewDate.getMonth() + 1}/{viewDate.getFullYear()}
              </p>
              <button
                type="button"
                onClick={() => handleSelectDate(todayValue)}
                className="mt-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
              >
                Hôm nay
              </button>
            </div>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="rounded-xl p-2 text-slate-600 hover:bg-orange-50 hover:text-orange-700"
              aria-label="Tháng sau"
            >
              <FiChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
              <span key={day} className="py-2">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <span key={`empty-${index}`} className="h-9" />;
              }

              const dayValue = toLocalDateValue(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
              const isSelected = Boolean(value) && dayValue === selectedValue;
              const isToday = dayValue === todayValue;

              return (
                <button
                  key={dayValue}
                  type="button"
                  onClick={() => handleSelectDate(dayValue)}
                  className={[
                    "h-9 rounded-xl text-sm font-semibold transition",
                    isSelected
                      ? "bg-orange-500 text-white shadow-sm"
                      : isToday
                        ? "bg-orange-50 text-orange-700"
                        : "text-slate-700 hover:bg-orange-50 hover:text-orange-700",
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
