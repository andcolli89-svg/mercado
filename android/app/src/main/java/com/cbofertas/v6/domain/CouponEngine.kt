package com.cbofertas.v6.domain

import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round

private fun money(value: Double): Double = round(value * 100.0) / 100.0

private fun String.normalized(): String = lowercase(Locale("pt", "BR")).trim()

fun CouponRecord.matches(product: Product, now: Long = System.currentTimeMillis()): Boolean {
    if (!active) return false
    if (expiresAt != null && expiresAt < now) return false
    if (platform.isNotBlank() && platform.normalized() != product.platform.normalized()) return false
    val current = product.price.current?.amount ?: return false
    if (current < minimumSpend) return false

    val terms = keywords.split(',', ';', '|')
        .map { it.normalized() }
        .filter { it.isNotBlank() }
    if (terms.isEmpty()) return true

    val haystack = "${product.title} ${product.itemId} ${product.catalogProductId.orEmpty()}".normalized()
    return terms.any(haystack::contains)
}

fun CouponRecord.estimatedDiscount(currentPrice: Double): Double {
    if (currentPrice <= 0.0 || value <= 0.0) return 0.0
    val raw = if (type.equals("percent", ignoreCase = true)) {
        currentPrice * (value / 100.0)
    } else {
        value
    }
    val capped = if (maxDiscount > 0.0) min(raw, maxDiscount) else raw
    return money(min(currentPrice, max(0.0, capped)))
}

fun Product.couponMatches(coupons: List<CouponRecord>): List<CouponMatch> {
    val current = price.current?.amount ?: return emptyList()
    return coupons.asSequence()
        .filter { it.matches(this) }
        .map { coupon ->
            val discount = coupon.estimatedDiscount(current)
            CouponMatch(
                coupon = coupon,
                estimatedDiscount = discount,
                estimatedPrice = money(max(0.0, current - discount)),
                confirmation = if (coupon.confirmed) "confirmed" else "suggested",
            )
        }
        .filter { it.estimatedDiscount > 0.0 || it.coupon.code.isNotBlank() }
        .sortedWith(
            compareByDescending<CouponMatch> { it.coupon.confirmed }
                .thenByDescending { it.estimatedDiscount }
                .thenBy { it.coupon.code },
        )
        .toList()
}

fun Product.bestCoupon(coupons: List<CouponRecord>): CouponMatch? = couponMatches(coupons).firstOrNull()

fun Product.couponByCode(coupons: List<CouponRecord>, code: String): CouponMatch? {
    if (code.isBlank()) return null
    return couponMatches(coupons).firstOrNull { it.coupon.code.equals(code.trim(), ignoreCase = true) }
}
