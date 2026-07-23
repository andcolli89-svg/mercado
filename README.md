# CbOfertas V5.0


## Correções principais da V5.0

- O parâmetro `wid=MLB...` agora identifica o anúncio específico antes do catálogo `/p/`.
- O preço é confirmado pelo item selecionado; cashback, parcelas e outras variações não são aceitos como preço final.
- Campos antigos são limpos antes de cada busca. Se o preço não for confirmado, a oferta não é aprovada.
- Links oficiais `meli.la` compartilhados para a CbOfertas são salvos em uma biblioteca local por anúncio e catálogo.
- Radar, favoritos, histórico e mensagens reutilizam automaticamente o link afiliado já cadastrado.
- Caso real incluído na validação: catálogo `MLB25929487`, anúncio `MLB4812130742` e afiliado `https://meli.la/2ZY9J9V`.

Aplicativo Android para consultar produtos, localizar ofertas no Radar, montar mensagens promocionais e trabalhar com links oficiais de afiliado do Mercado Livre.

## Novidades da V5.0

- Corrige a leitura de preços brasileiros com separador de milhares: `2.500` passa a ser `R$ 2.500,00`, e não `R$ 2,50`.
- O aplicativo agora aparece na lista de compartilhamento do Android.
- Novo botão **Gerar link de afiliado**: abre o produto no Mercado Livre para que o link seja gerado pela faixa **Ganhos > Compartilhar**.
- Ao escolher **CbOfertas** no compartilhamento, o link recebido substitui automaticamente o link normal da oferta.
- Mensagens, histórico, favoritos e agendamentos preservam o link recebido.
- Mantém Radar, cupons inteligentes, histórico, favoritos e backend modular.

## Como usar o link de afiliado

1. Busque ou selecione uma oferta no CbOfertas.
2. Toque em **Gerar link de afiliado**.
3. No Mercado Livre, toque em **Compartilhar** dentro da faixa **Ganhos**.
4. Na lista de aplicativos, escolha **CbOfertas**.
5. O aplicativo volta para a oferta, aplica o link recebido e confere novamente os dados do produto.

O CbOfertas não solicita senha, token ou código de afiliado. O rastreamento é criado pelo próprio Mercado Livre na conta que está conectada ao aplicativo oficial.

## Servidor configurado

O aplicativo usa por padrão:

`https://mercado-yvqn.onrender.com`

Publique a pasta `backend` desta versão no Render e abra `/health`. A versão esperada é `5.0.0`.

## Backend

```text
backend/
├── server.js
├── package.json
├── src/
│   ├── app.js
│   ├── config.js
│   ├── lib/
│   │   ├── format.js
│   │   └── http.js
│   └── services/
│       ├── imageService.js
│       ├── productService.js
│       └── radarService.js
└── test/
    └── smoke.test.js
```

Comandos:

```bash
cd backend
npm run check
npm test
npm start
```

## Validação completa

```bash
node scripts/validate-project.js
node scripts/smoke-webapp.js
```

## Gerar o APK no GitHub

1. Envie todo o conteúdo desta pasta para a raiz do repositório.
2. Abra **Actions**.
3. Execute **Validar e Gerar APK CbOfertas V5.0**.
4. Baixe o artefato `CbOfertas-V5.0-APK`.

O workflow gera:

- `CbOfertas-V5.0.apk`
- `CbOfertas-V5.0.apk.sha256`

## Observação sobre atualização do APK

Se o Android informar que o aplicativo não pode ser atualizado, a assinatura do APK anterior é diferente. Nesse caso, salve o que for necessário, desinstale a versão anterior e instale a V5.0. Para futuras atualizações sem desinstalar, use uma chave de assinatura permanente no GitHub Actions.
