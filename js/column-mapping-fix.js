// Correção de leitura da planilha HRJR
// Este módulo melhora a detecção da linha de cabeçalho e dos nomes reais das colunas.
(function(){
  const FIELD_LABELS = {
    date: 'Data do incidente',
    service: 'Serviço/Incidente',
    downtime: 'Tempo de indisponibilidade'
  };

  const EXTRA_ALIASES = {
    date: [
      'data', 'dt', 'data ocorrencia', 'data ocorrência', 'data do incidente',
      'data abertura', 'data da abertura', 'data inicio', 'data início',
      'data inicial', 'data indisponibilidade', 'data queda', 'data da queda',
      'data evento', 'data do evento', 'data registro', 'data do registro',
      'data chamado', 'abertura', 'inicio incidente', 'início incidente'
    ],
    year: ['ano', 'year', 'exercicio', 'exercício'],
    month: ['mes', 'mês', 'month', 'competencia', 'competência', 'periodo', 'período'],
    timeStart: [
      'hora inicio', 'hora início', 'hora de inicio', 'hora de início',
      'inicio', 'início', 'hora', 'horario', 'horário', 'hora abertura',
      'hora da abertura', 'hora queda', 'hora da queda'
    ],
    service: [
      'servico principal', 'serviço principal', 'servico', 'serviço',
      'sistema', 'recurso', 'serviço afetado', 'servico afetado',
      'servicos afetados', 'serviços afetados', 'aplicacao', 'aplicação',
      'sistema afetado', 'recurso afetado', 'item afetado', 'incidente',
      'evento', 'descricao', 'descrição', 'titulo', 'título'
    ],
    category: ['categoria', 'macroprocesso', 'grupo', 'classificacao', 'classificação', 'area', 'área', 'natureza'],
    type: ['tipo', 'tipo incidente', 'tipo de incidente', 'tipo ocorrencia', 'tipo ocorrência', 'ocorrencia', 'ocorrência', 'classe'],
    owner: ['responsavel', 'responsável', 'fornecedor', 'equipe', 'acionado', 'tratativa', 'solucionador', 'responsavel ti', 'responsável ti'],
    impact: ['impacto', 'criticidade', 'prioridade', 'severidade', 'nivel', 'nível', 'grau'],
    status: ['situacao', 'situação', 'status', 'estado', 'andamento', 'resolucao', 'resolução'],
    cause: ['causa raiz', 'causa', 'origem', 'motivo', 'problema', 'causa provavel', 'causa provável', 'observacao', 'observação'],
    downtime: [
      'tempo de indisponibilidade', 'tempo indisponibilidade', 'indisponibilidade',
      'tempo parado', 'duracao', 'duração', 'tempo', 'tempo total',
      'tempo total indisponibilidade', 'periodo de indisponibilidade',
      'período de indisponibilidade', 'minutos', 'horas', 'sla',
      'tempo resolucao', 'tempo resolução', 'tempo de resolucao',
      'tempo de resolução', 'tempo atendimento', 'tempo de atendimento'
    ]
  };

  function normalizeText(value){
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function mergeAliases(){
    if(typeof aliases === 'undefined') return;
    Object.entries(EXTRA_ALIASES).forEach(([field, values]) => {
      aliases[field] = Array.from(new Set([...(aliases[field] || []), ...values]));
    });
  }

  function headerScore(row){
    const allAliases = Object.values(EXTRA_ALIASES).flat().map(normalizeText);
    return row.reduce((score, cell) => {
      const value = normalizeText(cell);
      if(!value) return score;
      let local = 0;
      allAliases.forEach(alias => {
        if(value === alias) local += 5;
        else if(value.includes(alias) || alias.includes(value)) local += 2;
      });
      return score + local;
    }, 0);
  }

  window.HRJRSheetParser = {
    sheetToRows(sheet){
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
      let headerIndex = 0;
      let bestScore = -1;
      matrix.slice(0, 40).forEach((row, index) => {
        const score = headerScore(row);
        if(score > bestScore){
          bestScore = score;
          headerIndex = index;
        }
      });

      let headers = (matrix[headerIndex] || []).map((header, index) => String(header || '').trim() || `Coluna ${index + 1}`);
      headers = headers.map((header, index) => headers.indexOf(header) === index ? header : `${header} ${index + 1}`);

      return matrix
        .slice(headerIndex + 1)
        .filter(row => row.some(cell => String(cell || '').trim()))
        .map(row => {
          const item = {};
          headers.forEach((header, index) => item[header] = row[index] || '');
          return item;
        });
    },

    patch(){
      mergeAliases();

      if(typeof detectColumns === 'function'){
        window.detectColumns = function(rows){
          const columns = Object.keys(rows[0] || {});
          const found = {};

          Object.entries(aliases).forEach(([field, names]) => {
            const normalizedNames = names.map(normalizeText);
            found[field] = columns.find(column => normalizedNames.includes(normalizeText(column)))
              || columns.find(column => normalizedNames.some(alias => normalizeText(column).includes(alias) || alias.includes(normalizeText(column))))
              || '';
          });

          state.warnings = [];
          ['date', 'service'].forEach(field => {
            if(!found[field]) state.warnings.push(`Coluna não localizada: ${FIELD_LABELS[field]}`);
          });

          if(!found.downtime){
            state.warnings.push('Coluna não localizada: Tempo de indisponibilidade. Os tempos serão considerados como 0 até ajustar o cabeçalho.');
          }

          return found;
        };
      }

      window.readFile = async function(file){
        try{
          const data = await file.arrayBuffer();
          let rows;

          if(file.name.toLowerCase().endsWith('.csv')){
            const text = new TextDecoder('utf-8').decode(data);
            const workbook = XLSX.read(text, { type: 'string' });
            rows = window.HRJRSheetParser.sheetToRows(workbook.Sheets[workbook.SheetNames[0]]);
          }else{
            const workbook = XLSX.read(data, { type: 'array', cellDates: false });
            rows = window.HRJRSheetParser.sheetToRows(workbook.Sheets[workbook.SheetNames[0]]);
          }

          loadRows(rows, true);
          toast('Planilha atualizada, cabeçalho detectado e salva em cache');
        }catch(error){
          console.error(error);
          toast('Erro ao ler arquivo. Verifique se a planilha está válida.');
        }
      };
    }
  };
})();
