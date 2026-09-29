// Whole days from today until `date` (a YYYY-MM-DD string), or null if it has
// passed. Computed on UTC calendar days so the server and every visitor's
// browser agree; a local-time version disagreed across timezones near midnight
// and broke hydration of the header countdown.
export const getDaysUntil = (date: string) => {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = new Date(date);
  if (isNaN(target.getTime())) return null;
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const diffDays = Math.round((targetUtc - todayUtc) / 86400000);
  return diffDays > 0 ? diffDays : null;
};
