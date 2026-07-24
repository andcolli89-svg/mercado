# CbOfertas V6 — reconstrução limpa

Esta pasta contém a primeira base funcional da nova CbOfertas. Ela não reutiliza o WebView nem o parser genérico da V5.

## O que já existe nesta alpha

- Aplicativo Android nativo em Kotlin + Jetpack Compose.
- Estado de busca que apaga o produto anterior antes da nova consulta.
- Backend Node.js 24 sem dependências de runtime.
- Resolução manual de HTTP 301, 302, 303, 307 e 308, com cookies.
- Identificação de links `meli.la`, MLB e páginas de catálogo.
- Consulta separada de item, preço de venda, preços cadastrados, catálogo e vendedor.
- Modelo separado para preço atual, original, parcela, cashback e preço por unidade.
- Bloqueio de publicação automática quando a confiança do preço é baixa.
- Radar com concorrência limitada, que só aceita produtos confirmados e ordena pelo desconto real.
- Histórico, favoritos, cupons e Biblioteca de Afiliados locais.
- 352 frases em 22 categorias, sem repetição imediata.
- Tema claro e escuro.
- GitHub Actions para testes, APK, ZIP e checksums.

## Estado da versão

`6.0.0-alpha.1` é uma base de desenvolvimento. Não substitua a V5 em produção ainda. Use uma branch `v6-rebuild` e um serviço Render separado.

## Backend local

```bash
cd backend
npm test
npm start
```

O servidor inicia na porta `10000`. No emulador Android, use `http://10.0.2.2:10000`.

## Render separado

Crie um novo Web Service apontando para a pasta `backend`:

- Runtime: Node
- Build command: `npm test`
- Start command: `npm start`
- Node: 24
- Variável opcional: `MELI_ACCESS_TOKEN`

A API oficial de preços do Mercado Livre exige token em vários contextos. Sem a variável, a V6 tenta as fontes públicas e reduz a confiança quando não consegue confirmar o preço vencedor.

## Android

O projeto usa:

- compileSdk 37
- AGP 9.2.0
- Gradle 9.6.1
- Kotlin 2.3.21
- Compose BOM 2026.06.00

O workflow instala o SDK, executa os testes Android e gera `CbOfertas-V6.0.0-alpha.1.apk`. Nesta entrega local, o APK ainda não foi compilado porque o ambiente não possui Android SDK/Gradle; a compilação será confirmada pelo GitHub Actions da branch `v6-rebuild`.


## Validação atual

- 18 testes automatizados do backend aprovados.
- Casos cobertos: Galaxy A17, toalhas, cadeira, cashback, parcelas, preço unitário, catálogo/buy box, contextos especiais, redirecionamentos 302/307 e Radar.
- Sintaxe JavaScript, YAML e estrutura do projeto validadas.
- Modelo de domínio Kotlin compilado isoladamente.
- A interface Android completa aguarda a primeira compilação no GitHub Actions.
