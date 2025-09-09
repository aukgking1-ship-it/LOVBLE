import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGregorianDate(input: string | Date, locale: string = 'ar-LY'): string {
  try {
    const date = input instanceof Date ? input : new Date(input);
    const options: Intl.DateTimeFormatOptions & { calendar?: string } = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      calendar: 'gregory'
    };
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return '';
  }
}

export function formatArDate(input: string | Date): string {
  try {
    const date = input instanceof Date ? input : new Date(input);
    const locale = 'ar-EG-u-nu-arab';
    const options: Intl.DateTimeFormatOptions & { calendar?: string } = {
      year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'gregory'
    };
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch { return ''; }
}

export function formatArNumber(n: number): string {
  try {
    return new Intl.NumberFormat('ar-EG-u-nu-arab', { maximumFractionDigits: 0, useGrouping: true }).format(Number(n) || 0);
  } catch { return (Number(n) || 0).toLocaleString('ar-EG'); }
}

export function formatArCurrencyLYD(n: number): string {
  const num = formatArNumber(n);
  return `${num} د.ل`;
}
