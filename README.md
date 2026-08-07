# CbOfertas V12.2

## Automação por rodadas

Configuração padrão:

- 3 mensagens por rodada;
- 20 segundos entre as mensagens da mesma rodada;
- 30 minutos entre as rodadas;
- limite diário de 80 mensagens.

Todos os valores são editáveis no celular.

## Calibração para aparelhos antigos

Há três estratégias:

1. somente elementos e textos da tela;
2. somente coordenadas calibradas;
3. texto primeiro e coordenadas como reserva.

Passos:

1. ativar Acessibilidade;
2. tocar em **Capturar clique do grupo** e selecionar o destino;
3. tocar em **Capturar clique de Enviar**;
4. usar uma conversa de teste, pois essa segunda calibração envia a mensagem;
5. executar **Enviar teste**;
6. ativar a fila.

A máquina de estados permite apenas dois cliques por mensagem:

1. destino;
2. Enviar.

## Transferência entre celulares

Na página Fila:

- Exportar fila;
- Importar fila;
- Somar à fila atual;
- Substituir fila atual;
- evitar duplicados pelo link ou identificador.

## Observação

A automação continua dependendo da interface do WhatsApp e do Serviço de
Acessibilidade. A calibração por aparelho reduz as diferenças entre celulares,
mas pode precisar ser refeita após atualizações do WhatsApp.


## Correção V12.2.1 — colagem em lote restaurada

- Campo grande para colar várias ofertas copiadas do WhatsApp.
- Uma oferta separada para cada link do Mercado Livre.
- O lote anterior é preservado.
- Links duplicados são ignorados.
- Título e preço são extraídos do texto.
- Seleção de todas ou algumas ofertas.
- Envio das selecionadas para a fila automática.
- Envio individual para o WhatsApp.
- Exclusão individual.
- Botão para apagar o lote completo.


## V12.3 — lote afiliado e clique reforçado

- Limpeza de cabeçalhos do WhatsApp, data, hora, remetente e linhas repetidas.
- Uma oferta separada por link.
- Link original preservado.
- Afiliado desmarcado por padrão, mesmo quando o texto colado contém meli.la.
- Checkbox afiliado somente após o botão `Usar link copiado`.
- Botão `Abrir produto no ML`.
- Botão `Copiar link original`.
- Envio individual para WhatsApp Business somente após confirmação do afiliado.
- Fila automática bloqueia ofertas de colagem sem afiliado confirmado.
- Clique do destino usa a linha inteira, não apenas as letras do nome.
- Duração e ajustes X/Y configuráveis.
- Perfil pronto para celular antigo.
