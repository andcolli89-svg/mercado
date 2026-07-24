package com.cbofertas.v6.domain

import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val brl = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))
private val dateTime = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("pt", "BR"))

fun Double?.asBrl(): String = if (this == null) "—" else brl.format(this)
fun Long.asDateTime(): String = dateTime.format(Date(this))
