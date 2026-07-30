package com.cbofertas.v6.domain

import java.util.UUID

/**
 * Converte uma oferta confirmada na busca individual em um item da fila do Lote.
 * Mantém a foto e o texto que o usuário revisou, incluindo cupom e parcelamento.
 */
fun Product.toPendingBatchOffer(
    offerText: String,
    affiliateUrl: String = "",
    existing: BatchOffer? = null,
    now: Long = System.currentTimeMillis(),
): BatchOffer {
    val productUrl = permalink.ifBlank { resolvedUrl.ifBlank { sourceUrl } }
    return BatchOffer(
        id = existing?.id ?: UUID.randomUUID().toString(),
        originalText = cleanBatchOfferText(offerText),
        originalUrl = productUrl,
        itemId = itemId,
        title = title,
        imageUrl = imageUrl ?: existing?.imageUrl,
        affiliateUrl = affiliateUrl.ifBlank { existing?.affiliateUrl.orEmpty() },
        status = "pending",
        createdAt = existing?.createdAt ?: now,
        sentAt = null,
    )
}
