# CbOfertas V6.0.0 Alpha 5.5

## Alpha 5.5 — fotos automáticas e busca integrada ao Lote

A busca de produto agora aceita links diretos do Mercado Livre, links curtos `meli.la` e links intermediários `go.promozone.ai/mercadolivre/...`. O backend segue redirecionamentos HTTP, meta refresh e redirecionamentos comuns em JavaScript, confirma o produto final e tenta obter a foto principal por `og:image`, JSON estruturado ou API pública.

Na aba **Lote WhatsApp**, a busca das fotos começa automaticamente logo depois de separar os anúncios. O botão **Buscar fotos faltantes** continua disponível para tentar novamente apenas os cards sem imagem.

Na consulta individual foi acrescentado o botão **Adicionar esta oferta ao Lote**. Ele leva para a fila de Pendentes o texto revisado, título, MLB, foto, cupom, parcelamento e link afiliado já salvo, sem obrigar o usuário a copiar a mensagem novamente.

## Consulta individual preservada

- consulta de links comuns, páginas de catálogo, `meli.la` e `go.promozone.ai`;
- preço atual, original, parcelamento, cashback e preço unitário separados;
- correção manual do parcelamento com opção sem juros, com juros ou sem informação;
- botão para adicionar a oferta confirmada ao Lote WhatsApp;
- cupons, Radar, histórico, favoritos, afiliados e agenda;
- compartilhamento prioritário no WhatsApp Business.

## Lote WhatsApp

- recebe vários anúncios colados de uma vez;
- separa cada anúncio pelo link;
- inicia automaticamente a busca das fotos depois da separação;
- suporta links diretos, `meli.la` e `go.promozone.ai`;
- preserva parágrafos, emojis, asteriscos e formatação do texto recebido;
- converte corretamente quebras copiadas como `\\n`;
- remove data, hora, telefone e nome do remetente adicionados pelo WhatsApp;
- busca título, MLB e foto principal pelo link;
- reutiliza links afiliados salvos por produto;
- guarda os links já utilizados na Biblioteca de Afiliados;
- compartilha foto e texto pelo WhatsApp Business;
- mantém filas separadas de Pendentes e Enviados;
- reinicia o lembrete de 30 minutos depois de uma postagem.

## Lembrete diário

- intervalo: 30 minutos;
- horário ativo: 8h às 21h;
- som e vibração pelo canal de notificações do Android;
- não avisa quando não houver anúncios pendentes;
- pausa automaticamente durante a noite;
- volta automaticamente às 8h;
- é restaurado depois de reiniciar ou atualizar o celular.

## Backend de produção

`https://cbofertas-v6-api.onrender.com`

## Versão

- workspace/backend: `6.0.0-alpha.5.5`
- Android versionName: `6.0.0-alpha.5.5`
- Android versionCode: `600011`
- Android API 35
- Gradle 8.9
- Kotlin 2.0.21
- JDK 17
- Node.js 24 no GitHub Actions

## Compilação

A branch de testes é `v6-rebuild`. O workflow `.github/workflows/build-v6.yml` valida o backend, executa os testes Android, compila o APK e publica o artefato:

`CbOfertas-V6.0.0-alpha.5.5-COMPLETA`
