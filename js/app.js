const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_ALIASES = {jan:'Janeiro',janeiro:'Janeiro',fev:'Fevereiro',fevereiro:'Fevereiro',mar:'Março',marco:'Março','março':'Março',abr:'Abril',abril:'Abril',mai:'Maio',maio:'Maio',jun:'Junho',junho:'Junho',jul:'Julho',julho:'Julho',ago:'Agosto',agosto:'Agosto',set:'Setembro',setembro:'Setembro',out:'Outubro',outubro:'Outubro',nov:'Novembro',novembro:'Novembro',dez:'Dezembro',dezembro:'Dezembro'};

const state = {
  rawRows: [], rows: [], charts: {}, page: 1, pageSize: 12, columns: {}, warnings: [],
  filters: { years: [], month: '', service: '', category: '', type: '', owner: '', impact: '', status: '', search: '' }
};

const aliases = {
  date: ['data','dt','data ocorrencia','data ocorrência','data do incidente','data abertura'],
  year: ['ano','year'],
  month: ['mes','mês','month','mes ocorrencia','mês ocorrência'],
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
  {Data:'02/07/2026',Ano:'2026',Mês:'Julho','Serviço Principal':'Internet',Categoria:'Rede',Tipo:'Indisponibilidade',Responsável:'Operadora',Impacto:'Crítico',Situação:'Resolvido','Causa Raiz':'Falha operadora','Tempo de Indisponibilidade':'02:15'},
  {Data:'01/07/2026',Ano:'2026',Mês:'Julho','Serviço Principal':'MV',Categoria:'Sistema',Tipo:'Lentidão',Responsável:'Fornecedor',Impacto:'Alto',Situação:'Resolvido','Causa Raiz':'Falha sistêmica','Tempo de Indisponibilidade':'01:05'},
  {Data:'12/06/2026',Ano:'2026',Mês:'Junho','Serviço Principal':'PACS',Categoria:'Infraestrutura',Tipo:'Erro',Responsável:'TI',Impacto:'Médio',Situação:'Resolvido','Causa Raiz':'Servidor','Tempo de Indisponibilidade':'00:35'},
  {Data:'20/07/2025',Ano:'2025',Mês:'Julho','Serviço Principal':'Internet',Categoria:'Rede',Tipo:'Indisponibilidade',Responsável:'Operadora',Impacto:'Alto',Situação:'Resolvido','Causa Raiz':'Link externo','Tempo de Indisponibilidade':'03:40'},
  {Data:'11/05/2025',Ano:'2025',Mês:'Maio','Serviço Principal':'MV',Categoria:'Sistema',Tipo:'Erro',Responsável:'Fornecedor',Impacto:'Crítico',Situação:'Resolvido','Causa Raiz':'Banco de dados','Tempo de Indisponibilidade':'04:10'}
];

function norm(v){ return String(v ?? '').trim(); }
function keyNorm(v){ return norm(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '); }
function html(v){ return String(v ?? '').replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s])); }
function setText(id, value){ const el = document.getElementById(id); if(el) el.textContent = value; }

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

function excelDateToJSDate(serial){
  if(typeof serial !== 'number') return null;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}
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
function extractYear(row){
  const y = val(row, 'year');
  const yMatch = y.match(/(19\d{2}|20\d{2}|21\d{2})/);
  if(yMatch) return yMatch[1];
  const d = parseDate(row);
  return d ? String(d.getFullYear()) : '';
}
function extractMonth(row){
  const m = val(row, 'month');
  if(m){ const k = keyNorm(m); if(MONTH_ALIASES[k]) return MONTH_ALIASES[k]; const n = parseInt(k, 10); if(n >= 1 && n <= 12) return MONTHS[n - 1]; }
  const d = parseDate(row);
  return d ? MONTHS[d.getMonth()] : '';
}
function parseDowntime(value){
  if(value == null || value === '') return 0;
  if(typeof value === 'number') return value < 1 ? Math.round(value * 24 * 60) : Math.round(value * 60);
  const s = String(value).trim().toLowerCase();
  const hm = s.match(/(\d{1,3})[:h](\d{1,2})?/);
  if(hm) return (+hm[1]) * 60 + (+(hm[2] || 0));
  const min = s.match(/(\d+)\s*m/);
  const hour = s.match(/(\d+(?:[.,]\d+)?)\s*h/);
  if(hour) return Math.round(parseFloat(hour[1].replace(',','.')) * 60) + (min ? +min[1] : 0);
  const num = parseFloat(s.replace(',','.'));
  return isNaN(num) ? 0 : Math.round(num * 60);
}
function formatMinutes(min){
  min = Math.round(min || 0);
  const h = Math.floor(min / 60), m = min % 60;
  if(h && m) return `${h}h ${String(m).padStart(2,'0')}m`;
  if(h) return `${h}h`;
  return `${m}m`;
}
function toast(msg){
  const area = document.getElementById('toastArea');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  area.appendChild(el);
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 250); }, 3000);
}
function updateTime(){ setText('lastUpdate', new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date())); }

