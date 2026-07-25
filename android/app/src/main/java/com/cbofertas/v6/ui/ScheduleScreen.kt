package com.cbofertas.v6.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cbofertas.v6.domain.ScheduleDraft
import com.cbofertas.v6.domain.ScheduledOffer
import com.cbofertas.v6.domain.ShareHistoryRecord
import com.cbofertas.v6.domain.asDateTime
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.UUID

@Composable
fun ScheduleScreen(
    draft: ScheduleDraft?,
    schedules: List<ScheduledOffer>,
    shareHistory: List<ShareHistoryRecord>,
    message: String?,
    onDraftConsumed: () -> Unit,
    onSchedule: (ScheduledOffer) -> Unit,
    onCancel: (ScheduledOffer) -> Unit,
    onShareNow: (ScheduledOffer) -> Unit,
) {
    val initial = Calendar.getInstance().apply { add(Calendar.MINUTE, 10) }
    var date by remember { mutableStateOf(SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR")).format(initial.time)) }
    var time by remember { mutableStateOf(SimpleDateFormat("HH:mm", Locale("pt", "BR")).format(initial.time)) }
    var recurrence by remember { mutableStateOf("once") }
    var localError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(draft?.itemId, draft?.offerText) {
        if (draft != null) {
            val future = Calendar.getInstance().apply { add(Calendar.MINUTE, 10) }
            date = SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR")).format(future.time)
            time = SimpleDateFormat("HH:mm", Locale("pt", "BR")).format(future.time)
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Column {
                Text("🗓️ Agenda de ofertas", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Black)
                Text("No horário escolhido, uma notificação abre o WhatsApp Business com a mensagem pronta.")
            }
        }

        if (draft != null) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(22.dp),
                ) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                        Text("Nova publicação", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                        Text(draft.title, fontWeight = FontWeight.Bold)
                        OutlinedTextField(
                            value = date,
                            onValueChange = { date = it.take(10) },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Data dd/MM/aaaa") },
                            singleLine = true,
                        )
                        OutlinedTextField(
                            value = time,
                            onValueChange = { time = it.take(5) },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Horário HH:mm") },
                            singleLine = true,
                        )
                        Text("Repetição", fontWeight = FontWeight.Bold)
                        Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            AssistChip(onClick = { recurrence = "once" }, label = { Text(if (recurrence == "once") "✓ Uma vez" else "Uma vez") })
                            AssistChip(onClick = { recurrence = "daily" }, label = { Text(if (recurrence == "daily") "✓ Diário" else "Diário") })
                            AssistChip(onClick = { recurrence = "weekly" }, label = { Text(if (recurrence == "weekly") "✓ Semanal" else "Semanal") })
                        }
                        Button(
                            onClick = {
                                val whenMillis = parseDateTime(date, time)
                                if (whenMillis == null) {
                                    localError = "Informe uma data e um horário futuros válidos."
                                } else {
                                    localError = null
                                    onSchedule(
                                        ScheduledOffer(
                                            id = UUID.randomUUID().toString(),
                                            itemId = draft.itemId,
                                            title = draft.title,
                                            imageUrl = draft.imageUrl,
                                            offerText = draft.offerText,
                                            shareUrl = draft.shareUrl,
                                            scheduledAt = whenMillis,
                                            recurrence = recurrence,
                                        ),
                                    )
                                    onDraftConsumed()
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Agendar oferta") }
                        if (!localError.isNullOrBlank()) {
                            Text(localError.orEmpty(), color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.SemiBold)
                        }
                        TextButton(onClick = onDraftConsumed, modifier = Modifier.fillMaxWidth()) { Text("Cancelar criação") }
                    }
                }
            }
        }

        if (!message.isNullOrBlank()) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                    Text(message, modifier = Modifier.fillMaxWidth().padding(13.dp), fontWeight = FontWeight.SemiBold)
                }
            }
        }

        if (schedules.isEmpty()) {
            item { Text("Nenhuma oferta agendada.") }
        }

        items(schedules, key = { it.id }) { offer ->
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(20.dp),
            ) {
                Column(Modifier.fillMaxWidth().padding(15.dp)) {
                    Text(offer.title, fontWeight = FontWeight.ExtraBold)
                    Text(offer.scheduledAt.asDateTime(), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Black)
                    Text(
                        when (offer.recurrence) {
                            "daily" -> "Repete diariamente"
                            "weekly" -> "Repete semanalmente"
                            else -> "Publicação única"
                        },
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Text(if (offer.active) "🟢 Ativo" else "⚪ Concluído", style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { onShareNow(offer) }, modifier = Modifier.fillMaxWidth()) { Text("Abrir agora no WhatsApp Business") }
                    Spacer(Modifier.height(6.dp))
                    OutlinedButton(onClick = { onCancel(offer) }, modifier = Modifier.fillMaxWidth()) { Text("Cancelar e remover") }
                }
            }
        }

        if (shareHistory.isNotEmpty()) {
            item {
                Column {
                    Text("Últimos compartilhamentos", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                    Text("Registro local das ofertas abertas para publicação.")
                }
            }
            items(shareHistory.take(20), key = { it.id }) { record ->
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(12.dp)) {
                        Text(record.title, fontWeight = FontWeight.Bold)
                        Text(record.sharedAt.asDateTime(), color = MaterialTheme.colorScheme.primary)
                        Text(
                            when (record.channel) {
                                "whatsapp_business" -> "WhatsApp Business"
                                "agendamento_disparado" -> "Lembrete agendado"
                                else -> "Outro aplicativo"
                            },
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }

    }
}

private fun parseDateTime(date: String, time: String): Long? {
    val format = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("pt", "BR")).apply { isLenient = false }
    val parsed = runCatching { format.parse("$date $time") }.getOrNull() ?: return null
    return parsed.time.takeIf { it > System.currentTimeMillis() }
}
