package com.cbofertas.v6

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import com.cbofertas.v6.data.LocalStore

class ShareOfferActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val text = intent.getStringExtra("offer_text").orEmpty()
        if (text.isBlank()) {
            finish()
            return
        }

        val scheduleId = intent.getStringExtra("schedule_id").orEmpty()
        if (scheduleId.isNotBlank()) {
            LocalStore(this).scheduleById(scheduleId)?.let {
                LocalStore(this).recordShare(it.itemId, it.title, "whatsapp_business")
            }
        }

        val baseIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }

        val opened = openPackage(baseIntent, "com.whatsapp.w4b") || openPackage(baseIntent, "com.whatsapp")
        if (!opened) {
            runCatching { startActivity(Intent.createChooser(baseIntent, "Compartilhar oferta")) }
                .onFailure {
                    Toast.makeText(this, "Nenhum aplicativo de compartilhamento foi encontrado.", Toast.LENGTH_LONG).show()
                }
        }
        finish()
    }

    private fun openPackage(base: Intent, packageName: String): Boolean = runCatching {
        val intent = Intent(base).setPackage(packageName)
        if (intent.resolveActivity(packageManager) == null) return@runCatching false
        startActivity(intent)
        true
    }.getOrDefault(false)
}
