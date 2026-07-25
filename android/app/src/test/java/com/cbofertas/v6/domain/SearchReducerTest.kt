package com.cbofertas.v6.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SearchReducerTest {
    @Test
    fun `nova consulta sempre limpa produto anterior`() {
        val state = reduceSearch(SearchAction.Start("https://meli.la/teste"))
        assertEquals(SearchState.Loading("https://meli.la/teste"), state)
    }

    @Test
    fun `falha nao preserva dados anteriores`() {
        val state = reduceSearch(SearchAction.Fail("Não confirmado"))
        assertTrue(state is SearchState.Error)
    }
}
