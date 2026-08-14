'use client';
import React, { useState, useEffect, useRef } from 'react';
import DateRangePicker from '@/components/DateRangePicker';

const CATEGORIES = ['Mat', 'Chair', 'Desk', 'Sofa', 'Foot Massager', 'Elite', 'Group', 'Boost'];

export default function MatFunnelPage() {
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  
  const [data, setData] = useState<{ regions: any[], monthLabels: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  
  const initialLoadDone = useRef(false);

  // Expanded state for regions
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      // Auto-fetch on load using default 4-month range if categories are selected
      // Wait, requirement: "If no category is selected on load, show empty table"
      // So no need to auto-fetch if selectedCats is empty.
    }
  }, []);
  
  const isAllSelected = CATEGORIES.every(c => selectedCats.includes(c));

  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedCats([]);
    } else {
      setSelectedCats([...CATEGORIES]);
    }
  };

  const toggleCategory = (cat: string) => {
    if (selectedCats.includes(cat)) {
      setSelectedCats(selectedCats.filter(c => c !== cat));
    } else {
      setSelectedCats([...selectedCats, cat]);
    }
  };

  const handleApplyFilter = () => {
    fetchData(selectedCats, startMonth, endMonth);
  };

  const handleReset = () => {
    setSelectedCats([]);
    setStartMonth('');
    setEndMonth('');
    setData(null);
    setError('');
    setExpandedRegions({});
  };

  const toggleExpand = (region: string) => {
    setExpandedRegions(prev => ({
      ...prev,
      [region]: !prev[region]
    }));
  };

  const fetchData = async (cats: string[], start: string, end: string) => {
    if (cats.length === 0) {
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (cats.length === CATEGORIES.length) {
        params.append('categories', 'All');
      } else {
        params.append('categories', cats.join(','));
      }
      
      if (start && end) {
        params.append('startDate', start);
        params.append('endDate', end);
      }
      
      const res = await fetch(`/api/mat-funnel?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        setError(json.error || 'Failed to fetch data');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const exportCSV = () => {
    if (!data) return;
    const header = ['Region', 'Funnel Row', ...data.monthLabels];
    const rows = [header.join(',')];
    
    data.regions.forEach(r => {
      // Total row for region
      const regionTotalRow = [r.region, 'Total'];
      data.monthLabels.forEach((m) => {
        const val = ['Top', 'Mid', 'Bot', 'Growth', 'RnF'].reduce((sum, f) => sum + (r.funnels[f][m]?.spend || 0), 0);
        regionTotalRow.push(val.toString());
      });
      rows.push(regionTotalRow.join(','));

      // Sub-rows
      ['Top', 'Mid', 'Bot', 'Growth', 'RnF'].forEach(f => {
        const subRow = [r.region, f];
        data.monthLabels.forEach((m) => {
          subRow.push((r.funnels[f][m]?.spend || 0).toString());
        });
        rows.push(subRow.join(','));
      });
    });
    
    // Grand Total row
    const grandTotalRow = ['Grand Total', ''];
    data.monthLabels.forEach(m => {
      let monthTotal = 0;
      data.regions.forEach(r => {
        monthTotal += ['Top', 'Mid', 'Bot', 'Growth', 'RnF'].reduce((sum, f) => sum + (r.funnels[f][m]?.spend || 0), 0);
      });
      grandTotalRow.push(monthTotal.toString());
    });
    rows.push(grandTotalRow.join(','));
    
    const csvStr = rows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mat-funnel.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getRegionTotal = (regionNode: any, monthLabel: string) => {
    return ['Top', 'Mid', 'Bot', 'Growth', 'RnF'].reduce((sum, f) => sum + (regionNode.funnels[f][monthLabel]?.spend || 0), 0);
  };

  const formatNumber = (num: number) => {
    if (num === 0) return '0';
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num);
  };

  // Filter out regions with 0 spend across all months?
  // "Regions with zero total spend in the selected period can be hidden or shown with 0"
  // Let's keep them if we want to show 0s, but maybe filter out if ALL months are 0?
  // Filtering out entirely empty regions is usually preferred for cleaner UI.
  const visibleRegions = data?.regions.filter(r => {
    let totalSpend = 0;
    data.monthLabels.forEach(m => {
      totalSpend += getRegionTotal(r, m);
    });
    return totalSpend > 0;
  }) || [];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>Mat - Funnel Report</h1>
      
      <div className="card" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, marginRight: '8px' }}>Categories:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            <input type="checkbox" checked={isAllSelected} onChange={toggleAll} /> All
          </label>
          {CATEGORIES.map(cat => (
            <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={selectedCats.includes(cat)}
                onChange={() => toggleCategory(cat)}
              />
              {cat}
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', background: '#1a1d27', border: '1px solid #2d3348', padding: '10px 16px', borderRadius: '9999px' }}>
          <DateRangePicker 
            onApply={(s, e) => {
              setStartMonth(s);
              setEndMonth(e);
              fetchData(selectedCats, s, e);
            }}
            onReset={() => {
              setStartMonth('');
              setEndMonth('');
              fetchData(selectedCats, '', '');
            }}
          />
          
          <div style={{ borderLeft: '1px solid var(--border-color)', height: '24px', margin: '0 8px' }}></div>
          
          <button className="btn-primary" onClick={handleApplyFilter} disabled={loading}>
            {loading ? '⏳ Fetching...' : '🔄 Apply Filters & Generate'}
          </button>
          <button className="btn-outline" onClick={handleReset}>
            Reset All
          </button>
          
          <div style={{ flexGrow: 1 }}></div>
          {data && <button className="btn-primary" onClick={exportCSV}>Export CSV</button>}
        </div>

      </div>

      {error && <div style={{ color: 'var(--danger-color)', marginBottom: '16px' }}>Error: {error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>Loading data...</div>
      ) : !data || selectedCats.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          Select at least one category to view data.
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="modern-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Region / Funnel</th>
                {data.monthLabels.map(m => <th key={m} style={{ textAlign: 'right', padding: '12px 16px' }}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {visibleRegions.map(r => (
                <React.Fragment key={r.region}>
                  <tr 
                    style={{ backgroundColor: 'var(--surface-hover)', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                    onClick={() => toggleExpand(r.region)}
                  >
                    <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px' }}>{expandedRegions[r.region] ? '▼' : '▶'}</span>
                      {r.region}
                    </td>
                    {data.monthLabels.map(m => (
                      <td key={m} style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px 16px' }}>
                        {formatNumber(getRegionTotal(r, m))}
                      </td>
                    ))}
                  </tr>
                  
                  {expandedRegions[r.region] && ['Top', 'Mid', 'Bot', 'Growth', 'RnF'].map(f => (
                    <tr key={f} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--table-row-even)' }}>
                      <td style={{ textAlign: 'left', padding: '10px 16px 10px 40px', color: 'var(--text-secondary)' }}>
                        {f}
                      </td>
                      {data.monthLabels.map(m => (
                        <td key={m} style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-secondary)' }}>
                          {formatNumber(r.funnels[f][m]?.spend || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {visibleRegions.length > 0 && (
                <tr className="total-row" style={{ backgroundColor: '#111', borderTop: '2px solid var(--border-color)' }}>
                  <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '12px 16px' }}>Grand Total</td>
                  {data.monthLabels.map(m => {
                    const monthTotal = visibleRegions.reduce((sum, r) => sum + getRegionTotal(r, m), 0);
                    return (
                      <td key={m} style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px 16px' }}>
                        {formatNumber(monthTotal)}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
