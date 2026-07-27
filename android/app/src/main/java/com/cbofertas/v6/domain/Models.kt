package com.cbofertas.v6.domain

data class MoneyEvidence(
    val amount: Double,
    val kind: String,
    val source: String,
    val confidence: Double,
    val currency: String = "BRL",
    val label: String? = null,
)

data class PriceInfo(
    val confirmed: Boolean,
    val current: MoneyEvidence?,
    val original: MoneyEvidence?,
    val installment: MoneyEvidence?,
    val cashback: MoneyEvidence?,
    val unit: MoneyEvidence?,
    val discountPercent: Int,
    val savings: Double,
    val confidence: Double,
    val reason: String? = null,
)

data class Product(
    val platform: String,
    val itemId: String,
    val catalogProductId: String?,
    val title: String,
    val sellerId: String?,
    val sellerName: String?,
    val freeShipping: Boolean,
    val logisticType: String?,
    val imageUrl: String?,
    val permalink: String,
    val sourceUrl: String,
    val resolvedUrl: String,
    val price: PriceInfo,
)

data class AffiliateRecord(
    val itemId: String,
    val affiliateUrl: String,
    val originalUrl: String,
    val title: String,
    val savedAt: Long,
    val lastUsedAt: Long,
)

data class HistoryRecord(
    val itemId: String,
    val title: String,
    val imageUrl: String?,
    val permalink: String,
    val currentPrice: Double?,
    val originalPrice: Double?,
    val minPrice: Double?,
    val maxDiscount: Int,
    val queryCount: Int,
    val lastQueryAt: Long,
)

data class FavoriteRecord(
    val itemId: String,
    val title: String,
    val imageUrl: String?,
    val permalink: String,
    val currentPrice: Double?,
    val savedAt: Long,
)

/**
 * type: "fixed" para desconto em reais ou "percent" para porcentagem.
 * confirmed: true somente quando o usuário sabe que o cupom está confirmado na oferta.
 */
data class CouponRecord(
    val code: String,
    val description: String = "",
    val active: Boolean = true,
    val type: String = "fixed",
    val value: Double = 0.0,
    val minimumSpend: Double = 0.0,
    val maxDiscount: Double = 0.0,
    val keywords: String = "",
    val platform: String = "mercado_livre",
    val expiresAt: Long? = null,
    val confirmed: Boolean = false,
    val savedAt: Long = System.currentTimeMillis(),
)

data class CouponMatch(
    val coupon: CouponRecord,
    val estimatedDiscount: Double,
    val estimatedPrice: Double,
    val confirmation: String,
)

data class ScheduleDraft(
    val itemId: String,
    val title: String,
    val imageUrl: String?,
    val offerText: String,
    val shareUrl: String,
)

data class ScheduledOffer(
    val id: String,
    val itemId: String,
    val title: String,
    val imageUrl: String?,
    val offerText: String,
    val shareUrl: String,
    val scheduledAt: Long,
    val recurrence: String = "once",
    val active: Boolean = true,
    val createdAt: Long = System.currentTimeMillis(),
    val lastTriggeredAt: Long? = null,
)



data class BatchOffer(
    val id: String,
    val originalText: String,
    val originalUrl: String,
    val itemId: String = "",
    val title: String = "",
    val imageUrl: String? = null,
    val affiliateUrl: String = "",
    val status: String = "pending",
    val createdAt: Long = System.currentTimeMillis(),
    val sentAt: Long? = null,
) {
    val finalUrl: String get() = affiliateUrl.ifBlank { originalUrl }
    val finalText: String
        get() = if (originalUrl.isBlank()) originalText.trim()
        else originalText.replace(originalUrl, finalUrl).trim()
}
data class ShareHistoryRecord(
    val id: String,
    val itemId: String,
    val title: String,
    val channel: String,
    val sharedAt: Long,
)

sealed interface SearchState {
    data object Idle : SearchState
    data class Loading(val url: String) : SearchState
    data class Success(val product: Product) : SearchState
    data class Error(val message: String) : SearchState
}

sealed interface SearchAction {
    data class Start(val url: String) : SearchAction
    data class Succeed(val product: Product) : SearchAction
    data class Fail(val message: String) : SearchAction
    data object Clear : SearchAction
}

fun reduceSearch(action: SearchAction): SearchState = when (action) {
    is SearchAction.Start -> SearchState.Loading(action.url)
    is SearchAction.Succeed -> SearchState.Success(action.product)
    is SearchAction.Fail -> SearchState.Error(action.message)
    SearchAction.Clear -> SearchState.Idle
}
