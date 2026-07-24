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

class ApiClient {
    suspend fun resolveProduct(baseUrl: String, productUrl: String): Result<Product> = withContext(Dispatchers.IO) {
        runCatching {
            val payload = JSONObject().put("url", productUrl).toString()
            val json = requestJson("${baseUrl.trimEnd('/')}/v1/products/resolve", "POST", payload)
            parseProduct(json.getJSONObject("product"))
        }
    }

    suspend fun radar(baseUrl: String, query: String, limit: Int = 8): Result<List<Product>> = withContext(Dispatchers.IO) {
        runCatching {
            val encoded = java.net.URLEncoder.encode(query, Charsets.UTF_8.name())
            val json = requestJson("${baseUrl.trimEnd('/')}/v1/radar?query=$encoded&limit=$limit", "GET", null)
            val products = json.optJSONArray("products") ?: JSONArray()
            buildList {
                for (index in 0 until products.length()) add(parseProduct(products.getJSONObject(index)))
            }
        }
    }

    suspend fun health(baseUrl: String): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val json = requestJson("${baseUrl.trimEnd('/')}/health", "GET", null)
            "${json.optString("service")} ${json.optString("version")}".trim()
        }
    }

    private fun requestJson(url: String, method: String, body: String?): JSONObject {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 20_000
            readTimeout = 30_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("User-Agent", "CbOfertas-Android/6.0")
            doInput = true
            if (body != null) doOutput = true
        }
        if (body != null) connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { reader -> reader.readText() }.orEmpty()
        connection.disconnect()
        val json = runCatching { JSONObject(text) }.getOrElse { JSONObject() }
        if (status !in 200..299) {
            val message = json.optJSONObject("error")?.optString("message")
                ?.takeIf { it.isNotBlank() }
                ?: "O servidor respondeu com código $status."
            throw IllegalStateException(message)
        }
        return json
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
            title = json.optString("title", "Produto"),
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
        return MoneyEvidence(
            amount = json.optDouble("amount"),
            kind = json.optString("kind"),
            source = json.optString("source"),
            confidence = json.optDouble("confidence"),
            currency = json.optString("currency", "BRL"),
            label = json.nullableString("label"),
        )
    }
}

private fun JSONObject.nullableString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).takeIf { it.isNotBlank() && it != "null" }
}
