const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_ALIASES = {jan:'Janeiro',janeiro:'Janeiro',fev:'Fevereiro',fevereiro:'Fevereiro',mar:'Março',marco:'Março','março':'Março',abr:'Abril',abril:'Abril',mai:'Maio',maio:'Maio',jun:'Junho',junho:'Junho',jul:'Julho',julho:'Julho',ago:'Agosto',agosto:'Agosto',set:'Setembro',setembro:'Setembro',out:'Outubro',outubro:'Outubro',nov:'Novembro',novembro:'Novembro',dez:'Dezembro',dezembro:'Dezembro'};
const CACHE_KEY = 'hrjr-dashboard-cache-v1';
const SLA_MINUTES = 60;

const state = {
  rawRows: [], rows: [], charts: {}, page: 1, pageSize: 12, columns: {}, warnings: [], cacheLoaded: false,
  filters: { years: [], month: '', service: '', category: '', type: '', owner: '', impact: '', status: '', search: '' }
};

const aliases = {
  date: ['data','dt','data ocorrencia','data ocorrência','data do incidente','data abertura'],
  year: ['ano','year'],
  month: ['mes','mês','month','mes ocorrencia','mês ocorrência'],
  timeStart: ['hora inicio','hora início','hora de inicio','hora de início','inicio','início','hora'],
  service: ['servico principal','serviço principal','servico','serviço','sistema','recurso','serviço afetado','servico afetado'],
  category: ['categoria','macroprocesso','grupo'],
  type: ['tipo','tipo incidente','tipo de incidente','classificacao','classificação'],
  owner: ['responsavel','responsável','fornecedor','equipe','acionado'],
  impact: ['impacto','criticidade','prioridade'],
  status: ['situacao','situação','status','estado'],
  cause: ['causa raiz','causa','origem','motivo'],
  downtime: ['tempo de indisponibilidade','indisponibilidade','tempo parado','duracao','duração','tempo','tempo total']
};

const sampleRows = [
  {Data:'02/07/2026',Ano:'2026',Mês:'Julho','Hora Início':'08:15','Serviço Principal':'Internet',Categoria:'Rede',Tipo:'Indisponibilidade',Responsável:'Operadora',Impacto:'Crítico',Situação:'Resolvido','Causa Raiz':'Falha operadora','Tempo de Indisponibilidade':'02:15'},
  {Data:'01/07/2026',Ano:'2026',Mês:'Julho','Hora Início':'12:00','Serviço Principal':'MV',Categoria:'Sistema',Tipo:'Lentidão',Responsável:'Fornecedor',Impacto:'Alto',Situação:'Resolvido','Causa Raiz':'Falha sistêmica','Tempo de Indisponibilidade':'01:05'},
  {Data:'12/06/2026',Ano:'2026',Mês:'Junho','Hora Início':'16:20','Serviço Principal':'PACS',Categoria:'Infraestrutura',Tipo:'Erro',Responsável:'TI',Impacto:'Médio',Situação:'Resolvido','Causa Raiz':'Servidor','Tempo de Indisponibilidade':'00:35'},
  {Data:'20/07/2025',Ano:'2025',Mês:'Julho','Hora Início':'09:10','Serviço Principal':'Internet',Categoria:'Rede',Tipo:'Indisponibilidade',Responsável:'Operadora',Impacto:'Alto',Situação:'Resolvido','Causa Raiz':'Link externo','Tempo de Indisponibilidade':'03:40'},
  {Data:'11/05/2025',Ano:'2025',Mês:'Maio','Hora Início':'14:40','Serviço Principal':'MV',Categoria:'Sistema',Tipo:'Erro',Responsável:'Fornecedor',Impacto:'Crítico',Situação:'Resolvido','Causa Raiz':'Banco de dados','Tempo de Indisponibilidade':'04:10'}
];

