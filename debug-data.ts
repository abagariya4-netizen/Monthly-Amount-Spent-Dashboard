import fetch from 'node-fetch';

const TOKEN = 'EAAU11hb8dBcBRFUBmvVxjdNZBPHdDpS1tpT1N11YuEjShqZBXPWHNnH03H9R1K1iFu3hJ851aJxqR6g1kL9vRaurqEZBrhDlxl72APpwU9zUATV0yKEYqBqxPfXKZALyGlZBjQlxiU7L4Lugzj9HJm0PrnDm9tp0UGXopJKmHKS8WzDhN6eRZAzZAjxrqQHSQZDZD';
const ACCOUNT_ID = 'act_2240079932900749';
const BASE_URL = 'https://graph.facebook.com/v19.0';

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

function classifyFunnel(campaignName: string): string | null {
  const n = (campaignName || '').toLowerCase();
  if (n.includes('growth')) return 'Growth';
  if (n.includes('bot')) return 'Bot';
  if (n.includes('mid')) return 'Mid';
  if (n.includes('top')) return 'Top';
  return null;
}

function getCategory(campaignName: string, adsetName: string): string {
  const cn = (campaignName || '').toLowerCase();
  const an = (adsetName || '').toLowerCase();
  
  if (cn.includes('group') || an.includes('group')) return 'Group';
  if (cn.includes('boost') || an.includes('boost')) return 'Boost';
  
  if (cn.includes('dhoni')) {
    if (an.includes('chair')) return 'Chair';
    if (an.includes('desk')) return 'Desk';
    if (an.includes('sofa')) return 'Sofa';
    if (an.includes('elite')) return 'Elite';
    if (an.includes('foot')) return 'Foot Massager';
    if (an.includes('mat') || an.includes('mattress')) return 'Mat';
    return 'Mat'; // Fallback for dhoni?
  } 
  
  const isGrowth = classifyFunnel(campaignName) === 'Growth';
  const str = isGrowth ? cn : cn + " " + an;
  const isMat = (cn.includes('mat') || cn.includes('mattress')) && !cn.includes('non_mat') && !cn.includes('non_mattress');
  
  if (isMat) return 'Mat';
  
  if (str.includes('chair')) return 'Chair';
  if (str.includes('desk')) return 'Desk';
  if (str.includes('sofa')) return 'Sofa';
  if (str.includes('elite')) return 'Elite';
  if (str.includes('foot')) return 'Foot Massager';
  
  return 'Mat'; // Default fallback
}

async function run() {
  const p = { label: 'Apr', since: '2026-04-01', until: '2026-04-30' };
  const timeRangeStr = encodeURIComponent(JSON.stringify({ since: p.since, until: p.until }));
  const url = `${BASE_URL}/${ACCOUNT_ID}/insights?fields=campaign_name,adset_name,spend&level=adset&time_range=${timeRangeStr}&limit=500&access_token=${TOKEN}`;
  
  const data = await fetchAllPages(url);
  
  const growthCamps = [];
  
  for (const row of data) {
    const cName = row.campaign_name || '';
    const aName = row.adset_name || '';
    const spend = Math.round(parseFloat(row.spend || '0'));
    
    if (spend === 0) continue;
    
    const cat = getCategory(cName, aName);
    const funnel = classifyFunnel(cName);
    
    if (funnel === 'Growth' && (cat === 'Mat' || cat === 'Group')) {
      growthCamps.push({ cName, aName, spend, cat });
    }
  }
  
  growthCamps.sort((a,b) => b.spend - a.spend);
  console.log("Growth campaigns categorized as Mat or Group in April:");
  for (const c of growthCamps) {
    console.log(`${c.spend} | ${c.cat} | ${c.cName} | ${c.aName}`);
  }
}

run().catch(console.error);
