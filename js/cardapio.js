// Página do cardápio: monta o copo, carrinho, dados de entrega e envio do pedido.

const $ = id => document.getElementById(id);

let config = { aberto: true, esgotados: [], cardapio: null };
let menu = CARDAPIO;
let carrinho = carregarJSON(sessionStorage, 'lugami_carrinho', []);

function carregarJSON(storage, chave, padrao) {
  try { return JSON.parse(storage.getItem(chave)) ?? padrao; } catch (e) { return padrao; }
}
function salvarJSON(storage, chave, valor) {
  try { storage.setItem(chave, JSON.stringify(valor)); } catch (e) {}
}

function toast(texto) {
  const t = $('toast');
  t.textContent = texto;
  t.classList.add('visivel');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('visivel'), 2600);
}

// ---------------- Cabeçalho, rodapé e modal ----------------

function preencherLoja() {
  $('loja-nome').textContent = LOJA.nome;
  $('loja-slogan').textContent = LOJA.slogan;
  $('taxa-label').textContent = '+ ' + fmt(LOJA.taxaEntrega);
  $('rodape-endereco').textContent = LOJA.endereco;
  $('rodape-whats').href = `https://wa.me/${LOJA.whatsapp}`;
  if (LOJA.instagram) {
    $('rodape-insta').href = LOJA.instagram;
    $('rodape-insta').hidden = false;
  }
  $('info-endereco').textContent = '📍 ' + LOJA.endereco;
  $('info-tempos').innerHTML = `Delivery: ${esc(LOJA.tempoEntrega)}<br>Retirada: ${esc(LOJA.tempoRetirada)}`;
  $('info-horarios').innerHTML = LOJA.horarios
    .map(([dia, hora]) => `<tr><td>${esc(dia)}</td><td>${esc(hora)}</td></tr>`).join('');

  const modal = $('modal-info');
  $('btn-info').onclick = () => modal.showModal();
  modal.querySelector('.modal-fechar').onclick = () => modal.close();
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

  if (DB.demo) $('aviso-demo').hidden = false;
}

function mostrarStatusLoja() {
  const badge = $('status-loja');
  badge.textContent = config.aberto ? 'Aberto agora' : 'Fechado agora';
  badge.className = 'badge ' + (config.aberto ? 'badge-aberto' : 'badge-fechado');
  $('btn-enviar').textContent = config.aberto ? 'Enviar pedido' : 'Loja fechada no momento';
  $('btn-enviar').disabled = !config.aberto;
}

function mostrarPedidoEmAndamento() {
  const meus = carregarJSON(localStorage, 'lugami_meus_pedidos', []);
  const ultimo = meus[0];
  if (!ultimo || Date.now() - new Date(ultimo.criado_em) > 6 * 3600 * 1000) return;
  const a = $('pedido-aberto');
  a.href = `pedido.html?id=${encodeURIComponent(ultimo.id)}`;
  a.textContent = `Acompanhar seu pedido #${ultimo.numero} →`;
  a.hidden = false;
}

// ---------------- Montagem do copo ----------------

function chip(tipo, nome, item, mostrarPreco) {
  const esgotado = config.esgotados.includes(item.id);
  const preco = !mostrarPreco ? '' : `<em>${item.preco ? fmt(item.preco) : 'grátis'}</em>`;
  return `
    <label class="chip ${esgotado ? 'chip-esgotado' : ''}">
      <input type="${tipo}" name="${nome}" value="${esc(item.id)}" ${esgotado ? 'disabled' : ''}>
      <span>${esc(item.nome)} ${esgotado ? '<em>esgotado</em>' : preco}</span>
    </label>`;
}

function renderCardapio() {
  $('sabores').innerHTML = menu.sabores.map(s => chip('radio', 'sabor', s, false)).join('');
  $('tamanhos').innerHTML = menu.tamanhos.map(t => chip('radio', 'tamanho', t, true)).join('');
  $('categorias').innerHTML = menu.categorias.map(cat => `
    <div class="bloco">
      <h3>${esc(cat.nome)} <small>opcional</small></h3>
      <div class="chips">${cat.itens.map(i => chip('checkbox', 'extra', i, true)).join('')}</div>
    </div>`).join('');
  atualizarCopo();
}

const todosExtras = () => menu.categorias.flatMap(c => c.itens);

function copoAtual() {
  const saborId = document.querySelector('input[name=sabor]:checked')?.value;
  const tamanhoId = document.querySelector('input[name=tamanho]:checked')?.value;
  const extrasIds = [...document.querySelectorAll('input[name=extra]:checked')].map(i => i.value);
  const sabor = menu.sabores.find(s => s.id === saborId);
  const tamanho = menu.tamanhos.find(t => t.id === tamanhoId);
  const extras = todosExtras().filter(e => extrasIds.includes(e.id));
  const preco = (tamanho?.preco || 0) + extras.reduce((s, e) => s + e.preco, 0);
  return { sabor, tamanho, extras, preco };
}

