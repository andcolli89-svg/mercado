package com.cbofertas.v6.domain

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OfferTextTest {
    private val product = Product(
        platform = "mercado_livre",
        itemId = "MLB123",
        catalogProductId = null,
        title = "Kit 5 Toalhas Banho Gigante",
        sellerId = null,
        sellerName = "Loja Teste",
        freeShipping = true,
        logisticType = "fulfillment",
        imageUrl = null,
        permalink = "https://produto.mercadolivre.com.br/MLB-123",
        sourceUrl = "https://meli.la/teste",
        resolvedUrl = "https://produto.mercadolivre.com.br/MLB-123",
        price = PriceInfo(
            confirmed = true,
            current = MoneyEvidence(142.39, "current", "test", 0.99),
            original = MoneyEvidence(185.29, "original", "test", 0.99),
            installment = MoneyEvidence(14.07, "installment", "test", 0.9, label = "12x de R$ 14,07"),
            cashback = MoneyEvidence(427.0, "cashback", "test", 0.9),
            unit = null,
            discountPercent = 23,
            savings = 42.90,
            confidence = 0.99,
        ),
    )

    @Test
    fun `texto inclui frase preço desconto parcela frete e link`() {
        val text = product.offerText("Seu banho de hotel começa aqui.", "OFERTA20", null)
        assertTrue(text.contains("Seu banho de hotel"))
        assertTrue(text.contains("R$ 142,39"))
        assertTrue(text.contains("23% OFF"))
        assertTrue(text.contains("12x de R$ 14,07"))
        assertTrue(text.contains("Frete grátis"))
        assertTrue(text.contains("OFERTA20"))
        assertTrue(text.contains(product.permalink))
    }

    @Test
    fun `cashback nunca aparece como preço principal`() {
        val text = product.offerText("Teste", "", null)
        assertFalse(text.contains("R$ 427,00"))
    }

    @Test
    fun `link afiliado substitui link original`() {
        val affiliate = AffiliateRecord(
            itemId = product.itemId,
            affiliateUrl = "https://meli.la/afiliado",
            originalUrl = product.permalink,
            title = product.title,
            savedAt = 1L,
            lastUsedAt = 1L,
        )
        val text = product.offerText("Teste", "", affiliate)
        assertTrue(text.contains("https://meli.la/afiliado"))
        assertFalse(text.contains(product.permalink))
    }
}
