package com.cbofertas.v6.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CouponEngineTest {
    private val product = Product(
        platform = "mercado_livre",
        itemId = "MLB123",
        catalogProductId = null,
        title = "Creatina Monohidratada 500g",
        sellerId = null,
        sellerName = null,
        freeShipping = true,
        logisticType = null,
        imageUrl = null,
        permalink = "https://produto.mercadolivre.com.br/MLB-123",
        sourceUrl = "https://meli.la/teste",
        resolvedUrl = "https://produto.mercadolivre.com.br/MLB-123",
        price = PriceInfo(
            confirmed = true,
            current = MoneyEvidence(100.0, "current", "test", 0.99),
            original = MoneyEvidence(120.0, "original", "test", 0.99),
            installment = null,
            cashback = null,
            unit = null,
            discountPercent = 17,
            savings = 20.0,
            confidence = 0.99,
        ),
    )

    @Test
    fun `escolhe melhor cupom compatível`() {
        val best = product.bestCoupon(
            listOf(
                CouponRecord(code = "FIXO10", type = "fixed", value = 10.0, keywords = "creatina"),
                CouponRecord(code = "PCT20", type = "percent", value = 20.0, maxDiscount = 15.0, keywords = "creatina"),
                CouponRecord(code = "CELULAR", type = "fixed", value = 50.0, keywords = "celular"),
            ),
        )
        assertEquals("PCT20", best?.coupon?.code)
        assertEquals(15.0, best?.estimatedDiscount ?: 0.0, 0.001)
        assertEquals(85.0, best?.estimatedPrice ?: 0.0, 0.001)
    }

    @Test
    fun `texto diferencia cupom sugerido`() {
        val match = product.bestCoupon(listOf(CouponRecord(code = "OFERTA10", value = 10.0)))
        val text = product.offerText("O shape não vem sozinho.", match, null)
        assertTrue(text.contains("Cupom sugerido"))
        assertTrue(text.contains("R$ 90,00"))
    }
}
