import { NextResponse, NextRequest } from 'next/server';
import { fetchAllPages } from '@/lib/metaApi';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://graph.facebook.com/v19.0';

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type Month = {
  label: string;
  startDate: string;
  endDate: string;
};

function getDefaultMonthsBeforeCurrent(): Month[] {
  const istString = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const today = new Date(istString);
  const months: Month[] = [];
  
  for (let i = 4; i >= 1; i--) {
    const targetMonthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = targetMonthDate.getFullYear();
    const monthIndex = targetMonthDate.getMonth();
    
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    
    const label = targetMonthDate.toLocaleString('default', { month: 'short' }) + "'" + year.toString().slice(-2);
    
    months.push({
      label,
      startDate: fmtDate(monthStart),
      endDate: fmtDate(monthEnd),
    });
  }
  return months;
}

function getSelectedMonths(startDateStr: string, endDateStr: string): Month[] {
  const startParts = startDateStr.split('-');
  const endParts = endDateStr.split('-');
  
  const startYear = parseInt(startParts[0]);
  const startMonth = parseInt(startParts[1]) - 1;
  
  const endYear = parseInt(endParts[0]);
  const endMonth = parseInt(endParts[1]) - 1;
  
  let current = new Date(startYear, startMonth, 1);
  const end = new Date(endYear, endMonth, 1);
  const months: Month[] = [];
  
  while (current <= end) {
    const year = current.getFullYear();
    const monthIndex = current.getMonth();
    
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    const label = current.toLocaleString('default', { month: 'short' }) + "'" + year.toString().slice(-2);
    
    months.push({
      label,
      startDate: fmtDate(monthStart),
      endDate: fmtDate(monthEnd)
    });
    
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

function classifyFunnel(campaignName: string): 'Top' | 'Mid' | 'Bot' | 'Growth' | null {
  const n = (campaignName || '').toLowerCase();
  if (n.includes('growth')) return 'Growth';
  if (n.includes('bot')) return 'Bot';
  if (n.includes('mid')) return 'Mid';
  if (n.includes('top')) return 'Top';
  return null;
}

function getCategories(campaignName: string, adsetName: string): Set<string> {
  const cn = (campaignName || '').toLowerCase();
  const an = (adsetName || '').toLowerCase();
  const matched = new Set<string>();
  
  if (cn.includes('group') || an.includes('group')) matched.add('Group');
  if (cn.includes('boost') || an.includes('boost')) matched.add('Boost');
  
  let productCategory = null;
  const isGrowth = classifyFunnel(campaignName) === 'Growth';

  if (cn.includes('dhoni')) {
    if (an.includes('chair')) productCategory = 'Chair';
    else if (an.includes('desk')) productCategory = 'Desk';
    else if (an.includes('sofa')) productCategory = 'Sofa';
    else if (an.includes('elite')) productCategory = 'Elite';
    else if (an.includes('foot')) productCategory = 'Foot Massager';
    else if (an.includes('mat') || an.includes('mattress')) productCategory = 'Mat';
  } else if (isGrowth) {
    const str = cn;
    if (str.includes('chair')) productCategory = 'Chair';
    else if (str.includes('desk')) productCategory = 'Desk';
    else if (str.includes('sofa')) productCategory = 'Sofa';
    else if (str.includes('elite')) productCategory = 'Elite';
    else if (str.includes('foot')) productCategory = 'Foot Massager';
    else productCategory = 'Mat';
  } else {
    const str = cn + " " + an;
    const isMat = (cn.includes('mat') || cn.includes('mattress')) && !cn.includes('non_mat') && !cn.includes('non_mattress');
    
    if (isMat) {
      productCategory = 'Mat';
    } else {
      if (str.includes('chair')) productCategory = 'Chair';
      else if (str.includes('desk')) productCategory = 'Desk';
      else if (str.includes('sofa')) productCategory = 'Sofa';
      else if (str.includes('elite')) productCategory = 'Elite';
      else if (str.includes('foot')) productCategory = 'Foot Massager';
      else if (str.includes('all_products') || isMat) productCategory = 'Mat';
      else productCategory = 'Mat';
    }
  }
  
  if (productCategory) matched.add(productCategory);
  return matched;
}

export async function GET(req: NextRequest) {
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;

  if (!token || !accountId) {
    return NextResponse.json({ error: 'META_ACCESS_TOKEN or META_AD_ACCOUNT_ID not set' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const selectedCategoriesStr = searchParams.get('categories');
  const selectedCategories = selectedCategoriesStr ? selectedCategoriesStr.split(',') : [];
  
  let startDateStr = searchParams.get('startDate');
  let endDateStr = searchParams.get('endDate');

  let periods: Month[] = [];
  if (startDateStr && endDateStr) {
    periods = getSelectedMonths(startDateStr, endDateStr);
  } else {
    periods = getDefaultMonthsBeforeCurrent();
  }
  
  if (selectedCategories.length === 0) {
    return NextResponse.json({ campaigns: [], monthLabels: periods.map(p => p.label) });
  }

  try {
    const campaignsMap = new Map<string, any>();
    const getCampNode = (name: string) => campaignsMap.get(name);
    
    ['Top', 'Mid', 'Bot', 'Growth'].forEach(name => {
      const node: any = { name };
      periods.forEach(p => {
        node[p.label] = { spend: 0 };
      });
      campaignsMap.set(name, node);
    });

    const isAllSelected = selectedCategories.includes('All');

    const fetchPeriod = async (p: Month) => {
      const timeRangeStr = encodeURIComponent(JSON.stringify({ since: p.startDate, until: p.endDate }));
      const url = `${BASE_URL}/${accountId}/insights?fields=campaign_name,adset_name,spend&level=adset&time_range=${timeRangeStr}&limit=500&access_token=${token}`;
      
      const allData = await fetchAllPages(url);

      for (const row of allData) {
        const cName = row.campaign_name || '';
        const aName = row.adset_name || '';
        const spend = Math.round(parseFloat(row.spend || '0'));

        if (spend === 0) continue;

        const campaignCats = getCategories(cName, aName);
        
        let shouldInclude = false;
        
        if (isAllSelected) {
          shouldInclude = campaignCats.size > 0;
        } else {
          for (const cat of selectedCategories) {
            if (campaignCats.has(cat)) {
              shouldInclude = true;
              break;
            }
          }
        }

        if (!shouldInclude) continue;

        const funnelRow = classifyFunnel(cName);
        if (!funnelRow) continue; 

        const node = getCampNode(funnelRow);
        if (node) {
          node[p.label].spend += spend;
        }
      }
    };

    for (const p of periods) {
      await fetchPeriod(p);
    }

    const finalCampaigns = [];
    for (const name of ['Top', 'Mid', 'Bot', 'Growth']) {
      finalCampaigns.push(campaignsMap.get(name));
    }

    return NextResponse.json({
      campaigns: finalCampaigns,
      monthLabels: periods.map(p => p.label)
    });
    
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
