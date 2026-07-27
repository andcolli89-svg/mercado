package com.cbofertas.v6.data

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.cbofertas.v6.domain.cleanBatchOfferText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL

object ShareUtils {
    suspend fun shareToWhatsAppBusiness(
        context: Context,
        text: String,
        imageUrl: String?,
    ): Boolean = withContext(Dispatchers.IO) {
        val safeText = cleanBatchOfferText(text)
        val imageFile = imageUrl?.takeIf { it.startsWith("http") }?.let { downloadImage(context, it) }
        withContext(Dispatchers.Main) {
            val intent = Intent(Intent.ACTION_SEND).apply {
                putExtra(Intent.EXTRA_TEXT, safeText)
                if (imageFile != null) {
                    type = "image/*"
                    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", imageFile)
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                } else {
                    type = "text/plain"
                }
                setPackage("com.whatsapp.w4b")
            }
            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
                true
            } else {
                val fallback = Intent(intent).setPackage("com.whatsapp")
                if (fallback.resolveActivity(context.packageManager) != null) {
                    context.startActivity(fallback)
                    true
                } else false
            }
        }
    }

    private fun downloadImage(context: Context, imageUrl: String): File? = runCatching {
        val dir = File(context.cacheDir, "shared_images").apply { mkdirs() }
        val file = File(dir, "offer_${imageUrl.hashCode()}.jpg")
        if (!file.exists() || file.length() == 0L) {
            URL(imageUrl).openConnection().apply {
                connectTimeout = 15_000
                readTimeout = 20_000
                setRequestProperty("User-Agent", "Mozilla/5.0 CbOfertas")
            }.getInputStream().use { input -> file.outputStream().use(input::copyTo) }
        }
        file
    }.getOrNull()
}
