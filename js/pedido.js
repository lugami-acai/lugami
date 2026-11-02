// Página de acompanhamento: mostra o status do pedido e atualiza sozinha.

const params = new URLSearchParams(location.search);
const pedidoId = params.get('id');
const conteudo = document.getElementById('conteudo');
let ultimoStatus = null;

function mensagemParaLoja(p) {
  const linhas = [
    `Olá! Acabei de fazer o pedido #${p.numero} pelo site 💜`,
    '',
    ...p.itens.map(descreverItem),
    '',
    `Total: ${fmt(p.total)} (${p.pagamento})`,
    p.tipo_entrega === 'retirada' ? 'Vou retirar na loja.' : '',
    p.talheres == null ? '' : p.talheres ? 'Com colher e guardanapo.' : 'Sem colher e guardanapo.',
    p.pagamento === 'Pix' ? 'Segue o comprovante do Pix:' : '',
  ];
  return linhas.filter((l, i, arr) => l || arr[i - 1]).join('\n').trim();
}

function render(p) {
  const retirada = p.tipo_entrega === 'retirada';
  const novo = params.get('novo') === '1';

  if (p.status === 'cancelado') {
    conteudo.innerHTML = `
      <div class="card status-card">
        <div class="status-icone">😔</div>
        <h1>Pedido #${p.numero} cancelado</h1>
        <p>${esc(p.motivo_cancelamento || textoStatus('cancelado')[1])}</p>
        <a class="btn" href="https://wa.me/${LOJA.whatsapp}" target="_blank" rel="noopener">Falar com a loja</a>
      </div>`;
    return;
  }

  const atual = STATUS.indexOf(p.status);
  const [titulo, sub] = textoStatus(p.status, retirada);
  const previsao = p.previsao_min && !retirada && atual < 4 ? `Previsão: cerca de ${p.previsao_min} min` : '';

  const etapas = STATUS.map((s, i) => {
    const [t, d] = textoStatus(s, retirada);
    const cls = i < atual ? 'feita' : i === atual ? 'atual' : '';
    return `
      <li class="etapa ${cls}">
        <span class="etapa-ponto">${i < atual ? '✓' : ''}</span>
        <div><strong>${t}</strong><span>${d}</span></div>
      </li>`;
  }).join('');

  conteudo.innerHTML = `
    ${novo && atual === 0 ? `
      <div class="card destaque">
        <h2>Pedido recebido! 🎉</h2>
        <p>Guarde esta página para acompanhar: ela atualiza sozinha.
        ${p.pagamento === 'Pix' ? 'Se pagou por Pix, mande o comprovante no WhatsApp da loja.' : ''}</p>
        <a class="btn btn-whats" href="${linkWhats(LOJA.whatsapp, mensagemParaLoja(p))}" target="_blank" rel="noopener">Avisar a loja no WhatsApp</a>
      </div>` : ''}

    <div class="card status-card">
      <span class="status-numero">Pedido #${p.numero}</span>
      <h1>${titulo}</h1>
      <p>${previsao || sub}</p>
      <ol class="etapas">${etapas}</ol>
    </div>

    <div class="card">
      <h2 class="card-titulo">Resumo</h2>
      <ul class="resumo-itens">
        ${p.itens.map(i => `
          <li><span>${i.promo ? `<em class="tag-promo">🔥 ${esc(i.promo)}</em>` : ''}${i.qtd}x ${esc(i.sabor)} · ${esc(i.tamanho)}
            <small>${esc(i.acompanhamentos.join(', ') || 'Sem acompanhamentos')}</small></span>
            <strong>${fmt(i.preco * i.qtd)}</strong></li>`).join('')}
      </ul>
      <dl class="resumo">
        <div><dt>Subtotal</dt><dd>${fmt(p.subtotal)}</dd></div>
        <div><dt>${retirada ? 'Retirada' : 'Entrega'}</dt><dd>${p.taxa_entrega ? fmt(p.taxa_entrega) : 'grátis'}</dd></div>
        <div class="resumo-total"><dt>Total</dt><dd>${fmt(p.total)}</dd></div>
        <div><dt>Pagamento</dt><dd>${esc(p.pagamento)}</dd></div>
        ${p.talheres == null ? '' : `<div><dt>Colher e guardanapo</dt><dd>${p.talheres ? 'Sim' : 'Não'}</dd></div>`}
      </dl>
    </div>

    <p class="centro"><a href="https://wa.me/${LOJA.whatsapp}" target="_blank" rel="noopener">Dúvidas? Fale com a loja no WhatsApp</a></p>`;
}

async function carregar() {
  try {
    const p = await DB.getPedido(pedidoId);
    if (!p) {
      conteudo.innerHTML = '<p class="vazio">Pedido não encontrado.</p>';
      return;
    }
    const chave = p.status + '|' + p.previsao_min;
    if (chave !== ultimoStatus) {
      if (ultimoStatus && navigator.vibrate) navigator.vibrate(200);
      ultimoStatus = chave;
      render(p);
    }
  } catch (e) {
    if (!ultimoStatus) conteudo.innerHTML = '<p class="vazio">Não foi possível carregar o pedido. Tente recarregar a página.</p>';
  }
}

if (!pedidoId) {
  conteudo.innerHTML = '<p class="vazio">Pedido não encontrado.</p>';
} else {
  carregar();
  setInterval(carregar, DB.demo ? 3000 : 10000);
}
