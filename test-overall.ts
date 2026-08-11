import fetch from 'node-fetch';

const TOKEN = 'EAAU11hb8dBcBRFUBmvVxjdNZBPHdDpS1tpT1N11YuEjShqZBXPWHNnH03H9R1K1iFu3hJ851aJxqR6g1kL9vRaurqEZBrhDlxl72APpwU9zUATV0yKEYqBqxPfXKZALyGlZBjQlxiU7L4Lugzj9HJm0PrnDm9tp0UGXopJKmHKS8WzDhN6eRZAzZAjxrqQHSQZDZD';
const ACCOUNT_ID = 'act_2240079932900749';
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

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchAllPages(url: string, retries = 4): Promise<any[]> {
  let rows: any[] = [];
  let next: string | null = url;
  let page = 0;
  while (next) {
    page++;
    let success = false;
    let attempt = 0;
    while (!success && attempt < retries) {
      attempt++;
      try {
        const res: any = await fetch(next as string);
        const json: any = await res.json();
        if (json.error) {
           if (attempt >= retries) throw new Error(json.error.message);
           await delay(attempt * 3000);
           continue; 
        }
        if (json.data?.length) rows = rows.concat(json.data);
        next = json.paging?.next || null;
        success = true;
      } catch (err: any) {
        if (attempt >= retries) throw err;
        await delay(attempt * 3000);
      }
    }
    if (next) await delay(100);
    if (page >= 1000) break;
  }
  return rows;
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

async function run() {
  const periods = [
    { label: "Apr'26", since: '2026-04-01', until: '2026-04-30' },
    { label: "May'26", since: '2026-05-01', until: '2026-05-31' },
    { label: "Jun'26", since: '2026-06-01', until: '2026-06-30' },
    { label: "Jul'26", since: '2026-07-01', until: '2026-07-31' },
  ];
  
  const selectedCategories = ['Chair', 'Desk', 'Elite', 'Foot Massager', 'Group', 'Mat', 'Sofa'];
  const selectedFunnels = ['Top', 'Mid', 'Bot'];
  
  let grandTotals = { "Apr'26": 0, "May'26": 0, "Jun'26": 0, "Jul'26": 0 };
  
  for (const p of periods) {
    const timeRangeStr = encodeURIComponent(JSON.stringify({ since: p.since, until: p.until }));
    const url = `${BASE_URL}/${ACCOUNT_ID}/insights?fields=campaign_name,adset_name,spend&level=adset&breakdowns=region&time_range=${timeRangeStr}&limit=500&access_token=${TOKEN}`;
    
    console.log(`Fetching ${p.label}...`);
    const data = await fetchAllPages(url);
    
    let monthTotal = 0;
    
    for (const row of data) {
      const cName = row.campaign_name || '';
      const aName = row.adset_name || '';
      const spend = Math.round(parseFloat(row.spend || '0'));
      let rawRegion = row.region || 'Unknown';
      let mappedRegion = REGIONS.includes(rawRegion) ? rawRegion : 'Unknown';

      if (spend === 0) continue;

      const campaignCats = getCategories(cName, aName);
      
      let catIncluded = false;
      for (const cat of selectedCategories) {
        if (campaignCats.has(cat)) {
          catIncluded = true;
          break;
        }
      }

      if (!catIncluded) continue;

      const funnelRow = classifyFunnel(cName);
      if (!funnelRow) continue; 
      
      if (!selectedFunnels.includes(funnelRow)) continue;
      
      monthTotal += spend;
    }
    grandTotals[p.label as keyof typeof grandTotals] = monthTotal;
  }
  
  console.log('Grand Totals:', grandTotals);
}

run().catch(console.error);
