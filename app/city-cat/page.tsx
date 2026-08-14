'use client';
import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';

import { getMappedCity } from '@/lib/googleCityMapping';
import { TSC_CITIES } from '@/lib/googleCityMap';

const CATEGORIES = ['Mattress', 'Chair', 'Desk', 'Elite', 'Sofa', 'Foot Massager', 'Accessories', 'Bed'];
const CAT_MAP: Record<string, string> = {
  'Mattress': 'Mattress', 'Chair': 'Chair', 'Desk': 'Desk', 'Sofa': 'Sofa', 'Foot Massager': 'Foot Massager', 
  'Elite': 'Elite', 'Accessories': 'Accessories', 'Bed': 'Bed'
};

function getCategoryFromCampaign(campaignName: string): string {
  const lower = (campaignName || '').toLowerCase();
  if (lower.includes('mat') || lower.includes('mattress')) return 'Mattress';
  if (lower.includes('chair')) return 'Chair';
  if (lower.includes('desk')) return 'Desk';
  if (lower.includes('elite')) return 'Elite';
  if (lower.includes('sofa')) return 'Sofa';
  if (lower.includes('foot') || lower.includes('massager')) return 'Foot Massager';
  if (lower.includes('accessories') || lower.includes('pillow') || lower.includes('cushion') || lower.includes('protector') || lower.includes('bedsheet') || lower.includes('comforter')) return 'Accessories';
  if (lower.includes('bed')) return 'Bed';
  return 'Mattress';
}



type RawRow = {
  cat: string;
  mappedCity: string;
  month: string;
  cost: number;
};

function parseMonthStr(raw: string): string {
  const r = raw.trim();
  if (/^\d{4}-\d{2}/.test(r)) {
    return r.substring(0, 7);
  }
  
  const mmmYyMatch = r.match(/^([a-zA-Z]{3})[- ]?(\d{2,4})$/);
  if (mmmYyMatch) {
    const monthStr = mmmYyMatch[1].toLowerCase();
    let yearStr = mmmYyMatch[2];
    if (yearStr.length === 2) yearStr = "20" + yearStr;
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mIdx = months.indexOf(monthStr);
    if (mIdx !== -1) return `${yearStr}-${String(mIdx + 1).padStart(2, '0')}`;
  }
  
  const ddMmmYyMatch = r.match(/^\d{1,2}[- ]?([a-zA-Z]{3})[- ]?(\d{2,4})/);
  if (ddMmmYyMatch) {
    const monthStr = ddMmmYyMatch[1].toLowerCase();
    let yearStr = ddMmmYyMatch[2];
    if (yearStr.length === 2) yearStr = "20" + yearStr;
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mIdx = months.indexOf(monthStr);
    if (mIdx !== -1) return `${yearStr}-${String(mIdx + 1).padStart(2, '0')}`;
  }

  return r;
}

function formatDisplayMonth(yyyyMm: string): string {
  const parts = yyyyMm.split('-');
  if (parts.length === 2) {
    const year = parts[0].substring(2);
    const mIdx = parseInt(parts[1], 10) - 1;
    const normalMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (mIdx >= 0 && mIdx < 12) {
      return `${normalMonths[mIdx]}-${year}`;
    }
  }
  return yyyyMm;
}

