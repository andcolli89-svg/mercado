package com.cbofertas.v6.data

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.cbofertas.v6.MainActivity
import com.cbofertas.v6.domain.PostingReminderPolicy

class PostingReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val store = LocalStore(context)
        if (!store.postingReminderEnabled) return

        val now = System.currentTimeMillis()
        val insideWindow = PostingReminderPolicy.isInsideWindow(
            timeMillis = now,
            startHour = store.postingReminderStartHour,
            endHour = store.postingReminderEndHour,
        )
        val pendingCount = store.batchOffers().count { it.status == "pending" }

        if (insideWindow && pendingCount > 0) {
            showNotification(context, pendingCount)
        }

        PostingReminderScheduler.scheduleNext(context, now)
    }

    private fun showNotification(context: Context, pendingCount: Int) {
        val channelId = "cbofertas_posting_reminders"
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    channelId,
                    "Lembretes de postagem",
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    description = "Avisos a cada 30 minutos, das 8h às 21h, para publicar ofertas"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0L, 250L, 160L, 250L)
                },
            )
        }

        val openIntent = Intent(context, MainActivity::class.java).apply {
            putExtra("open_page", "batch")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            60431,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val message = if (pendingCount == 1) {
            "Há 1 anúncio pendente. Toque para preparar e publicar."
        } else {
            "Há $pendingCount anúncios pendentes. Toque para preparar e publicar."
        }

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Hora de publicar outra oferta")
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_SOUND or NotificationCompat.DEFAULT_VIBRATE)
            .setVibrate(longArrayOf(0L, 250L, 160L, 250L))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_menu_view, "Abrir anúncios pendentes", pendingIntent)
            .build()

        manager.notify(60430, notification)
    }
}
