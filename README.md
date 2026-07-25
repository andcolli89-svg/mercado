# CbOfertas V6.0.0 Alpha 4

Aplicativo Android nativo e backend Node.js para confirmar ofertas, montar textos com personalidade, aplicar links afiliados, localizar oportunidades no Radar e preparar publicações no WhatsApp Business.

## Recursos da Alpha 4

- confirmação separada de preço atual, original, parcelas, cashback e preço unitário;
- fallback para HTML público quando a API do Mercado Livre responde 401/403/404;
- links comuns, páginas de catálogo e links curtos `meli.la`;
- Radar com busca pública alternativa, concorrência limitada e remoção de duplicados;
- cupons inteligentes por valor, porcentagem, compra mínima, limite máximo, validade e palavras-chave;
- distinção visual entre cupom confirmado e cupom apenas sugerido;
- cálculo de preço estimado depois do cupom;
- frase engraçada automática, com 352 frases em 22 categorias;
- texto completo da oferta;
- Biblioteca de Afiliados por MLB;
- compartilhamento prioritário no WhatsApp Business;
- agenda local de publicações únicas, diárias e semanais;
- notificação que abre a mensagem pronta no WhatsApp Business;
- reagendamento após reiniciar o celular ou atualizar o aplicativo;
- histórico de consultas, favoritos e histórico local de compartilhamentos;
- tema claro e escuro.

## Backend de produção

`https://cbofertas-v6-api.onrender.com`

O endereço pode ser alterado na tela **Ajustes**.

## Rotas

- `GET /health`
- `POST /v1/products/resolve`
- `GET /v1/products/resolve?url=...`
- `GET /v1/radar?query=...&limit=8`
- `POST /v1/coupons/evaluate`
- compatibilidade: `GET /api/product` e `GET /api/radar`

## Compilação

A branch de testes é `v6-rebuild`. O workflow `.github/workflows/build-v6.yml` executa testes, compila o APK e publica:

- `CbOfertas-V6.0.0-alpha.4.apk`
- checksum SHA-256 do APK;
- ZIP completo das fontes;
- checksum SHA-256 do ZIP.

Toolchain congelada:

- Android Gradle Plugin 8.7.3
- Gradle 8.9
- Kotlin 2.0.21
- Android API 35
- JDK 17
- Node.js 24

## Segurança do agendamento

A agenda não envia mensagens escondidas. No horário marcado, o Android exibe uma notificação; ao tocar, o WhatsApp Business abre com o texto pronto para o usuário confirmar o destinatário e o envio.