function atualizarCopo() {
  const copo = copoAtual();
  $('copo-total').textContent = fmt(copo.preco);
  $('btn-add').disabled = !(copo.sabor && copo.tamanho);
  $('btn-add').textContent = !copo.sabor ? 'Escolha o sabor'
    : !copo.tamanho ? 'Escolha o tamanho' : 'Adicionar ao pedido';
}

function adicionarCopo() {
  const copo = copoAtual();
  if (!copo.sabor || !copo.tamanho) return;
  carrinho.push({
    sabor: copo.sabor.nome,
    tamanho: copo.tamanho.nome,
    acompanhamentos: copo.extras.map(e => e.nome),
    preco: copo.preco,
    qtd: 1,
  });
  document.querySelectorAll('#monte input').forEach(i => { i.checked = false; });
  atualizarCopo();
  renderCarrinho();
  toast('Copo adicionado! Monte outro ou finalize abaixo.');
  $('carrinho-sec').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------- Carrinho e totais ----------------

function renderCarrinho() {
  salvarJSON(sessionStorage, 'lugami_carrinho', carrinho);
  const lista = $('carrinho');
  if (!carrinho.length) {
    lista.innerHTML = '<p class="vazio">Nenhum copo ainda. Monte o seu acima 💜</p>';
  } else {
    lista.innerHTML = carrinho.map((item, i) => `
      <div class="item-carrinho">
        <div class="item-info">
          <strong>${esc(item.sabor)} · ${esc(item.tamanho)}</strong>
          <span>${item.acompanhamentos.length ? esc(item.acompanhamentos.join(', ')) : 'Sem acompanhamentos'}</span>
        </div>
        <div class="item-acoes">
          <div class="qtd">
            <button type="button" data-acao="menos" data-i="${i}" aria-label="Diminuir">−</button>
            <span>${item.qtd}</span>
            <button type="button" data-acao="mais" data-i="${i}" aria-label="Aumentar">+</button>
          </div>
          <strong>${fmt(item.preco * item.qtd)}</strong>
        </div>
      </div>`).join('');
  }
  atualizarTotais();
}

function alterarQtd(e) {
  const btn = e.target.closest('button[data-acao]');
  if (!btn) return;
  const item = carrinho[btn.dataset.i];
  item.qtd += btn.dataset.acao === 'mais' ? 1 : -1;
  if (item.qtd <= 0) carrinho.splice(btn.dataset.i, 1);
  renderCarrinho();
}

const tipoEntrega = () => document.querySelector('input[name=tipo]:checked')?.value;
const pagamento = () => document.querySelector('input[name=pagamento]:checked')?.value;

function totais() {
  const subtotal = carrinho.reduce((s, i) => s + i.preco * i.qtd, 0);
  const taxa = tipoEntrega() === 'entrega' ? LOJA.taxaEntrega : 0;
  return { subtotal, taxa, total: subtotal + taxa };
}

function atualizarTotais() {
  const t = totais();
  $('r-subtotal').textContent = fmt(t.subtotal);
  $('r-taxa').textContent = !tipoEntrega() ? '—' : t.taxa ? fmt(t.taxa) : 'grátis';
  $('r-total').textContent = fmt(t.total);

  const qtd = carrinho.reduce((s, i) => s + i.qtd, 0);
  $('barra-fixa').hidden = qtd === 0;
  $('barra-qtd').textContent = `${qtd} ${qtd === 1 ? 'copo' : 'copos'} · `;
  $('barra-total').textContent = fmt(t.total);
}

// ---------------- Entrega e pagamento ----------------

function renderPagamentos() {
  $('pagamentos').innerHTML = LOJA.pagamentos.map(p => `
    <label class="chip"><input type="radio" name="pagamento" value="${esc(p)}"><span>${esc(p)}</span></label>`).join('');
  $('pix-chave').textContent = LOJA.pix.chave;
  $('pix-titular').textContent = LOJA.pix.titular ? 'Titular: ' + LOJA.pix.titular : '';
}

function atualizarPagamento() {
  const p = pagamento();
  $('caixa-pix').hidden = !(p === 'Pix' && LOJA.pix.chave);
  $('caixa-troco').hidden = p !== 'Dinheiro';
}

function mascaraTelefone(e) {
  const d = e.target.value.replace(/\D/g, '').slice(0, 11);
  let v = d;
  if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length > 7) v = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
  e.target.value = v;
}

