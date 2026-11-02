// Painel da loja: login, abrir/fechar, gerenciar pedidos e editar o cardápio.

const $ = id => document.getElementById(id);

let config = { aberto: true, esgotados: [], cardapio: null };
let pedidos = [];
let abaAtual = 'andamento';
let idsConhecidos = null;  // para tocar o som só em pedidos novos
let audio = null;

function toast(texto) {
  const t = $('toast');
  t.textContent = texto;
  t.classList.add('visivel');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('visivel'), 2600);
}

// Pergunta com campo de texto (motivo do cancelamento, previsão de entrega).
function perguntar(titulo, rotulo, { tipo = 'text', valor = '', obrigatorio = false } = {}) {
  const modal = $('modal-pergunta');
  const input = $('pergunta-input');
  $('pergunta-titulo').textContent = titulo;
  $('pergunta-rotulo').textContent = rotulo;
  input.type = tipo;
  input.value = valor;
  input.required = obrigatorio;
  modal.showModal();
  return new Promise(resolve => {
    modal.addEventListener('close', () => resolve(modal.returnValue === 'ok' ? input.value.trim() : null), { once: true });
  });
}

// ---------------- Login ----------------

async function iniciar() {
  $('dica-demo').hidden = !DB.demo;
  if (await DB.sessao().catch(() => false)) return abrirPainel();

  $('form-login').onsubmit = async e => {
    e.preventDefault();
    $('erro-login').hidden = true;
    try {
      await DB.login($('email').value.trim(), $('senha').value);
      abrirPainel();
    } catch (err) {
      $('erro-login').textContent = err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : err.message;
      $('erro-login').hidden = false;
    }
  };
}

async function abrirPainel() {
  $('tela-login').hidden = true;
  $('tela-painel').hidden = false;
  $('btn-sair').hidden = false;
  $('btn-sair').onclick = async () => { await DB.logout(); location.reload(); };

  config = await DB.getConfig();
  mostrarLojaAberta();
  $('loja-aberta').onchange = async e => {
    try {
      await DB.setConfig({ aberto: e.target.checked });
      config.aberto = e.target.checked;
      toast(config.aberto ? 'Loja aberta para pedidos' : 'Loja fechada para pedidos');
    } catch (err) {
      e.target.checked = config.aberto;
      toast('Erro: ' + err.message);
    }
    mostrarLojaAberta();
  };

  $('btn-som').onclick = ativarSom;
  $('abas').onclick = e => {
    const aba = e.target.closest('.aba');
    if (!aba) return;
    if (abaAtual === 'cardapio' && sujo && !confirm('Descartar as alterações do cardápio?')) return;
    abaAtual = aba.dataset.aba;
    document.querySelectorAll('.aba').forEach(a => a.classList.toggle('ativa', a === aba));
    $('lista-pedidos').hidden = abaAtual === 'cardapio';
    $('editor-cardapio').hidden = abaAtual !== 'cardapio';
    if (abaAtual === 'cardapio') abrirEditor(); else renderPedidos();
  };
  $('lista-pedidos').onclick = acaoPedido;

  await carregarPedidos();
  DB.assinar(carregarPedidos);
}

function mostrarLojaAberta() {
  $('loja-aberta').checked = config.aberto;
  $('loja-aberta-texto').textContent = config.aberto ? 'Loja aberta' : 'Loja fechada';
}

// ---------------- Som de novo pedido ----------------

function ativarSom() {
  audio = audio || new (window.AudioContext || window.webkitAudioContext)();
  audio.resume();
  tocarSom();
  $('btn-som').textContent = '🔔 Som ativado';
  $('btn-som').disabled = true;
  // Enquanto houver pedido esperando ser aceito, repete o aviso.
  setInterval(() => { if (pedidos.some(p => p.status === 'enviado')) tocarSom(); }, 20000);
}

// Campainha "plim-plom" (duas notas com harmônicos) seguida da voz "Novo pedido!".
function tocarSom() {
  if (!audio) return;
  const nota = (freq, inicio, duracao) => {
    [[1, 0.35], [2, 0.12], [3, 0.05]].forEach(([mult, volume]) => {
      const osc = audio.createOscillator();
      const vol = audio.createGain();
      const t = audio.currentTime + inicio;
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      vol.gain.setValueAtTime(0.0001, t);
      vol.gain.exponentialRampToValueAtTime(volume, t + 0.01);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
      osc.connect(vol).connect(audio.destination);
      osc.start(t);
      osc.stop(t + duracao);
    });
  };
  nota(1318.5, 0, 0.9);    // Mi
  nota(1046.5, 0.35, 1.4); // Dó
  setTimeout(falarNovoPedido, 1300);
}

