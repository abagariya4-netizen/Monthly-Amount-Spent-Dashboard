import { NextResponse, NextRequest } from 'next/server';
import { fetchAllPages } from '@/lib/metaApi';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://graph.facebook.com/v19.0';

import { fmtDate, Month, getDefaultMonthsBeforeCurrent, getSelectedMonths } from '@/lib/dateUtils';

function classifyFunnel(campaignName: string, adsetName: string): 'Top' | 'Mid' | 'Bot' | 'Growth' | 'RnF' | null {
  const cn = (campaignName || '').toLowerCase();
  const an = (adsetName || '').toLowerCase();
  if (cn.includes('rnf') || an.includes('rnf') || cn.includes('r&f') || an.includes('r&f')) return 'RnF';
  if (cn.includes('growth') || an.includes('growth')) return 'Growth';
  if (cn.includes('bot')) return 'Bot';
  if (cn.includes('mid')) return 'Mid';
  if (cn.includes('top')) return 'Top';
  return null;
}

function getCategories(campaignName: string, adsetName: string): Set<string> {
  const cn = (campaignName || '').toLowerCase();
  const an = (adsetName || '').toLowerCase();
  const matched = new Set<string>();
  
  if (cn.includes('group') || an.includes('group')) matched.add('Group');
  if (cn.includes('boost') || an.includes('boost')) matched.add('Boost');
  
  let productCategory = null;
  const isGrowth = classifyFunnel(campaignName, adsetName) === 'Growth';

  if (cn.includes('dhoni')) {
    if (an.includes('chair')) productCategory = 'Chair';
    else if (an.includes('desk')) productCategory = 'Desk';
    else if (an.includes('sofa')) productCategory = 'Sofa';
    else if (an.includes('elite')) productCategory = 'Elite';
    else if (an.includes('foot')) productCategory = 'Foot Massager';
    else if (an.includes('bed')) productCategory = 'Bed';
    else if (an.includes('acce')) productCategory = 'Accessories';
    else if (an.includes('mat') || an.includes('mattress')) productCategory = 'Mat';
  } else if (isGrowth) {
    const str = cn;
    if (str.includes('chair')) productCategory = 'Chair';
    else if (str.includes('desk')) productCategory = 'Desk';
    else if (str.includes('sofa')) productCategory = 'Sofa';
    else if (str.includes('elite')) productCategory = 'Elite';
    else if (str.includes('foot')) productCategory = 'Foot Massager';
    else if (str.includes('bed')) productCategory = 'Bed';
    else if (str.includes('acce')) productCategory = 'Accessories';
    else {
      if (!matched.has('Group') && !matched.has('Boost')) {
        productCategory = 'Mat';
      }
    }
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
      else {
        if (!matched.has('Group') && !matched.has('Boost')) {
          productCategory = 'Mat';
        }
      }
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
    
    ['Top', 'Mid', 'Bot', 'Growth', 'RnF'].forEach(name => {
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

        const funnelRow = classifyFunnel(cName, aName);
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
