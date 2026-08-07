# CbOfertas V12.1

Projeto completo com automação configurável por aparelho.

## Piloto automático

- WhatsApp Business ou WhatsApp comum.
- Grupo/contato padrão editável.
- Intervalo configurável.
- Limite diário.
- Tempos de espera ajustáveis.
- Máximo de tentativas.
- Parar ou continuar após erro.
- Teste guiado.
- Botão de emergência.
- Máquina de estados com no máximo dois cliques:
  1. destino;
  2. enviar.
- Trava pós-envio e retorno ao CbOfertas.
- Enviadas saem da fila e vão ao histórico sem cupons.

## Atenção

A automação usa o Serviço de Acessibilidade e depende da interface do WhatsApp.
Ela é configurável para reduzir diferenças entre aparelhos, mas pode precisar de
ajuste quando o WhatsApp alterar a tela.


## Correção V12.1.1

- Unifica todas as dependências Kotlin em 1.8.22.
- Corrige `checkDebugDuplicateClasses` entre Kotlin 1.8.22 e 1.6.21.
