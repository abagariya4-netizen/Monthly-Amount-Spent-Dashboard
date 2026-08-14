'use client';
import React, { useState, useEffect, useRef } from 'react';
import DateRangePicker from '@/components/DateRangePicker';

const CATEGORIES = ['Mat', 'Chair', 'Desk', 'Sofa', 'Foot Massager', 'Elite', 'Group', 'Boost', 'RnF'];
const FUNNELS = ['Top', 'Mid', 'Bot', 'Growth'];

export default function OverallCatPage() {
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedFunnels, setSelectedFunnels] = useState<string[]>([]);
  
  const [data, setData] = useState<{ regions: any[], monthLabels: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
    }
  }, []);
  
  const isAllCatsSelected = CATEGORIES.every(c => selectedCats.includes(c));
  const isAllFunnelsSelected = FUNNELS.every(f => selectedFunnels.includes(f));

  const toggleAllCats = () => {
    if (isAllCatsSelected) {
      setSelectedCats([]);
    } else {
      setSelectedCats([...CATEGORIES]);
    }
  };

  const toggleAllFunnels = () => {
    if (isAllFunnelsSelected) {
      setSelectedFunnels([]);
    } else {
      setSelectedFunnels([...FUNNELS]);
    }
  };

  const toggleCategory = (cat: string) => {
    if (selectedCats.includes(cat)) {
      setSelectedCats(selectedCats.filter(c => c !== cat));
    } else {
      setSelectedCats([...selectedCats, cat]);
    }
  };

  const toggleFunnel = (funnel: string) => {
    if (selectedFunnels.includes(funnel)) {
      setSelectedFunnels(selectedFunnels.filter(f => f !== funnel));
    } else {
      setSelectedFunnels([...selectedFunnels, funnel]);
    }
  };

  const handleApplyFilter = () => {
    fetchData(selectedCats, selectedFunnels, startMonth, endMonth);
  };

  const handleReset = () => {
    setSelectedCats([]);
    setSelectedFunnels([]);
    setStartMonth('');
    setEndMonth('');
    setData(null);
    setError('');
  };

  const fetchData = async (cats: string[], funnels: string[], start: string, end: string) => {
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
      
      if (funnels.length === FUNNELS.length || funnels.length === 0) {
        params.append('funnels', 'All');
      } else {
        params.append('funnels', funnels.join(','));
      }
      
      if (start && end) {
        params.append('startDate', start);
        params.append('endDate', end);
      }
      
      const res = await fetch(`/api/overall-cat?${params.toString()}`);
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
    const header = ['Region', ...data.monthLabels];
    const rows = [header.join(',')];
    
    data.regions.forEach(r => {
      const row = [r.region];
      data.monthLabels.forEach((m) => {
        row.push((r[m]?.spend || 0).toString());
      });
      rows.push(row.join(','));
    });
    
    // Grand Total row
    const grandTotalRow = ['Grand Total'];
    data.monthLabels.forEach(m => {
      let monthTotal = 0;
      data.regions.forEach(r => {
        monthTotal += (r[m]?.spend || 0);
      });
      grandTotalRow.push(monthTotal.toString());
    });
    rows.push(grandTotalRow.join(','));
    
    const csvStr = rows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'overall-cat.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatNumber = (num: number) => {
    if (num === 0) return '0';
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num);
  };

  const visibleRegions = data?.regions.filter(r => {
    let totalSpend = 0;
    data.monthLabels.forEach(m => {
      totalSpend += (r[m]?.spend || 0);
    });
    return totalSpend > 0;
  }) || [];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>Overall + Cat (Meta) Report</h1>
      
      <div className="card" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, marginRight: '8px' }}>Categories:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            <input type="checkbox" checked={isAllCatsSelected} onChange={toggleAllCats} /> All
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, marginRight: '8px' }}>Funnels:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            <input type="checkbox" checked={isAllFunnelsSelected} onChange={toggleAllFunnels} /> All
          </label>
          {FUNNELS.map(funnel => (
            <label key={funnel} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={selectedFunnels.includes(funnel)}
                onChange={() => toggleFunnel(funnel)}
              />
              {funnel}
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', background: '#1a1d27', border: '1px solid #2d3348', padding: '10px 16px', borderRadius: '9999px' }}>
          <DateRangePicker 
            onApply={(s, e) => {
              setStartMonth(s);
              setEndMonth(e);
              fetchData(selectedCats, selectedFunnels, s, e);
            }}
            onReset={() => {
              setStartMonth('');
              setEndMonth('');
              fetchData(selectedCats, selectedFunnels, '', '');
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
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Region</th>
                {data.monthLabels.map(m => <th key={m} style={{ textAlign: 'right', padding: '12px 16px' }}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {visibleRegions.map(r => (
                <tr key={r.region} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '12px 16px' }}>
                    {r.region}
                  </td>
                  {data.monthLabels.map(m => (
                    <td key={m} style={{ textAlign: 'right', padding: '12px 16px' }}>
                      {formatNumber(r[m]?.spend || 0)}
                    </td>
                  ))}
                </tr>
              ))}
              {visibleRegions.length > 0 && (
                <tr className="total-row" style={{ backgroundColor: '#111', borderTop: '2px solid var(--border-color)' }}>
                  <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '12px 16px' }}>Grand Total</td>
                  {data.monthLabels.map(m => {
                    const monthTotal = visibleRegions.reduce((sum, r) => sum + (r[m]?.spend || 0), 0);
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
