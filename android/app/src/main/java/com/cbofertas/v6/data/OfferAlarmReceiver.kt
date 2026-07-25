package com.cbofertas.v6.data

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.cbofertas.v6.ShareOfferActivity

class OfferAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra("schedule_id").orEmpty()
        val store = LocalStore(context)
        val offer = store.scheduleById(id) ?: return

        val channelId = "cbofertas_scheduled_offers"
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    channelId,
                    "Ofertas agendadas",
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    description = "Lembretes para publicar ofertas no WhatsApp Business"
                },
            )
        }

        val shareIntent = Intent(context, ShareOfferActivity::class.java).apply {
            putExtra("offer_text", offer.offerText)
            putExtra("schedule_id", offer.id)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pending = PendingIntent.getActivity(
            context,
            offer.id.hashCode(),
            shareIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Oferta agendada pronta")
            .setContentText(offer.title.ifBlank { "Toque para abrir no WhatsApp Business" })
            .setStyle(NotificationCompat.BigTextStyle().bigText("${offer.title}\nToque para abrir a mensagem pronta no WhatsApp Business."))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .addAction(android.R.drawable.ic_menu_share, "Abrir no WhatsApp Business", pending)
            .build()

        manager.notify(offer.id.hashCode(), notification)

        store.recordShare(offer.itemId, offer.title, "agendamento_disparado")
        store.markScheduleTriggered(offer.id)?.let { OfferScheduler.schedule(context, it) }
    }
}
