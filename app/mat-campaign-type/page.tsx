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

function classifyCampaignType(rawType: string, campaignName: string): string {
  const name = (campaignName || '').toLowerCase();
  if (rawType === 'Performance Max') return 'Performance Max';
  if (rawType === 'Shopping') return 'Shopping';
  if (rawType === 'Display') return 'Display';
  if (rawType === 'Demand Gen') {
    return name.includes('click') ? 'Demand Gen Click' : 'Demand Gen';
  }
  if (rawType === 'Search') {
    return name.includes('brand') ? 'Brand Search' : 'Search';
  }
  return rawType;
}


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
      return `${normalMonths[mIdx]}'${year}`;
    }
  }
  return yyyyMm;
}

type RawRow = {
  campaign: string;
  cat: string;
  campaignType: string;
  mappedCity: string;
  month: string;
  cost: number;
  convValue: number;
};

export default function MatCampaignTypePage() {
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [statusMsg, setStatusMsg] = useState('No CSV loaded');
  
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [appliedCats, setAppliedCats] = useState<string[]>([]);
  const [appliedCities, setAppliedCities] = useState<string[]>([]);
  
  const [expandedCities, setExpandedCities] = useState<Record<string, boolean>>({});

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
        
        results.data.forEach((r: any) => {
          // Re-map row keys using cleanFields if BOM was present in the original keys
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

          const rawCampaign = cleanRow['Campaign'] || '';
          
          let cat = '';
          if (hasCatColumn) {
             cat = cleanRow['Cat'] || '';
          } else {
             cat = getCategoryFromCampaign(rawCampaign);
          }
          
          let rawCity = '';
          if (hasMappedColumn) {
             rawCity = (cleanRow['Mapped'] || '').trim();
          } else if (hasCityColumn) {
             rawCity = getMappedCity((cleanRow['City (Matched)'] || '').trim());
          } else {
             rawCity = 'Rest';
          }
          
          const rawType = cleanRow['Campaign type'] || '';
          const finalType = classifyCampaignType(rawType, rawCampaign);

          parsed.push({
            campaign: rawCampaign,
            cat,
            campaignType: finalType,
            mappedCity: rawCity.toLowerCase(),
            month: monthKey,
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
  const isAllCities = TSC_CITIES.every(c => selectedCities.includes(c));

  const toggleAllCats = () => {
    if (isAllCats) setSelectedCats([]);
    else setSelectedCats([...CATEGORIES]);
  };

  const toggleCategory = (cat: string) => {
    if (selectedCats.includes(cat)) setSelectedCats(selectedCats.filter(c => c !== cat));
    else setSelectedCats([...selectedCats, cat]);
  };

  const toggleAllCities = () => {
    if (isAllCities) setSelectedCities([]);
    else setSelectedCities([...TSC_CITIES]);
  };

  const toggleCity = (city: string) => {
    if (selectedCities.includes(city)) setSelectedCities(selectedCities.filter(c => c !== city));
    else setSelectedCities([...selectedCities, city]);
  };

  const toggleExpand = (city: string) => {
    setExpandedCities(prev => ({ ...prev, [city]: !prev[city] }));
  };

  // Aggregation Engine
  const { filteredData, monthCols, isFlat } = useMemo(() => {
    if (rawData.length === 0 || appliedCats.length === 0 || appliedCities.length === 0) {
      return { filteredData: [], monthCols: [], isFlat: true };
    }

    const validCatValues = new Set(appliedCats.map(c => CAT_MAP[c]));
    const validCitiesLower = new Set(appliedCities.map(c => c.toLowerCase()));
    
    // Determine unique months from filtered data
    const monthsSet = new Set<string>();

    const fData = rawData.filter(r => {
      if (!validCatValues.has(r.cat)) return false;
      if (!validCitiesLower.has(r.mappedCity)) return false;
      if (r.month) monthsSet.add(r.month);
      return true;
    });

    const mCols = Array.from(monthsSet).sort();
    
    return { 
      filteredData: fData, 
      monthCols: mCols,
      isFlat: appliedCities.length === 1
    };
  }, [rawData, appliedCats, appliedCities]);

  const { cityGrouped, flatGrouped } = useMemo(() => {
    if (isFlat) {
      // Group by Campaign Type only
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
      return { flatGrouped: map, cityGrouped: null };
    } else {
      // Group by City -> Campaign Type
      const map = new Map<string, Map<string, Record<string, { cost: number, conv: number }>>>();
      filteredData.forEach(r => {
        // Find proper case for city based on raw matched mappedCity
        const properCityName = TSC_CITIES.find(c => c.toLowerCase() === r.mappedCity) || r.mappedCity;
        
        let cityNode = map.get(properCityName);
        if (!cityNode) {
          cityNode = new Map();
          map.set(properCityName, cityNode);
        }
        
        let typeNode = cityNode.get(r.campaignType);
        if (!typeNode) {
          typeNode = {};
          monthCols.forEach(m => typeNode![m] = { cost: 0, conv: 0 });
          cityNode.set(r.campaignType, typeNode);
        }
        
        if (typeNode[r.month]) {
          typeNode[r.month].cost += r.cost;
          typeNode[r.month].conv += r.convValue;
        }
      });
      return { cityGrouped: map, flatGrouped: null };
    }
  }, [filteredData, monthCols, isFlat]);


  const formatNum = (num: number, isROAS = false) => {
    if (isNaN(num) || num === 0) return isROAS ? '—' : '0';
    if (isROAS) return num.toFixed(2);
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(num));
  };

  // Build CSV export
  const exportCSV = () => {
    if (monthCols.length === 0) return;
    
    let rows: string[] = [];
    
    const displayCols = monthCols.map(formatDisplayMonth);
    
    // AMOUNT SPENT TABLE
    rows.push('--- AMOUNT SPENT ---');
    if (isFlat && flatGrouped) {
      rows.push(['Campaign Type', ...displayCols].join(','));
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
    } else if (cityGrouped) {
      rows.push(['City', 'Campaign Type', ...displayCols].join(','));
      let grandTotalCost = Object.fromEntries(monthCols.map(m => [m, 0]));
      
      Array.from(cityGrouped.keys()).sort().forEach(city => {
        const cityNode = cityGrouped.get(city)!;
        const cityTotalCost = Object.fromEntries(monthCols.map(m => [m, 0]));
        
        const subRows: string[][] = [];
        Array.from(cityNode.keys()).sort().forEach(type => {
          const typeNode = cityNode.get(type)!;
          const subRow = [city, type];
          monthCols.forEach(m => {
            subRow.push(typeNode[m].cost.toString());
            cityTotalCost[m] += typeNode[m].cost;
            grandTotalCost[m] += typeNode[m].cost;
          });
          subRows.push(subRow);
        });
        
        const ctRow = [city, 'Total'];
        monthCols.forEach(m => ctRow.push(cityTotalCost[m].toString()));
        rows.push(ctRow.join(','));
        subRows.forEach(sr => rows.push(sr.join(',')));
      });
      
      const gtRow = ['Grand Total', ''];
      monthCols.forEach(m => gtRow.push(grandTotalCost[m].toString()));
      rows.push(gtRow.join(','));
    }
    
    rows.push(''); // Spacer
    
    // ROAS TABLE
    rows.push('--- ROAS ---');
    if (isFlat && flatGrouped) {
      rows.push(['Campaign Type', ...displayCols].join(','));
      let sumCost = Object.fromEntries(monthCols.map(m => [m, 0]));
      let sumConv = Object.fromEntries(monthCols.map(m => [m, 0]));
      
      Array.from(flatGrouped.keys()).sort().forEach(type => {
        const node = flatGrouped.get(type)!;
        const row = [type];
        monthCols.forEach(m => {
          const cost = node[m].cost;
          const conv = node[m].conv;
          sumCost[m] += cost;
          sumConv[m] += conv;
          row.push(cost > 0 ? (conv / cost).toFixed(2) : '0');
        });
        rows.push(row.join(','));
      });
      
      const gtRow = ['Grand Total'];
      monthCols.forEach(m => {
        gtRow.push(sumCost[m] > 0 ? (sumConv[m] / sumCost[m]).toFixed(2) : '0');
      });
      rows.push(gtRow.join(','));
    } else if (cityGrouped) {
      rows.push(['City', 'Campaign Type', ...displayCols].join(','));
      let grandSumCost = Object.fromEntries(monthCols.map(m => [m, 0]));
      let grandSumConv = Object.fromEntries(monthCols.map(m => [m, 0]));
      
      Array.from(cityGrouped.keys()).sort().forEach(city => {
        const cityNode = cityGrouped.get(city)!;
        let citySumCost = Object.fromEntries(monthCols.map(m => [m, 0]));
        let citySumConv = Object.fromEntries(monthCols.map(m => [m, 0]));
        
        const subRows: string[][] = [];
        Array.from(cityNode.keys()).sort().forEach(type => {
          const typeNode = cityNode.get(type)!;
          const subRow = [city, type];
          monthCols.forEach(m => {
            const cost = typeNode[m].cost;
            const conv = typeNode[m].conv;
            citySumCost[m] += cost;
            citySumConv[m] += conv;
            grandSumCost[m] += cost;
            grandSumConv[m] += conv;
            subRow.push(cost > 0 ? (conv / cost).toFixed(2) : '0');
          });
          subRows.push(subRow);
        });
        
        const ctRow = [city, 'Total'];
        monthCols.forEach(m => ctRow.push(citySumCost[m] > 0 ? (citySumConv[m] / citySumCost[m]).toFixed(2) : '0'));
        rows.push(ctRow.join(','));
        subRows.forEach(sr => rows.push(sr.join(',')));
      });
      
      const gtRow = ['Grand Total', ''];
      monthCols.forEach(m => {
        gtRow.push(grandSumCost[m] > 0 ? (grandSumConv[m] / grandSumCost[m]).toFixed(2) : '0');
      });
      rows.push(gtRow.join(','));
    }
    
    const csvStr = rows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mat-campaign-type.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };


  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>Mat - Campaign Type (Google)</h1>
      
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, marginRight: '8px' }}>Cities:</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', maxHeight: '120px', overflowY: 'auto', padding: '8px', background: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)', flex: 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              <input type="checkbox" checked={isAllCities} onChange={toggleAllCities} /> All
            </label>
            {TSC_CITIES.map(city => (
              <label key={city} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="checkbox" checked={selectedCities.includes(city)} onChange={() => toggleCity(city)} />
                {city}
              </label>
            ))}
          </div>
        </div>

        {/* Export */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', gap: '16px' }}>
          <button className="btn-primary" onClick={() => { setAppliedCats([...selectedCats]); setAppliedCities([...selectedCities]); }}>Generate Output</button>
          {monthCols.length > 0 && <button className="btn-primary" onClick={exportCSV}>Export CSV</button>}
        </div>

      </div>

      {/* Tables Output */}
      {monthCols.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          {rawData.length === 0 ? 'Upload a CSV to begin.' : 'Select at least one category and city to view data.'}
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
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>{isFlat ? 'Campaign Type' : 'City / Campaign Type'}</th>
                    {monthCols.map(m => <th key={m} style={{ textAlign: 'right', padding: '12px 16px' }}>{formatDisplayMonth(m)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {isFlat && flatGrouped && (
                    <>
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
                    </>
                  )}

                  {!isFlat && cityGrouped && (
                    <>
                      {Array.from(cityGrouped.keys()).sort().map(city => {
                        const cityNode = cityGrouped.get(city)!;
                        const isExp = expandedCities[city];
                        return (
                          <React.Fragment key={city}>
                            <tr 
                              style={{ backgroundColor: 'var(--surface-hover)', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                              onClick={() => toggleExpand(city)}
                            >
                              <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px' }}>{isExp ? '▼' : '▶'}</span>
                                {city}
                              </td>
                              {monthCols.map(m => {
                                const cityTotal = Array.from(cityNode.values()).reduce((sum, n) => sum + n[m].cost, 0);
                                return <td key={m} style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px 16px' }}>{formatNum(cityTotal)}</td>;
                              })}
                            </tr>
                            {isExp && Array.from(cityNode.keys()).sort().map(type => (
                              <tr key={type} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--table-row-even)' }}>
                                <td style={{ textAlign: 'left', padding: '10px 16px 10px 40px', color: 'var(--text-secondary)' }}>{type}</td>
                                {monthCols.map(m => (
                                  <td key={m} style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-secondary)' }}>{formatNum(cityNode.get(type)![m].cost)}</td>
                                ))}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                      <tr className="total-row" style={{ backgroundColor: '#111', borderTop: '2px solid var(--border-color)' }}>
                        <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '12px 16px' }}>Grand Total</td>
                        {monthCols.map(m => {
                          const gt = Array.from(cityGrouped.values()).reduce((sum, cNode) => sum + Array.from(cNode.values()).reduce((s, tNode) => s + tNode[m].cost, 0), 0);
                          return <td key={m} style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px 16px' }}>{formatNum(gt)}</td>;
                        })}
                      </tr>
                    </>
                  )}
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
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>{isFlat ? 'Campaign Type' : 'City / Campaign Type'}</th>
                    {monthCols.map(m => <th key={m} style={{ textAlign: 'right', padding: '12px 16px' }}>{formatDisplayMonth(m)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {isFlat && flatGrouped && (
                    <>
                      {Array.from(flatGrouped.keys()).sort().map(type => (
                        <tr key={type} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ textAlign: 'left', padding: '12px 16px' }}>{type}</td>
                          {monthCols.map(m => {
                            const node = flatGrouped.get(type)![m];
                            const roas = node.cost > 0 ? node.conv / node.cost : 0;
                            return <td key={m} style={{ textAlign: 'right', padding: '12px 16px' }}>{formatNum(roas, true)}</td>;
                          })}
                        </tr>
                      ))}
                      <tr className="total-row" style={{ backgroundColor: '#111', borderTop: '2px solid var(--border-color)' }}>
                        <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '12px 16px' }}>Grand Total</td>
                        {monthCols.map(m => {
                          const totalCost = Array.from(flatGrouped.values()).reduce((sum, n) => sum + n[m].cost, 0);
                          const totalConv = Array.from(flatGrouped.values()).reduce((sum, n) => sum + n[m].conv, 0);
                          const roas = totalCost > 0 ? totalConv / totalCost : 0;
                          return <td key={m} style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px 16px' }}>{formatNum(roas, true)}</td>;
                        })}
                      </tr>
                    </>
                  )}

                  {!isFlat && cityGrouped && (
                    <>
                      {Array.from(cityGrouped.keys()).sort().map(city => {
                        const cityNode = cityGrouped.get(city)!;
                        const isExp = expandedCities[city];
                        return (
                          <React.Fragment key={city}>
                            <tr 
                              style={{ backgroundColor: 'var(--surface-hover)', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                              onClick={() => toggleExpand(city)}
                            >
                              <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px' }}>{isExp ? '▼' : '▶'}</span>
                                {city}
                              </td>
                              {monthCols.map(m => {
                                const cityCost = Array.from(cityNode.values()).reduce((sum, n) => sum + n[m].cost, 0);
                                const cityConv = Array.from(cityNode.values()).reduce((sum, n) => sum + n[m].conv, 0);
                                const roas = cityCost > 0 ? cityConv / cityCost : 0;
                                return <td key={m} style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px 16px' }}>{formatNum(roas, true)}</td>;
                              })}
                            </tr>
                            {isExp && Array.from(cityNode.keys()).sort().map(type => (
                              <tr key={type} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--table-row-even)' }}>
                                <td style={{ textAlign: 'left', padding: '10px 16px 10px 40px', color: 'var(--text-secondary)' }}>{type}</td>
                                {monthCols.map(m => {
                                  const node = cityNode.get(type)![m];
                                  const roas = node.cost > 0 ? node.conv / node.cost : 0;
                                  return <td key={m} style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-secondary)' }}>{formatNum(roas, true)}</td>;
                                })}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                      <tr className="total-row" style={{ backgroundColor: '#111', borderTop: '2px solid var(--border-color)' }}>
                        <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '12px 16px' }}>Grand Total</td>
                        {monthCols.map(m => {
                          const gtCost = Array.from(cityGrouped.values()).reduce((sum, cNode) => sum + Array.from(cNode.values()).reduce((s, tNode) => s + tNode[m].cost, 0), 0);
                          const gtConv = Array.from(cityGrouped.values()).reduce((sum, cNode) => sum + Array.from(cNode.values()).reduce((s, tNode) => s + tNode[m].conv, 0), 0);
                          const roas = gtCost > 0 ? gtConv / gtCost : 0;
                          return <td key={m} style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px 16px' }}>{formatNum(roas, true)}</td>;
                        })}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
