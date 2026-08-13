import { NextResponse, NextRequest } from 'next/server';
import { fetchAllPages } from '@/lib/metaApi';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://graph.facebook.com/v19.0';

const REGIONS = [
  'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Gujarat', 
  'Delhi', 'Kerala', 'Andhra Pradesh', 'Uttar Pradesh', 'Haryana', 
  'West Bengal', 'Rajasthan', 'Madhya Pradesh', 'Punjab region', 
  'Odisha', 'Goa', 'Bihar', 'Assam', 'Chhattisgarh', 
  'Jammu and Kashmir', 'Uttarakhand', 'Jharkhand', 'Chandigarh', 
  'Puducherry', 'Himachal Pradesh', 'Unknown', 
  'Dadra and Nagar Haveli', 'Arunachal Pradesh', 'Tripura', 'Manipur', 
  'Nagaland', 'Meghalaya', 'Sikkim', 'Mizoram', 
  'Andaman and Nicobar Islands', 'Lakshadweep'
];

import { fmtDate, Month, getDefaultMonthsBeforeCurrent, getSelectedMonths } from '@/lib/dateUtils';

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
  const categoriesStr = searchParams.get('categories');
  const funnelsStr = searchParams.get('funnels');
  
  const selectedCategories = categoriesStr ? categoriesStr.split(',') : [];
  const selectedFunnels = funnelsStr ? funnelsStr.split(',') : [];
  
  let startDateStr = searchParams.get('startDate');
  let endDateStr = searchParams.get('endDate');

  let periods: Month[] = [];
  if (startDateStr && endDateStr) {
    periods = getSelectedMonths(startDateStr, endDateStr);
  } else {
    periods = getDefaultMonthsBeforeCurrent();
  }
  
  if (selectedCategories.length === 0) {
    return NextResponse.json({ regions: [], monthLabels: periods.map(p => p.label) });
  }

  try {
    const regionMap = new Map<string, any>();
    
    const getRegionNode = (region: string) => {
      let node = regionMap.get(region);
      if (!node) {
        node = { region };
        periods.forEach(p => {
          node[p.label] = { spend: 0 };
        });
        regionMap.set(region, node);
      }
      return node;
    };

    const isAllCategories = selectedCategories.includes('All');
    // If no funnel selected, treat as All
    const isAllFunnels = selectedFunnels.length === 0 || selectedFunnels.includes('All');

    const fetchPeriod = async (p: Month) => {
      const timeRangeStr = encodeURIComponent(JSON.stringify({ since: p.startDate, until: p.endDate }));
      const url = `${BASE_URL}/${accountId}/insights?fields=campaign_name,adset_name,spend&level=adset&breakdowns=region&time_range=${timeRangeStr}&limit=500&access_token=${token}`;
      
      const allData = await fetchAllPages(url);

      for (const row of allData) {
        const cName = row.campaign_name || '';
        const aName = row.adset_name || '';
        const spend = Math.round(parseFloat(row.spend || '0'));
        let rawRegion = row.region || 'Unknown';
        
        let mappedRegion = REGIONS.includes(rawRegion) ? rawRegion : 'Unknown';

        if (spend === 0) continue;

        // Category Check
        const campaignCats = getCategories(cName, aName);
        let catIncluded = false;
        
        if (isAllCategories) {
          catIncluded = campaignCats.size > 0;
        } else {
          for (const cat of selectedCategories) {
            if (campaignCats.has(cat)) {
              catIncluded = true;
              break;
            }
          }
        }
        if (!catIncluded) continue;

        // Funnel Check
        const funnelRow = classifyFunnel(cName);
        if (!funnelRow) continue; 

        if (!isAllFunnels && !selectedFunnels.includes(funnelRow)) {
          continue;
        }

        const node = getRegionNode(mappedRegion);
        node[p.label].spend += spend;
      }
    };

    for (const p of periods) {
      await fetchPeriod(p);
    }

    const finalRegions = [];
    for (const region of REGIONS) {
      if (regionMap.has(region)) {
        finalRegions.push(regionMap.get(region));
      } else {
        finalRegions.push(getRegionNode(region));
      }
    }

    return NextResponse.json({
      regions: finalRegions,
      monthLabels: periods.map(p => p.label)
    });
    
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
