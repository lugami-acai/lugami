# Lugami — pedidos online

Site de pedidos da Lugami Açaí e Sorvetes. O cliente monta o açaí, escolhe entrega ou retirada, envia o pedido e acompanha o status pelo celular. A loja gerencia tudo no painel.

## Páginas

| Arquivo | Para quem | O que faz |
|---|---|---|
| `index.html` | Cliente | Cardápio, carrinho, entrega e pagamento. **É este link que vai no WhatsApp.** |
| `pedido.html` | Cliente | Acompanhamento do pedido. Atualiza sozinho a cada 10 segundos. |
| `admin.html` | Loja | Abrir e fechar a loja, aceitar e avançar pedidos, editar o cardápio e os preços. |

## Onde mudar as coisas

- **Cardápio, preços e itens esgotados:** no painel (`admin.html` → aba **Cardápio**). Não precisa mexer em código.
- **Horários, taxa de entrega, chave Pix, endereço e Instagram:** no arquivo `js/config.js`.

## Testar no computador (modo demonstração)

Enquanto o Supabase não estiver configurado, o site funciona em modo demonstração. Os pedidos ficam salvos só no navegador em que foram feitos.

1. Abra `index.html` no navegador e faça um pedido.
2. Em outra aba, abra `admin.html` e entre com qualquer e-mail e a senha `lugami`.
3. Aceite e avance o pedido. A aba do pedido atualiza sozinha.

## Colocar no ar

1. **Supabase** (banco de dados, grátis): crie um projeto em supabase.com.
   1. Abra **SQL Editor**, cole o conteúdo de `supabase.sql`, troque `SEU-EMAIL@exemplo.com` pelo seu e-mail e clique em **Run**.
   2. Em **Authentication → Users → Add user**, crie o usuário do painel com esse mesmo e-mail e uma senha.
   3. Em **Authentication → Sign In / Providers**, desative **Allow new users to sign up**.
   4. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public** para `SUPABASE` no arquivo `js/config.js`.
2. **GitHub Pages** (hospedagem, grátis): crie um repositório, envie estes arquivos e ative **Settings → Pages**.
3. Troque a linha `og:image` do `index.html` pelo endereço completo do logo publicado (ex.: `https://SEU-USUARIO.github.io/lugami/img/logo.png`). É isso que faz o logo aparecer na prévia do link no WhatsApp.

## Observações

- Os preços são calculados no navegador do cliente. Ao aceitar um pedido, confira se o total bate com os itens.
- O cliente só vê o próprio pedido, pelo link. Nome, telefone e endereço ficam visíveis apenas no painel.

## Ideias para depois (backlog)

- **Caldos (época de frio):** caldo de quenga, caldo verde etc. Ficaria numa aba própria no cardápio, com um botão no painel para ligar no frio e desligar no calor.
- **Bebidas:** outra aba de produtos prontos, também ligável pelo painel. Falta definir os itens.
- **Som do painel:** se quiser, trocar a campainha atual por um arquivo próprio (.mp3).
