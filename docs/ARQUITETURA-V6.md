# Arquitetura da CbOfertas V6

## Regra central

Um preço só pertence ao produto quando a evidência está ligada ao mesmo MLB. Valores de outro anúncio, outra variação ou outro contexto são descartados.

## Hierarquia de fontes

1. `/items/{MLB}/sale_price` — preço vencedor do marketplace.
2. `buy_box_winner` do catálogo — confirmação do anúncio vencedor.
3. `/items/{MLB}/prices` — promoções e preço regular.
4. `/items/{MLB}` — fallback legado.
5. JSON-LD da página — fallback estruturado.
6. Texto visível rotulado — último recurso, com confiança menor.

## Campos separados

- `current`: valor atual de venda.
- `original`: preço riscado/regular.
- `installment`: valor da parcela, nunca preço final.
- `cashback`: benefício futuro, nunca preço final.
- `unit`: preço por quilo/unidade, nunca preço final.

## Confiança

A interface só habilita o compartilhamento quando `price.confirmed` é verdadeiro. O backend mantém evidências e fonte do valor para diagnóstico.

## Links afiliados

A associação é feita por MLB. O link afiliado não participa da extração de preço; ele é apenas o link de saída usado no compartilhamento.
