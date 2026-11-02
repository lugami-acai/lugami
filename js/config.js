// =====================================================================
//  CONFIGURAÇÃO DA LOJA — tudo que muda no dia a dia fica aqui.
//  Itens marcados com (EXEMPLO) ainda precisam dos valores reais.
// =====================================================================

const LOJA = {
  nome: 'Lugami',
  slogan: 'Açaí e Sorvetes',
  whatsapp: '5511948637475',          // só números, com 55 + DDD
  instagram: '',                        // ex: 'https://instagram.com/lugami' (vazio = esconde)
  endereco: 'Endereço da loja (EXEMPLO)',
  tempoEntrega: 'cerca de 30 min',
  tempoRetirada: 'cerca de 30 min',
  taxaEntrega: 5.00,                    // valor fixo do delivery (retirada é grátis)
  pedidoMinimo: 0,                      // 0 = sem pedido mínimo
  horarios: [
    ['Segunda', '11:00 – 18:00'],
    ['Terça',   '11:00 – 18:00'],
    ['Quarta',  '11:00 – 18:00'],
    ['Quinta',  '11:00 – 18:00'],
    ['Sexta',   '14:00 – 20:00'],
    ['Sábado',  '14:00 – 20:00'],
    ['Domingo', '14:00 – 20:00'],
  ],
  pagamentos: ['Pix', 'Cartão na entrega'],   // para aceitar dinheiro, acrescente 'Dinheiro' (pede troco)
  pix: {
    chave: '',                          // (EXEMPLO) vazio = esconde o quadro do Pix
    titular: '',
  },
};

// Cardápio INICIAL. Depois do primeiro salvamento no painel da loja
// (admin.html → "Cardápio"), vale o que estiver salvo lá, e não este.
// Preço final do copo = preço do tamanho + soma dos acompanhamentos (0 = grátis).
// Os "id" não podem se repetir: são usados para marcar itens como esgotados.
const CARDAPIO = {
  sabores: [
    { id: 'acai',      nome: 'Açaí' },
    { id: 'cupuacu',   nome: 'Cupuaçu' },
    { id: 'casadinho', nome: 'Casadinho (meio açaí, meio cupuaçu)' },
  ],
  tamanhos: [                           // (EXEMPLO de preços)
    { id: 't300',    nome: '300 ml',      preco: 14 },
    { id: 't400',    nome: '400 ml',      preco: 17 },
    { id: 't500',    nome: '500 ml',      preco: 20 },
    { id: 't700',    nome: '700 ml',      preco: 26 },
    { id: 'marmita', nome: 'Marmita 1 kg', preco: 45 },
  ],
  categorias: [                         // (EXEMPLO de preços)
    { nome: 'Frutas', itens: [
      { id: 'banana',    nome: 'Banana',    preco: 3 },
      { id: 'morango',   nome: 'Morango',   preco: 3 },
      { id: 'kiwi',      nome: 'Kiwi',      preco: 3 },
      { id: 'uva-verde', nome: 'Uva verde', preco: 3 },
      { id: 'abacaxi',   nome: 'Abacaxi',   preco: 3 },
      { id: 'manga',     nome: 'Manga',     preco: 3 },
      { id: 'uva-roxa',  nome: 'Uva roxa',  preco: 3 },
    ]},
    { nome: 'Cremes', itens: [
      { id: 'ninho',  nome: 'Creme de Leite Ninho', preco: 4 },
      { id: 'avela',  nome: 'Creme de avelã',       preco: 4 },
    ]},
    { nome: 'Chocolates e bombons', itens: [
      { id: 'kitkat',  nome: 'Kit Kat',            preco: 3 },
      { id: 'bis',     nome: 'Bis',                preco: 3 },
      { id: 'sonho',   nome: 'Sonho de Valsa',     preco: 3 },
      { id: 'mms',     nome: "M&M's",              preco: 3 },
      { id: 'gotas',   nome: 'Gotas de chocolate', preco: 2 },
    ]},
    { nome: 'Doces e confeitos', itens: [
      { id: 'granulado', nome: 'Granulado de chocolate', preco: 2 },
      { id: 'amendoim',  nome: 'Amendoim granulado',     preco: 2 },
      { id: 'pacoca',    nome: 'Paçoca',                 preco: 2 },
      { id: 'sucrilhos', nome: 'Sucrilhos',              preco: 2 },
      { id: 'granola',   nome: 'Granola',                preco: 2 },
      { id: 'chocoball', nome: 'Chocoball',              preco: 2 },
      { id: 'flocos',    nome: 'Flocos de arroz',        preco: 2 },
    ]},
    { nome: 'Complementos', itens: [
      { id: 'leite-cond', nome: 'Leite condensado', preco: 2 },
      { id: 'leite-po',   nome: 'Leite em pó',      preco: 2 },
      { id: 'nutella',    nome: 'Nutella',          preco: 6 },
    ]},
  ],
};

// Conexão com o Supabase (banco de dados). Enquanto estiver vazio, o site roda
// em MODO DEMONSTRAÇÃO: os pedidos ficam salvos só neste navegador, para testar.
// A "chave" é a anon/public key do projeto — ela pode ficar pública.
const SUPABASE = {
  url: 'https://gdgystjmqytczjvrlwhv.supabase.co',
  chave: 'sb_publishable_bKuMiDSBCWqNEN2NnnFrrw_twty0nTm',
};
