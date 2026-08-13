'use client';
import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const CATEGORIES = ['Mattress', 'Sofa', 'Chair', 'Desk', 'Accessories', 'Comforter'];

type RawRow = {
  asin: string;
  campaign: string;
  date: Date;
  spend: number;
};

type Bucket = {
  key: string;
  label: string;
  type: 'day' | 'partial' | 'month';
  start: Date;
  end: Date;
  order: number;
};

function parseAnyDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') return new Date(Math.round((val - 25569) * 86400 * 1000));
  
  const s = val.toString().trim();
  
  // 1. Try DD/MM/YYYY fallback explicitly FIRST
  // If we rely on standard JS Date first, it will mistakenly parse "05/06/2026" as May 6th instead of June 5th.
  const ddMmyyyy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddMmyyyy) {
    const d = new Date(`${ddMmyyyy[3]}-${ddMmyyyy[2].padStart(2,'0')}-${ddMmyyyy[1].padStart(2,'0')}T00:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  
  // 2. Try DD-MMM-YYYY
  const ddMmmYy = s.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3})[-/ ](\d{2,4})$/);
  if (ddMmmYy) {
    let year = ddMmmYy[3];
    if (year.length === 2) year = '20' + year;
    const d = new Date(`${ddMmmYy[2]} ${ddMmmYy[1]}, ${year}`);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Try standard JS parse (handles YYYY-MM-DD, etc)
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  
  return null;
}

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

export default function AmazonPage() {
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [statusMsg, setStatusMsg] = useState('No file loaded');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [appliedCats, setAppliedCats] = useState<string[]>([]);
  const [asinCategoryMap, setAsinCategoryMap] = useState<Map<string, string>>(new Map());

  const processData = (dataArray: any[]) => {
    const parsed: RawRow[] = [];
    const catMap = new Map<string, string>();
    const parseNum = (val: any) => parseFloat((val || '0').toString().replace(/[^0-9.-]+/g, '')) || 0;

    dataArray.forEach(r => {
      // Find keys case-insensitively
      const keys = Object.keys(r);
      const keyDate = keys.find(k => k.trim().toLowerCase() === 'date');
      const keyCampaign = keys.find(k => k.trim().toLowerCase() === 'campaign name');
      const keyAsin = keys.find(k => k.trim().toLowerCase() === 'advertised asin');
      const keySpend = keys.find(k => k.trim().toLowerCase() === 'spend');

      if (!keyDate || !keyCampaign || !keyAsin || !keySpend) return;

      const rawDate = r[keyDate];
      const dateObj = parseAnyDate(rawDate);
      if (!dateObj) return;

      const asin = (r[keyAsin] || '').toString().trim();
      const campaign = (r[keyCampaign] || '').toString().trim();
      const spend = parseNum(r[keySpend]);

      if (!asin) return;

      if (!catMap.has(asin)) {
        catMap.set(asin, deriveCategory(campaign));
      }

      dateObj.setHours(0,0,0,0);

      parsed.push({
        asin,
        campaign,
        date: dateObj,
        spend
      });
    });

    setAsinCategoryMap(catMap);
    setRawData(parsed);
    setStatusMsg(`File loaded — ${parsed.length} rows processed`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setStatusMsg('Parsing file...');
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (results) => {
          processData(results.data);
        },
        error: (err) => {
          setStatusMsg(`Error parsing CSV: ${err.message}`);
        }
      });
    } else if (ext === 'xlsx') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { raw: true });
          processData(json);
        } catch (err: any) {
          setStatusMsg(`Error parsing XLSX: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setStatusMsg('Unsupported file type. Please upload .csv or .xlsx');
    }
  };

  const isAllCats = CATEGORIES.every(c => selectedCats.includes(c));
  const toggleAllCats = () => {
    if (isAllCats) setSelectedCats([]);
    else setSelectedCats([...CATEGORIES]);
  };

  const toggleCategory = (cat: string) => {
    if (selectedCats.includes(cat)) setSelectedCats(selectedCats.filter(c => c !== cat));
    else setSelectedCats([...selectedCats, cat]);
  };

  const { filteredAsins, buckets, aggregatedData } = useMemo(() => {
    if (rawData.length === 0 || appliedCats.length === 0) {
      return { filteredAsins: [], buckets: [], aggregatedData: new Map() };
    }

    // 1. Find Max Date (Anchor)
    let maxTime = 0;
    rawData.forEach(r => {
      if (r.date.getTime() > maxTime) maxTime = r.date.getTime();
    });
    const anchorDate = new Date(maxTime);
    anchorDate.setHours(0,0,0,0);

    // 2. Build Buckets
    const bcks: Bucket[] = [];
    
    const d1 = new Date(anchorDate);
    bcks.push({ key: 'day1', label: formatDateLabel(d1), type: 'day', start: d1, end: d1, order: 10000 });
    
    const d2 = new Date(d1); d2.setDate(d2.getDate() - 1);
    bcks.push({ key: 'day2', label: formatDateLabel(d2), type: 'day', start: d2, end: d2, order: 9000 });
    
    const d3 = new Date(d1); d3.setDate(d3.getDate() - 2);
    bcks.push({ key: 'day3', label: formatDateLabel(d3), type: 'day', start: d3, end: d3, order: 8000 });
    
    const d4 = new Date(d1); d4.setDate(d4.getDate() - 3);
    const monthStart = new Date(d1); monthStart.setDate(1);
    
    if (d4 >= monthStart) {
      const monthName = monthStart.toLocaleString('en-US', { month: 'short' });
      bcks.push({ 
        key: 'partial', 
        label: `${monthName} 1-${d4.getDate()}`, 
        type: 'partial', 
        start: monthStart, 
        end: d4, 
        order: 7000 
      });
    }

    const histBuckets = new Map<string, Bucket>();
    rawData.forEach(r => {
      if (r.date < monthStart) {
        const mStart = new Date(r.date);
        mStart.setDate(1);
        const key = `${mStart.getFullYear()}-${mStart.getMonth()}`;
        if (!histBuckets.has(key)) {
          const mEnd = new Date(mStart);
          mEnd.setMonth(mEnd.getMonth() + 1);
          mEnd.setDate(0);
          
          const monthName = mStart.toLocaleString('en-US', { month: 'short' });
          const year = mStart.getFullYear().toString().substring(2);
          
          histBuckets.set(key, {
            key,
            label: `${monthName}'${year}`,
            type: 'month',
            start: mStart,
            end: mEnd,
            order: mStart.getTime()
          });
        }
      }
    });

    const sortedHist = Array.from(histBuckets.values()).sort((a,b) => a.order - b.order);
    const allBuckets = [...sortedHist, ...bcks.sort((a,b) => a.order - b.order)];

    // 3. Filter Asins
    const validCats = new Set(appliedCats);
    const validAsins = new Set<string>();
    
    // Group By ASIN -> BucketKey -> Spend
    const agg = new Map<string, Record<string, number>>();

    rawData.forEach(r => {
      const cat = asinCategoryMap.get(r.asin) || 'Uncategorized';
      if (appliedCats.length > 0 && !validCats.has(cat)) return;
      
      validAsins.add(r.asin);

      if (!agg.has(r.asin)) {
        const initMap: Record<string, number> = {};
        allBuckets.forEach(b => initMap[b.key] = 0);
        agg.set(r.asin, initMap);
      }
      
      const node = agg.get(r.asin)!;
      // find bucket
      for (const b of allBuckets) {
        if (r.date >= b.start && r.date <= b.end) {
          node[b.key] += r.spend;
          break;
        }
      }
    });

    // Sort valid ASINs by Category, then by Total Spend desc
    const sortedAsins = Array.from(validAsins).sort((a, b) => {
      const catA = asinCategoryMap.get(a) || '';
      const catB = asinCategoryMap.get(b) || '';
      if (catA !== catB) return catA.localeCompare(catB);
      
      const spendA = Object.values(agg.get(a)!).reduce((sum, v) => sum + v, 0);
      const spendB = Object.values(agg.get(b)!).reduce((sum, v) => sum + v, 0);
      return spendB - spendA;
    });

    return { filteredAsins: sortedAsins, buckets: allBuckets, aggregatedData: agg };
  }, [rawData, appliedCats, asinCategoryMap]);

  const formatNum = (num: number) => {
    if (!num || isNaN(num) || num === 0) return '';
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(num));
  };

  const exportCSV = () => {
    if (buckets.length === 0 || filteredAsins.length === 0) return;
    
    let rows: string[] = [];
    const headers = ['Category', 'Asin', ...buckets.map(b => b.label), 'Remarks'];
    rows.push(headers.join(','));
    
    filteredAsins.forEach(asin => {
      const cat = asinCategoryMap.get(asin) || 'Uncategorized';
      const node = aggregatedData.get(asin)!;
      const row = [cat, asin];
      buckets.forEach(b => {
        row.push(node[b.key] === 0 ? '' : node[b.key].toString());
      });
      row.push(''); // Remarks
      rows.push(row.join(','));
    });
    
    const csvStr = rows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'amazon-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>Amazon Sponsored Products</h1>
      
      <div className="card" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#1a1d27', padding: '12px 16px', borderRadius: '8px' }}>
          <label style={{ fontWeight: 600 }}>Upload Report (CSV/XLSX):</label>
          <input type="file" accept=".csv, .xlsx" onChange={handleFileUpload} style={{ color: 'var(--text-primary)' }} />
          <span style={{ marginLeft: 'auto', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{statusMsg}</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, marginRight: '8px' }}>Categories:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            <input type="checkbox" checked={isAllCats} onChange={toggleAllCats} /> All
          </label>
          {CATEGORIES.map(cat => (
            <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedCats.includes(cat)} onChange={() => toggleCategory(cat)} />
              {cat}
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', gap: '16px' }}>
          <button className="btn-primary" onClick={() => setAppliedCats([...selectedCats])}>Generate Output</button>
          {filteredAsins.length > 0 && <button className="btn-primary" onClick={exportCSV}>Export CSV</button>}
        </div>

      </div>

      {buckets.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          {rawData.length === 0 ? 'Upload a file to begin.' : 'Select at least one category to view data.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>Amount Spent</h2>
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Category</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Asin</th>
                    {buckets.map(b => (
                      <th key={b.key} style={{ textAlign: 'right', padding: '12px 16px' }}>{b.label}</th>
                    ))}
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAsins.map(asin => {
                    const cat = asinCategoryMap.get(asin) || 'Uncategorized';
                    const node = aggregatedData.get(asin)!;
                    return (
                      <tr key={asin} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ textAlign: 'left', padding: '12px 16px' }}>{cat}</td>
                        <td style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500 }}>{asin}</td>
                        {buckets.map(b => (
                          <td key={b.key} style={{ textAlign: 'right', padding: '12px 16px' }}>
                            {formatNum(node[b.key])}
                          </td>
                        ))}
                        <td style={{ textAlign: 'left', padding: '12px 16px' }}>
                          <input type="text" style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', outline: 'none' }} placeholder="Add remarks..." />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
