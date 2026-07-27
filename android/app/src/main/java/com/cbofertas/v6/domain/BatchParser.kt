package com.cbofertas.v6.domain

import java.util.UUID

private val urlRegex = Regex("https?://\\S+", RegexOption.IGNORE_CASE)

fun parseBatchOffers(input: String): List<BatchOffer> {
    val lines = input.replace("\\r", "").lines()
    val current = mutableListOf<String>()
    val offers = mutableListOf<BatchOffer>()

    fun flush(url: String? = null) {
        val text = current.joinToString("\\n").trim()
        if (text.isNotBlank()) {
            val detected = url ?: urlRegex.find(text)?.value?.trimEnd('.', ',', ';', ')', ']') ?: ""
            offers += BatchOffer(
                id = UUID.randomUUID().toString(),
                originalText = text,
                originalUrl = detected,
                title = text.lineSequence().firstOrNull { it.isNotBlank() }.orEmpty().take(120),
            )
        }
        current.clear()
    }

    for (line in lines) {
        if (line.isBlank() && current.isEmpty()) continue
        current += line
        val match = urlRegex.find(line)
        if (match != null) flush(match.value.trimEnd('.', ',', ';', ')', ']'))
    }
    flush()
    return offers
}
