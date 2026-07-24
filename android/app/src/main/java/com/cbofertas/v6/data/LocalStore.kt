package com.cbofertas.v6.data

import android.content.Context
import com.cbofertas.v6.domain.AffiliateRecord
import com.cbofertas.v6.domain.CouponRecord
import com.cbofertas.v6.domain.FavoriteRecord
import com.cbofertas.v6.domain.HistoryRecord
import com.cbofertas.v6.domain.Product
import org.json.JSONArray
import org.json.JSONObject

class LocalStore(context: Context) {
    private val prefs = context.getSharedPreferences("cbofertas_v6", Context.MODE_PRIVATE)

    var backendUrl: String
        get() = prefs.getString("backend_url", "") ?: ""
        set(value) = prefs.edit().putString("backend_url", value.trim()).apply()

    var darkTheme: Boolean
        get() = prefs.getBoolean("dark_theme", false)
        set(value) = prefs.edit().putBoolean("dark_theme", value).apply()

    fun affiliates(): List<AffiliateRecord> = parseArray("affiliates") { json ->
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
        val now = System.currentTimeMillis()
        val updated = affiliates().filterNot { it.itemId == product.itemId }.toMutableList()
        updated.add(0, AffiliateRecord(product.itemId, affiliateUrl, product.permalink, product.title, now, now))
        putArray("affiliates", updated.map(::affiliateJson))
    }

    fun affiliateFor(itemId: String): AffiliateRecord? = affiliates().firstOrNull { it.itemId == itemId }

    fun markAffiliateUsed(itemId: String) {
        val now = System.currentTimeMillis()
        val updated = affiliates().map { record ->
            if (record.itemId == itemId) record.copy(lastUsedAt = now) else record
        }.sortedByDescending { it.lastUsedAt }
        putArray("affiliates", updated.map(::affiliateJson))
    }

    fun removeAffiliate(itemId: String) {
        putArray("affiliates", affiliates().filterNot { it.itemId == itemId }.map(::affiliateJson))
    }

    fun recordHistory(product: Product) {
        val now = System.currentTimeMillis()
        val existing = history().firstOrNull { it.itemId == product.itemId }
        val price = product.price.current?.amount
        val record = HistoryRecord(
            itemId = product.itemId,
            title = product.title,
            imageUrl = product.imageUrl,
            permalink = product.permalink,
            currentPrice = price,
            originalPrice = product.price.original?.amount,
            minPrice = listOfNotNull(existing?.minPrice, price).minOrNull(),
            maxDiscount = maxOf(existing?.maxDiscount ?: 0, product.price.discountPercent),
            queryCount = (existing?.queryCount ?: 0) + 1,
            lastQueryAt = now,
        )
        putArray("history", (listOf(record) + history().filterNot { it.itemId == product.itemId }).take(300).map(::historyJson))
    }

    fun history(): List<HistoryRecord> = parseArray("history") { json ->
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

    fun favorites(): List<FavoriteRecord> = parseArray("favorites") { json ->
        FavoriteRecord(
            itemId = json.getString("itemId"),
            title = json.optString("title"),
            imageUrl = json.nullableString("imageUrl"),
            permalink = json.optString("permalink"),
            currentPrice = json.nullableDouble("currentPrice"),
            savedAt = json.optLong("savedAt"),
        )
    }

    fun toggleFavorite(product: Product): Boolean {
        val list = favorites().toMutableList()
        val existing = list.indexOfFirst { it.itemId == product.itemId }
        if (existing >= 0) {
            list.removeAt(existing)
            putArray("favorites", list.map(::favoriteJson))
            return false
        }
        list.add(0, FavoriteRecord(product.itemId, product.title, product.imageUrl, product.permalink, product.price.current?.amount, System.currentTimeMillis()))
        putArray("favorites", list.map(::favoriteJson))
        return true
    }

    fun coupons(): List<CouponRecord> = parseArray("coupons") { json ->
        CouponRecord(json.getString("code"), json.optString("description"), json.optBoolean("active", true))
    }

    fun addCoupon(code: String, description: String) {
        val normalized = code.trim().uppercase()
        if (normalized.isBlank()) return
        val records = listOf(CouponRecord(normalized, description.trim(), true)) + coupons().filterNot { it.code == normalized }
        putArray("coupons", records.map { JSONObject().put("code", it.code).put("description", it.description).put("active", it.active) })
    }

    fun removeCoupon(code: String) {
        putArray("coupons", coupons().filterNot { it.code == code }.map { JSONObject().put("code", it.code).put("description", it.description).put("active", it.active) })
    }

    private fun affiliateJson(record: AffiliateRecord) = JSONObject()
        .put("itemId", record.itemId).put("affiliateUrl", record.affiliateUrl)
        .put("originalUrl", record.originalUrl).put("title", record.title)
        .put("savedAt", record.savedAt).put("lastUsedAt", record.lastUsedAt)

    private fun historyJson(record: HistoryRecord) = JSONObject()
        .put("itemId", record.itemId).put("title", record.title).putNullable("imageUrl", record.imageUrl)
        .put("permalink", record.permalink).putNullable("currentPrice", record.currentPrice)
        .putNullable("originalPrice", record.originalPrice).putNullable("minPrice", record.minPrice)
        .put("maxDiscount", record.maxDiscount).put("queryCount", record.queryCount).put("lastQueryAt", record.lastQueryAt)

    private fun favoriteJson(record: FavoriteRecord) = JSONObject()
        .put("itemId", record.itemId).put("title", record.title).putNullable("imageUrl", record.imageUrl)
        .put("permalink", record.permalink).putNullable("currentPrice", record.currentPrice).put("savedAt", record.savedAt)

    private fun <T> parseArray(key: String, parser: (JSONObject) -> T): List<T> {
        val array = runCatching { JSONArray(prefs.getString(key, "[]")) }.getOrDefault(JSONArray())
        return buildList {
            for (index in 0 until array.length()) runCatching { parser(array.getJSONObject(index)) }.getOrNull()?.let(::add)
        }
    }

    private fun putArray(key: String, objects: List<JSONObject>) {
        val array = JSONArray()
        objects.forEach(array::put)
        prefs.edit().putString(key, array.toString()).apply()
    }
}

private fun JSONObject.putNullable(key: String, value: Any?): JSONObject = put(key, value ?: JSONObject.NULL)
private fun JSONObject.nullableString(key: String): String? = if (!has(key) || isNull(key)) null else optString(key).takeIf(String::isNotBlank)
private fun JSONObject.nullableDouble(key: String): Double? = if (!has(key) || isNull(key)) null else optDouble(key)
