package com.cbofertas.v6.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF00A650),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDDF7DF),
    onPrimaryContainer = Color(0xFF003919),
    secondary = Color(0xFFFFD600),
    onSecondary = Color(0xFF2B2500),
    secondaryContainer = Color(0xFFFFF4B8),
    onSecondaryContainer = Color(0xFF332B00),
    tertiary = Color(0xFF3483FA),
    onTertiary = Color.White,
    background = Color(0xFFF2F5F2),
    surface = Color.White,
    surfaceVariant = Color(0xFFE8EEE8),
    error = Color(0xFFB3261E),
    errorContainer = Color(0xFFFFDAD6),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF64DC8A),
    onPrimary = Color(0xFF003918),
    primaryContainer = Color(0xFF005227),
    onPrimaryContainer = Color(0xFFB9F4C7),
    secondary = Color(0xFFFFE169),
    onSecondary = Color(0xFF393000),
    secondaryContainer = Color(0xFF544700),
    onSecondaryContainer = Color(0xFFFFEFA4),
    tertiary = Color(0xFFA9C7FF),
    onTertiary = Color(0xFF003064),
    background = Color(0xFF0E120F),
    surface = Color(0xFF181D19),
    surfaceVariant = Color(0xFF252B26),
    error = Color(0xFFFFB4AB),
    errorContainer = Color(0xFF93000A),
)

@Composable
fun CbOfertasTheme(darkTheme: Boolean, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
