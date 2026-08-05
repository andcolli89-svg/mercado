package com.cbofertas.app;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;

public final class CbDatabaseHelper extends SQLiteOpenHelper {
    private static final String DB_NAME = "cbofertas_v7.db";
    private static final int DB_VERSION = 1;

    public CbDatabaseHelper(Context context) { super(context, DB_NAME, null, DB_VERSION); }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE offers (id TEXT PRIMARY KEY,title TEXT NOT NULL DEFAULT '',message TEXT NOT NULL DEFAULT '',original_link TEXT NOT NULL DEFAULT '',affiliate_link TEXT NOT NULL DEFAULT '',image TEXT NOT NULL DEFAULT '',old_price TEXT NOT NULL DEFAULT '',offer_price TEXT NOT NULL DEFAULT '',coupon TEXT NOT NULL DEFAULT '',category TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,last_used_at INTEGER NOT NULL DEFAULT 0,use_count INTEGER NOT NULL DEFAULT 0,copied_at INTEGER NOT NULL DEFAULT 0,exported_at INTEGER NOT NULL DEFAULT 0)");
        db.execSQL("CREATE TABLE usage_history (id INTEGER PRIMARY KEY AUTOINCREMENT,offer_id TEXT NOT NULL,event_type TEXT NOT NULL,coupon TEXT NOT NULL DEFAULT '',used_at INTEGER NOT NULL,details TEXT NOT NULL DEFAULT '')");
        db.execSQL("CREATE INDEX idx_usage_offer ON usage_history(offer_id,used_at DESC)");
        db.execSQL("CREATE TABLE saved_exports (id TEXT PRIMARY KEY,name TEXT NOT NULL DEFAULT '',payload TEXT NOT NULL,created_at INTEGER NOT NULL,last_used_at INTEGER NOT NULL DEFAULT 0,item_count INTEGER NOT NULL DEFAULT 0)");
    }

    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { }

    public synchronized String upsertOffer(String json) {
        try {
            JSONObject o = new JSONObject(json == null ? "{}" : json);
            String id = o.optString("id", "").trim();
            if (id.isEmpty()) id = "offer-" + System.currentTimeMillis();
            long now = System.currentTimeMillis();
            ContentValues v = new ContentValues();
            v.put("id", id); v.put("title", o.optString("title", ""));
            v.put("message", o.optString("message", o.optString("text", "")));
            v.put("original_link", o.optString("originalLink", o.optString("link", "")));
            v.put("affiliate_link", o.optString("affiliateLink", o.optString("finalLink", "")));
            v.put("image", o.optString("image", "")); v.put("old_price", o.optString("oldPrice", ""));
            v.put("offer_price", o.optString("offerPrice", o.optString("price", "")));
            v.put("coupon", o.optString("coupon", "")); v.put("category", o.optString("category", ""));
            v.put("status", o.optString("status", "pending")); v.put("created_at", o.optLong("createdAt", now));
            v.put("updated_at", now); v.put("last_used_at", o.optLong("lastUsedAt", 0));
            v.put("use_count", o.optInt("useCount", 0)); v.put("copied_at", o.optLong("copiedAt", 0));
            v.put("exported_at", o.optLong("exportedAt", 0));
            getWritableDatabase().insertWithOnConflict("offers", null, v, SQLiteDatabase.CONFLICT_REPLACE);
            return id;
        } catch (Exception error) { return ""; }
    }

    public synchronized String listOffers() {
        JSONArray result = new JSONArray();
        try (Cursor c = getReadableDatabase().rawQuery("SELECT * FROM offers ORDER BY updated_at DESC", null)) {
            while (c.moveToNext()) {
                JSONObject o = new JSONObject();
                o.put("id", c.getString(c.getColumnIndexOrThrow("id")));
                o.put("title", c.getString(c.getColumnIndexOrThrow("title")));
                o.put("message", c.getString(c.getColumnIndexOrThrow("message")));
                o.put("originalLink", c.getString(c.getColumnIndexOrThrow("original_link")));
                o.put("affiliateLink", c.getString(c.getColumnIndexOrThrow("affiliate_link")));
                o.put("image", c.getString(c.getColumnIndexOrThrow("image")));
                o.put("coupon", c.getString(c.getColumnIndexOrThrow("coupon")));
                o.put("status", c.getString(c.getColumnIndexOrThrow("status")));
                o.put("lastUsedAt", c.getLong(c.getColumnIndexOrThrow("last_used_at")));
                o.put("useCount", c.getInt(c.getColumnIndexOrThrow("use_count")));
                result.put(o);
            }
        } catch (Exception ignored) { }
        return result.toString();
    }

    public synchronized boolean deleteOffer(String id) {
        return getWritableDatabase().delete("offers", "id=?", new String[]{id}) > 0;
    }

    public synchronized void recordUsage(String offerId, String type, String coupon, String details) {
        long now = System.currentTimeMillis();
        SQLiteDatabase db = getWritableDatabase();
        ContentValues h = new ContentValues();
        h.put("offer_id", offerId == null ? "" : offerId); h.put("event_type", type == null ? "used" : type);
        h.put("coupon", coupon == null ? "" : coupon); h.put("used_at", now);
        h.put("details", details == null ? "" : details); db.insert("usage_history", null, h);
        ContentValues u = new ContentValues(); u.put("last_used_at", now);
        if ("copied".equals(type)) u.put("copied_at", now);
        if ("exported".equals(type)) u.put("exported_at", now);
        db.update("offers", u, "id=?", new String[]{offerId == null ? "" : offerId});
        db.execSQL("UPDATE offers SET use_count=use_count+1 WHERE id=?", new Object[]{offerId == null ? "" : offerId});
    }

    public synchronized String listUsage(String offerId) {
        JSONArray result = new JSONArray();
        try (Cursor c = getReadableDatabase().rawQuery("SELECT event_type,coupon,used_at,details FROM usage_history WHERE offer_id=? ORDER BY used_at DESC", new String[]{offerId == null ? "" : offerId})) {
            while (c.moveToNext()) {
                JSONObject o = new JSONObject(); o.put("type", c.getString(0)); o.put("coupon", c.getString(1));
                o.put("usedAt", c.getLong(2)); o.put("details", c.getString(3)); result.put(o);
            }
        } catch (Exception ignored) { }
        return result.toString();
    }

    public synchronized boolean saveExport(String id, String name, String payload, int count) {
        ContentValues v = new ContentValues(); v.put("id", id); v.put("name", name == null ? "" : name);
        v.put("payload", payload == null ? "{}" : payload); v.put("created_at", System.currentTimeMillis());
        v.put("last_used_at", 0); v.put("item_count", Math.max(0, count));
        return getWritableDatabase().insertWithOnConflict("saved_exports", null, v, SQLiteDatabase.CONFLICT_REPLACE) != -1;
    }

    public synchronized String listExports() {
        JSONArray result = new JSONArray();
        try (Cursor c = getReadableDatabase().rawQuery("SELECT id,name,payload,created_at,last_used_at,item_count FROM saved_exports ORDER BY created_at DESC LIMIT 30", null)) {
            while (c.moveToNext()) {
                JSONObject o = new JSONObject(); o.put("id", c.getString(0)); o.put("name", c.getString(1));
                o.put("payload", c.getString(2)); o.put("createdAt", c.getLong(3));
                o.put("lastUsedAt", c.getLong(4)); o.put("itemCount", c.getInt(5)); result.put(o);
            }
        } catch (Exception ignored) { }
        return result.toString();
    }

    public synchronized boolean deleteExport(String id) {
        return getWritableDatabase().delete("saved_exports", "id=?", new String[]{id}) > 0;
    }
}
