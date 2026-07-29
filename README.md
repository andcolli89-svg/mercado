# CbOfertas V6.0.0 Alpha 5.4

## Alpha 5.4 — lembrete automático de postagem

A aba **Ajustes** agora possui um lembrete de postagem que avisa aproximadamente a cada 30 minutos, somente entre **8h e 21h**. O aviso usa som e vibração, abre diretamente a aba **Lote** e mostra quantos anúncios ainda estão pendentes. Depois das 21h, os alertas pausam automaticamente e o próximo é programado para as 8h do dia seguinte.

Quando uma publicação é aberta no WhatsApp Business ou marcada como enviada, a contagem de 30 minutos é reiniciada.

## Consulta individual preservada

- consulta de links comuns, páginas de catálogo e links curtos `meli.la`;
- preço atual, original, parcelamento, cashback e preço unitário separados;
- correção manual do parcelamento com opção sem juros, com juros ou sem informação;
- cupons, Radar, histórico, favoritos, afiliados e agenda;
- compartilhamento prioritário no WhatsApp Business.

## Lote WhatsApp

- recebe vários anúncios colados de uma vez;
- separa cada anúncio pelo link;
- preserva parágrafos, emojis, asteriscos e formatação do texto recebido;
- converte corretamente quebras copiadas como `\\n`;
- remove data, hora, telefone e nome do remetente adicionados pelo WhatsApp;
- busca título, MLB e foto principal pelo link;
- possui busca automática de todas as fotos faltantes;
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

- workspace/backend: `6.0.0-alpha.5.4`
- Android versionName: `6.0.0-alpha.5.4`
- Android versionCode: `600010`
- Android API 35
- Gradle 8.9
- Kotlin 2.0.21
- JDK 17
- Node.js 24 no GitHub Actions

## Compilação

A branch de testes é `v6-rebuild`. O workflow `.github/workflows/build-v6.yml` valida o backend, executa os testes Android, compila o APK e publica o artefato:

`CbOfertas-V6.0.0-alpha.5.4-COMPLETA`
