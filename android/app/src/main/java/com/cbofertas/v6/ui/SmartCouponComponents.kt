package com.cbofertas.v6.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cbofertas.v6.domain.CouponMatch
import com.cbofertas.v6.domain.CouponRecord
import com.cbofertas.v6.domain.Product
import com.cbofertas.v6.domain.asBrl
import com.cbofertas.v6.domain.couponByCode
import com.cbofertas.v6.domain.couponMatches
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

@Composable
fun SmartCouponEditor(
    coupons: List<CouponRecord>,
    onSave: (CouponRecord) -> Unit,
    onRemove: (String) -> Unit,
) {
    var code by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("fixed") }
    var value by remember { mutableStateOf("") }
    var minimum by remember { mutableStateOf("") }
    var cap by remember { mutableStateOf("") }
    var keywords by remember { mutableStateOf("") }
    var expiration by remember { mutableStateOf("") }
    var confirmed by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("🎟️ Cupons inteligentes", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
        Text("Cadastre regras para a CbOfertas sugerir automaticamente o melhor cupom para cada produto.")

        OutlinedTextField(
            value = code,
            onValueChange = { code = it.uppercase() },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Código do cupom") },
            singleLine = true,
        )
        OutlinedTextField(
            value = description,
            onValueChange = { description = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Descrição") },
            singleLine = true,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AssistChip(
                onClick = { type = "fixed" },
                label = { Text(if (type == "fixed") "✓ Valor em R$" else "Valor em R$") },
            )
            AssistChip(
                onClick = { type = "percent" },
                label = { Text(if (type == "percent") "✓ Porcentagem" else "Porcentagem") },
            )
        }

        OutlinedTextField(
            value = value,
            onValueChange = { value = it.filterMoney() },
            modifier = Modifier.fillMaxWidth(),
            label = { Text(if (type == "percent") "Desconto em %" else "Desconto em R$") },
            singleLine = true,
        )
        OutlinedTextField(
            value = minimum,
            onValueChange = { minimum = it.filterMoney() },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Compra mínima em R$ (opcional)") },
            singleLine = true,
        )
        if (type == "percent") {
            OutlinedTextField(
                value = cap,
                onValueChange = { cap = it.filterMoney() },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Desconto máximo em R$ (opcional)") },
                singleLine = true,
            )
        }
        OutlinedTextField(
            value = keywords,
            onValueChange = { keywords = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Palavras-chave: creatina, celular, cozinha") },
            supportingText = { Text("Separe por vírgula. Vazio significa qualquer produto.") },
        )
        OutlinedTextField(
            value = expiration,
            onValueChange = { expiration = it.take(10) },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Validade dd/MM/aaaa (opcional)") },
            singleLine = true,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Cupom confirmado", fontWeight = FontWeight.Bold)
                Text("Marque apenas quando o anúncio ou a campanha confirmou o código.", style = MaterialTheme.typography.bodySmall)
            }
            Switch(checked = confirmed, onCheckedChange = { confirmed = it })
        }

        Button(
            onClick = {
                onSave(
                    CouponRecord(
                        code = code.trim().uppercase(),
                        description = description.trim(),
                        type = type,
                        value = value.toNumber(),
                        minimumSpend = minimum.toNumber(),
                        maxDiscount = cap.toNumber(),
                        keywords = keywords.trim(),
                        confirmed = confirmed,
                        expiresAt = parseExpiration(expiration),
                    ),
                )
                code = ""
                description = ""
                value = ""
                minimum = ""
                cap = ""
                keywords = ""
                expiration = ""
                confirmed = false
            },
            enabled = code.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Salvar cupom inteligente")
        }

        coupons.forEach { coupon ->
            HorizontalDivider(Modifier.padding(vertical = 4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(coupon.code, fontWeight = FontWeight.ExtraBold)
                    val valueText = if (coupon.value <= 0.0) {
                        "Sem valor estimado"
                    } else if (coupon.type == "percent") {
                        "${coupon.value}%${if (coupon.maxDiscount > 0) " • máx. ${coupon.maxDiscount.asBrl()}" else ""}"
                    } else {
                        coupon.value.asBrl()
                    }
                    Text(valueText, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                    if (coupon.minimumSpend > 0) Text("Mínimo: ${coupon.minimumSpend.asBrl()}", style = MaterialTheme.typography.bodySmall)
                    if (coupon.keywords.isNotBlank()) Text("Para: ${coupon.keywords}", style = MaterialTheme.typography.bodySmall)
                    Text(if (coupon.confirmed) "✅ Confirmado" else "💡 Sugerido", style = MaterialTheme.typography.bodySmall)
                }
                TextButton(onClick = { onRemove(coupon.code) }) { Text("Remover") }
            }
        }
    }
}

@Composable
fun SmartCouponSummary(product: Product, selectedCode: String, coupons: List<CouponRecord>) {
    val matches = product.couponMatches(coupons)
    val selected = product.couponByCode(coupons, selectedCode) ?: matches.firstOrNull()
    if (selected == null) {
        Text("Nenhum cupom inteligente compatível foi identificado.", style = MaterialTheme.typography.bodySmall)
        return
    }

    CouponMatchCard(selected)
}

@Composable
private fun CouponMatchCard(match: CouponMatch) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.fillMaxWidth().padding(12.dp)) {
            Text(
                if (match.coupon.confirmed) "✅ Cupom confirmado: ${match.coupon.code}" else "💡 Cupom sugerido: ${match.coupon.code}",
                fontWeight = FontWeight.ExtraBold,
            )
            if (match.estimatedDiscount > 0) {
                Text("Economia estimada: ${match.estimatedDiscount.asBrl()}")
                Text("Preço estimado: ${match.estimatedPrice.asBrl()}", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Black)
            }
            if (!match.coupon.confirmed) {
                Spacer(Modifier.height(3.dp))
                Text("Confirme o cupom no anúncio antes de publicar.", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

private fun String.filterMoney(): String = filter { it.isDigit() || it == ',' || it == '.' }.take(12)
private fun String.toNumber(): Double {
    val clean = trim()
    if (clean.isBlank()) return 0.0
    return if (clean.contains(',')) {
        clean.replace(".", "").replace(',', '.').toDoubleOrNull() ?: 0.0
    } else {
        clean.toDoubleOrNull() ?: 0.0
    }
}

private fun parseExpiration(value: String): Long? {
    if (value.isBlank()) return null
    val format = SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR")).apply { isLenient = false }
    val parsed = runCatching { format.parse(value) }.getOrNull() ?: return null
    return Calendar.getInstance().apply {
        time = parsed
        set(Calendar.HOUR_OF_DAY, 23)
        set(Calendar.MINUTE, 59)
        set(Calendar.SECOND, 59)
    }.timeInMillis
}
