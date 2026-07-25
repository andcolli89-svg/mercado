package com.cbofertas.v6.domain

import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

fun Double?.asBrl(): String {
    if (this == null || !this.isFinite()) return "—"
    return NumberFormat.getCurrencyInstance(Locale("pt", "BR")).format(this)
}

fun Long.asDateTime(): String =
    SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("pt", "BR")).format(Date(this))
