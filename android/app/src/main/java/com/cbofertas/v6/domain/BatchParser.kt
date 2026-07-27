package com.cbofertas.v6.domain

import java.util.UUID

private val urlRegex = Regex("https?://\\S+", RegexOption.IGNORE_CASE)

private val whatsappBracketPrefix = Regex(
    """^\s*\[\d{1,2}/\d{1,2}(?:/\d{2,4})?(?:,\s*|\s+)\d{1,2}:\d{2}(?::\d{2})?\]\s*(?:-\s*)?(?:~\s*)?(?:\+?\d[\d\s().-]{7,}\d|[^:\n]{1,80}):\s*""",
    RegexOption.IGNORE_CASE,
)

private val whatsappExportPrefix = Regex(
    """^\s*\d{1,2}/\d{1,2}/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*-\s*(?:~\s*)?(?:\+?\d[\d\s().-]{7,}\d|[^:\n]{1,80}):\s*""",
    RegexOption.IGNORE_CASE,
)

private val phoneOnlyPrefix = Regex(
    """^\s*\+?\d[\d\s().-]{7,}\d:\s*""",
)

private val standaloneWhatsAppHeader = Regex(
    """^\s*(?:\[\d{1,2}/\d{1,2}(?:/\d{2,4})?(?:,\s*|\s+)\d{1,2}:\d{2}(?::\d{2})?\]\s*(?:-\s*)?)?(?:~\s*)?\+?\d[\d\s().-]{7,}\d:?\s*$""",
    RegexOption.IGNORE_CASE,
)

private val escapedCrlf = Regex("""\\+r\\+n""", RegexOption.IGNORE_CASE)
private val escapedLineBreak = Regex("""\\+[nr]""", RegexOption.IGNORE_CASE)
private val escapedUnicodeLineBreak = Regex("""\\+u000[ad]""", RegexOption.IGNORE_CASE)

private val forwardedMarker = Regex(
    """^\s*(?:encaminhad[oa]|forwarded)\s*$""",
    RegexOption.IGNORE_CASE,
)

/**
 * Normaliza texto copiado do WhatsApp sem remontar o anúncio.
 *
 * O WhatsApp pode entregar quebras reais ou os caracteres literais "\\n".
 * Também pode acrescentar data, hora e remetente antes da primeira linha.
 */
fun cleanBatchOfferText(input: String): String {
    val normalized = decodeEscapedLineBreaks(input)
        .replace("\r\n", "\n")
        .replace('\r', '\n')
        .replace('\u00A0', ' ')
        .replace("\u200E", "")
        .replace("\u200F", "")
        .replace("\u202A", "")
        .replace("\u202C", "")

    val rawLines = normalized.lines()
    val firstMetadataLine = rawLines.indexOfFirst { line ->
        whatsappBracketPrefix.containsMatchIn(line) || whatsappExportPrefix.containsMatchIn(line)
    }
    val linesToClean = if (
        firstMetadataLine in 1..3 &&
        rawLines.take(firstMetadataLine).none { urlRegex.containsMatchIn(it) }
    ) {
        rawLines.drop(firstMetadataLine)
    } else {
        rawLines
    }

    val cleaned = mutableListOf<String>()
    linesToClean.forEach { rawLine ->
        val line = cleanWhatsAppLine(rawLine) ?: return@forEach
        if (line.isBlank()) {
            if (cleaned.isNotEmpty() && cleaned.last().isNotBlank()) cleaned += ""
        } else {
            cleaned += line.trimEnd()
        }
    }

    while (cleaned.lastOrNull()?.isBlank() == true) cleaned.removeAt(cleaned.lastIndex)
    return cleaned.joinToString("\n").trim()
}


private fun decodeEscapedLineBreaks(input: String): String {
    var value = input
    repeat(4) {
        val decoded = value
            .replace(escapedCrlf, "\n")
            .replace(escapedUnicodeLineBreak, "\n")
            .replace(escapedLineBreak, "\n")
        if (decoded == value) return decoded
        value = decoded
    }
    return value
}

private fun cleanWhatsAppLine(rawLine: String): String? {
    var line = rawLine.trimEnd()
    if (line.isBlank()) return ""
    if (forwardedMarker.matches(line) || standaloneWhatsAppHeader.matches(line)) return null

    var previous: String
    do {
        previous = line
        line = line
            .replaceFirst(whatsappBracketPrefix, "")
            .replaceFirst(whatsappExportPrefix, "")
            .replaceFirst(phoneOnlyPrefix, "")
    } while (line != previous)

    return line.trimStart().takeUnless { forwardedMarker.matches(it) }
}

fun parseBatchOffers(input: String): List<BatchOffer> {
    val normalized = cleanBatchOfferText(input)
    if (normalized.isBlank()) return emptyList()

    val current = mutableListOf<String>()
    val offers = mutableListOf<BatchOffer>()

    fun flush(url: String? = null) {
        val text = cleanBatchOfferText(current.joinToString("\n"))
        if (text.isNotBlank()) {
            val detected = url ?: urlRegex.find(text)?.value?.cleanUrl().orEmpty()
            offers += BatchOffer(
                id = UUID.randomUUID().toString(),
                originalText = text,
                originalUrl = detected,
                title = deriveBatchTitle(text),
            )
        }
        current.clear()
    }

    normalized.lineSequence().forEach { line ->
        if (line.isBlank()) {
            if (current.isNotEmpty() && current.last().isNotBlank()) current += ""
            return@forEach
        }

        val matches = urlRegex.findAll(line).toList()
        if (matches.isEmpty()) {
            current += line
            return@forEach
        }

        var cursor = 0
        matches.forEach { match ->
            val segment = line.substring(cursor, match.range.last + 1).trim()
            if (segment.isNotBlank()) current += segment
            flush(match.value.cleanUrl())
            cursor = match.range.last + 1
        }

        val remaining = line.substring(cursor).trim()
        if (remaining.isNotBlank()) {
            cleanWhatsAppLine(remaining)?.takeIf(String::isNotBlank)?.let(current::add)
        }
    }

    flush()
    return offers
}

private fun String.cleanUrl(): String = trimEnd('.', ',', ';', ')', ']', '}', '!', '?')

private fun deriveBatchTitle(text: String): String = text
    .lineSequence()
    .map(String::trim)
    .firstOrNull { line ->
        line.isNotBlank() &&
            urlRegex.find(line) == null &&
            !line.startsWith("cupom", ignoreCase = true) &&
            !line.startsWith("use o cupom", ignoreCase = true)
    }
    .orEmpty()
    .trim('*', '_', '~', ' ')
    .take(120)
