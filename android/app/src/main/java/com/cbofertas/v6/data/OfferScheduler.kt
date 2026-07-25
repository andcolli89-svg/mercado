package com.cbofertas.v6.data

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.cbofertas.v6.domain.ScheduledOffer

object OfferScheduler {
    fun schedule(context: Context, offer: ScheduledOffer) {
        if (!offer.active) return
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerAt = maxOf(System.currentTimeMillis() + 3_000L, offer.scheduledAt)
        alarmManager.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            triggerAt,
            alarmIntent(context, offer.id),
        )
    }

    fun cancel(context: Context, id: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(alarmIntent(context, id))
    }

    fun rescheduleAll(context: Context) {
        LocalStore(context).schedules()
            .filter { it.active }
            .forEach { schedule(context, it) }
    }

    private fun alarmIntent(context: Context, id: String): PendingIntent {
        val intent = Intent(context, OfferAlarmReceiver::class.java).putExtra("schedule_id", id)
        return PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
