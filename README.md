# CbOfertas V6.0.0 Alpha 5.2

Aplicativo Android nativo e backend Node.js para consultar ofertas, organizar anúncios copiados do WhatsApp, aplicar links afiliados e compartilhar pelo WhatsApp Business.

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
- remove cabeçalhos que apareçam antes do primeiro anúncio;
- limpa automaticamente anúncios que já estavam salvos na Alpha 5;
- busca título, MLB e foto principal pelo link;
- reutiliza links afiliados salvos por produto;
- compartilha foto e texto pelo WhatsApp Business;
- mantém filas separadas de Pendentes e Enviados.

## Backend de produção

`https://cbofertas-v6-api.onrender.com`

## Versão

- workspace/backend: `6.0.0-alpha.5.2`
- Android versionName: `6.0.0-alpha.5.2`
- Android versionCode: `600008`
- Android API 35
- Gradle 8.9
- Kotlin 2.0.21
- JDK 17
- Node.js 24 no GitHub Actions

## Compilação

A branch de testes é `v6-rebuild`. O workflow `.github/workflows/build-v6.yml` valida o backend, executa os testes Android, compila o APK e publica o artefato:

`CbOfertas-V6.0.0-alpha.5.2-COMPLETA`
