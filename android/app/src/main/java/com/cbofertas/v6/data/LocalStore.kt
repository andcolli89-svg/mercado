package com.cbofertas.v6.data

import android.content.Context
import com.cbofertas.v6.BuildConfig
import com.cbofertas.v6.domain.AffiliateRecord
import com.cbofertas.v6.domain.BatchOffer
import com.cbofertas.v6.domain.cleanBatchOfferText
import com.cbofertas.v6.domain.CouponRecord
import com.cbofertas.v6.domain.FavoriteRecord
import com.cbofertas.v6.domain.HistoryRecord
import com.cbofertas.v6.domain.Product
import com.cbofertas.v6.domain.ScheduledOffer
import com.cbofertas.v6.domain.ShareHistoryRecord
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class LocalStore(context: Context) {
    private val prefs = context.getSharedPreferences("cbofertas_v6_alpha4", Context.MODE_PRIVATE)
    private val legacyPrefs = context.getSharedPreferences("cbofertas_v6_alpha2", Context.MODE_PRIVATE)

    init {
        migrateLegacyIfNeeded()
    }

    var backendUrl: String
        get() = prefs.getString("backend_url", null)?.takeIf(String::isNotBlank) ?: BuildConfig.DEFAULT_API_URL
        set(value) = prefs.edit().putString("backend_url", value.trim()).apply()

    var darkTheme: Boolean
        get() = prefs.getBoolean("dark_theme", false)
        set(value) = prefs.edit().putBoolean("dark_theme", value).apply()

    var postingReminderEnabled: Boolean
        get() = prefs.getBoolean("posting_reminder_enabled", false)
        set(value) = prefs.edit().putBoolean("posting_reminder_enabled", value).apply()

    var postingReminderIntervalMinutes: Int
        get() = prefs.getInt("posting_reminder_interval_minutes", 30).coerceAtLeast(15)
        set(value) = prefs.edit().putInt("posting_reminder_interval_minutes", value.coerceAtLeast(15)).apply()

    var postingReminderStartHour: Int
        get() = prefs.getInt("posting_reminder_start_hour", 8).coerceIn(0, 22)
        set(value) = prefs.edit().putInt("posting_reminder_start_hour", value.coerceIn(0, 22)).apply()

    var postingReminderEndHour: Int
        get() = prefs.getInt("posting_reminder_end_hour", 21).coerceIn(1, 23)
        set(value) = prefs.edit().putInt("posting_reminder_end_hour", value.coerceIn(1, 23)).apply()

    var postingReminderNextAt: Long
        get() = prefs.getLong("posting_reminder_next_at", 0L)
        set(value) = prefs.edit().putLong("posting_reminder_next_at", value).apply()

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
        val clean = affiliateUrl.trim()
        if (!clean.startsWith("https://")) return
        val now = System.currentTimeMillis()
        val existing = affiliates().firstOrNull { it.itemId == product.itemId }
        val record = AffiliateRecord(
            itemId = product.itemId,
            affiliateUrl = clean,
            originalUrl = product.permalink,
            title = product.title,
            savedAt = existing?.savedAt ?: now,
            lastUsedAt = now,
        )
        writeArray("affiliates", (listOf(record) + affiliates().filterNot { it.itemId == product.itemId }).take(500).map { it.toJson() })
    }

    fun markAffiliateUsed(itemId: String) {
        val now = System.currentTimeMillis()
        writeArray("affiliates", affiliates().map { if (it.itemId == itemId) it.copy(lastUsedAt = now) else it }.map { it.toJson() })
    }

    fun removeAffiliate(itemId: String) {
        writeArray("affiliates", affiliates().filterNot { it.itemId == itemId }.map { it.toJson() })
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
            listOf(
                FavoriteRecord(
                    itemId = product.itemId,
                    title = product.title,
                    imageUrl = product.imageUrl,
                    permalink = product.permalink,
                    currentPrice = product.price.current?.amount,
                    savedAt = System.currentTimeMillis(),
                ),
            ) + existing
        }
        writeArray("favorites", updated.map { it.toJson() })
    }

    fun coupons(): List<CouponRecord> = readArray("coupons") { json ->
        CouponRecord(
            code = json.getString("code"),
            description = json.optString("description"),
            active = json.optBoolean("active", true),
            type = json.optString("type", "fixed"),
            value = json.optDouble("value", 0.0),
            minimumSpend = json.optDouble("minimumSpend", 0.0),
            maxDiscount = json.optDouble("maxDiscount", 0.0),
            keywords = json.optString("keywords"),
            platform = json.optString("platform", "mercado_livre"),
            expiresAt = json.nullableLong("expiresAt"),
            confirmed = json.optBoolean("confirmed", false),
            savedAt = json.optLong("savedAt", System.currentTimeMillis()),
        )
    }

    fun saveCoupon(record: CouponRecord) {
        val clean = record.code.trim().uppercase()
        if (clean.isBlank()) return
        val existing = coupons().firstOrNull { it.code.equals(clean, ignoreCase = true) }
        val normalized = record.copy(code = clean, savedAt = existing?.savedAt ?: record.savedAt)
        writeArray("coupons", (listOf(normalized) + coupons().filterNot { it.code.equals(clean, ignoreCase = true) }).take(150).map { it.toJson() })
    }

    fun saveCoupon(code: String, description: String = "") {
        saveCoupon(CouponRecord(code = code, description = description))
    }

    fun removeCoupon(code: String) {
        writeArray("coupons", coupons().filterNot { it.code.equals(code, ignoreCase = true) }.map { it.toJson() })
    }

    fun schedules(): List<ScheduledOffer> = readArray("schedules") { json ->
        ScheduledOffer(
            id = json.getString("id"),
            itemId = json.optString("itemId"),
            title = json.optString("title"),
            imageUrl = json.nullableString("imageUrl"),
            offerText = json.optString("offerText"),
            shareUrl = json.optString("shareUrl"),
            scheduledAt = json.optLong("scheduledAt"),
            recurrence = json.optString("recurrence", "once"),
            active = json.optBoolean("active", true),
            createdAt = json.optLong("createdAt", System.currentTimeMillis()),
            lastTriggeredAt = json.nullableLong("lastTriggeredAt"),
        )
    }.sortedBy { it.scheduledAt }

    fun saveSchedule(record: ScheduledOffer) {
        val normalized = if (record.id.isBlank()) record.copy(id = UUID.randomUUID().toString()) else record
        writeArray("schedules", (listOf(normalized) + schedules().filterNot { it.id == normalized.id }).take(250).map { it.toJson() })
    }

    fun removeSchedule(id: String) {
        writeArray("schedules", schedules().filterNot { it.id == id }.map { it.toJson() })
    }

    fun scheduleById(id: String): ScheduledOffer? = schedules().firstOrNull { it.id == id }

    fun markScheduleTriggered(id: String, now: Long = System.currentTimeMillis()): ScheduledOffer? {
        val existing = scheduleById(id) ?: return null
        val next = when (existing.recurrence) {
            "daily" -> existing.copy(
                scheduledAt = advanceToFuture(existing.scheduledAt, 24L * 60L * 60L * 1000L, now),
                lastTriggeredAt = now,
                active = true,
            )
            "weekly" -> existing.copy(
                scheduledAt = advanceToFuture(existing.scheduledAt, 7L * 24L * 60L * 60L * 1000L, now),
                lastTriggeredAt = now,
                active = true,
            )
            else -> existing.copy(lastTriggeredAt = now, active = false)
        }
        saveSchedule(next)
        return next.takeIf { it.active }
    }

    fun batchOffers(): List<BatchOffer> = readArray("batch_offers") { json ->
        BatchOffer(
            id = json.getString("id"),
            originalText = cleanBatchOfferText(json.optString("originalText")),
            originalUrl = json.optString("originalUrl"),
            itemId = json.optString("itemId"),
            title = json.optString("title"),
            imageUrl = json.nullableString("imageUrl"),
            affiliateUrl = json.optString("affiliateUrl"),
            status = json.optString("status", "pending"),
            createdAt = json.optLong("createdAt", System.currentTimeMillis()),
            sentAt = json.nullableLong("sentAt"),
        )
    }.sortedByDescending { it.createdAt }

    fun saveBatchOffers(records: List<BatchOffer>) {
        val existing = batchOffers().associateBy { it.id }.toMutableMap()
        records.forEach { existing[it.id] = it }
        writeArray("batch_offers", existing.values.sortedByDescending { it.createdAt }.take(1000).map { it.toJson() })
    }

    fun updateBatchOffer(record: BatchOffer) {
        saveBatchOffers(listOf(record))
    }

    fun removeBatchOffer(id: String) {
        writeArray("batch_offers", batchOffers().filterNot { it.id == id }.map { it.toJson() })
    }

    fun markBatchSent(id: String, sent: Boolean = true) {
        val now = System.currentTimeMillis()
        val updated = batchOffers().map {
            if (it.id == id) it.copy(status = if (sent) "sent" else "pending", sentAt = if (sent) now else null) else it
        }
        writeArray("batch_offers", updated.map { it.toJson() })
    }

    fun shareHistory(): List<ShareHistoryRecord> = readArray("share_history") { json ->
        ShareHistoryRecord(
            id = json.getString("id"),
            itemId = json.optString("itemId"),
            title = json.optString("title"),
            channel = json.optString("channel"),
            sharedAt = json.optLong("sharedAt"),
        )
    }

    fun recordShare(itemId: String, title: String, channel: String) {
        val record = ShareHistoryRecord(
            id = UUID.randomUUID().toString(),
            itemId = itemId,
            title = title,
            channel = channel,
            sharedAt = System.currentTimeMillis(),
        )
        writeArray("share_history", (listOf(record) + shareHistory()).take(500).map { it.toJson() })
    }

    fun clearLocalData() {
        val api = backendUrl
        val dark = darkTheme
        prefs.edit().clear().putBoolean("legacy_migrated", true).apply()
        backendUrl = api
        darkTheme = dark
    }

    private fun migrateLegacyIfNeeded() {
        if (prefs.getBoolean("legacy_migrated", false)) return
        val editor = prefs.edit()
        for (key in listOf("backend_url", "dark_theme", "affiliates", "history", "favorites", "coupons")) {
            if (!legacyPrefs.contains(key)) continue
            when (val value = legacyPrefs.all[key]) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
            }
        }
        editor.putBoolean("legacy_migrated", true).apply()
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

