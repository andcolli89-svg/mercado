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
    onPrimaryContainer = Color(0xFF004D25),
    secondary = Color(0xFFFFE600),
    onSecondary = Color(0xFF2B2700),
    background = Color(0xFFF3F6F3),
    surface = Color.White,
    error = Color(0xFFB3261E),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF65DB8A),
    onPrimary = Color(0xFF003918),
    primaryContainer = Color(0xFF005227),
    onPrimaryContainer = Color(0xFFB9F4C7),
    secondary = Color(0xFFFFE600),
    onSecondary = Color(0xFF2B2700),
    background = Color(0xFF0F120F),
    surface = Color(0xFF191D19),
    error = Color(0xFFFFB4AB),
)

@Composable
fun CbOfertasTheme(darkTheme: Boolean, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
