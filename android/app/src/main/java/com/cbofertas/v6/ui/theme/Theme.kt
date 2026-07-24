package com.cbofertas.v6.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Green = Color(0xFF00A650)
private val DarkGreen = Color(0xFF006B35)
private val Yellow = Color(0xFFFFE600)

private val LightColors = lightColorScheme(
    primary = Green,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDDF7DF),
    onPrimaryContainer = DarkGreen,
    secondary = Yellow,
    onSecondary = Color(0xFF282300),
    surface = Color(0xFFF8FAF8),
    surfaceContainer = Color.White,
    background = Color(0xFFF2F5F2),
    error = Color(0xFFB3261E),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF63DD88),
    onPrimary = Color(0xFF003919),
    primaryContainer = Color(0xFF005226),
    onPrimaryContainer = Color(0xFFB8F5C5),
    secondary = Yellow,
    onSecondary = Color(0xFF332E00),
    surface = Color(0xFF111411),
    surfaceContainer = Color(0xFF1A1E1A),
    background = Color(0xFF0E110E),
    error = Color(0xFFFFB4AB),
)

@Composable
fun CbOfertasTheme(darkTheme: Boolean, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