private fun advanceToFuture(start: Long, interval: Long, now: Long): Long {
    var next = start + interval
    while (next <= now) next += interval
    return next
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

private fun CouponRecord.toJson() = JSONObject()
    .put("code", code).put("description", description).put("active", active)
    .put("type", type).put("value", value).put("minimumSpend", minimumSpend)
    .put("maxDiscount", maxDiscount).put("keywords", keywords).put("platform", platform)
    .putNullable("expiresAt", expiresAt).put("confirmed", confirmed).put("savedAt", savedAt)

private fun ScheduledOffer.toJson() = JSONObject()
    .put("id", id).put("itemId", itemId).put("title", title).putNullable("imageUrl", imageUrl)
    .put("offerText", offerText).put("shareUrl", shareUrl).put("scheduledAt", scheduledAt)
    .put("recurrence", recurrence).put("active", active).put("createdAt", createdAt)
    .putNullable("lastTriggeredAt", lastTriggeredAt)


private fun BatchOffer.toJson() = JSONObject()
    .put("id", id).put("originalText", originalText).put("originalUrl", originalUrl)
    .put("itemId", itemId).put("title", title).putNullable("imageUrl", imageUrl)
    .put("affiliateUrl", affiliateUrl).put("status", status).put("createdAt", createdAt)
    .putNullable("sentAt", sentAt)

private fun ShareHistoryRecord.toJson() = JSONObject()
    .put("id", id).put("itemId", itemId).put("title", title)
    .put("channel", channel).put("sharedAt", sharedAt)

private fun JSONObject.putNullable(key: String, value: Any?): JSONObject = put(key, value ?: JSONObject.NULL)
private fun JSONObject.nullableString(key: String): String? = if (!has(key) || isNull(key)) null else optString(key).takeIf(String::isNotBlank)
private fun JSONObject.nullableDouble(key: String): Double? = if (!has(key) || isNull(key)) null else optDouble(key)
private fun JSONObject.nullableLong(key: String): Long? = if (!has(key) || isNull(key)) null else optLong(key)
