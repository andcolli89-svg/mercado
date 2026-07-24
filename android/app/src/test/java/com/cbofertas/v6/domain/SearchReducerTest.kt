package com.cbofertas.v6.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SearchReducerTest {
    private val product = Product(
        platform = "mercado_livre",
        itemId = "MLB123",
        catalogProductId = null,
        title = "Produto antigo",
        sellerId = null,
        sellerName = null,
        freeShipping = false,
        logisticType = null,
        imageUrl = null,
        permalink = "https://example.test",
        sourceUrl = "https://example.test",
        resolvedUrl = "https://example.test",
        price = PriceInfo(false, null, null, null, null, null, 0, 0.0, 0.0),
    )

    @Test
    fun novaBuscaRemoveProdutoAnteriorImediatamente() {
        val previous: SearchState = SearchState.Success(product)
        val next = reduceSearch(previous, SearchAction.Start("https://meli.la/nova"))
        assertTrue(next is SearchState.Loading)
    }

    @Test
    fun erroNaoMantemProdutoAntigo() {
        val previous: SearchState = SearchState.Success(product)
        val loading = reduceSearch(previous, SearchAction.Start("https://meli.la/nova"))
        val failed = reduceSearch(loading, SearchAction.Fail("Não foi possível confirmar"))
        assertEquals(SearchState.Error("Não foi possível confirmar"), failed)
    }
}
