'use client';
import React, { useState, useEffect, useRef } from 'react';
import DateRangePicker from '@/components/DateRangePicker';

const CATEGORIES = ['Mat', 'Chair', 'Desk', 'Sofa', 'Foot Massager', 'Elite', 'Group', 'Boost', 'RnF'];

export default function IndiaFunnelPage() {
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  
  const [data, setData] = useState<{ campaigns: any[], monthLabels: string[] } | null>(null);
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
      
      const res = await fetch(`/api/data?${params.toString()}`);
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
    const header = ['Funnel', ...data.monthLabels];
    const rows = [header.join(',')];
    
    let grandTotal = Array(data.monthLabels.length).fill(0);
    
    data.campaigns.forEach(c => {
      const row = [c.name];
      data.monthLabels.forEach((m, i) => {
        const val = c[m]?.spend || 0;
        row.push(val);
        grandTotal[i] += val;
      });
      rows.push(row.join(','));
    });
    
    rows.push(['Grand Total', ...grandTotal].join(','));
    
    const csvStr = rows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'india-funnel.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getGrandTotal = (monthLabel: string) => {
    if (!data) return 0;
    return data.campaigns.reduce((sum, c) => sum + (c[monthLabel]?.spend || 0), 0);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>India - Funnel Report</h1>
      
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
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Funnel</th>
                {data.monthLabels.map(m => <th key={m} style={{ textAlign: 'right' }}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map(c => (
                <tr key={c.name}>
                  <td style={{ fontWeight: 500, textAlign: 'left' }}>{c.name}</td>
                  {data.monthLabels.map(m => (
                    <td key={m} style={{ textAlign: 'right' }}>{formatNumber(c[m]?.spend || 0)}</td>
                  ))}
                </tr>
              ))}
              <tr className="total-row">
                <td style={{ textAlign: 'left' }}>Grand Total</td>
                {data.monthLabels.map(m => (
                  <td key={m} style={{ textAlign: 'right' }}>{formatNumber(getGrandTotal(m))}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
