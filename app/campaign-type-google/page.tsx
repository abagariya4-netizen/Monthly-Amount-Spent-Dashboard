'use client';
import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';

const CATEGORIES = ['Mattress', 'Chair', 'Desk', 'Elite', 'Sofa', 'Foot Massager', 'Accessories', 'Bed'];

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

function classifyCampaignType(rawType: string, campaignName: string): string {
  const name = (campaignName || '').toLowerCase();
  if (rawType === 'Performance Max') return 'Performance Max';
  if (rawType === 'Shopping') return 'Shopping';
  if (rawType === 'Display') return 'Display';
  if (rawType === 'Demand Gen') {
    return name.includes('click') ? 'Demand Gen Click' : 'Demand Gen Video';
  }
  if (rawType === 'Search') {
    return name.includes('brand') ? 'Brand Search' : 'Search';
  }
  return rawType;
}

type RawRow = {
  campaign: string;
  cat: string;
  campaignType: string;
  month: string;
  cost: number;
  convValue: number;
};

export default function CampaignTypeGooglePage() {
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [statusMsg, setStatusMsg] = useState('No CSV loaded');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [appliedCats, setAppliedCats] = useState<string[]>([]);

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
        
        const parseNum = (val: any) => parseFloat((val || '0').toString().replace(/,/g,'')) || 0;
        
        results.data.forEach((r: any) => {
          const cleanRow: any = {};
          Object.keys(r).forEach((k, i) => {
            const cleanKey = k.replace(/^\uFEFF/, '').trim();
            cleanRow[cleanKey] = r[k];
          });
          
          const rawCampaign = cleanRow['Campaign'] || '';
          
          let cat = '';
          if (hasCatColumn) {
             cat = cleanRow['Cat'] || '';
          } else {
             cat = getCategoryFromCampaign(rawCampaign);
          }
          
          const rawType = cleanRow['Campaign type'] || '';
          const finalType = classifyCampaignType(rawType, rawCampaign);

          parsed.push({
            campaign: rawCampaign,
            cat,
            campaignType: finalType,
            month: (cleanRow['Month'] || '').trim(),
            cost: parseNum(cleanRow['Cost']),
            convValue: parseNum(cleanRow['Conv. value'])
          });
        });
        
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

    const validCatValues = new Set(appliedCats);
    const monthsSet = new Set<string>();

    const fData = rawData.filter(r => {
      if (!validCatValues.has(r.cat)) return false;
      if (r.month) monthsSet.add(r.month);
      return true;
    });

    const mCols = Array.from(monthsSet).sort((a, b) => {
      const parse = (s: string) => {
        const p = s.replace('-', ' ');
        const d = new Date(`01 ${p}`);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };
      return parse(a) - parse(b);
    });
    
    return { 
      filteredData: fData, 
      monthCols: mCols
    };
  }, [rawData, appliedCats]);

  const flatGrouped = useMemo(() => {
    const map = new Map<string, Record<string, { cost: number, conv: number }>>();
    filteredData.forEach(r => {
      let node = map.get(r.campaignType);
      if (!node) {
        node = {};
        monthCols.forEach(m => node![m] = { cost: 0, conv: 0 });
        map.set(r.campaignType, node);
      }
      if (node[r.month]) {
        node[r.month].cost += r.cost;
        node[r.month].conv += r.convValue;
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
    
    rows.push('--- AMOUNT SPENT ---');
    rows.push(['Campaign Type', ...monthCols].join(','));
    let grandTotalCost = Object.fromEntries(monthCols.map(m => [m, 0]));
    
    Array.from(flatGrouped.keys()).sort().forEach(type => {
      const node = flatGrouped.get(type)!;
      const row = [type];
      monthCols.forEach(m => {
        row.push(node[m].cost.toString());
        grandTotalCost[m] += node[m].cost;
      });
      rows.push(row.join(','));
    });
    
    const gtRow = ['Grand Total'];
    monthCols.forEach(m => gtRow.push(grandTotalCost[m].toString()));
    rows.push(gtRow.join(','));

    rows.push('');
    rows.push('--- ROAS ---');
    rows.push(['Campaign Type', ...monthCols].join(','));
    let grandTotalConv = Object.fromEntries(monthCols.map(m => [m, 0]));
    
    Array.from(flatGrouped.keys()).sort().forEach(type => {
      const node = flatGrouped.get(type)!;
      const row = [type];
      monthCols.forEach(m => {
        const roas = node[m].cost > 0 ? (node[m].conv / node[m].cost).toFixed(2) : '0';
        row.push(roas);
        grandTotalConv[m] += node[m].conv;
      });
      rows.push(row.join(','));
    });
    
    const gtRoasRow = ['Grand Total'];
    monthCols.forEach(m => {
      const roas = grandTotalCost[m] > 0 ? (grandTotalConv[m] / grandTotalCost[m]).toFixed(2) : '0';
      gtRoasRow.push(roas);
    });
    rows.push(gtRoasRow.join(','));
    
    const csvStr = rows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campaign-type-google.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>Campaign Type (Google)</h1>
      
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
          
          {/* AMOUNT SPENT TABLE */}
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>Amount Spent</h2>
            <div className="table-wrapper">
              <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Campaign Type</th>
                    {monthCols.map(m => <th key={m} style={{ textAlign: 'right', padding: '12px 16px' }}>{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(flatGrouped.keys()).sort().map(type => (
                    <tr key={type} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ textAlign: 'left', padding: '12px 16px' }}>{type}</td>
                      {monthCols.map(m => (
                        <td key={m} style={{ textAlign: 'right', padding: '12px 16px' }}>{formatNum(flatGrouped.get(type)![m].cost)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="total-row" style={{ backgroundColor: '#111', borderTop: '2px solid var(--border-color)' }}>
                    <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '12px 16px' }}>Grand Total</td>
                    {monthCols.map(m => {
                      const total = Array.from(flatGrouped.values()).reduce((sum, n) => sum + n[m].cost, 0);
                      return <td key={m} style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px 16px' }}>{formatNum(total)}</td>;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          {/* ROAS TABLE */}
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>ROAS</h2>
            <div className="table-wrapper">
              <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Campaign Type</th>
                    {monthCols.map(m => <th key={m} style={{ textAlign: 'right', padding: '12px 16px' }}>{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(flatGrouped.keys()).sort().map(type => (
                    <tr key={type} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ textAlign: 'left', padding: '12px 16px' }}>{type}</td>
                      {monthCols.map(m => {
                        const node = flatGrouped.get(type)![m];
                        const roas = node.cost > 0 ? (node.conv / node.cost) : 0;
                        return (
                          <td key={m} style={{ textAlign: 'right', padding: '12px 16px' }}>
                            {roas > 0 ? roas.toFixed(2) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="total-row" style={{ backgroundColor: '#111', borderTop: '2px solid var(--border-color)' }}>
                    <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '12px 16px' }}>Grand Total</td>
                    {monthCols.map(m => {
                      const totalCost = Array.from(flatGrouped.values()).reduce((sum, n) => sum + n[m].cost, 0);
                      const totalConv = Array.from(flatGrouped.values()).reduce((sum, n) => sum + n[m].conv, 0);
                      const roas = totalCost > 0 ? (totalConv / totalCost) : 0;
                      return (
                        <td key={m} style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px 16px' }}>
                          {roas > 0 ? roas.toFixed(2) : '—'}
                        </td>
                      );
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
