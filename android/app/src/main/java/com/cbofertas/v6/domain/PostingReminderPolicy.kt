package com.cbofertas.v6.domain

import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Regra do lembrete periódico de postagem.
 *
 * O lembrete funciona somente dentro da janela diária configurada. Quando a
 * próxima ocorrência ultrapassa o fim da janela, ela é movida para o início
 * do próximo dia.
 */
object PostingReminderPolicy {
    const val DEFAULT_INTERVAL_MINUTES = 30
    const val DEFAULT_START_HOUR = 8
    const val DEFAULT_END_HOUR = 21

    fun isInsideWindow(
        timeMillis: Long,
        startHour: Int = DEFAULT_START_HOUR,
        endHour: Int = DEFAULT_END_HOUR,
        zoneId: ZoneId = ZoneId.systemDefault(),
    ): Boolean {
        val time = Instant.ofEpochMilli(timeMillis).atZone(zoneId)
        val start = time.toLocalDate().atTime(startHour, 0).atZone(zoneId)
        val end = time.toLocalDate().atTime(endHour, 0).atZone(zoneId)
        return !time.isBefore(start) && !time.isAfter(end)
    }

    fun nextTriggerAt(
        fromMillis: Long,
        intervalMinutes: Int = DEFAULT_INTERVAL_MINUTES,
        startHour: Int = DEFAULT_START_HOUR,
        endHour: Int = DEFAULT_END_HOUR,
        zoneId: ZoneId = ZoneId.systemDefault(),
    ): Long {
        require(intervalMinutes >= 15) { "O intervalo deve ser de pelo menos 15 minutos." }
        require(startHour in 0..23 && endHour in 1..23 && startHour < endHour) {
            "A janela diária do lembrete é inválida."
        }

        val from = Instant.ofEpochMilli(fromMillis).atZone(zoneId)
        val todayStart = from.toLocalDate().atTime(startHour, 0).atZone(zoneId)
        val todayEnd = from.toLocalDate().atTime(endHour, 0).atZone(zoneId)

        val next: ZonedDateTime = when {
            from.isBefore(todayStart) -> todayStart
            !from.isBefore(todayEnd) -> todayStart.plusDays(1)
            else -> {
                val candidate = from.plusMinutes(intervalMinutes.toLong())
                if (candidate.isAfter(todayEnd)) todayStart.plusDays(1) else candidate
            }
        }
        return next.toInstant().toEpochMilli()
    }
}
