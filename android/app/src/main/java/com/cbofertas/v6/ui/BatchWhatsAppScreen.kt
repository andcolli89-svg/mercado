package com.cbofertas.v6.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.produceState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.Image
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URL
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cbofertas.v6.domain.BatchOffer

@Composable
fun BatchWhatsAppScreen(
    offers: List<BatchOffer>,
    loadingIds: Set<String>,
    onImport: (String) -> Unit,
    onResolve: (BatchOffer) -> Unit,
    onUseClipboardAffiliate: (BatchOffer) -> Unit,
    onOpen: (String) -> Unit,
    onShare: (BatchOffer) -> Unit,
    onMarkSent: (BatchOffer, Boolean) -> Unit,
    onDelete: (BatchOffer) -> Unit,
) {
    var input by remember { mutableStateOf("") }
    var tab by remember { mutableStateOf("pending") }
    val shown = offers.filter { it.status == tab }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text("📥 Lote WhatsApp", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
            Text("Cole vários anúncios. O aplicativo separa cada oferta, busca a foto e troca pelos links afiliados já salvos.")
        }
        item {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                modifier = Modifier.fillMaxWidth(),
                minLines = 7,
                label = { Text("Cole aqui os anúncios copiados do WhatsApp") },
                placeholder = { Text("Texto do anúncio...\nCupom...\nhttps://meli.la/...") },
            )
        }
        item {
            Button(
                onClick = { if (input.isNotBlank()) { onImport(input); input = "" } },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Separar anúncios") }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(onClick = { tab = "pending" }, label = { Text("Pendentes (${offers.count { it.status == "pending" }})") })
                AssistChip(onClick = { tab = "sent" }, label = { Text("Enviados (${offers.count { it.status == "sent" }})") })
            }
        }
        if (shown.isEmpty()) {
            item { Text(if (tab == "pending") "Nenhum anúncio pendente." else "Nenhum anúncio enviado.") }
        }
        items(shown, key = { it.id }) { offer ->
            BatchOfferCard(
                offer = offer,
                loading = offer.id in loadingIds,
                onResolve = { onResolve(offer) },
                onUseClipboardAffiliate = { onUseClipboardAffiliate(offer) },
                onOpen = { onOpen(offer.originalUrl) },
                onShare = { onShare(offer) },
                onMarkSent = { onMarkSent(offer, offer.status != "sent") },
                onDelete = { onDelete(offer) },
            )
        }
    }
}

@Composable
private fun BatchOfferCard(
    offer: BatchOffer,
    loading: Boolean,
    onResolve: () -> Unit,
    onUseClipboardAffiliate: () -> Unit,
    onOpen: () -> Unit,
    onShare: () -> Unit,
    onMarkSent: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            BatchRemoteImage(offer.imageUrl)
            Text(offer.title.ifBlank { "Anúncio sem título" }, fontWeight = FontWeight.Bold)
            Text("Texto que será enviado", style = MaterialTheme.typography.labelLarge, color = Color(0xFF00A650))
            Text(
                offer.finalText.take(1600),
                style = MaterialTheme.typography.bodyMedium,
                lineHeight = 21.sp,
            )
            when {
                offer.affiliateUrl.isNotBlank() -> Text("✅ Link afiliado aplicado", color = Color(0xFF00A650), fontWeight = FontWeight.Bold)
                offer.itemId.isNotBlank() -> Text("🟡 Produto identificado; falta seu link afiliado")
                else -> Text("🔎 Produto ainda não identificado")
            }
            Text("Link final: ${offer.finalUrl}", style = MaterialTheme.typography.bodySmall)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onResolve, enabled = !loading) { Text(if (loading) "Buscando..." else "Buscar foto") }
                OutlinedButton(onClick = onOpen, enabled = offer.originalUrl.isNotBlank()) { Text("Abrir ML") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onUseClipboardAffiliate) { Text("Usar link copiado") }
                Button(onClick = onShare) { Text("WhatsApp Business") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onMarkSent) { Text(if (offer.status == "sent") "Voltar para pendentes" else "Marcar como enviado") }
                TextButton(onClick = onDelete) { Text("Excluir") }
            }
        }
    }
}


@Composable
private fun BatchRemoteImage(url: String?) {
    val bitmap by produceState<Bitmap?>(initialValue = null, url) {
        value = if (url.isNullOrBlank()) null else withContext(Dispatchers.IO) {
            runCatching { URL(url).openStream().use(BitmapFactory::decodeStream) }.getOrNull()
        }
    }
    if (bitmap != null) {
        Image(
            bitmap = bitmap!!.asImageBitmap(),
            contentDescription = "Foto do produto",
            modifier = Modifier.fillMaxWidth().size(170.dp),
            contentScale = ContentScale.Fit,
        )
    }
}
