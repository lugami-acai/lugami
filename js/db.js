// =====================================================================
//  Camada de dados + utilidades compartilhadas pelas três páginas.
//  Com SUPABASE configurado usa o banco de verdade; sem ele, roda em
//  modo demonstração guardando tudo no localStorage deste navegador.
// =====================================================================

const fmt = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const STATUS = ['enviado', 'aceito', 'preparo', 'caminho', 'entregue'];

// Textos de cada etapa; "caminho" e "entregue" mudam quando é retirada.
function textoStatus(status, retirada) {
  const t = {
    enviado:   ['Pedido enviado', 'Aguardando a loja confirmar'],
    aceito:    ['Pedido aceito', 'A loja confirmou seu pedido'],
    preparo:   ['Em preparo', 'Seu açaí está sendo montado'],
    caminho:   retirada ? ['Pronto para retirar', 'Pode vir buscar na loja'] : ['A caminho', 'Saiu para entrega'],
    entregue:  retirada ? ['Retirado', 'Bom apetite!'] : ['Entregue', 'Bom apetite!'],
    cancelado: ['Pedido cancelado', 'Fale com a loja pelo WhatsApp se tiver dúvidas'],
  };
  return t[status] || t.enviado;
}

function descreverItem(item) {
  const extras = item.acompanhamentos.length ? item.acompanhamentos.join(', ') : 'sem acompanhamentos';
  return `${item.qtd}x ${item.promo ? `[${item.promo}] ` : ''}${item.sabor} ${item.tamanho} — ${extras}`;
}

function linkWhats(numero, texto) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

const DB = (() => {
  const usarSupabase = !!(SUPABASE.url && SUPABASE.chave);

  if (usarSupabase) {
    const sb = window.supabase.createClient(SUPABASE.url, SUPABASE.chave);
    const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

    return {
      demo: false,
      async getConfig() {
        return ok(await sb.from('config_loja').select('aberto, esgotados, cardapio').eq('id', 1).single());
      },
      async setConfig(patch) {
        ok(await sb.from('config_loja').update(patch).eq('id', 1));
      },
      async criarPedido(p) {
        return ok(await sb.rpc('criar_pedido', { p }));
      },
      async getPedido(id) {
        return ok(await sb.rpc('ver_pedido', { p_id: id }));
      },
      async listarPedidos() {
        return ok(await sb.from('pedidos').select('*').order('criado_em', { ascending: false }).limit(200));
      },
      async atualizarPedido(id, patch) {
        ok(await sb.from('pedidos').update({ ...patch, atualizado_em: new Date().toISOString() }).eq('id', id));
      },
      assinar(cb) {
        sb.channel('pedidos-admin')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, cb)
          .subscribe();
        setInterval(cb, 30000); // garantia caso a conexão em tempo real caia
      },
      async login(email, senha) {
        ok(await sb.auth.signInWithPassword({ email, password: senha }));
        if (!(await this.sessao())) {
          await sb.auth.signOut();
          throw new Error('Este usuário não tem acesso ao painel.');
        }
      },
      async sessao() {
        const { data } = await sb.auth.getSession();
        if (!data.session) return false;
        return !!ok(await sb.rpc('is_admin'));
      },
      async logout() { await sb.auth.signOut(); },
    };
  }

  // ---------------- Modo demonstração ----------------
  const CHAVE = 'lugami_demo';
  const ler = () => {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) {}
    d.config ??= { aberto: true, esgotados: [], cardapio: null };
    d.pedidos ??= [];
    d.seq ??= 0;
    return d;
  };
  const salvar = d => localStorage.setItem(CHAVE, JSON.stringify(d));
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  return {
    demo: true,
    async getConfig() { return ler().config; },
    async setConfig(patch) {
      const d = ler();
      Object.assign(d.config, patch);
      salvar(d);
    },
    async criarPedido(p) {
      const d = ler();
      if (!d.config.aberto) throw new Error('A loja está fechada no momento.');
      const pedido = {
        ...p, id: novoId(), numero: ++d.seq, status: 'enviado',
        criado_em: new Date().toISOString(), previsao_min: null, motivo_cancelamento: null,
      };
      d.pedidos.unshift(pedido);
      salvar(d);
      return { id: pedido.id, numero: pedido.numero };
    },
    async getPedido(id) { return ler().pedidos.find(p => p.id === id) || null; },
    async listarPedidos() { return ler().pedidos; },
    async atualizarPedido(id, patch) {
      const d = ler();
      const p = d.pedidos.find(x => x.id === id);
      if (p) Object.assign(p, patch, { atualizado_em: new Date().toISOString() });
      salvar(d);
    },
    assinar(cb) {
      window.addEventListener('storage', e => { if (e.key === CHAVE) cb(); });
      setInterval(cb, 5000);
    },
    async login(email, senha) {
      if (senha !== 'lugami') throw new Error('No modo demonstração a senha é: lugami');
      sessionStorage.setItem('lugami_admin', '1');
    },
    async sessao() { return sessionStorage.getItem('lugami_admin') === '1'; },
    async logout() { sessionStorage.removeItem('lugami_admin'); },
  };
})();
