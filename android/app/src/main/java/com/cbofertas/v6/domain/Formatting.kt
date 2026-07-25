package com.cbofertas.v6.domain

import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

fun Double?.asBrl(): String {
    if (this == null || !this.isFinite()) return "—"
    return NumberFormat.getCurrencyInstance(Locale("pt", "BR")).format(this)
        .replace('\u00A0', ' ')
        .replace('\u202F', ' ')
}

fun Long.asDateTime(): String =
    SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("pt", "BR")).format(Date(this))

fun Product.installmentText(): String? {
    val installment = price.installment ?: return null
    val label = installment.label.orEmpty().trim()
    if (label.isNotBlank()) return label.replace(Regex("\\s+"), " ")
    return "Parcela de ${installment.amount.asBrl()}"
}

fun Product.bestLink(affiliate: AffiliateRecord?): String =
    affiliate?.affiliateUrl?.takeIf(String::isNotBlank)
        ?: permalink.takeIf(String::isNotBlank)
        ?: resolvedUrl

fun Product.offerText(
    phrase: String,
    coupon: String,
    affiliate: AffiliateRecord?,
): String {
    val lines = mutableListOf<String>()
    lines += "😂 “${phrase.trim().trim('“', '”', '\"')}”"
    lines += ""
    lines += title.trim()
    lines += ""

    val original = price.original?.amount
    val current = price.current?.amount
    if (original != null && current != null && original > current) {
        lines += "🔥 De ${original.asBrl()}"
    }
    if (current != null) lines += "💰 Por apenas ${current.asBrl()}"
    if (price.discountPercent > 0) lines += "📉 ${price.discountPercent}% OFF"
    installmentText()?.let { lines += "💳 $it" }
    if (freeShipping) lines += "🚚 Frete grátis"
    sellerName?.takeIf(String::isNotBlank)?.let { lines += "🏪 Vendido por $it" }
    coupon.trim().takeIf(String::isNotBlank)?.let { lines += "🎟️ Use o cupom: $it" }
    lines += ""
    lines += "🛒 Link da oferta:"
    lines += bestLink(affiliate)
    return lines.joinToString("\n")
}
