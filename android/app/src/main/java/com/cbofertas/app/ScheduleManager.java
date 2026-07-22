package com.cbofertas.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONObject;

import java.util.Map;

final class ScheduleManager {
    private static final String PREFS = "cbofertas_schedules";

    private ScheduleManager() { }

    static void schedule(Context context, String id, long when, String title, String text, String imageUrl, boolean store) {
        Intent intent = new Intent(context, ScheduledMessageReceiver.class);
        intent.setAction("com.cbofertas.app.SCHEDULED_MESSAGE");
        intent.putExtra("schedule_id", id);
        intent.putExtra("schedule_title", title);
        intent.putExtra("schedule_text", text);
        intent.putExtra("schedule_image", imageUrl);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                id.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) throw new IllegalStateException("Serviço de agendamento indisponível.");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pendingIntent);
        } else {
            alarmManager.set(AlarmManager.RTC_WAKEUP, when, pendingIntent);
        }

        if (store) {
            try {
                JSONObject json = new JSONObject();
                json.put("id", id);
                json.put("when", when);
                json.put("title", title);
                json.put("text", text);
                json.put("image", imageUrl == null ? "" : imageUrl);
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(id, json.toString()).apply();
            } catch (Exception error) {
                cancel(context, id);
                throw new IllegalStateException("Não foi possível salvar o agendamento.");
            }
        }
    }

    static void cancel(Context context, String id) {
        Intent intent = new Intent(context, ScheduledMessageReceiver.class);
        intent.setAction("com.cbofertas.app.SCHEDULED_MESSAGE");
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                id.hashCode(),
                intent,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (pendingIntent != null && alarmManager != null) {
            alarmManager.cancel(pendingIntent);
            pendingIntent.cancel();
        }
        removeStored(context, id);
    }

    static void removeStored(Context context, String id) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(id).apply();
    }

    static void restoreAll(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Map<String, ?> all = prefs.getAll();
        long now = System.currentTimeMillis();
        for (Map.Entry<String, ?> entry : all.entrySet()) {
            try {
                JSONObject json = new JSONObject(String.valueOf(entry.getValue()));
                long when = json.optLong("when", 0L);
                if (when <= now) {
                    prefs.edit().remove(entry.getKey()).apply();
                    continue;
                }
                schedule(
                        context,
                        json.optString("id", entry.getKey()),
                        when,
                        json.optString("title", "Oferta agendada"),
                        json.optString("text", ""),
                        json.optString("image", ""),
                        false
                );
            } catch (Exception ignored) {
                prefs.edit().remove(entry.getKey()).apply();
            }
        }
    }
}
