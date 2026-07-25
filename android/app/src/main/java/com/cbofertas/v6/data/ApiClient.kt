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
            requireBaseUrl(baseUrl)
            val payload = JSONObject().put("url", productUrl).toString()
            parseProduct(requestJson("${baseUrl.trimEnd('/')}/v1/products/resolve", "POST", payload).getJSONObject("product"))
        }
    }

    suspend fun radar(baseUrl: String, query: String, limit: Int = 8): Result<List<Product>> = withContext(Dispatchers.IO) {
        runCatching {
            requireBaseUrl(baseUrl)
            val encoded = URLEncoder.encode(query, Charsets.UTF_8.name())
            val response = requestJson("${baseUrl.trimEnd('/')}/v1/radar?query=$encoded&limit=$limit", "GET", null)
            val array = response.optJSONArray("products") ?: JSONArray()
            buildList {
                for (index in 0 until array.length()) add(parseProduct(array.getJSONObject(index)))
            }
        }
    }

    suspend fun health(baseUrl: String): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            requireBaseUrl(baseUrl)
            val json = requestJson("${baseUrl.trimEnd('/')}/health", "GET", null)
            listOf(json.optString("service"), json.optString("version")).filter(String::isNotBlank).joinToString(" ")
        }
    }

    private fun requireBaseUrl(baseUrl: String) {
        require(baseUrl.startsWith("https://")) { "Configure uma URL HTTPS válida para o backend V6." }
    }

    private fun requestJson(url: String, method: String, body: String?): JSONObject {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 20_000
            readTimeout = 35_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("User-Agent", "CbOfertas-Android/6.0-alpha.2")
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
                    ?: "O backend respondeu com código $status."
                error(message)
            }
            return json
        } finally {
            connection.disconnect()
        }
    }

    private fun parseProduct(json: JSONObject): Product {
        val seller = json.optJSONObject("seller") ?: JSONObject()
        val shipping = json.optJSONObject("shipping") ?: JSONObject()
        val images = json.optJSONArray("images") ?: JSONArray()
        val firstImage = if (images.length() > 0) images.optString(0) else null
        return Product(
            platform = json.optString("platform", "mercado_livre"),
            itemId = json.getString("itemId"),
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
            price = parsePrice(json.optJSONObject("price") ?: JSONObject()),
        )
    }

    private fun parsePrice(json: JSONObject): PriceInfo = PriceInfo(
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
        return MoneyEvidence(
            amount = amount,
            kind = json.optString("kind"),
            source = json.optString("source"),
            confidence = json.optDouble("confidence", 0.0),
            currency = json.optString("currency", "BRL"),
            label = json.nullableString("label"),
        )
    }
}

private fun JSONObject.nullableString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).takeIf { it.isNotBlank() && it != "null" }
}