export default function CityCatPage() {
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [statusMsg, setStatusMsg] = useState('No CSV loaded');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [appliedCats, setAppliedCats] = useState<string[]>([]);
  const [unmatchedCities, setUnmatchedCities] = useState<string[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setStatusMsg('Parsing CSV...');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const parsed: RawRow[] = [];
        
        // Strip BOM from headers
        const fields = results.meta.fields || [];
        const cleanFields = fields.map(f => f.replace(/^\uFEFF/, '').trim());
        
        const hasCatColumn = cleanFields.includes('Cat');
        const hasMappedColumn = cleanFields.includes('Mapped');
        const hasCityColumn = cleanFields.includes('City (Matched)');
        
        const parseNum = (val: any) => parseFloat((val || '0').toString().replace(/,/g,'')) || 0;
        
        const unmatched = new Set<string>();

        // Build lowercased lookup map for the static cities
        const staticCityMap = new Map<string, string>();
        TSC_CITIES.forEach(c => staticCityMap.set(c.toLowerCase(), c));

        results.data.forEach((r: any) => {
          const cleanRow: any = {};
          Object.keys(r).forEach((k, i) => {
            const cleanKey = k.replace(/^\uFEFF/, '').trim();
            cleanRow[cleanKey] = r[k];
          });

          const rawMonth = (cleanRow['Month'] || '').trim();
          let monthKey = '';
          if (rawMonth) {
            monthKey = parseMonthStr(rawMonth);
          }

          let rawCity = '';
          if (hasMappedColumn) {
             rawCity = (cleanRow['Mapped'] || '').trim();
          } else if (hasCityColumn) {
             rawCity = getMappedCity((cleanRow['City (Matched)'] || '').trim());
          } else {
             rawCity = 'Rest';
          }
          let lowerCity = rawCity.toLowerCase();
          
          let canonicalCity = 'Rest';
          if (staticCityMap.has(lowerCity)) {
            canonicalCity = staticCityMap.get(lowerCity)!;
          } else if (lowerCity && lowerCity !== 'rest') {
            unmatched.add(rawCity);
          }

          const rawCampaign = cleanRow['Campaign'] || '';
          let cat = '';
          if (hasCatColumn) {
             cat = cleanRow['Cat'] || '';
          } else {
             cat = getCategoryFromCampaign(rawCampaign);
          }
          
          parsed.push({
            cat,
            mappedCity: canonicalCity,
            month: monthKey,
            cost: parseNum(cleanRow['Cost'])
          });
        });
        
        if (unmatched.size > 0) {
          console.warn('Unmatched cities folded into "Rest":', Array.from(unmatched));
          setUnmatchedCities(Array.from(unmatched));
        } else {
          setUnmatchedCities([]);
        }

        setRawData(parsed);
        setStatusMsg(`CSV loaded — ${parsed.length} rows`);
      },
      error: (err) => {
        setStatusMsg(`Error parsing CSV: ${err.message}`);
      }
    });
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

  // Aggregation Engine
  const { filteredData, monthCols } = useMemo(() => {
    if (rawData.length === 0 || appliedCats.length === 0) {
      return { filteredData: [], monthCols: [] };
    }

    const validCatValues = new Set(appliedCats.map(c => CAT_MAP[c]));
    const monthsSet = new Set<string>();

    const fData = rawData.filter(r => {
      if (!validCatValues.has(r.cat)) return false;
      if (r.month) monthsSet.add(r.month);
      return true;
    });

    const mCols = Array.from(monthsSet).sort();
    return { filteredData: fData, monthCols: mCols };
  }, [rawData, appliedCats]);

  const groupedByCity = useMemo(() => {
    const map = new Map<string, Record<string, { cost: number }>>();
    
    // Initialize all cities to 0
    TSC_CITIES.forEach(city => {
      const node: Record<string, { cost: number }> = {};
      monthCols.forEach(m => node[m] = { cost: 0 });
      map.set(city, node);
    });

    filteredData.forEach(r => {
      // By this point, r.mappedCity is guaranteed to be one of the cities
      let node = map.get(r.mappedCity);
      if (!node) {
        // Fallback in case of weird data
        node = {};
        monthCols.forEach(m => node![m] = { cost: 0 });
        map.set(r.mappedCity, node);
      }
      if (node[r.month]) {
        node[r.month].cost += r.cost;
      }
    });
    
    return map;
  }, [filteredData, monthCols]);

  const formatNum = (num: number) => {
    if (isNaN(num) || num === 0) return '0';
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(num));
  };

  // Build CSV export
  const exportCSV = () => {
    if (monthCols.length === 0) return;
    
    let rows: string[] = [];
    const displayCols = monthCols.map(formatDisplayMonth);
    
    rows.push(['City', ...displayCols].join(','));
    let grandTotalCost = Object.fromEntries(monthCols.map(m => [m, 0]));
    
    TSC_CITIES.forEach(city => {
      const node = groupedByCity.get(city);
      if (!node) return;
      const row = [city];
      monthCols.forEach(m => {
        row.push(node[m].cost.toString());
        grandTotalCost[m] += node[m].cost;
      });
      rows.push(row.join(','));
    });
    
    const gtRow = ['Total'];
    monthCols.forEach(m => gtRow.push(grandTotalCost[m].toString()));
    rows.push(gtRow.join(','));
    
    const csvStr = rows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'city-cat.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>City - Cat (Google)</h1>
      
      <div className="card" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* CSV Upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#1a1d27', padding: '12px 16px', borderRadius: '8px' }}>
          <label style={{ fontWeight: 600 }}>Upload Raw Data CSV:</label>
          <input type="file" accept=".csv" onChange={handleFileUpload} style={{ color: 'var(--text-primary)' }} />
          <span style={{ marginLeft: 'auto', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{statusMsg}</span>
        </div>

        {/* Filters */}
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

        {unmatchedCities.length > 0 && (
          <div style={{ padding: '8px', border: '1px solid var(--danger-color)', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', fontSize: '12px' }}>
            <strong>Warning:</strong> The following raw cities were unmatched and folded into "Rest": {unmatchedCities.join(', ')}
          </div>
        )}

        {/* Export */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', gap: '16px' }}>
          <button className="btn-primary" onClick={() => setAppliedCats([...selectedCats])}>Generate Output</button>
          {monthCols.length > 0 && <button className="btn-primary" onClick={exportCSV}>Export CSV</button>}
        </div>

      </div>

      {/* Tables Output */}
      {monthCols.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          {rawData.length === 0 ? 'Upload a CSV to begin.' : 'Select at least one category to view data.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>Amount Spent</h2>
            <div className="table-wrapper">
              <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>City</th>
                    {monthCols.map(m => <th key={m} style={{ textAlign: 'right', padding: '12px 16px' }}>{formatDisplayMonth(m)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {TSC_CITIES.map(city => {
                    const node = groupedByCity.get(city);
                    if (!node) return null;
                    return (
                      <tr key={city} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ textAlign: 'left', padding: '12px 16px' }}>{city}</td>
                        {monthCols.map(m => (
                          <td key={m} style={{ textAlign: 'right', padding: '12px 16px' }}>{formatNum(node[m].cost)}</td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr className="total-row" style={{ backgroundColor: '#111', borderTop: '2px solid var(--border-color)' }}>
                    <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '12px 16px' }}>Total</td>
                    {monthCols.map(m => {
                      const total = TSC_CITIES.reduce((sum, c) => {
                        const node = groupedByCity.get(c);
                        return sum + (node ? node[m].cost : 0);
                      }, 0);
                      return <td key={m} style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px 16px' }}>{formatNum(total)}</td>;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
