package com.cbofertas.v6.data

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.cbofertas.v6.domain.PostingReminderPolicy

object PostingReminderScheduler {
    private const val REQUEST_CODE = 60430

    fun sync(context: Context, fromMillis: Long = System.currentTimeMillis()) {
        val store = LocalStore(context)
        if (!store.postingReminderEnabled) {
            cancel(context)
            return
        }
        scheduleNext(context, fromMillis)
    }

    fun resetAfterPosting(context: Context, postedAt: Long = System.currentTimeMillis()) {
        if (!LocalStore(context).postingReminderEnabled) return
        scheduleNext(context, postedAt)
    }

    fun scheduleNext(context: Context, fromMillis: Long = System.currentTimeMillis()) {
        val store = LocalStore(context)
        if (!store.postingReminderEnabled) {
            cancel(context)
            return
        }

        val triggerAt = PostingReminderPolicy.nextTriggerAt(
            fromMillis = fromMillis,
            intervalMinutes = store.postingReminderIntervalMinutes,
            startHour = store.postingReminderStartHour,
            endHour = store.postingReminderEndHour,
        )
        store.postingReminderNextAt = triggerAt

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            triggerAt,
            alarmIntent(context),
        )
    }

    fun cancel(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(alarmIntent(context))
        LocalStore(context).postingReminderNextAt = 0L
    }

    private fun alarmIntent(context: Context): PendingIntent {
        val intent = Intent(context, PostingReminderReceiver::class.java)
        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