function norm(v){ return String(v ?? '').trim(); }
function keyNorm(v){ return norm(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '); }
function html(v){ return String(v ?? '').replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s])); }
function setText(id, value){ const el = document.getElementById(id); if(el) el.textContent = value; }

function injectExtraStyles(){
  if(document.getElementById('hrjr-extra-styles')) return;
  const style = document.createElement('style');
  style.id = 'hrjr-extra-styles';
  style.textContent = `
    .executive-strip{display:grid;grid-template-columns:repeat(4,minmax(180px,1fr));gap:14px;margin-bottom:16px}
    .executive-strip article{background:linear-gradient(135deg,rgba(0,87,168,.1),rgba(0,168,107,.08));border:1px solid var(--border);box-shadow:var(--shadow);border-radius:20px;padding:18px}
    .executive-strip span{display:block;color:var(--muted);font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.executive-strip strong{display:block;font-size:22px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .heatmap-grid{display:grid;grid-template-columns:70px repeat(5,1fr);gap:8px;align-items:center}.heatmap-grid b{font-size:12px;color:var(--muted);text-align:center}.heatmap-cell{height:42px;border-radius:12px;display:grid;place-items:center;font-size:12px;font-weight:900;color:var(--text);background:rgba(0,87,168,.08)}
    .heat-l0{background:rgba(0,87,168,.06)}.heat-l1{background:rgba(0,168,107,.18)}.heat-l2{background:rgba(0,166,200,.28)}.heat-l3{background:rgba(0,87,168,.42);color:#fff}.heat-l4{background:rgba(220,38,38,.55);color:#fff}
    .drilldown-list{display:grid;gap:10px}.drill-row{display:grid;grid-template-columns:110px 1fr 120px 90px;gap:10px;align-items:center;background:var(--card2);border-radius:14px;padding:10px 12px;font-weight:800}.drill-row small{color:var(--muted);font-weight:700}
    body.tv-mode{--sidebar:0px}body.tv-mode .sidebar{display:none}body.tv-mode .content{padding:20px 28px}body.tv-mode .no-pdf{display:none!important}body.tv-mode .topbar h1{font-size:48px}body.tv-mode .kpis article{min-height:160px}body.tv-mode .panel canvas{height:360px!important}
    .pdf-mode .no-pdf{display:none!important}.pdf-mode .content{background:var(--bg)}
    @media(max-width:900px){.executive-strip{grid-template-columns:1fr}.drill-row{grid-template-columns:1fr}.heatmap-grid{grid-template-columns:52px repeat(5,1fr)}}`;
  document.head.appendChild(style);
}

function detectColumns(rows){
  const cols = Object.keys(rows[0] || {});
  const found = {};
  for(const [field, names] of Object.entries(aliases)){
    const normalized = names.map(keyNorm);
    found[field] = cols.find(c => normalized.includes(keyNorm(c))) || cols.find(c => normalized.some(n => keyNorm(c).includes(n))) || '';
  }
  state.warnings = [];
  ['date','service','downtime'].forEach(required => { if(!found[required]) state.warnings.push(`Coluna não localizada: ${required}`); });
  return found;
}
function val(row, field){ const col = state.columns[field]; return col ? norm(row[col]) : ''; }

