'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const pathname = usePathname();

  const links = [
    { label: 'India - Funnel', href: '/' },
    { label: 'Mat - Funnel', href: '/mat-funnel' },
    { label: 'Overall + Cat', href: '/overall-cat' },
    { label: 'Mat - Campaign Type', href: '/mat-campaign-type' },
    { label: 'Campaign Type Google', href: '/campaign-type-google' }
  ];

  return (
    <nav style={{
      backgroundColor: 'var(--surface-color)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0 2rem',
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      gap: '24px'
    }}>
      <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)', marginRight: '16px' }}>
        TSC Dashboard
      </div>
      {links.map(l => (
        <Link
          key={l.href}
          href={l.href}
          style={{
            color: pathname === l.href ? 'var(--accent-primary)' : 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: pathname === l.href ? 600 : 500,
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: pathname === l.href ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            transition: 'all 0.2s'
          }}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