function fillSelect(id, values, selectedValue = ''){
  const el = document.getElementById(id);
  const unique = [...new Set(values.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true}));
  if(el.multiple){
    el.innerHTML = unique.map(v => `<option value="${html(v)}">${html(v)}</option>`).join('');
    [...el.options].forEach(o => o.selected = state.filters.years.includes(o.value));
  } else {
    el.innerHTML = '<option value="">Todos</option>' + unique.map(v => `<option value="${html(v)}">${html(v)}</option>`).join('');
    el.value = unique.includes(selectedValue) ? selectedValue : '';
  }
}
function populateFilters(){
  const rows = state.rawRows;
  fillSelect('filterYear', rows.map(extractYear));
  fillSelect('filterMonth', MONTHS.filter(m => rows.some(r => extractMonth(r) === m)), state.filters.month);
  fillSelect('filterService', rows.map(r => val(r,'service')), state.filters.service);
  fillSelect('filterCategory', rows.map(r => val(r,'category')), state.filters.category);
  fillSelect('filterType', rows.map(r => val(r,'type')), state.filters.type);
  fillSelect('filterOwner', rows.map(r => val(r,'owner')), state.filters.owner);
  fillSelect('filterImpact', rows.map(r => val(r,'impact')), state.filters.impact);
  fillSelect('filterStatus', rows.map(r => val(r,'status')), state.filters.status);
  renderWarnings();
}
function renderWarnings(){
  const warning = document.getElementById('warnings');
  if(!warning) return;
  warning.innerHTML = state.warnings.length ? `<div class="warning-box">Atenção: ${state.warnings.map(html).join(' | ')}</div>` : '';
}
function syncControls(){
  document.getElementById('filterMonth').value = state.filters.month;
  document.getElementById('filterService').value = state.filters.service;
  document.getElementById('filterCategory').value = state.filters.category;
  document.getElementById('filterType').value = state.filters.type;
  document.getElementById('filterOwner').value = state.filters.owner;
  document.getElementById('filterImpact').value = state.filters.impact;
  document.getElementById('filterStatus').value = state.filters.status;
  [...document.getElementById('filterYear').options].forEach(o => o.selected = state.filters.years.includes(o.value));
}
function applyFilters(){
  const q = keyNorm(state.filters.search);
  state.rows = state.rawRows.filter(r => {
    if(state.filters.years.length && !state.filters.years.includes(extractYear(r))) return false;
    if(state.filters.month && extractMonth(r) !== state.filters.month) return false;
    for(const k of ['service','category','type','owner','impact','status']) if(state.filters[k] && val(r,k) !== state.filters[k]) return false;
    if(q && !keyNorm(Object.values(r).join(' ')).includes(q)) return false;
    return true;
  });
  state.page = 1;
  renderAll();
}
function groupCount(rows, field, limit=12){
  const map = new Map();
  rows.forEach(r => { const k = field === 'month' ? extractMonth(r) : field === 'year' ? extractYear(r) : (val(r,field) || 'Não informado'); map.set(k, (map.get(k) || 0) + 1); });
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit);
}
function groupTime(rows, field, limit=10){
  const map = new Map();
  rows.forEach(r => { const k = val(r, field) || 'Não informado'; map.set(k, (map.get(k) || 0) + parseDowntime(val(r,'downtime'))); });
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit);
}
function renderKpis(){
  const rows = state.rows;
  const total = rows.length;
  const totalMin = rows.reduce((s,r) => s + parseDowntime(val(r,'downtime')), 0);
  const critical = rows.filter(r => ['critico','crítico','alto'].includes(keyNorm(val(r,'impact')))).length;
  const svc = groupCount(rows,'service',1)[0]?.[0] || '-';
  const availability = Math.max(0, 100 - (totalMin / (30*24*60))*100);
  setText('kpiTotal', total.toLocaleString('pt-BR'));
  setText('kpiHours', formatMinutes(totalMin));
  setText('kpiMttr', formatMinutes(total ? totalMin / total : 0));
  setText('kpiAvailability', availability.toLocaleString('pt-BR',{maximumFractionDigits:2}) + '%');
  setText('kpiCritical', critical.toLocaleString('pt-BR'));
  setText('kpiTopService', svc);
}
function createChart(id, type, labels, datasets, onClickField){
  const ctx = document.getElementById(id);
  if(state.charts[id]) state.charts[id].destroy();
  state.charts[id] = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: datasets.length > 1 || type === 'doughnut' || type === 'pie' } },
      scales: type === 'doughnut' || type === 'pie' ? {} : { y: { beginAtZero:true, grid:{color:'rgba(120,140,160,.16)'} }, x: { grid:{display:false} } },
      onClick: (_, els) => {
        if(!els.length || !onClickField) return;
        const v = labels[els[0].index];
        state.filters[onClickField] = state.filters[onClickField] === v ? '' : v;
        syncControls();
        applyFilters();
        toast(`Filtro aplicado: ${v}`);
      }
    }
  });
}
function renderCharts(){
  const years = [...new Set(state.rows.map(extractYear).filter(Boolean))].sort();
  const datasets = years.map(y => ({ label:y, data:MONTHS.map(m => state.rows.filter(r => extractYear(r) === y && extractMonth(r) === m).length), borderWidth:2, tension:.35 }));
  createChart('chartYearCompare','line',MONTHS,datasets.length ? datasets : [{label:'Sem dados',data:MONTHS.map(()=>0),borderWidth:2}],null);
  const impact = groupCount(state.rows,'impact',8); createChart('chartImpact','doughnut',impact.map(x=>x[0]),[{label:'Impacto',data:impact.map(x=>x[1])}],'impact');
  const status = groupCount(state.rows,'status',8); createChart('chartStatus','pie',status.map(x=>x[0]),[{label:'Situação',data:status.map(x=>x[1])}],'status');
  const mappings = [['chartService','service','Serviços'],['chartCategory','category','Categorias'],['chartOwner','owner','Responsáveis'],['chartCause','cause','Causas']];
  mappings.forEach(([id,field,label]) => { const g = groupCount(state.rows,field,10); createChart(id,'bar',g.map(x=>x[0]),[{label,data:g.map(x=>x[1]),borderWidth:2,borderRadius:10}],field === 'cause' ? null : field); });
}
function renderRanking(){
  const list = document.getElementById('rankingList');
  const rows = groupTime(state.rows,'service',10);
  const max = rows[0]?.[1] || 1;
  list.innerHTML = rows.map((r,i) => `<div class="rank-row" style="--w:${Math.max(4,r[1]/max*100)}%"><span>${String(i+1).padStart(2,'0')}</span><b>${html(r[0])}</b><em>${formatMinutes(r[1])}</em></div>`).join('') || '<p>Nenhum dado para exibir.</p>';
}
function badge(v){ const k = keyNorm(v), cls = k.includes('resol') ? 'ok' : k.includes('andamento') ? 'info' : (k.includes('cr') || k.includes('alto')) ? 'bad' : k.includes('medio') ? 'warn' : 'info'; return `<span class="badge ${cls}">${html(v || '-')}</span>`; }
function renderTable(){
  const table = document.getElementById('incidentTable');
  const cols = Object.keys(state.rawRows[0] || {}).slice(0,12);
  const totalPages = Math.max(1, Math.ceil(state.rows.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const pageRows = state.rows.slice((state.page-1)*state.pageSize, state.page*state.pageSize);
  table.querySelector('thead').innerHTML = `<tr>${cols.map(c => `<th>${html(c)}</th>`).join('')}</tr>`;
  table.querySelector('tbody').innerHTML = pageRows.map(r => `<tr>${cols.map(c => { const v = norm(r[c]); return keyNorm(c).includes('impacto') || keyNorm(c).includes('situacao') || keyNorm(c).includes('status') ? `<td>${badge(v)}</td>` : `<td>${html(v || '-')}</td>`; }).join('')}</tr>`).join('');
  setText('pageInfo', `${state.page}/${totalPages}`);
  setText('tableInfo', `${state.rows.length} registro(s) exibido(s) de ${state.rawRows.length}`);
}
function renderAll(){ renderKpis(); renderCharts(); renderRanking(); renderTable(); updateTime(); }
function loadRows(rows){
  state.rawRows = rows.filter(r => Object.values(r).some(v => norm(v)));
  state.columns = detectColumns(state.rawRows);
  populateFilters();
  applyFilters();
  toast(`${state.rawRows.length} registros carregados`);
}
async function readFile(file){
  try{
    const data = await file.arrayBuffer();
    let rows;
    if(file.name.toLowerCase().endsWith('.csv')){
      const txt = new TextDecoder('utf-8').decode(data);
      const wb = XLSX.read(txt,{type:'string'});
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
    } else {
      const wb = XLSX.read(data,{type:'array',cellDates:false});
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
    }
    loadRows(rows);
  } catch(e){ console.error(e); toast('Erro ao ler arquivo. Verifique a planilha.'); }
}
function exportCsv(){
  const cols = Object.keys(state.rawRows[0] || {});
  const csv = [cols.join(';')].concat(state.rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g,'""')}"`).join(';'))).join('\n');
  const blob = new Blob(['\ufeff' + csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'incidentes-filtrados-hrjr.csv'; a.click();
}
async function exportDashboardPdf(){
  try{
    toast('Gerando PDF do dashboard...');
    await new Promise(resolve => setTimeout(resolve, 250));
    const element = document.getElementById('dashboardContent');
    const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg') || '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgHeight = canvas.height * pageWidth / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;
    while(heightLeft > 0){
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    const stamp = new Date().toISOString().slice(0,10);
    pdf.save(`dashboard-hrjr-incidentes-${stamp}.pdf`);
    toast('PDF gerado com sucesso');
  }catch(error){
    console.error(error);
    toast('Erro ao gerar PDF. Tente novamente.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if(localStorage.getItem('hrjr-theme') === 'dark') document.body.classList.add('dark');
  document.getElementById('btnTheme').onclick = () => { document.body.classList.toggle('dark'); localStorage.setItem('hrjr-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); };
  document.getElementById('collapseSidebar').onclick = () => document.body.classList.toggle('collapsed');
  document.getElementById('btnRefresh').onclick = () => { renderAll(); toast('Dashboard atualizado'); };
  document.getElementById('btnClear').onclick = () => { state.filters = { years: [], month:'', service:'', category:'', type:'', owner:'', impact:'', status:'', search:'' }; document.getElementById('globalSearch').value = ''; syncControls(); applyFilters(); toast('Filtros limpos'); };
  document.getElementById('btnCsv').onclick = exportCsv;
  const pdfButton = document.getElementById('btnPdf');
  if(pdfButton) pdfButton.onclick = exportDashboardPdf;
  document.getElementById('fileInput').onchange = e => e.target.files[0] && readFile(e.target.files[0]);
  const drop = document.getElementById('dropZone');
  ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('dragover'); }));
  drop.addEventListener('drop', e => e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]));
  document.getElementById('filterYear').addEventListener('change', e => { state.filters.years = [...e.target.selectedOptions].map(o => o.value); applyFilters(); });
  for(const [id,k] of Object.entries({filterMonth:'month',filterService:'service',filterCategory:'category',filterType:'type',filterOwner:'owner',filterImpact:'impact',filterStatus:'status'})) document.getElementById(id).addEventListener('change', e => { state.filters[k] = e.target.value; applyFilters(); });
  document.getElementById('globalSearch').addEventListener('input', e => { state.filters.search = e.target.value; applyFilters(); });
  document.getElementById('prevPage').onclick = () => { state.page = Math.max(1,state.page-1); renderTable(); };
  document.getElementById('nextPage').onclick = () => { const totalPages = Math.max(1, Math.ceil(state.rows.length / state.pageSize)); state.page = Math.min(totalPages,state.page+1); renderTable(); };
  loadRows(sampleRows);
});