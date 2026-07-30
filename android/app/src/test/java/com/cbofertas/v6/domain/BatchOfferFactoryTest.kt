package com.cbofertas.v6.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BatchOfferFactoryTest {
    @Test
    fun `oferta da busca entra no lote com foto e link afiliado`() {
        val product = Product(
            platform = "mercado_livre",
            itemId = "MLB1234567890",
            catalogProductId = null,
            title = "Tênis Puma",
            sellerId = null,
            sellerName = "PUMA",
            freeShipping = true,
            logisticType = "fulfillment",
            imageUrl = "https://http2.mlstatic.com/puma.jpg",
            permalink = "https://produto.mercadolivre.com.br/MLB-1234567890",
            sourceUrl = "https://meli.la/1MxHWTB",
            resolvedUrl = "https://produto.mercadolivre.com.br/MLB-1234567890",
            price = PriceInfo(false, null, null, null, null, null, 0, 0.0, 0.0),
        )

        val batch = product.toPendingBatchOffer(
            offerText = "Tênis Puma\nhttps://produto.mercadolivre.com.br/MLB-1234567890",
            affiliateUrl = "https://meli.la/meu-link",
            now = 123L,
        )

        assertEquals("MLB1234567890", batch.itemId)
        assertEquals("https://http2.mlstatic.com/puma.jpg", batch.imageUrl)
        assertEquals("https://meli.la/meu-link", batch.affiliateUrl)
        assertEquals("pending", batch.status)
        assertNull(batch.sentAt)
        assertEquals(123L, batch.createdAt)
    }

    @Test
    fun `atualiza item pendente sem duplicar id nem perder foto`() {
        val existing = BatchOffer(
            id = "existente",
            originalText = "antigo",
            originalUrl = "https://produto.mercadolivre.com.br/MLB-1234567890",
            itemId = "MLB1234567890",
            imageUrl = "https://http2.mlstatic.com/antiga.jpg",
            createdAt = 50L,
        )
        val product = Product(
            platform = "mercado_livre",
            itemId = "MLB1234567890",
            catalogProductId = null,
            title = "Título atualizado",
            sellerId = null,
            sellerName = null,
            freeShipping = false,
            logisticType = null,
            imageUrl = null,
            permalink = existing.originalUrl,
            sourceUrl = existing.originalUrl,
            resolvedUrl = existing.originalUrl,
            price = PriceInfo(false, null, null, null, null, null, 0, 0.0, 0.0),
        )

        val batch = product.toPendingBatchOffer("novo", existing = existing, now = 999L)
        assertEquals("existente", batch.id)
        assertEquals(50L, batch.createdAt)
        assertEquals("https://http2.mlstatic.com/antiga.jpg", batch.imageUrl)
    }
}
