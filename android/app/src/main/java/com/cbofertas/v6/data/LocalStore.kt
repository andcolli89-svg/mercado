package com.cbofertas.v6.data

import android.content.Context
import com.cbofertas.v6.BuildConfig
import com.cbofertas.v6.domain.AffiliateRecord
import com.cbofertas.v6.domain.FavoriteRecord
import com.cbofertas.v6.domain.HistoryRecord
import com.cbofertas.v6.domain.Product
import org.json.JSONArray
import org.json.JSONObject

class LocalStore(context: Context) {
    private val prefs = context.getSharedPreferences("cbofertas_v6_alpha2", Context.MODE_PRIVATE)

    var backendUrl: String
        get() = prefs.getString("backend_url", null)?.takeIf(String::isNotBlank) ?: BuildConfig.DEFAULT_API_URL
        set(value) = prefs.edit().putString("backend_url", value.trim()).apply()

    var darkTheme: Boolean
        get() = prefs.getBoolean("dark_theme", false)
        set(value) = prefs.edit().putBoolean("dark_theme", value).apply()

    fun affiliates(): List<AffiliateRecord> = readArray("affiliates") { json ->
        AffiliateRecord(
            itemId = json.getString("itemId"),
            affiliateUrl = json.getString("affiliateUrl"),
            originalUrl = json.optString("originalUrl"),
            title = json.optString("title"),
            savedAt = json.optLong("savedAt"),
            lastUsedAt = json.optLong("lastUsedAt"),
        )
    }

    fun saveAffiliate(product: Product, affiliateUrl: String) {
        if (!affiliateUrl.startsWith("https://")) return
        val now = System.currentTimeMillis()
        val updated = listOf(AffiliateRecord(product.itemId, affiliateUrl, product.permalink, product.title, now, now)) +
            affiliates().filterNot { it.itemId == product.itemId }
        writeArray("affiliates", updated.take(500).map { it.toJson() })
    }

    fun affiliateFor(itemId: String): AffiliateRecord? = affiliates().firstOrNull { it.itemId == itemId }

    fun history(): List<HistoryRecord> = readArray("history") { json ->
        HistoryRecord(
            itemId = json.getString("itemId"),
            title = json.optString("title"),
            imageUrl = json.nullableString("imageUrl"),
            permalink = json.optString("permalink"),
            currentPrice = json.nullableDouble("currentPrice"),
            originalPrice = json.nullableDouble("originalPrice"),
            minPrice = json.nullableDouble("minPrice"),
            maxDiscount = json.optInt("maxDiscount"),
            queryCount = json.optInt("queryCount"),
            lastQueryAt = json.optLong("lastQueryAt"),
        )
    }

    fun recordHistory(product: Product) {
        val existing = history().firstOrNull { it.itemId == product.itemId }
        val current = product.price.current?.amount
        val record = HistoryRecord(
            itemId = product.itemId,
            title = product.title,
            imageUrl = product.imageUrl,
            permalink = product.permalink,
            currentPrice = current,
            originalPrice = product.price.original?.amount,
            minPrice = listOfNotNull(existing?.minPrice, current).minOrNull(),
            maxDiscount = maxOf(existing?.maxDiscount ?: 0, product.price.discountPercent),
            queryCount = (existing?.queryCount ?: 0) + 1,
            lastQueryAt = System.currentTimeMillis(),
        )
        writeArray("history", (listOf(record) + history().filterNot { it.itemId == product.itemId }).take(300).map { it.toJson() })
    }

    fun favorites(): List<FavoriteRecord> = readArray("favorites") { json ->
        FavoriteRecord(
            itemId = json.getString("itemId"),
            title = json.optString("title"),
            imageUrl = json.nullableString("imageUrl"),
            permalink = json.optString("permalink"),
            currentPrice = json.nullableDouble("currentPrice"),
            savedAt = json.optLong("savedAt"),
        )
    }

    fun toggleFavorite(product: Product) {
        val existing = favorites()
        val updated = if (existing.any { it.itemId == product.itemId }) {
            existing.filterNot { it.itemId == product.itemId }
        } else {
            listOf(FavoriteRecord(product.itemId, product.title, product.imageUrl, product.permalink, product.price.current?.amount, System.currentTimeMillis())) + existing
        }
        writeArray("favorites", updated.map { it.toJson() })
    }

    fun clearLocalData() {
        val api = backendUrl
        val dark = darkTheme
        prefs.edit().clear().apply()
        backendUrl = api
        darkTheme = dark
    }

    private fun <T> readArray(key: String, mapper: (JSONObject) -> T): List<T> {
        val array = runCatching { JSONArray(prefs.getString(key, "[]")) }.getOrDefault(JSONArray())
        return buildList {
            for (index in 0 until array.length()) {
                runCatching { mapper(array.getJSONObject(index)) }.getOrNull()?.let(::add)
            }
        }
    }

    private fun writeArray(key: String, values: List<JSONObject>) {
        val array = JSONArray()
        values.forEach(array::put)
        prefs.edit().putString(key, array.toString()).apply()
    }
}

private fun AffiliateRecord.toJson() = JSONObject()
    .put("itemId", itemId).put("affiliateUrl", affiliateUrl).put("originalUrl", originalUrl)
    .put("title", title).put("savedAt", savedAt).put("lastUsedAt", lastUsedAt)

private fun HistoryRecord.toJson() = JSONObject()
    .put("itemId", itemId).put("title", title).putNullable("imageUrl", imageUrl)
    .put("permalink", permalink).putNullable("currentPrice", currentPrice)
    .putNullable("originalPrice", originalPrice).putNullable("minPrice", minPrice)
    .put("maxDiscount", maxDiscount).put("queryCount", queryCount).put("lastQueryAt", lastQueryAt)

private fun FavoriteRecord.toJson() = JSONObject()
    .put("itemId", itemId).put("title", title).putNullable("imageUrl", imageUrl)
    .put("permalink", permalink).putNullable("currentPrice", currentPrice).put("savedAt", savedAt)

private fun JSONObject.putNullable(key: String, value: Any?): JSONObject = put(key, value ?: JSONObject.NULL)
private fun JSONObject.nullableString(key: String): String? = if (!has(key) || isNull(key)) null else optString(key).takeIf(String::isNotBlank)
private fun JSONObject.nullableDouble(key: String): Double? = if (!has(key) || isNull(key)) null else optDouble(key)