function excelDateToJSDate(serial){ if(typeof serial !== 'number') return null; return new Date(Math.floor(serial - 25569) * 86400 * 1000); }
function parseDate(row){
  const raw = val(row, 'date');
  if(!raw) return null;
  if(typeof raw === 'number') return excelDateToJSDate(raw);
  if(raw instanceof Date) return raw;
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if(m){ const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return new Date(year, Number(m[2]) - 1, Number(m[1])); }
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if(m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function extractYear(row){ const y = val(row, 'year'); const m = y.match(/(19\d{2}|20\d{2}|21\d{2})/); if(m) return m[1]; const d = parseDate(row); return d ? String(d.getFullYear()) : ''; }
function extractMonth(row){
  const m = val(row, 'month');
  if(m){ const k = keyNorm(m); if(MONTH_ALIASES[k]) return MONTH_ALIASES[k]; const n = parseInt(k, 10); if(n >= 1 && n <= 12) return MONTHS[n - 1]; }
  const d = parseDate(row); return d ? MONTHS[d.getMonth()] : '';
}
function extractHour(row){
  const t = val(row,'timeStart');
  if(t){ const m = String(t).match(/(\d{1,2})[:h]/); if(m) return Math.max(0,Math.min(23,Number(m[1]))); }
  const raw = val(row,'date');
  const m = String(raw).match(/\b(\d{1,2}):\d{2}\b/); if(m) return Math.max(0,Math.min(23,Number(m[1])));
  return null;
}
function parseDowntime(value){
  if(value == null || value === '') return 0;
  if(typeof value === 'number') return value < 1 ? Math.round(value * 24 * 60) : Math.round(value * 60);
  const s = String(value).trim().toLowerCase(); const hm = s.match(/(\d{1,3})[:h](\d{1,2})?/);
  if(hm) return (+hm[1]) * 60 + (+(hm[2] || 0));
  const min = s.match(/(\d+)\s*m/), hour = s.match(/(\d+(?:[.,]\d+)?)\s*h/);
  if(hour) return Math.round(parseFloat(hour[1].replace(',','.')) * 60) + (min ? +min[1] : 0);
  const num = parseFloat(s.replace(',','.')); return isNaN(num) ? 0 : Math.round(num * 60);
}
function formatMinutes(min){ min = Math.round(min || 0); const h = Math.floor(min/60), m = min%60; if(h&&m) return `${h}h ${String(m).padStart(2,'0')}m`; if(h) return `${h}h`; return `${m}m`; }
function toast(msg){ const area=document.getElementById('toastArea'); const el=document.createElement('div'); el.className='toast'; el.textContent=msg; area.appendChild(el); setTimeout(()=>{el.style.opacity=0; setTimeout(()=>el.remove(),250)},3000); }
function updateTime(){ setText('lastUpdate', new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date())); }

function fillSelect(id, values, selectedValue=''){
  const el=document.getElementById(id); const unique=[...new Set(values.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true}));
  if(el.multiple){ el.innerHTML=unique.map(v=>`<option value="${html(v)}">${html(v)}</option>`).join(''); [...el.options].forEach(o=>o.selected=state.filters.years.includes(o.value)); }
  else { el.innerHTML='<option value="">Todos</option>'+unique.map(v=>`<option value="${html(v)}">${html(v)}</option>`).join(''); el.value=unique.includes(selectedValue)?selectedValue:''; }
}
function populateFilters(){
  const rows=state.rawRows; fillSelect('filterYear', rows.map(extractYear)); fillSelect('filterMonth', MONTHS.filter(m=>rows.some(r=>extractMonth(r)===m)), state.filters.month); fillSelect('filterService', rows.map(r=>val(r,'service')), state.filters.service); fillSelect('filterCategory', rows.map(r=>val(r,'category')), state.filters.category); fillSelect('filterType', rows.map(r=>val(r,'type')), state.filters.type); fillSelect('filterOwner', rows.map(r=>val(r,'owner')), state.filters.owner); fillSelect('filterImpact', rows.map(r=>val(r,'impact')), state.filters.impact); fillSelect('filterStatus', rows.map(r=>val(r,'status')), state.filters.status); renderWarnings();
}
function renderWarnings(){ const w=document.getElementById('warnings'); if(w) w.innerHTML=state.warnings.length ? `<div class="warning-box">Atenção: ${state.warnings.map(html).join(' | ')}</div>` : ''; }
function syncControls(){ ['Month','Service','Category','Type','Owner','Impact','Status'].forEach(n=>document.getElementById('filter'+n).value=state.filters[n==='Owner'?'owner':n.toLowerCase()]); [...document.getElementById('filterYear').options].forEach(o=>o.selected=state.filters.years.includes(o.value)); }
function applyFilters(){
  const q=keyNorm(state.filters.search);
  state.rows=state.rawRows.filter(r=>{ if(state.filters.years.length&&!state.filters.years.includes(extractYear(r))) return false; if(state.filters.month&&extractMonth(r)!==state.filters.month) return false; for(const k of ['service','category','type','owner','impact','status']) if(state.filters[k]&&val(r,k)!==state.filters[k]) return false; if(q&&!keyNorm(Object.values(r).join(' ')).includes(q)) return false; return true; });
  state.page=1; renderAll();
}
function groupCount(rows, field, limit=12){ const map=new Map(); rows.forEach(r=>{ const k=field==='month'?extractMonth(r):field==='year'?extractYear(r):(val(r,field)||'Não informado'); map.set(k,(map.get(k)||0)+1); }); return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit); }
function groupTime(rows, field, limit=10){ const map=new Map(); rows.forEach(r=>{ const k=val(r,field)||'Não informado'; map.set(k,(map.get(k)||0)+parseDowntime(val(r,'downtime'))); }); return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit); }
function rowsByPeriod(rows){ return rows.map(r=>({row:r,date:parseDate(r)})).filter(x=>x.date).sort((a,b)=>a.date-b.date); }
function getFilterSummary(){ const parts=[]; if(state.filters.years.length) parts.push(`Ano(s): ${state.filters.years.join(', ')}`); if(state.filters.month) parts.push(`Mês: ${state.filters.month}`); ['service','category','type','owner','impact','status'].forEach(k=>{ if(state.filters[k]) parts.push(`${k}: ${state.filters[k]}`); }); if(state.filters.search) parts.push(`Pesquisa: ${state.filters.search}`); return parts.join(' | ') || 'Todos os dados carregados'; }
function periodLabel(){ const years=[...new Set(state.rows.map(extractYear).filter(Boolean))].sort(); const months=[...new Set(state.rows.map(extractMonth).filter(Boolean))]; if(!state.rows.length) return 'Sem dados'; if(years.length===1 && months.length===1) return `${months[0]} / ${years[0]}`; if(years.length) return years.join(' x '); return 'Todos os períodos'; }

