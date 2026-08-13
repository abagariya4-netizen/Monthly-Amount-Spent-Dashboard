export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type Month = {
  label: string;
  startDate: string;
  endDate: string;
};

export function getDefaultMonthsBeforeCurrent(): Month[] {
  const istString = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const today = new Date(istString);
  const months: Month[] = [];
  
  for (let i = 4; i >= 1; i--) {
    const targetMonthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = targetMonthDate.getFullYear();
    const monthIndex = targetMonthDate.getMonth();
    
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    
    const label = targetMonthDate.toLocaleString('default', { month: 'short' }) + "'" + year.toString().slice(-2);
    
    months.push({
      label,
      startDate: fmtDate(monthStart),
      endDate: fmtDate(monthEnd),
    });
  }
  return months;
}

export function getSelectedMonths(startDateStr: string, endDateStr: string): Month[] {
  const startParts = startDateStr.split('-');
  const endParts = endDateStr.split('-');
  
  const startYear = parseInt(startParts[0]);
  const startMonth = parseInt(startParts[1]) - 1;
  
  const endYear = parseInt(endParts[0]);
  const endMonth = parseInt(endParts[1]) - 1;
  
  let current = new Date(startYear, startMonth, 1);
  const end = new Date(endYear, endMonth, 1);

  const istString = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const today = new Date(istString);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  
  const months: Month[] = [];
  
  while (current <= end) {
    const year = current.getFullYear();
    const monthIndex = current.getMonth();
    
    const monthStart = new Date(year, monthIndex, 1);
    let monthEnd = new Date(year, monthIndex + 1, 0);

    if (monthEnd > yesterday) {
      monthEnd = new Date(yesterday.getTime());
    }
    
    if (monthStart > yesterday) {
      break;
    }
    
    const label = current.toLocaleString('default', { month: 'short' }) + "'" + year.toString().slice(-2);
    
    months.push({
      label,
      startDate: fmtDate(monthStart),
      endDate: fmtDate(monthEnd)
    });
    
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}
