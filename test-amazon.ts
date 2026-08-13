import { parse } from 'path';

function deriveCategory(campaignName: string) {
  const segments = campaignName.split('/');
  for (const seg of segments) {
    const s = seg.toLowerCase();
    if (s.includes('chair')) return 'Chair';
    if (s.includes('mattress') || s === 'mat') return 'Mattress';
    if (s.includes('sofa')) return 'Sofa';
    if (s.includes('desk')) return 'Desk';
    if (s.includes('comforter')) return 'Comforter';
    if (s.includes('cushion') || s.includes('pillow')) return 'Accessories';
  }
  return 'Uncategorized';
}

function formatDateLabel(d: Date) {
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

// Test cases
console.log('Category tests:');
console.log('TSC/Chair/SP/Generic/CT/Onyx ->', deriveCategory('TSC/Chair/SP/Generic/CT/Onyx') === 'Chair' ? 'PASS' : 'FAIL');
console.log('TSC/SP/Sofa/Generic/KW/2 Seater/Exp ->', deriveCategory('TSC/SP/Sofa/Generic/KW/2 Seater/Exp') === 'Sofa' ? 'PASS' : 'FAIL');
console.log('TSC/SP/Pillow/Generic/KW ->', deriveCategory('TSC/SP/Pillow/Generic/KW') === 'Accessories' ? 'PASS' : 'FAIL');

type Bucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  order: number;
};

// Assuming anchor is June 10, 2026
const anchorDate = new Date('2026-06-10T00:00:00.000Z');

// Build Buckets
const bcks: Bucket[] = [];
const d1 = new Date(anchorDate);
bcks.push({ key: 'day1', label: formatDateLabel(d1), start: d1, end: d1, order: 10000 });

const d2 = new Date(d1); d2.setDate(d2.getDate() - 1);
bcks.push({ key: 'day2', label: formatDateLabel(d2), start: d2, end: d2, order: 9000 });

const d3 = new Date(d1); d3.setDate(d3.getDate() - 2);
bcks.push({ key: 'day3', label: formatDateLabel(d3), start: d3, end: d3, order: 8000 });

const d4 = new Date(d1); d4.setDate(d4.getDate() - 3);
const monthStart = new Date(d1); monthStart.setDate(1);

if (d4 >= monthStart) {
  const monthName = monthStart.toLocaleString('en-US', { month: 'short' });
  bcks.push({ 
    key: 'partial', 
    label: `${monthName} 1-${d4.getDate()}`, 
    start: monthStart, 
    end: d4, 
    order: 7000 
  });
}

// Test Spend calculation
// We want Jun 8: 10766.85
// We want Jun 9: 11038.79
// We want Jun 10: 10897.91
// We want Jun 1-7: ~69419

const dummyData = [
  { date: new Date('2026-06-10T00:00:00.000Z'), spend: 10897.91 },
  { date: new Date('2026-06-09T00:00:00.000Z'), spend: 11038.79 },
  { date: new Date('2026-06-08T00:00:00.000Z'), spend: 10766.85 },
  { date: new Date('2026-06-07T00:00:00.000Z'), spend: 10000 },
  { date: new Date('2026-06-06T00:00:00.000Z'), spend: 10000 },
  { date: new Date('2026-06-05T00:00:00.000Z'), spend: 10000 },
  { date: new Date('2026-06-04T00:00:00.000Z'), spend: 10000 },
  { date: new Date('2026-06-03T00:00:00.000Z'), spend: 10000 },
  { date: new Date('2026-06-02T00:00:00.000Z'), spend: 10000 },
  { date: new Date('2026-06-01T00:00:00.000Z'), spend: 9419 },
];

const agg: Record<string, number> = {};
bcks.forEach(b => agg[b.key] = 0);

dummyData.forEach(r => {
  for (const b of bcks) {
    if (r.date >= b.start && r.date <= b.end) {
      agg[b.key] += r.spend;
      break;
    }
  }
});

console.log('\nBucket Aggregation Tests:');
console.log('day1 (Jun 10):', agg['day1'], '==', 10897.91, '->', Math.abs(agg['day1'] - 10897.91) < 0.01 ? 'PASS' : 'FAIL');
console.log('day2 (Jun 9):', agg['day2'], '==', 11038.79, '->', Math.abs(agg['day2'] - 11038.79) < 0.01 ? 'PASS' : 'FAIL');
console.log('day3 (Jun 8):', agg['day3'], '==', 10766.85, '->', Math.abs(agg['day3'] - 10766.85) < 0.01 ? 'PASS' : 'FAIL');
console.log('partial (Jun 1-7):', agg['partial'], '==', 69419, '->', Math.abs(agg['partial'] - 69419) < 0.01 ? 'PASS' : 'FAIL');