function renderKpis(){
  const rows=state.rows,total=rows.length,totalMin=rows.reduce((s,r)=>s+parseDowntime(val(r,'downtime')),0),critical=rows.filter(r=>['critico','crítico','alto'].includes(keyNorm(val(r,'impact')))).length,svc=groupCount(rows,'service',1)[0]?.[0]||'-',availability=Math.max(0,100-(totalMin/(30*24*60))*100);
  setText('kpiTotal', total.toLocaleString('pt-BR')); setText('kpiHours', formatMinutes(totalMin)); setText('kpiMttr', formatMinutes(total?totalMin/total:0)); setText('kpiAvailability', availability.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%'); setText('kpiCritical', critical.toLocaleString('pt-BR')); setText('kpiTopService', svc);
  const inSla=rows.filter(r=>parseDowntime(val(r,'downtime'))<=SLA_MINUTES).length, sla=total?Math.round(inSla/total*100):100; setText('summaryPeriod', periodLabel()); setText('summarySla', `${sla}% dentro da meta`); setText('summaryCriticalService', svc);
  const trend=calculateTrend(); setText('summaryTrend', trend);
}
function calculateTrend(){ const data=trend12Data(); if(data.length<2) return 'Sem histórico suficiente'; const last=data[data.length-1].count, prev=data[data.length-2].count; if(prev===0&&last>0) return 'Alta sem base anterior'; const pct=prev?((last-prev)/prev*100):0; return `${pct>=0?'Alta':'Queda'} de ${Math.abs(pct).toFixed(0)}%`; }

function createChart(id,type,labels,datasets,onClickField){
  const ctx=document.getElementById(id); if(!ctx) return; if(state.charts[id]) state.charts[id].destroy();
  state.charts[id]=new Chart(ctx,{type,data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:datasets.length>1||type==='doughnut'||type==='pie'}},scales:type==='doughnut'||type==='pie'?{}:{y:{beginAtZero:true,grid:{color:'rgba(120,140,160,.16)'}},x:{grid:{display:false}}},onClick:(_,els)=>{if(!els.length||!onClickField)return;const v=labels[els[0].index];state.filters[onClickField]=state.filters[onClickField]===v?'':v;syncControls();applyFilters();toast(`Drill-down aplicado: ${v}`)}}});
}
function trend12Data(){ const sorted=rowsByPeriod(state.rows); const map=new Map(); sorted.forEach(({date})=>{ const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; map.set(key,(map.get(key)||0)+1); }); return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-12).map(([key,count])=>{ const [y,m]=key.split('-'); return {label:`${MONTHS[Number(m)-1].slice(0,3)}/${y}`,count}; }); }
function serviceSlaData(){ const services=groupCount(state.rows,'service',12).map(x=>x[0]); return services.map(s=>{ const rows=state.rows.filter(r=>(val(r,'service')||'Não informado')===s); const ok=rows.filter(r=>parseDowntime(val(r,'downtime'))<=SLA_MINUTES).length; return [s, rows.length?Math.round(ok/rows.length*100):100]; }); }
function avgDowntimeData(){ return groupCount(state.rows,'service',12).map(([s])=>{ const rows=state.rows.filter(r=>(val(r,'service')||'Não informado')===s); const avg=rows.length?rows.reduce((a,r)=>a+parseDowntime(val(r,'downtime')),0)/rows.length:0; return [s,Math.round(avg)]; }); }
function renderCharts(){
  const years=[...new Set(state.rows.map(extractYear).filter(Boolean))].sort(), datasets=years.map(y=>({label:y,data:MONTHS.map(m=>state.rows.filter(r=>extractYear(r)===y&&extractMonth(r)===m).length),borderWidth:2,tension:.35})); createChart('chartYearCompare','line',MONTHS,datasets.length?datasets:[{label:'Sem dados',data:MONTHS.map(()=>0),borderWidth:2}],null);
  const impact=groupCount(state.rows,'impact',8); createChart('chartImpact','doughnut',impact.map(x=>x[0]),[{label:'Impacto',data:impact.map(x=>x[1])}],'impact'); const status=groupCount(state.rows,'status',8); createChart('chartStatus','pie',status.map(x=>x[0]),[{label:'Situação',data:status.map(x=>x[1])}],'status');
  [['chartService','service','Serviços'],['chartCategory','category','Categorias'],['chartOwner','owner','Responsáveis'],['chartCause','cause','Causas']].forEach(([id,field,label])=>{ const g=groupCount(state.rows,field,10); createChart(id,'bar',g.map(x=>x[0]),[{label,data:g.map(x=>x[1]),borderWidth:2,borderRadius:10}],field==='cause'?null:field); });
  const t=trend12Data(); createChart('chartTrend12','line',t.map(x=>x.label),[{label:'Incidentes',data:t.map(x=>x.count),borderWidth:2,tension:.35}],null);
  const sla=serviceSlaData(); createChart('chartSlaService','bar',sla.map(x=>x[0]),[{label:'SLA %',data:sla.map(x=>x[1]),borderWidth:2,borderRadius:10}],null);
  const avg=avgDowntimeData(); createChart('chartAvgDowntime','bar',avg.map(x=>x[0]),[{label:'Minutos médios',data:avg.map(x=>x[1]),borderWidth:2,borderRadius:10}],null);
}
function renderHeatmap(){ const el=document.getElementById('heatmap'); if(!el) return; const days=['Seg','Ter','Qua','Qui','Sex'], buckets=['00-07','08-11','12-15','16-19','20-23']; const matrix=Array.from({length:buckets.length},()=>Array(days.length).fill(0)); state.rows.forEach(r=>{ const d=parseDate(r); if(!d) return; const jsDay=d.getDay(); if(jsDay===0||jsDay===6) return; const dayIdx=jsDay-1; const h=extractHour(r); const b=h==null?1:h<8?0:h<12?1:h<16?2:h<20?3:4; matrix[b][dayIdx]++; }); const max=Math.max(1,...matrix.flat()); el.innerHTML='<span></span>'+days.map(d=>`<b>${d}</b>`).join('')+buckets.map((b,i)=>`<b>${b}</b>`+matrix[i].map(v=>`<div class="heatmap-cell heat-l${Math.ceil(v/max*4)}">${v||''}</div>`).join('')).join(''); }
function renderDrilldown(){ const el=document.getElementById('drilldown'); if(!el) return; const rows=[...state.rows].sort((a,b)=>parseDowntime(val(b,'downtime'))-parseDowntime(val(a,'downtime'))).slice(0,6); el.innerHTML=rows.map(r=>`<div class="drill-row"><small>${html(val(r,'date')||'-')}</small><b>${html(val(r,'service')||'-')}</b><span>${html(val(r,'impact')||'-')}</span><strong>${formatMinutes(parseDowntime(val(r,'downtime')))}</strong></div>`).join('')||'<p>Nenhum incidente no filtro atual.</p>'; }
function renderRanking(){ const list=document.getElementById('rankingList'),rows=groupTime(state.rows,'service',10),max=rows[0]?.[1]||1; list.innerHTML=rows.map((r,i)=>`<div class="rank-row" style="--w:${Math.max(4,r[1]/max*100)}%"><span>${String(i+1).padStart(2,'0')}</span><b>${html(r[0])}</b><em>${formatMinutes(r[1])}</em></div>`).join('')||'<p>Nenhum dado para exibir.</p>'; }
function badge(v){ const k=keyNorm(v), cls=k.includes('resol')?'ok':k.includes('andamento')?'info':(k.includes('cr')||k.includes('alto'))?'bad':k.includes('medio')?'warn':'info'; return `<span class="badge ${cls}">${html(v||'-')}</span>`; }
function renderTable(){ const table=document.getElementById('incidentTable'),cols=Object.keys(state.rawRows[0]||{}).slice(0,12),totalPages=Math.max(1,Math.ceil(state.rows.length/state.pageSize)); state.page=Math.min(state.page,totalPages); const pageRows=state.rows.slice((state.page-1)*state.pageSize,state.page*state.pageSize); table.querySelector('thead').innerHTML=`<tr>${cols.map(c=>`<th>${html(c)}</th>`).join('')}</tr>`; table.querySelector('tbody').innerHTML=pageRows.map(r=>`<tr>${cols.map(c=>{const v=norm(r[c]);return keyNorm(c).includes('impacto')||keyNorm(c).includes('situacao')||keyNorm(c).includes('status')?`<td>${badge(v)}</td>`:`<td>${html(v||'-')}</td>`}).join('')}</tr>`).join(''); setText('pageInfo',`${state.page}/${totalPages}`); setText('tableInfo',`${state.rows.length} registro(s) exibido(s) de ${state.rawRows.length}`); }
function renderAll(){ renderKpis(); renderCharts(); renderHeatmap(); renderDrilldown(); renderRanking(); renderTable(); updateTime(); }

