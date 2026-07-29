package com.cbofertas.v6.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneId

class PostingReminderPolicyTest {
    private val zone = ZoneId.of("America/Sao_Paulo")

    @Test
    fun beforeEightSchedulesAtEight() {
        val from = time(2026, 7, 29, 7, 20)
        assertEquals(time(2026, 7, 29, 8, 0), PostingReminderPolicy.nextTriggerAt(from, zoneId = zone))
    }

    @Test
    fun insideWindowSchedulesThirtyMinutesLater() {
        val from = time(2026, 7, 29, 10, 15)
        assertEquals(time(2026, 7, 29, 10, 45), PostingReminderPolicy.nextTriggerAt(from, zoneId = zone))
    }

    @Test
    fun twentyThirtySchedulesFinalReminderAtTwentyOne() {
        val from = time(2026, 7, 29, 20, 30)
        assertEquals(time(2026, 7, 29, 21, 0), PostingReminderPolicy.nextTriggerAt(from, zoneId = zone))
    }

    @Test
    fun afterClosingSchedulesNextDayAtEight() {
        val from = time(2026, 7, 29, 21, 1)
        assertEquals(time(2026, 7, 30, 8, 0), PostingReminderPolicy.nextTriggerAt(from, zoneId = zone))
    }

    @Test
    fun windowIncludesEightAndTwentyOne() {
        assertTrue(PostingReminderPolicy.isInsideWindow(time(2026, 7, 29, 8, 0), zoneId = zone))
        assertTrue(PostingReminderPolicy.isInsideWindow(time(2026, 7, 29, 21, 0), zoneId = zone))
        assertFalse(PostingReminderPolicy.isInsideWindow(time(2026, 7, 29, 21, 1), zoneId = zone))
    }

    private fun time(year: Int, month: Int, day: Int, hour: Int, minute: Int): Long =
        LocalDateTime.of(year, month, day, hour, minute).atZone(zone).toInstant().toEpochMilli()
}
