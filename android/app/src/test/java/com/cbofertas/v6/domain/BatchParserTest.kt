package com.cbofertas.v6.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BatchParserTest {
    @Test
    fun `remove cabecalho do WhatsApp e converte barras n em quebras reais`() {
        val pasted = """Loja Oficial Growth no MELI!\n[27/7 18:23] +55 55 9221-5536: *Kit com 12 Pares de Meias Soquete Mash*\n\nDe ~R$127~\nPor *R$53* 🔥\n\n🎟️ Cupom: *MODALIVRE* ou *MODAPRAVC*\n\n👉 *Pegar promoção:* https://meli.la/2xP6GjD"""

        val offers = parseBatchOffers(pasted)

        assertEquals(1, offers.size)
        val offer = offers.single()
        assertEquals("Kit com 12 Pares de Meias Soquete Mash", offer.title)
        assertEquals("https://meli.la/2xP6GjD", offer.originalUrl)
        assertFalse(offer.originalText.contains("+55 55 9221-5536"))
        assertFalse(offer.originalText.contains("[27/7 18:23]"))
        assertFalse(offer.originalText.contains("Loja Oficial Growth no MELI!"))
        assertFalse(offer.originalText.contains("\\n"))
        assertTrue(offer.originalText.contains("\n\nDe ~R$127~\n"))
        assertTrue(offer.originalText.startsWith("*Kit com 12 Pares"))
    }

    @Test
    fun `separa dois anuncios exportados e preserva a formatacao`() {
        val pasted = """
            [27/07/2026, 18:23] +55 42 99999-1111: *Produto A*

            De ~R$ 99~
            Por *R$ 43*
            Cupom: *FDSBELEZA*
            https://meli.la/produtoA
            [27/07/2026, 18:24] Maria: *Produto B*

            R$ 20
            Cupom: *MODACOMVC*
            https://meli.la/produtoB
        """.trimIndent()

        val offers = parseBatchOffers(pasted)

        assertEquals(2, offers.size)
        assertEquals("Produto A", offers[0].title)
        assertEquals("Produto B", offers[1].title)
        assertTrue(offers[0].originalText.contains("\n\nDe ~R$ 99~\n"))
        assertFalse(offers.any { it.originalText.contains("18:2") })
        assertFalse(offers.any { it.originalText.contains("99999-1111") })
    }

    @Test
    fun `remove prefixo somente de telefone`() {
        val clean = cleanBatchOfferText("+55 42 99999-1111: *Oferta limpa*\nR$ 10\nhttps://meli.la/x")
        assertTrue(clean.startsWith("*Oferta limpa*"))
        assertFalse(clean.contains("99999-1111"))
    }

    @Test
    fun `link afiliado substitui somente o link recebido`() {
        val offer = parseBatchOffers("*Produto*\nR$ 10\nhttps://meli.la/original").single()
            .copy(affiliateUrl = "https://meli.la/meu-link")

        assertTrue(offer.finalText.endsWith("https://meli.la/meu-link"))
        assertFalse(offer.finalText.contains("https://meli.la/original"))
    }
    @Test
    fun `remove barras n duplicadas antes de compartilhar`() {
        val pasted = "Loja Oficial Growth no MELI!\\\\n[27/7 18:21] +55 55 9221-5536: BAIXOU MAIS, É DE 500G‼️\\\\n\\\\n*Creatina Monohidratada 500g Growth Supplements*\\\\n\\\\nDe ~R$104~\\\\nPor *R$44* 🔥\\\\n\\\\n🎟️ Cupom: *MLSAUDE*\\\\n\\\\n👉 *Pegar promoção:* https://meli.la/2ZAykt1"

        val offer = parseBatchOffers(pasted).single()

        assertFalse(offer.finalText.contains("\\n"))
        assertFalse(offer.finalText.contains("9221-5536"))
        assertFalse(offer.finalText.contains("[27/7 18:21]"))
        assertFalse(offer.finalText.contains("Loja Oficial Growth no MELI!"))
        assertFalse(offer.finalText.lineSequence().any { it.endsWith("\\") })
        assertTrue(offer.finalText.startsWith("BAIXOU MAIS, É DE 500G‼️\n\n*Creatina"))
        assertTrue(offer.finalText.endsWith("https://meli.la/2ZAykt1"))
    }

}