function saveCache(){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({rows:state.rawRows,savedAt:new Date().toISOString()})); }catch(e){ console.warn('Cache não salvo', e); } }
function loadCache(){ try{ const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null'); if(cached?.rows?.length){ state.cacheLoaded=true; loadRows(cached.rows,false); toast(`Última planilha restaurada do cache (${cached.rows.length} registros)`); return true; } }catch(e){ console.warn('Cache inválido', e); } return false; }
function loadRows(rows, persist=true){ state.rawRows=rows.filter(r=>Object.values(r).some(v=>norm(v))); state.columns=detectColumns(state.rawRows); populateFilters(); applyFilters(); if(persist) saveCache(); toast(`${state.rawRows.length} registros carregados`); }
async function readFile(file){ try{ const data=await file.arrayBuffer(); let rows; if(file.name.toLowerCase().endsWith('.csv')){ const txt=new TextDecoder('utf-8').decode(data),wb=XLSX.read(txt,{type:'string'}); rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}); } else { const wb=XLSX.read(data,{type:'array',cellDates:false}); rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}); } loadRows(rows,true); toast('Planilha atualizada e salva em cache'); }catch(e){ console.error(e); toast('Erro ao ler arquivo. Verifique a planilha.'); } }
function exportCsv(){ const cols=Object.keys(state.rawRows[0]||{}),csv=[cols.join(';')].concat(state.rows.map(r=>cols.map(c=>`"${String(r[c]??'').replace(/"/g,'""')}"`).join(';'))).join('\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='incidentes-filtrados-hrjr.csv'; a.click(); }
async function logoAsPng(){ try{ const img=new Image(); img.crossOrigin='anonymous'; img.src='assets/logo-hrjr.svg'; await new Promise((res,rej)=>{img.onload=res;img.onerror=rej}); const c=document.createElement('canvas'); c.width=900; c.height=180; c.getContext('2d').drawImage(img,0,0,900,180); return c.toDataURL('image/png'); }catch(e){ return null; } }
async function exportDashboardPdf(){
  try{
    toast('Gerando relatório executivo em PDF...');
    const { jsPDF }=window.jspdf, pdf=new jsPDF('p','mm','a4'), pageW=pdf.internal.pageSize.getWidth(), pageH=pdf.internal.pageSize.getHeight(); let y=12; const margin=12;
    const logo=await logoAsPng(); if(logo) pdf.addImage(logo,'PNG',margin,y,68,14); else {pdf.setFontSize(18); pdf.text('HRJR',margin,y+8);} pdf.setFontSize(16); pdf.setFont(undefined,'bold'); pdf.text('Relatório Executivo de Incidentes de TI',margin,y+28); pdf.setFontSize(9); pdf.setFont(undefined,'normal'); pdf.text(`Emissão: ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date())}`,margin,y+35); pdf.text(`Período/Filtros: ${getFilterSummary()}`,margin,y+41,{maxWidth:180}); y=62;
    const kpis=[['Total',document.getElementById('kpiTotal').textContent],['Indisponibilidade',document.getElementById('kpiHours').textContent],['MTTR',document.getElementById('kpiMttr').textContent],['Disponibilidade',document.getElementById('kpiAvailability').textContent],['Críticos',document.getElementById('kpiCritical').textContent],['Mais afetado',document.getElementById('kpiTopService').textContent]];
    const boxW=(pageW-margin*2)/3-3; kpis.forEach((k,i)=>{ const x=margin+(i%3)*(boxW+4), yy=y+Math.floor(i/3)*22; pdf.setFillColor(244,248,251); pdf.roundedRect(x,yy,boxW,18,3,3,'F'); pdf.setFontSize(8); pdf.text(k[0],x+3,yy+6); pdf.setFontSize(13); pdf.setFont(undefined,'bold'); pdf.text(String(k[1]).slice(0,22),x+3,yy+14); pdf.setFont(undefined,'normal'); }); y+=50;
    const chartIds=['chartYearCompare','chartTrend12','chartService','chartImpact','chartSlaService','chartAvgDowntime']; for(const id of chartIds){ const canvas=document.getElementById(id); if(!canvas) continue; if(y>210){ addFooter(pdf); pdf.addPage(); y=15; } const title=canvas.closest('.panel')?.querySelector('h2')?.textContent||id; pdf.setFontSize(11); pdf.setFont(undefined,'bold'); pdf.text(title,margin,y); y+=4; pdf.addImage(canvas.toDataURL('image/png',1),'PNG',margin,y,pageW-margin*2,55); y+=63; }
    if(y>205){ addFooter(pdf); pdf.addPage(); y=15; } pdf.setFontSize(12); pdf.setFont(undefined,'bold'); pdf.text('Top 10 maiores indisponibilidades',margin,y); y+=8; groupTime(state.rows,'service',10).forEach((r,i)=>{ pdf.setFontSize(9); pdf.setFont(undefined,'normal'); pdf.text(`${String(i+1).padStart(2,'0')}  ${r[0]}  —  ${formatMinutes(r[1])}`,margin,y); y+=6; });
    addFooter(pdf); const pages=pdf.internal.getNumberOfPages(); for(let i=1;i<=pages;i++){ pdf.setPage(i); pdf.setFontSize(8); pdf.text(`Página ${i} de ${pages}`,pageW-32,pageH-8); }
    pdf.save(`relatorio-executivo-hrjr-${new Date().toISOString().slice(0,10)}.pdf`); toast('PDF executivo gerado com sucesso');
  }catch(error){ console.error(error); toast('Erro ao gerar PDF. Tente novamente.'); }
}
function addFooter(pdf){ const pageW=pdf.internal.pageSize.getWidth(), pageH=pdf.internal.pageSize.getHeight(); pdf.setDrawColor(0,87,168); pdf.line(12,pageH-14,pageW-12,pageH-14); pdf.setFontSize(8); pdf.text('HRJR - Hospital Regional Jorge Rossmann | Dashboard de Gestão de Incidentes de TI',12,pageH-8); }
function toggleFullscreen(){ const root=document.documentElement; document.body.classList.toggle('tv-mode'); if(!document.fullscreenElement&&root.requestFullscreen) root.requestFullscreen().catch(()=>{}); else if(document.exitFullscreen) document.exitFullscreen().catch(()=>{}); renderAll(); }

document.addEventListener('DOMContentLoaded',()=>{
  injectExtraStyles();
  if(localStorage.getItem('hrjr-theme')==='dark') document.body.classList.add('dark');
  document.getElementById('btnTheme').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('hrjr-theme',document.body.classList.contains('dark')?'dark':'light')};
  document.getElementById('collapseSidebar').onclick=()=>document.body.classList.toggle('collapsed');
  document.getElementById('btnRefresh').onclick=()=>{renderAll();toast('Dashboard atualizado')};
  document.getElementById('btnClear').onclick=()=>{state.filters={years:[],month:'',service:'',category:'',type:'',owner:'',impact:'',status:'',search:''};document.getElementById('globalSearch').value='';syncControls();applyFilters();toast('Filtros limpos')};
  document.getElementById('btnCsv').onclick=exportCsv; document.getElementById('btnPdf').onclick=exportDashboardPdf; document.getElementById('btnFullscreen').onclick=toggleFullscreen;
  document.getElementById('fileInput').onchange=e=>e.target.files[0]&&readFile(e.target.files[0]);
  const drop=document.getElementById('dropZone'); ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover')})); ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover')})); drop.addEventListener('drop',e=>e.dataTransfer.files[0]&&readFile(e.dataTransfer.files[0]));
  document.getElementById('filterYear').addEventListener('change',e=>{state.filters.years=[...e.target.selectedOptions].map(o=>o.value);applyFilters()});
  for(const [id,k] of Object.entries({filterMonth:'month',filterService:'service',filterCategory:'category',filterType:'type',filterOwner:'owner',filterImpact:'impact',filterStatus:'status'})) document.getElementById(id).addEventListener('change',e=>{state.filters[k]=e.target.value;applyFilters()});
  document.getElementById('globalSearch').addEventListener('input',e=>{state.filters.search=e.target.value;applyFilters()});
  document.getElementById('prevPage').onclick=()=>{state.page=Math.max(1,state.page-1);renderTable()}; document.getElementById('nextPage').onclick=()=>{const totalPages=Math.max(1,Math.ceil(state.rows.length/state.pageSize));state.page=Math.min(totalPages,state.page+1);renderTable()};
  if(!loadCache()) loadRows(sampleRows,false);
});