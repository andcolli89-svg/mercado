# CbOfertas V4.0

Aplicativo Android em WebView para consultar produtos, montar mensagens promocionais, organizar publicações e localizar oportunidades no Mercado Livre.

## Novidades da V4.0

- Backend modular em `backend/src`, separado por configuração, utilitários e serviços.
- Radar de ofertas com pesquisa, filtros, pontuação, cache, histórico local de preços e ação de favoritar.
- Cupons inteligentes com categoria, palavras-chave, preço mínimo, desconto mínimo, validade e prioridade.
- Histórico preservado com edição, envio individual, envio em sequência e agendamentos locais.
- Página Favoritos independente do histórico, com pesquisa, abertura do anúncio e carregamento para o editor.
- GitHub Actions validando estrutura, backend, testes e geração do APK.
- Migração compatível com os dados locais usados nas versões anteriores.

## Servidor configurado

O aplicativo continua usando por padrão:

`https://mercado-yvqn.onrender.com`

Para que o Radar e a resposta `/health` mostrem a V4.0, publique a pasta `backend` desta versão no Render. O endereço pode ser alterado em **Configurações > Servidor de busca**.

## Fluxo principal

1. Cole o link do produto e toque em **Buscar**.
2. Confira título, foto, preços, vendedor, frete, parcelas e cupons sugeridos.
3. Gere uma mensagem e salve no histórico ou nos favoritos.
4. Use o Radar para localizar ofertas e carregá-las diretamente no editor.
5. No histórico, edite, agende ou envie cada publicação separadamente.

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

Na raiz do projeto:

```bash
node scripts/validate-project.js
```

## Gerar o APK no GitHub

1. Envie todo o conteúdo desta pasta para a raiz do repositório.
2. Abra a guia **Actions**.
3. Execute **Validar e Gerar APK CbOfertas V4.0**.
4. Baixe o artefato `CbOfertas-V4.0-APK`.

O workflow gera:

- `CbOfertas-V4.0.apk`
- `CbOfertas-V4.0.apk.sha256`

## Limitação do WhatsApp

O WhatsApp exige confirmação do usuário para cada envio. O aplicativo prepara e abre as mensagens, mas não envia silenciosamente para grupos.
