import { format, parseISO } from "date-fns";

export function formatDate(dateString: string | undefined | null) {
  if (!dateString) return "-";
  try {
    return format(parseISO(dateString), "dd/MM/yyyy HH:mm");
  } catch (e) {
    return dateString;
  }
}

export function formatProductionDate(dateString: string | undefined | null) {
  if (!dateString) return "-";
  try {
     return format(parseISO(dateString), "dd/MM/yyyy");
  } catch (e) {
    return dateString;
  }
}
