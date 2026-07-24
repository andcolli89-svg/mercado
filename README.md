# CbOfertas V5.2

Aplicativo Android com backend Node.js para consultar produtos do Mercado Livre e da Shopee, localizar ofertas no Radar do Mercado Livre, organizar links de afiliado e preparar textos para compartilhamento.

## Principais mudanças da V5.2

- Corrige a prioridade de preços: o preço promocional confirmado na página passa a prevalecer sobre preço regular ou desatualizado da API.
- Interpreta valores brasileiros apresentados por acessibilidade, por exemplo `475 reais com 96 centavos` como `R$ 475,96`.
- Separa preço atual, preço original, desconto e parcelamento, evitando confusão com cashback, ganhos de afiliado e valor das parcelas.
- Resolve links curtos `meli.la`, segue redirecionamentos e identifica automaticamente MLB, título, imagem, vendedor, frete e preços quando disponíveis.
- Aceita links diretos e curtos da Shopee, identifica o produto e interpreta os preços serializados pela plataforma.
- Faz o Radar priorizar o preço promocional e enriquecer resultados incertos com a API do anúncio.
- Remove da interface a antiga tela, botões e configurações do Gerador de Mensagens.
- Insere automaticamente uma única frase engraçada antes do título, escolhida sem repetição imediata em um banco com mais de 300 frases e 22 categorias.
- Adiciona Biblioteca de Afiliados, com associação automática entre o produto e o link compartilhado pelo Mercado Livre ou Shopee.
- Reutiliza o link afiliado no Radar, Histórico, Favoritos, WhatsApp e texto copiado.
- Amplia o Histórico com menor preço, maior desconto, quantidade de consultas e última consulta.
- Atualiza a interface, os cards, animações leves e os temas claro/escuro.
- Reorganiza o backend em APIs, parsers e serviços, com testes automatizados.

## Estrutura principal

```text
.github/workflows/build-apk.yml
android/
backend/
  src/
    api/mercadoLivreApi.js
    parsers/mercadoLivrePriceParser.js
    parsers/shopeePriceParser.js
    services/linkResolver.js
    services/productService.js
    services/radarService.js
  test/
scripts/
```

## Backend

Requisitos: Node.js 20 ou superior.

```bash
cd backend
npm run check
npm test
npm start
```

Servidor padrão configurado no aplicativo:

```text
https://mercado-yvqn.onrender.com
```

Ao publicar a pasta `backend` no Render, abra `/health` e confirme a versão `5.2.0`.

## Validação local

Na raiz do projeto:

```bash
node scripts/validate-project.js
node scripts/smoke-webapp.js
cd backend
npm run check
npm test
```

## Gerar APK e ZIP no GitHub Actions

1. Substitua o conteúdo da raiz do seu repositório pelos arquivos deste pacote.
2. Faça commit e push para a branch `main`.
3. Abra a aba **Actions** do GitHub.
4. Execute **Validar e Gerar CbOfertas V5.2**, ou aguarde a execução automática do push.
5. Baixe o artefato **CbOfertas-V5.2-Completa**.

O artefato contém:

- `CbOfertas-V5.2.apk`
- `CbOfertas-V5.2.apk.sha256`
- `CbOfertas-V5.2-PROGRAMA-COMPLETO.zip`
- `CbOfertas-V5.2-PROGRAMA-COMPLETO.zip.sha256`

## Link afiliado

Ao compartilhar um link oficial do Mercado Livre, incluindo `meli.la`, ou um link curto da Shopee para a CbOfertas, o aplicativo salva a associação na Biblioteca de Afiliados. Quando o mesmo produto reaparecer, o link afiliado é usado automaticamente.

A Biblioteca de Afiliados fica em **Configurações** e permite pesquisar, copiar o JSON, remover uma associação ou limpar a biblioteca.

## Atualização do aplicativo

A V5.2 usa `versionCode 520` e `versionName 5.2`. Se um APK anterior foi assinado com outra chave, o Android pode exigir a desinstalação da versão anterior. Para atualizações futuras sem reinstalação, configure uma chave de assinatura permanente no workflow.
