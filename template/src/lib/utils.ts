import { format, parse } from 'date-fns';

export function formatLongDate(date: string): string {
  return format(
    parse(date, "yyyy-MM-dd'T'HH:mm:ssXXX", new Date()),
    "PP 'at' p",
  );
}

export function formatLongDate2(date: string): string {
  return format(
    parse(date, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX", new Date()),
    "PP 'at' p",
  );
}

export function formatYMD(date: string): string {
  return format(
    parse(date, "yyyy-MM-dd'T'HH:mm:ssXXX", new Date()),
    'MM/dd/yyyy',
  );
}

export function formatYMD2(date: string): string {
  return format(
    parse(date, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX", new Date()),
    'MM/dd/yyyy',
  );
}