function falarNovoPedido() {
  if (!window.speechSynthesis) return;
  const fala = new SpeechSynthesisUtterance('Novo pedido!');
  fala.lang = 'pt-BR';
  // Prefere as vozes "Natural" (mais humanas) quando o computador tiver.
  const vozes = speechSynthesis.getVoices().filter(v => v.lang.replace('_', '-').startsWith('pt-BR'));
  fala.voice = vozes.find(v => /natural/i.test(v.name)) || vozes[0] || null;
  fala.rate = 1.05;
  speechSynthesis.cancel();
  speechSynthesis.speak(fala);
}

// ---------------- Pedidos ----------------

async function carregarPedidos() {
  try {
    pedidos = await DB.listarPedidos();
  } catch (e) {
    toast('Erro ao carregar pedidos: ' + e.message);
    return;
  }
  const ids = new Set(pedidos.map(p => p.id));
  if (idsConhecidos && pedidos.some(p => !idsConhecidos.has(p.id) && p.status === 'enviado')) {
    tocarSom();
    toast('Novo pedido!');
  }
  idsConhecidos = ids;

  const novos = pedidos.filter(p => p.status === 'enviado').length;
  const andamento = pedidos.filter(p => STATUS.indexOf(p.status) >= 0 && p.status !== 'entregue').length;
  $('cont-andamento').textContent = andamento ? `(${andamento})` : '';
  document.title = (novos ? `(${novos}) ` : '') + 'Painel — Lugami';
  if (abaAtual !== 'cardapio') renderPedidos();
}

function filtrar() {
  if (abaAtual === 'finalizados') return pedidos.filter(p => p.status === 'entregue');
  if (abaAtual === 'cancelados') return pedidos.filter(p => p.status === 'cancelado');
  // Em andamento: mais antigos primeiro, para seguir a ordem da fila
  return pedidos.filter(p => !['entregue', 'cancelado'].includes(p.status)).reverse();
}

function botoes(p) {
  const retirada = p.tipo_entrega === 'retirada';
  const proximo = {
    enviado:  ['aceitar', 'Aceitar pedido'],
    aceito:   ['avancar', 'Iniciar preparo'],
    preparo:  ['avancar', retirada ? 'Pronto para retirar' : 'Saiu para entrega'],
    caminho:  ['avancar', retirada ? 'Cliente retirou' : 'Entregue'],
  }[p.status];
  if (!proximo) return '';
  return `
    <button type="button" class="btn" data-acao="${proximo[0]}" data-id="${p.id}">${proximo[1]}</button>
    <button type="button" class="btn-mini perigo" data-acao="cancelar" data-id="${p.id}">${p.status === 'enviado' ? 'Recusar' : 'Cancelar'}</button>`;
}

function linkAcompanhar(p) {
  return new URL(`pedido.html?id=${encodeURIComponent(p.id)}`, location.href).href;
}