function lembrarCliente() {
  const c = carregarJSON(localStorage, 'lugami_cliente', {});
  ['nome', 'telefone', 'rua', 'bairro', 'referencia'].forEach(k => { if (c[k]) $(k).value = c[k]; });
}

// ---------------- Envio ----------------

function erro(texto, alvo) {
  const m = $('msg-erro');
  m.textContent = texto;
  m.hidden = false;
  (alvo || m).scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (alvo?.focus) alvo.focus({ preventScroll: true });
}

async function enviarPedido() {
  $('msg-erro').hidden = true;
  const tipo = tipoEntrega();
  const t = totais();
  const v = id => $(id).value.trim();
  const telefone = v('telefone').replace(/\D/g, '');

  if (!config.aberto) return erro('A loja está fechada no momento.');
  if (!carrinho.length) return erro('Monte pelo menos um copo antes de enviar.', $('monte'));
  if (LOJA.pedidoMinimo && t.subtotal < LOJA.pedidoMinimo) return erro(`O pedido mínimo é ${fmt(LOJA.pedidoMinimo)}.`);
  if (!tipo) return erro('Escolha delivery ou retirada.', $('entrega-sec'));
  if (v('nome').length < 2) return erro('Informe seu nome.', $('nome'));
  if (telefone.length < 10) return erro('Informe um WhatsApp válido com DDD.', $('telefone'));
  if (tipo === 'entrega' && !v('rua')) return erro('Informe a rua e o número.', $('rua'));
  if (tipo === 'entrega' && !v('bairro')) return erro('Informe o bairro.', $('bairro'));
  if (!pagamento()) return erro('Escolha a forma de pagamento.', $('pagamento-sec'));

  const troco = parseFloat(v('troco').replace(',', '.'));
  const pedido = {
    cliente_nome: v('nome'),
    cliente_telefone: telefone,
    tipo_entrega: tipo,
    endereco: tipo === 'entrega' ? `${v('rua')} — ${v('bairro')}` : null,
    referencia: tipo === 'entrega' ? v('referencia') || null : null,
    pagamento: pagamento(),
    troco_para: pagamento() === 'Dinheiro' && troco > 0 ? troco : null,
    observacoes: v('observacoes') || null,
    itens: carrinho,
    subtotal: t.subtotal,
    taxa_entrega: t.taxa,
    total: t.total,
  };

  const btn = $('btn-enviar');
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    const { id, numero } = await DB.criarPedido(pedido);
    const meus = carregarJSON(localStorage, 'lugami_meus_pedidos', []);
    meus.unshift({ id, numero, criado_em: new Date().toISOString() });
    salvarJSON(localStorage, 'lugami_meus_pedidos', meus.slice(0, 10));
    salvarJSON(localStorage, 'lugami_cliente',
      { nome: v('nome'), telefone: v('telefone'), rua: v('rua'), bairro: v('bairro'), referencia: v('referencia') });
    sessionStorage.removeItem('lugami_carrinho');
    location.href = `pedido.html?id=${encodeURIComponent(id)}&novo=1`;
  } catch (e) {
    erro('Não foi possível enviar: ' + e.message);
    btn.disabled = false;
    btn.textContent = 'Enviar pedido';
  }
}

// ---------------- Início ----------------

async function iniciar() {
  preencherLoja();
  renderPagamentos();
  lembrarCliente();
  mostrarPedidoEmAndamento();
  try {
    config = await DB.getConfig();
    if (config.cardapio) menu = config.cardapio;
  } catch (e) {
    toast('Não foi possível verificar se a loja está aberta.');
  }
  mostrarStatusLoja();
  renderCardapio();
  renderCarrinho();

  $('monte').addEventListener('change', atualizarCopo);
  $('btn-add').onclick = adicionarCopo;
  $('carrinho').addEventListener('click', alterarQtd);
  $('tipos-entrega').addEventListener('change', () => {
    $('campos-endereco').hidden = tipoEntrega() !== 'entrega';
    atualizarTotais();
  });
  $('pagamentos').addEventListener('change', atualizarPagamento);
  $('telefone').addEventListener('input', mascaraTelefone);
  $('btn-copiar-pix').onclick = async () => {
    try { await navigator.clipboard.writeText(LOJA.pix.chave); toast('Chave Pix copiada!'); }
    catch (e) { toast('Copie a chave manualmente.'); }
  };
  $('btn-enviar').onclick = enviarPedido;
  $('btn-ir-finalizar').onclick = () => {
    const alvo = !tipoEntrega() ? 'entrega-sec' : !pagamento() ? 'pagamento-sec' : 'btn-enviar';
    $(alvo).scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
}

iniciar();
