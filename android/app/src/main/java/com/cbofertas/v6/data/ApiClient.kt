package com.cbofertas.v6.data

import com.cbofertas.v6.domain.MoneyEvidence
import com.cbofertas.v6.domain.PriceInfo
import com.cbofertas.v6.domain.Product
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class ApiClient {
    suspend fun resolveProduct(baseUrl: String, productUrl: String): Result<Product> = withContext(Dispatchers.IO) {
        runCatching {
            val base = normalizedBase(baseUrl)
            try {
                val payload = JSONObject().put("url", productUrl).toString()
                val response = requestJson("$base/v1/products/resolve", "POST", payload)
                parseV6Product(response.getJSONObject("product"))
            } catch (error: BackendHttpException) {
                if (error.status !in listOf(404, 405)) throw error
                val encoded = URLEncoder.encode(productUrl, Charsets.UTF_8.name())
                parseV5Product(requestJson("$base/api/product?url=$encoded", "GET", null), base, productUrl)
            }
        }
    }

    suspend fun radar(baseUrl: String, query: String, limit: Int = 10): Result<List<Product>> = withContext(Dispatchers.IO) {
        runCatching {
            val base = normalizedBase(baseUrl)
            val encoded = URLEncoder.encode(query, Charsets.UTF_8.name())
            try {
                val response = requestJson("$base/v1/radar?query=$encoded&limit=$limit", "GET", null)
                parseProductArray(response.optJSONArray("products") ?: JSONArray(), ::parseV6Product)
            } catch (error: BackendHttpException) {
                if (error.status !in listOf(404, 405)) throw error
                val response = requestJson("$base/api/radar?query=$encoded&limit=$limit", "GET", null)
                parseProductArray(response.optJSONArray("items") ?: JSONArray()) { parseV5RadarProduct(it, base) }
            }
        }
    }

    suspend fun health(baseUrl: String): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val base = normalizedBase(baseUrl)
            val json = requestJson("$base/health", "GET", null)
            val service = json.optString("service").ifBlank { json.optString("app", "CbOfertas") }
            val version = json.optString("version")
            "$service $version".trim()
        }
    }

    private fun normalizedBase(baseUrl: String): String {
        val value = baseUrl.trim().trimEnd('/')
        require(value.startsWith("https://")) { "Configure uma URL HTTPS válida para o backend." }
        return value
    }

    private fun requestJson(url: String, method: String, body: String?): JSONObject {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 25_000
            readTimeout = 45_000
            instanceFollowRedirects = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("User-Agent", "CbOfertas-Android/6.0-alpha.4")
            doInput = true
            doOutput = body != null
        }
        try {
            if (body != null) connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(text) }.getOrDefault(JSONObject())
            if (status !in 200..299) {
                val message = json.optJSONObject("error")?.optString("message")
                    ?.takeIf(String::isNotBlank)
                    ?: json.optString("error").takeIf(String::isNotBlank)
                    ?: "O backend respondeu com código $status."
                throw BackendHttpException(status, message)
            }
            return json
        } finally {
            connection.disconnect()
        }
    }

    private fun parseV6Product(json: JSONObject): Product {
        val seller = json.optJSONObject("seller") ?: JSONObject()
        val shipping = json.optJSONObject("shipping") ?: JSONObject()
        val images = json.optJSONArray("images") ?: JSONArray()
        val firstImage = if (images.length() > 0) images.optString(0) else null
        return Product(
            platform = json.optString("platform", "mercado_livre"),
            itemId = json.nullableString("itemId")
                ?: json.nullableString("catalogProductId")
                ?: json.optString("permalink").hashCode().toString(),
            catalogProductId = json.nullableString("catalogProductId"),
            title = json.optString("title", "Produto sem título"),
            sellerId = seller.opt("id")?.toString()?.takeUnless { it == "null" },
            sellerName = seller.nullableString("nickname"),
            freeShipping = shipping.optBoolean("free", false),
            logisticType = shipping.nullableString("logisticType"),
            imageUrl = json.nullableString("thumbnail") ?: firstImage,
            permalink = json.optString("permalink"),
            sourceUrl = json.optString("sourceUrl"),
            resolvedUrl = json.optString("resolvedUrl"),
            price = parseV6Price(json.optJSONObject("price") ?: JSONObject()),
        )
    }

    private fun parseV5Product(json: JSONObject, base: String, requestedUrl: String): Product {
        val current = json.firstPositiveDouble("currentPrice", "price", "pixPrice")
        val original = json.firstPositiveDouble("originalPrice", "oldPrice")?.takeIf { current == null || it > current }
        val installmentAmount = json.firstPositiveDouble("installmentAmount")
        val installments = json.optInt("installments", 0)
        val itemId = json.optString("id").ifBlank {
            Regex("MLB[-_]?(\\d+)", RegexOption.IGNORE_CASE).find(json.optString("permalink"))
                ?.groupValues?.getOrNull(1)?.let { "MLB$it" }.orEmpty()
        }
        val image = json.nullableString("image")
            ?: json.nullableString("imageProxy")?.let { absoluteUrl(base, it) }
        val discount = json.optInt("discount", computedDiscount(current, original))
        val savings = if (current != null && original != null && original > current) original - current else 0.0
        return Product(
            platform = json.optString("platform", "mercado_livre"),
            itemId = itemId.ifBlank { "MLB-${json.optString("catalogProductId").ifBlank { requestedUrl.hashCode().toString() }}" },
            catalogProductId = json.nullableString("catalogProductId"),
            title = json.optString("title", "Produto do Mercado Livre"),
            sellerId = null,
            sellerName = json.nullableString("seller") ?: json.nullableString("store"),
            freeShipping = json.optBoolean("freeShipping", false),
            logisticType = if (json.optBoolean("full", false)) "fulfillment" else null,
            imageUrl = image,
            permalink = json.optString("affiliateLink").ifBlank {
                json.optString("permalink").ifBlank { json.optString("originalPermalink", requestedUrl) }
            },
            sourceUrl = requestedUrl,
            resolvedUrl = json.optString("originalPermalink").ifBlank { json.optString("permalink", requestedUrl) },
            price = PriceInfo(
                confirmed = current != null,
                current = current?.let { evidence(it, "current", "v5_compat", 0.8, "Preço confirmado pelo backend atual") },
                original = original?.let { evidence(it, "original", "v5_compat", 0.78, "Preço original") },
                installment = installmentAmount?.let {
                    evidence(it, "installment", "v5_compat", 0.8, if (installments > 0) "${installments}x de ${it.asMoneyLabel()}" else "Parcela de ${it.asMoneyLabel()}")
                },
                cashback = null,
                unit = null,
                discountPercent = discount.coerceAtLeast(0),
                savings = savings,
                confidence = if (current != null) 0.8 else 0.0,
                reason = if (current == null) "O backend atual identificou o produto, mas não confirmou o preço." else null,
            ),
        )
    }

    private fun parseV5RadarProduct(json: JSONObject, base: String): Product {
        val current = json.firstPositiveDouble("price", "currentPrice")
        val original = json.firstPositiveDouble("oldPrice", "originalPrice")?.takeIf { current == null || it > current }
        val link = json.optString("link").ifBlank { json.optString("permalink") }
        val itemId = json.optString("itemId").ifBlank { json.optString("id") }
        val discount = json.optInt("discount", computedDiscount(current, original))
        return Product(
            platform = "mercado_livre",
            itemId = itemId.ifBlank { link.hashCode().toString() },
            catalogProductId = json.nullableString("catalogProductId"),
            title = json.optString("title", "Oferta do Mercado Livre"),
            sellerId = null,
            sellerName = json.nullableString("seller"),
            freeShipping = json.optBoolean("freeShipping", false),
            logisticType = if (json.optBoolean("full", false)) "fulfillment" else null,
            imageUrl = json.nullableString("image")?.let { absoluteUrl(base, it) },
            permalink = link,
            sourceUrl = link,
            resolvedUrl = link,
            price = PriceInfo(
                confirmed = current != null,
                current = current?.let { evidence(it, "current", "v5_radar_compat", 0.76, "Preço do Radar") },
                original = original?.let { evidence(it, "original", "v5_radar_compat", 0.74, "Preço anterior") },
                installment = null,
                cashback = null,
                unit = null,
                discountPercent = discount.coerceAtLeast(0),
                savings = if (current != null && original != null && original > current) original - current else 0.0,
                confidence = json.optDouble("priceConfidence", if (current != null) 0.76 else 0.0),
                reason = null,
            ),
        )
    }

    private fun parseV6Price(json: JSONObject): PriceInfo = PriceInfo(
        confirmed = json.optBoolean("confirmed", false),
        current = parseEvidence(json.optJSONObject("current")),
        original = parseEvidence(json.optJSONObject("original")),
        installment = parseEvidence(json.optJSONObject("installment")),
        cashback = parseEvidence(json.optJSONObject("cashback")),
        unit = parseEvidence(json.optJSONObject("unit")),
        discountPercent = json.optInt("discountPercent", 0),
        savings = json.optDouble("savings", 0.0),
        confidence = json.optDouble("confidence", 0.0),
        reason = json.nullableString("reason"),
    )

    private fun parseEvidence(json: JSONObject?): MoneyEvidence? {
        if (json == null || !json.has("amount")) return null
        val amount = json.optDouble("amount", Double.NaN)
        if (!amount.isFinite() || amount <= 0.0) return null
        return evidence(
            amount = amount,
            kind = json.optString("kind"),
            source = json.optString("source"),
            confidence = json.optDouble("confidence", 0.0),
            label = json.nullableString("label"),
            currency = json.optString("currency", "BRL"),
        )
    }

    private fun evidence(
        amount: Double,
        kind: String,
        source: String,
        confidence: Double,
        label: String?,
        currency: String = "BRL",
    ) = MoneyEvidence(amount, kind, source, confidence, currency, label)

    private fun parseProductArray(array: JSONArray, parser: (JSONObject) -> Product): List<Product> = buildList {
        for (index in 0 until array.length()) {
            runCatching { parser(array.getJSONObject(index)) }.getOrNull()?.let(::add)
        }
    }

    private fun absoluteUrl(base: String, value: String): String = when {
        value.startsWith("https://") || value.startsWith("http://") -> value
        value.startsWith("/") -> "$base$value"
        else -> "$base/$value"
    }

    private fun computedDiscount(current: Double?, original: Double?): Int {
        if (current == null || original == null || original <= current) return 0
        return ((1.0 - current / original) * 100.0).toInt().coerceIn(0, 99)
    }
}

private class BackendHttpException(val status: Int, message: String) : Exception(message)

private fun JSONObject.nullableString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).takeIf { it.isNotBlank() && it != "null" }
}

private fun JSONObject.firstPositiveDouble(vararg keys: String): Double? {
    for (key in keys) {
        if (!has(key) || isNull(key)) continue
        val raw = opt(key)
        val number = when (raw) {
            is Number -> raw.toDouble()
            is String -> raw.replace("R$", "").replace(".", "").replace(",", ".").trim().toDoubleOrNull()
            else -> null
        }
        if (number != null && number.isFinite() && number > 0.0) return number
    }
    return null
}

private fun Double.asMoneyLabel(): String = "R$ %.2f".format(java.util.Locale("pt", "BR"), this)