function renderPedidos() {
  const lista = filtrar();
  if (!lista.length) {
    $('lista-pedidos').innerHTML = '<p class="vazio">Nenhum pedido aqui.</p>';
    return;
  }
  $('lista-pedidos').innerHTML = lista.map(p => {
    const retirada = p.tipo_entrega === 'retirada';
    const hora = new Date(p.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const msgCliente = `Olá, ${p.cliente_nome}! Aqui é da ${LOJA.nome} 💜 Acompanhe seu pedido #${p.numero} por aqui: ${linkAcompanhar(p)}`;
    return `
      <article class="card pedido pedido-${p.status}">
        <header class="pedido-cab">
          <strong>#${p.numero}</strong>
          <span class="etiqueta etiqueta-${p.status}">${textoStatus(p.status, retirada)[0]}</span>
          <span class="pedido-hora">${hora}</span>
        </header>
        <p class="pedido-cliente">
          <strong>${esc(p.cliente_nome)}</strong> ·
          <a href="${linkWhats('55' + p.cliente_telefone, msgCliente)}" target="_blank" rel="noopener">WhatsApp ${esc(p.cliente_telefone.replace(/^(\d{2})(\d+)(\d{4})$/, '($1) $2-$3'))}</a>
        </p>
        <p>${retirada ? '🏪 <strong>Retirada na loja</strong>'
          : `🛵 ${esc(p.endereco)}${p.referencia ? `<br><small>${esc(p.referencia)}</small>` : ''}`}</p>
        <ul class="pedido-itens">${p.itens.map(i => `<li>${esc(descreverItem(i))} <strong>${fmt(i.preco * i.qtd)}</strong></li>`).join('')}</ul>
        ${p.observacoes ? `<p class="pedido-obs">📝 ${esc(p.observacoes)}</p>` : ''}
        <p class="pedido-total">Total <strong>${fmt(p.total)}</strong> · ${esc(p.pagamento)}${p.troco_para ? ` (troco para ${fmt(p.troco_para)})` : ''}</p>
        ${p.motivo_cancelamento ? `<p class="pedido-obs">Motivo: ${esc(p.motivo_cancelamento)}</p>` : ''}
        <div class="pedido-acoes">${botoes(p)}</div>
      </article>`;
  }).join('');
}

async function acaoPedido(e) {
  const btn = e.target.closest('button[data-acao]');
  if (!btn) return;
  const p = pedidos.find(x => x.id === btn.dataset.id);
  let patch;

  if (btn.dataset.acao === 'aceitar') {
    const retirada = p.tipo_entrega === 'retirada';
    const min = await perguntar(`Aceitar pedido #${p.numero}`,
      retirada ? 'Fica pronto em quantos minutos?' : 'Previsão de entrega (minutos)', { tipo: 'number', valor: '30' });
    if (min === null) return;
    patch = { status: 'aceito', previsao_min: parseInt(min, 10) || null };
  } else if (btn.dataset.acao === 'avancar') {
    patch = { status: STATUS[STATUS.indexOf(p.status) + 1] };
  } else if (btn.dataset.acao === 'cancelar') {
    const motivo = await perguntar(`Cancelar pedido #${p.numero}`, 'Motivo (o cliente vai ver)',
      { valor: 'Desculpe, não conseguimos atender seu pedido agora.' });
    if (motivo === null) return;
    patch = { status: 'cancelado', motivo_cancelamento: motivo || null };
  }

  btn.disabled = true;
  try {
    await DB.atualizarPedido(p.id, patch);
    await carregarPedidos();
  } catch (err) {
    toast('Erro: ' + err.message);
    btn.disabled = false;
  }
}

// ---------------- Editor de cardápio ----------------

let edit = null;
let esgotados = null;
let sujo = false;

const novoIdItem = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function marcarSujo() {
  sujo = true;
  $('barra-salvar').hidden = false;
}

function abrirEditor() {
  edit = structuredClone(config.cardapio || CARDAPIO);
  edit.promocoes ??= structuredClone(CARDAPIO.promocoes || []);
  esgotados = new Set(config.esgotados);
  sujo = false;
  $('barra-salvar').hidden = true;
  renderEditor();
}

function linhaItem(item, i, lista, comPreco, ci = '') {
  return `
    <div class="ed-linha" data-lista="${lista}" data-ci="${ci}" data-i="${i}">
      <label class="ed-disp" title="Disponível">
        <input type="checkbox" data-campo="disp" ${esgotados.has(item.id) ? '' : 'checked'}>
      </label>
      <input type="text" class="ed-nome" data-campo="nome" value="${esc(item.nome)}" aria-label="Nome">
      ${comPreco ? `<label class="ed-preco">R$ <input type="number" min="0" step="0.5" inputmode="decimal" data-campo="preco" value="${item.preco}" aria-label="Preço"></label>` : ''}
      <button type="button" class="ed-remover" data-acao="remover" aria-label="Remover">✕</button>
    </div>`;
}

function blocoEditor(titulo, itens, lista, comPreco, ci = '') {
  const cabecalho = lista === 'cat'
    ? `<div class="ed-cat-cab">
         <input type="text" class="ed-cat-nome" data-campo="cat-nome" data-ci="${ci}" value="${esc(titulo)}" aria-label="Nome da categoria">
         <button type="button" class="btn-mini perigo" data-acao="remover-cat" data-ci="${ci}">Remover categoria</button>
       </div>`
    : `<h2 class="card-titulo">${titulo}</h2>`;
  return `
    <div class="card ed-bloco">
      ${cabecalho}
      ${itens.map((item, i) => linhaItem(item, i, lista, comPreco, ci)).join('')}
      <button type="button" class="btn-mini" data-acao="adicionar" data-lista="${lista}" data-ci="${ci}">+ Adicionar</button>
    </div>`;
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function blocoPromocao(p, pi) {
  const opcoes = (lista, sel) => lista.filter(i => i.nome.trim())
    .map(i => `<option value="${esc(i.id)}" ${i.id === sel ? 'selected' : ''}>${esc(i.nome)}</option>`).join('');
  const extras = edit.categorias.flatMap(c => c.itens).filter(i => i.nome.trim());
  const tamanho = edit.tamanhos.find(t => t.id === p.tamanho);
  const normal = (tamanho?.preco || 0) + extras.filter(e => p.extras.includes(e.id)).reduce((s, e) => s + e.preco, 0);
  const marcar = (campo, valor, rotulo, marcado) =>
    `<label><input type="checkbox" data-promo="${campo}" value="${esc(valor)}" ${marcado ? 'checked' : ''}> ${esc(rotulo)}</label>`;
  return `
    <div class="card ed-bloco ed-promo" data-pi="${pi}">
      <div class="ed-cat-cab">
        <label class="ed-disp" title="Ligada"><input type="checkbox" data-promo="ativa" ${p.ativa ? 'checked' : ''}></label>
        <input type="text" class="ed-cat-nome" data-promo="nome" value="${esc(p.nome)}" aria-label="Nome da promoção">
        <button type="button" class="btn-mini perigo" data-acao="remover-promo" data-pi="${pi}">Remover</button>
      </div>
      <div class="ed-promo-grade">
        <label>Sabor <select data-promo="sabor"><option value="">Qualquer sabor</option>${opcoes(edit.sabores, p.sabor)}</select></label>
        <label>Tamanho <select data-promo="tamanho"><option value="">Escolha…</option>${opcoes(edit.tamanhos, p.tamanho)}</select></label>
        <label>Preço da promoção <span class="ed-preco">R$ <input type="number" min="0" step="0.5" inputmode="decimal" data-promo="preco" value="${p.preco}"></span></label>
      </div>
      <p class="ed-rotulo">Acompanhamentos inclusos <small>preço normal do copo: ${fmt(normal)}</small></p>
      <div class="ed-marcar">${extras.map(e => marcar('extra', e.id, e.nome, p.extras.includes(e.id))).join('')}</div>
      <p class="ed-rotulo">Dias da semana</p>
      <div class="ed-marcar">${DIAS.map((d, i) => marcar('dia', i, d, p.dias.includes(i))).join('')}</div>
    </div>`;
}

function renderEditor() {
  $('editor').innerHTML =
    '<h2 class="ed-subtitulo">Promoções</h2>' +
    '<p class="dica">A promoção aparece em destaque nos dias marcados. O desconto entra sozinho quando o cliente monta o copo com o tamanho, o sabor e os acompanhamentos dela. Extras são cobrados à parte.</p>' +
    edit.promocoes.map(blocoPromocao).join('') +
    '<button type="button" class="btn-mini" data-acao="nova-promo">+ Nova promoção</button>' +
    '<h2 class="ed-subtitulo">Cardápio</h2>' +
    blocoEditor('Sabores', edit.sabores, 'sabores', false) +
    blocoEditor('Tamanhos', edit.tamanhos, 'tamanhos', true) +
    '<h2 class="ed-subtitulo">Acompanhamentos</h2>' +
    edit.categorias.map((c, ci) => blocoEditor(c.nome, c.itens, 'cat', true, ci)).join('') +
    '<button type="button" class="btn-mini" data-acao="nova-cat">+ Nova categoria</button>';
}

function listaDe(el) {
  return el.dataset.lista === 'cat' ? edit.categorias[el.dataset.ci].itens : edit[el.dataset.lista];
}

$('editor').addEventListener('input', e => {
  const campo = e.target.dataset.campo;
  const campoPromo = e.target.dataset.promo;
  if (campoPromo) {
    const p = edit.promocoes[e.target.closest('.ed-promo').dataset.pi];
    const v = e.target.value;
    if (campoPromo === 'nome') p.nome = v;
    else if (campoPromo === 'preco') p.preco = Math.max(0, parseFloat(v) || 0);
    else if (campoPromo === 'ativa') p.ativa = e.target.checked;
    else if (campoPromo === 'sabor' || campoPromo === 'tamanho') p[campoPromo] = v;
    else {
      const lista = campoPromo === 'dia' ? p.dias : p.extras;
      const valor = campoPromo === 'dia' ? Number(v) : v;
      if (e.target.checked) lista.push(valor); else lista.splice(lista.indexOf(valor), 1);
    }
    marcarSujo();
    // Atualiza o "preço normal" mostrado; campos de texto não re-renderizam para não perder o foco.
    if (['tamanho', 'extra'].includes(campoPromo)) renderEditor();
    return;
  }
  if (campo === 'cat-nome') {
    edit.categorias[e.target.dataset.ci].nome = e.target.value;
  } else if (campo === 'nome' || campo === 'preco') {
    const linha = e.target.closest('.ed-linha');
    const item = listaDe(linha)[linha.dataset.i];
    item[campo] = campo === 'preco' ? Math.max(0, parseFloat(e.target.value) || 0) : e.target.value;
  } else if (campo === 'disp') {
    const linha = e.target.closest('.ed-linha');
    const id = listaDe(linha)[linha.dataset.i].id;
    if (e.target.checked) esgotados.delete(id); else esgotados.add(id);
  } else return;
  marcarSujo();
});

$('editor').addEventListener('click', e => {
  const btn = e.target.closest('button[data-acao]');
  if (!btn) return;
  const acao = btn.dataset.acao;
  if (acao === 'remover') {
    const linha = btn.closest('.ed-linha');
    listaDe(linha).splice(linha.dataset.i, 1);
  } else if (acao === 'adicionar') {
    const lista = listaDe(btn);
    lista.push({ id: novoIdItem(), nome: '', preco: 0 });
  } else if (acao === 'remover-cat') {
    const cat = edit.categorias[btn.dataset.ci];
    if (!confirm(`Remover a categoria "${cat.nome}" e todos os itens dela?`)) return;
    edit.categorias.splice(btn.dataset.ci, 1);
  } else if (acao === 'nova-cat') {
    edit.categorias.push({ nome: 'Nova categoria', itens: [] });
  } else if (acao === 'nova-promo') {
    edit.promocoes.push({ id: novoIdItem(), nome: 'Nova promoção', ativa: false, dias: [1, 2, 3, 4],
      sabor: '', tamanho: '', extras: [], preco: 0 });
  } else if (acao === 'remover-promo') {
    if (!confirm(`Remover a promoção "${edit.promocoes[btn.dataset.pi].nome}"?`)) return;
    edit.promocoes.splice(btn.dataset.pi, 1);
  }
  marcarSujo();
  renderEditor();
  if (acao === 'adicionar') {
    const campos = document.querySelectorAll(`.ed-linha[data-lista="${btn.dataset.lista}"][data-ci="${btn.dataset.ci}"] .ed-nome`);
    campos[campos.length - 1]?.focus();
  }
});

$('btn-descartar').onclick = abrirEditor;

$('btn-salvar').onclick = async () => {
  const limpar = lista => lista.filter(i => i.nome.trim()).map(i => ({ ...i, nome: i.nome.trim() }));
  const cardapio = {
    sabores: limpar(edit.sabores).map(({ id, nome }) => ({ id, nome })),
    tamanhos: limpar(edit.tamanhos),
    categorias: edit.categorias.filter(c => c.nome.trim()).map(c => ({ nome: c.nome.trim(), itens: limpar(c.itens) })),
  };
  if (!cardapio.sabores.length || !cardapio.tamanhos.length) {
    toast('Deixe pelo menos um sabor e um tamanho.');
    return;
  }
  const ids = [cardapio.sabores, cardapio.tamanhos, ...cardapio.categorias.map(c => c.itens)].flat().map(i => i.id);

  // Promoções: descarta referências a itens removidos e exige tamanho e preço.
  const tem = (lista, id) => lista.some(i => i.id === id);
  cardapio.promocoes = edit.promocoes.map(p => ({
    ...p,
    nome: p.nome.trim() || 'Promoção',
    sabor: tem(cardapio.sabores, p.sabor) ? p.sabor : '',
    tamanho: tem(cardapio.tamanhos, p.tamanho) ? p.tamanho : '',
    extras: p.extras.filter(id => ids.includes(id)),
    dias: [...new Set(p.dias)].sort(),
  }));
  const invalida = cardapio.promocoes.find(p => !p.tamanho || !p.preco);
  if (invalida) {
    toast(`Promoção "${invalida.nome}": escolha o tamanho e o preço.`);
    return;
  }
  const lista = [...esgotados].filter(id => ids.includes(id));

  $('btn-salvar').disabled = true;
  try {
    await DB.setConfig({ cardapio, esgotados: lista });
    config.cardapio = cardapio;
    config.esgotados = lista;
    toast('Cardápio salvo! Já aparece para os clientes.');
    abrirEditor();
  } catch (err) {
    toast('Erro ao salvar: ' + err.message);
  }
  $('btn-salvar').disabled = false;
};

window.addEventListener('beforeunload', e => { if (sujo) e.preventDefault(); });

iniciar();
