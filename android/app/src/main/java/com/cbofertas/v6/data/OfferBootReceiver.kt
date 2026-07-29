package com.cbofertas.v6.data

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class OfferBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            OfferScheduler.rescheduleAll(context)
            PostingReminderScheduler.sync(context)
        }
    }
}
