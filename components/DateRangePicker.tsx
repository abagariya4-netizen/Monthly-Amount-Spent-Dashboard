import React, { useState } from 'react';

type DateRangePickerProps = {
  onApply: (startMonth: string, endMonth: string) => void;
  onReset: () => void;
};

export default function DateRangePicker({ onApply, onReset }: DateRangePickerProps) {
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');

  const handleApply = () => {
    if (!startMonth || !endMonth) return;
    onApply(startMonth, endMonth);
  };

  const handleReset = () => {
    setStartMonth('');
    setEndMonth('');
    onReset();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent' }}>
      <input 
        type="month" 
        value={startMonth}
        onChange={(e) => setStartMonth(e.target.value)}
        style={{ padding: '6px 12px', borderRadius: '9999px', background: '#1f2333', color: '#fff', border: '1px solid #2d3348', fontSize: '12px', outline: 'none' }}
      />
      <span style={{ color: '#64748b' }}>→</span>
      <input 
        type="month" 
        value={endMonth}
        onChange={(e) => setEndMonth(e.target.value)}
        style={{ padding: '6px 12px', borderRadius: '9999px', background: '#1f2333', color: '#fff', border: '1px solid #2d3348', fontSize: '12px', outline: 'none' }}
      />
      <button 
        onClick={handleApply}
        disabled={!startMonth || !endMonth}
        className="btn-primary"
      >
        Apply
      </button>
      <button 
        onClick={handleReset}
        className="btn-outline"
      >
        Reset
      </button>
    </div>
  );
}
