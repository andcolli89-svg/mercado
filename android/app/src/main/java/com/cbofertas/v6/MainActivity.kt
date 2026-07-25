package com.cbofertas.v6

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.cbofertas.v6.ui.CbOfertasApp

class MainActivity : ComponentActivity() {
    private var sharedUrl by mutableStateOf("")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sharedUrl = extractUrl(intent)
        setContent {
            CbOfertasApp(
                sharedUrl = sharedUrl,
                onSharedUrlConsumed = { sharedUrl = "" },
            )
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        sharedUrl = extractUrl(intent)
    }

    private fun extractUrl(intent: Intent?): String {
        if (intent?.action != Intent.ACTION_SEND || intent.type != "text/plain") return ""
        val text = intent.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
        return Regex("https?://\\S+", RegexOption.IGNORE_CASE)
            .find(text)
            ?.value
            ?.trimEnd('.', ',', ';', ')', ']')
            .orEmpty()
    }
}
