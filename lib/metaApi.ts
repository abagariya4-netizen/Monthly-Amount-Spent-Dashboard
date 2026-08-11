const BASE = 'https://graph.facebook.com/v19.0';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function fetchAllPages(url: string, retries = 4): Promise<any[]> {
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
        const res: Response  = await fetch(next as string, { cache: 'no-store' });
        const json = await res.json();
        
        if (json.error) {
           const msg = json.error.message?.toLowerCase() || '';
           if (json.error.code === 17 || json.error.code === 4 || json.error.code === 1 || json.error.code === 2 || msg.includes('limit reached') || msg.includes('temporarily unavailable') || msg.includes('timeout')) {
             if (attempt >= retries) throw new Error(`Meta API error: ${json.error.message}`);
             console.warn(`Rate limit or transient error on page ${page}, waiting ${attempt * 3}s before retry...`);
             await delay(attempt * 3000);
             continue; 
           }
           throw new Error(`Meta API error: ${json.error.message}`);
        }
        
        if (json.data?.length) rows = rows.concat(json.data);
        next = json.paging?.next || null;
        success = true;
      } catch (err: any) {
        if (attempt >= retries) throw err;
        console.warn(`Fetch failed, waiting ${attempt * 3}s...`);
        await delay(attempt * 3000);
      }
    }
    
    if (next) await delay(100);
    if (page >= 1000) break;
  }
  return rows;
}
