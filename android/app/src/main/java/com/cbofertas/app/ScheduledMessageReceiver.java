package com.cbofertas.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

public class ScheduledMessageReceiver extends BroadcastReceiver {
    private static final String CHANNEL_ID = "cbofertas_agendamentos";

    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra("schedule_id");
        String title = intent.getStringExtra("schedule_title");
        String text = intent.getStringExtra("schedule_text");
        String image = intent.getStringExtra("schedule_image");
        String group = intent.getStringExtra("schedule_group");
        boolean automatic = intent.getBooleanExtra("schedule_automatic", false);
        boolean testMode = intent.getBooleanExtra("schedule_test_mode", true);
        if (id == null) id = "cbofertas";
        if (title == null || title.trim().isEmpty()) title = "Oferta agendada";
        if (text == null) text = "";
        if (image == null) image = "";

        createChannel(context);

        if (automatic) {
            String activeJob = context.getSharedPreferences(WhatsAppAutomationService.PREFS, Context.MODE_PRIVATE)
                    .getString(WhatsAppAutomationService.KEY_JOB, "");
            if (activeJob != null && !activeJob.trim().isEmpty()) {
                ScheduleManager.schedule(context, id, System.currentTimeMillis() + 120000L, title, text, image,
                        group == null ? "" : group, true, testMode, true);
                return;
            }
        }

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        openIntent.putExtra("scheduled_share", true);
        openIntent.putExtra("scheduled_text", text);
        openIntent.putExtra("scheduled_image", image);
        openIntent.putExtra("scheduled_group", group == null ? "" : group);
        openIntent.putExtra("scheduled_automatic", automatic);
        openIntent.putExtra("scheduled_test_mode", testMode);
        openIntent.putExtra("scheduled_id", id);
        PendingIntent contentIntent = PendingIntent.getActivity(
                context,
                id.hashCode(),
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_send)
                .setContentTitle("CbOfertas — mensagem agendada")
                .setContentText(automatic ? title + " será processada pelo piloto automático." : title + " está pronta para compartilhar.")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(automatic
                        ? "Piloto automático preparado para o grupo: " + (group == null ? "" : group)
                        : "Toque para abrir o compartilhamento de: " + title))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(contentIntent)
                .setFullScreenIntent(contentIntent, automatic)
                .addAction(android.R.drawable.ic_menu_share, "Compartilhar agora", contentIntent);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            NotificationManagerCompat.from(context).notify(id.hashCode(), builder.build());
        }
        if (automatic) {
            try { context.startActivity(openIntent); } catch (Exception ignored) { }
        }
        ScheduleManager.removeStored(context, id);
    }

    private void createChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "Mensagens agendadas",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Avisos das ofertas agendadas no CbOfertas");
                manager.createNotificationChannel(channel);
            }
        }
    }
}
