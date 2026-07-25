# CbOfertas V6.0.0 Alpha 3

A Alpha 3 recupera a personalidade da CbOfertas sem voltar para a arquitetura WebView da V5.

## O que voltou

- frase engraçada automática antes do título;
- 352 frases em 22 categorias, sem repetição imediata;
- texto completo da oferta pronto para copiar;
- compartilhamento direto no WhatsApp;
- preço atual, original, desconto, economia e parcelamento;
- frete, vendedor, cashback e preço por unidade exibidos separadamente;
- cards completos no Radar;
- Histórico com menor preço, maior desconto, consultas e última consulta;
- Favoritos;
- Biblioteca de Afiliados por MLB;
- cupons salvos e aplicados ao texto;
- tema claro e escuro;
- recebimento de links pelo menu Compartilhar do Android.

## Compatibilidade de backend

O aplicativo tenta primeiro as rotas novas da V6:

- `POST /v1/products/resolve`
- `GET /v1/radar`

Se o servidor responder 404 ou 405, ele muda automaticamente para as rotas da V5.2.1:

- `GET /api/product`
- `GET /api/radar`

Por isso, a Alpha 3 já vem apontando para o backend atual:

`https://mercado-yvqn.onrender.com`

O endereço continua editável em **Ajustes**.

## Toolchain Android congelada

- Android Gradle Plugin 8.7.3
- Gradle 8.9
- Kotlin 2.0.21
- Android API 35
- JDK 17
- Compose BOM 2024.12.01

## Testes

O backend contém testes para:

- Galaxy A17: R$ 806,65 / R$ 1.855,71;
- Kit de toalhas: R$ 142,39 / R$ 185,29;
- Cadeira Python: R$ 475,96 / R$ 1.248,75;
- redirecionamentos meli.la;
- catálogo e MLB vencedor;
- cashback, parcela e preço por unidade;
- rotas V6 e rotas de compatibilidade V5.2.1;
- Radar ordenado pelo desconto real.

O Android também testa a montagem do texto e a prioridade do link afiliado.

## GitHub Actions

O workflow `.github/workflows/build-v6.yml` gera:

- `CbOfertas-V6.0.0-alpha.3.apk`
- checksum SHA-256;
- ZIP das fontes.

Use somente a branch `v6-rebuild` durante os testes.
