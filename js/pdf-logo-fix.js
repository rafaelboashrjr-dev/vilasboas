// Ajustes de logo e PDF executivo
// Corrige corte do logo e evita gráficos esticados no PDF.
(function(){
  function injectLogoAndPdfFixStyles(){
    if(document.getElementById('hrjr-logo-pdf-fix-style')) return;
    const style = document.createElement('style');
    style.id = 'hrjr-logo-pdf-fix-style';
    style.textContent = `
      .brand img{
        width:100%;
        height:auto!important;
        max-height:96px;
        object-fit:contain!important;
        object-position:center!important;
        display:block;
        padding:10px 12px!important;
      }
      body.collapsed .brand img{display:none!important;}
      @media(max-width:1050px){.brand img{max-width:420px;}}
    `;
    document.head.appendChild(style);
  }

  async function logoAsPngFixed(){
    try{
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = 'assets/logo-hrjr.svg?v=' + Date.now();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    }catch(error){
      console.warn('Não foi possível converter o logo para PNG.', error);
      return null;
    }
  }

  function addFooterFixed(pdf){
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.setDrawColor(0, 87, 168);
    pdf.line(12, pageH - 14, pageW - 12, pageH - 14);
    pdf.setFontSize(8);
    pdf.setTextColor(80, 90, 110);
    pdf.text('HRJR - Hospital Regional Jorge Rossmann | Dashboard de Gestão de Incidentes de TI', 12, pageH - 8);
  }

  function chartTitle(canvas){
    return canvas.closest('.panel')?.querySelector('h2')?.textContent || 'Gráfico';
  }

  function addChartKeepingRatio(pdf, canvas, title, x, y, maxW, maxH){
    const canvasRatio = canvas.width / canvas.height;
    let w = maxW;
    let h = w / canvasRatio;

    if(h > maxH){
      h = maxH;
      w = h * canvasRatio;
    }

    pdf.setFontSize(11);
    pdf.setTextColor(20, 32, 51);
    pdf.setFont(undefined, 'bold');
    pdf.text(title, x, y);
    y += 5;

    const centeredX = x + (maxW - w) / 2;
    pdf.addImage(canvas.toDataURL('image/png', 1), 'PNG', centeredX, y, w, h);
    return y + h + 10;
  }

  async function exportDashboardPdfFixed(){
    try{
      if(typeof toast === 'function') toast('Gerando PDF executivo otimizado...');

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 12;
      let y = 10;

      const logo = await logoAsPngFixed();
      if(logo){
        pdf.addImage(logo, 'PNG', margin, y, 92, 18.4);
      }else{
        pdf.setFontSize(18);
        pdf.setFont(undefined, 'bold');
        pdf.text('HRJR', margin, y + 10);
      }

      y += 30;
      pdf.setFontSize(16);
      pdf.setTextColor(20, 32, 51);
      pdf.setFont(undefined, 'bold');
      pdf.text('Relatório Executivo de Incidentes de TI', margin, y);

      y += 7;
      pdf.setFontSize(9);
      pdf.setFont(undefined, 'normal');
      const emittedAt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
      pdf.text('Emissão: ' + emittedAt, margin, y);
      y += 6;
      const filters = typeof getFilterSummary === 'function' ? getFilterSummary() : 'Todos os dados carregados';
      pdf.text('Período/Filtros: ' + filters, margin, y, { maxWidth: pageW - margin * 2 });

      y += 12;
      const kpis = [
        ['Total', document.getElementById('kpiTotal')?.textContent || '-'],
        ['Indisponibilidade', document.getElementById('kpiHours')?.textContent || '-'],
        ['MTTR', document.getElementById('kpiMttr')?.textContent || '-'],
        ['Disponibilidade', document.getElementById('kpiAvailability')?.textContent || '-'],
        ['Críticos', document.getElementById('kpiCritical')?.textContent || '-'],
        ['Mais afetado', document.getElementById('kpiTopService')?.textContent || '-']
      ];

      const boxGap = 4;
      const boxW = (pageW - margin * 2 - boxGap * 2) / 3;
      kpis.forEach((kpi, index) => {
        const x = margin + (index % 3) * (boxW + boxGap);
        const yy = y + Math.floor(index / 3) * 21;
        pdf.setFillColor(244, 248, 251);
        pdf.roundedRect(x, yy, boxW, 17, 3, 3, 'F');
        pdf.setFontSize(8);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100, 112, 130);
        pdf.text(kpi[0], x + 3, yy + 6);
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(20, 32, 51);
        pdf.text(String(kpi[1]).slice(0, 22), x + 3, yy + 13);
      });

      y += 50;

      const chartIds = ['chartYearCompare', 'chartTrend12', 'chartService', 'chartImpact', 'chartSlaService', 'chartAvgDowntime'];
      const chartMaxH = 58;
      for(const id of chartIds){
        const canvas = document.getElementById(id);
        if(!canvas) continue;
        if(y + chartMaxH + 18 > pageH - 18){
          addFooterFixed(pdf);
          pdf.addPage();
          y = 16;
        }
        y = addChartKeepingRatio(pdf, canvas, chartTitle(canvas), margin, y, pageW - margin * 2, chartMaxH);
      }

      if(y > pageH - 72){
        addFooterFixed(pdf);
        pdf.addPage();
        y = 16;
      }

      pdf.setFontSize(12);
      pdf.setTextColor(20, 32, 51);
      pdf.setFont(undefined, 'bold');
      pdf.text('Top 10 maiores indisponibilidades', margin, y);
      y += 8;

      const rankingRows = typeof groupTime === 'function' ? groupTime(state.rows, 'service', 10) : [];
      rankingRows.forEach((row, index) => {
        if(y > pageH - 22){
          addFooterFixed(pdf);
          pdf.addPage();
          y = 16;
        }
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(20, 32, 51);
        const line = `${String(index + 1).padStart(2, '0')}  ${row[0]}  —  ${typeof formatMinutes === 'function' ? formatMinutes(row[1]) : row[1]}`;
        pdf.text(line, margin, y, { maxWidth: pageW - margin * 2 });
        y += 6;
      });

      addFooterFixed(pdf);
      const pages = pdf.internal.getNumberOfPages();
      for(let i = 1; i <= pages; i++){
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(80, 90, 110);
        pdf.text(`Página ${i} de ${pages}`, pageW - 34, pageH - 8);
      }

      pdf.save(`relatorio-executivo-hrjr-${new Date().toISOString().slice(0,10)}.pdf`);
      if(typeof toast === 'function') toast('PDF executivo gerado com proporção corrigida');
    }catch(error){
      console.error(error);
      if(typeof toast === 'function') toast('Erro ao gerar PDF. Tente novamente.');
    }
  }

  function applyPdfPatch(){
    injectLogoAndPdfFixStyles();
    window.logoAsPng = logoAsPngFixed;
    window.exportDashboardPdf = exportDashboardPdfFixed;
    const btn = document.getElementById('btnPdf');
    if(btn) btn.onclick = exportDashboardPdfFixed;
  }

  document.addEventListener('DOMContentLoaded', applyPdfPatch);
  window.addEventListener('load', applyPdfPatch);
})();
