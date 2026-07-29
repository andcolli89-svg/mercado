package com.cbofertas.v6.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cbofertas.v6.data.ApiClient
import com.cbofertas.v6.data.LocalStore
import com.cbofertas.v6.data.OfferScheduler
import com.cbofertas.v6.data.PhraseLibrary
import com.cbofertas.v6.data.PostingReminderScheduler
import com.cbofertas.v6.data.ShareUtils
import com.cbofertas.v6.domain.AffiliateRecord
import com.cbofertas.v6.domain.BatchOffer
import com.cbofertas.v6.domain.CouponRecord
import com.cbofertas.v6.domain.FavoriteRecord
import com.cbofertas.v6.domain.HistoryRecord
import com.cbofertas.v6.domain.Product
import com.cbofertas.v6.domain.ScheduleDraft
import com.cbofertas.v6.domain.ScheduledOffer
import com.cbofertas.v6.domain.ShareHistoryRecord
import com.cbofertas.v6.domain.SearchAction
import com.cbofertas.v6.domain.SearchState
import com.cbofertas.v6.domain.asBrl
import com.cbofertas.v6.domain.asDateTime
import com.cbofertas.v6.domain.bestLink
import com.cbofertas.v6.domain.bestCoupon
import com.cbofertas.v6.domain.couponByCode
import com.cbofertas.v6.domain.couponMatches
import com.cbofertas.v6.domain.installmentText
import com.cbofertas.v6.domain.offerText
import com.cbofertas.v6.domain.parseBatchOffers
import com.cbofertas.v6.domain.reduceSearch
import com.cbofertas.v6.ui.theme.CbOfertasTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URL

private val MercadoYellow = Color(0xFFFFE600)
private val MercadoGreen = Color(0xFF00A650)
private val WhatsAppGreen = Color(0xFF1FA855)

private enum class BatchPreparationMode { ALL, LINKS, PHOTOS }

enum class Page(val title: String, val symbol: String) {
    HOME("Início", "⌂"),
    RADAR("Radar", "⚡"),
    BATCH("Lote", "📥"),
    HISTORY("Histórico", "◷"),
    FAVORITES("Favoritos", "★"),
    AFFILIATES("Afiliados", "🔗"),
    AGENDA("Agenda", "🗓"),
    SETTINGS("Ajustes", "⚙"),
}

@Composable
fun CbOfertasApp(
    sharedUrl: String,
    onSharedUrlConsumed: () -> Unit,
    requestedPage: String = "",
    onRequestedPageConsumed: () -> Unit = {},
) {
    val context = LocalContext.current
    val store = remember { LocalStore(context) }
    val api = remember { ApiClient() }
    val phrases = remember { PhraseLibrary(context) }
    val scope = rememberCoroutineScope()

    var page by remember { mutableStateOf(Page.HOME) }
    var darkTheme by remember { mutableStateOf(store.darkTheme) }
    var backendUrl by remember { mutableStateOf(store.backendUrl) }
    var postingReminderEnabled by remember { mutableStateOf(store.postingReminderEnabled) }
    var postingReminderNextAt by remember { mutableStateOf(store.postingReminderNextAt) }
    var urlInput by remember { mutableStateOf("") }
    var searchState by remember { mutableStateOf<SearchState>(SearchState.Idle) }
    var currentPhrase by remember { mutableStateOf("") }
    var selectedCoupon by remember { mutableStateOf("") }
    var history by remember { mutableStateOf(store.history()) }
    var favorites by remember { mutableStateOf(store.favorites()) }
    var affiliates by remember { mutableStateOf(store.affiliates()) }
    var coupons by remember { mutableStateOf(store.coupons()) }
    var schedules by remember { mutableStateOf(store.schedules()) }
    var scheduleDraft by remember { mutableStateOf<ScheduleDraft?>(null) }
    var scheduleMessage by remember { mutableStateOf<String?>(null) }
    var shareHistory by remember { mutableStateOf(store.shareHistory()) }
    var radarQuery by remember { mutableStateOf("") }
    var radarProducts by remember { mutableStateOf<List<Product>>(emptyList()) }
    var radarLoading by remember { mutableStateOf(false) }
    var radarMessage by remember { mutableStateOf<String?>(null) }
    var backendMessage by remember { mutableStateOf<String?>(null) }
    var batchOffers by remember { mutableStateOf(store.batchOffers()) }
    var batchLoadingIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var batchAutomationRunning by remember { mutableStateOf(false) }
    var batchAutomationMessage by remember { mutableStateOf<String?>(null) }

    fun finishProduct(product: Product, originalInput: String) {
        currentPhrase = phrases.next(product.title)
        selectedCoupon = product.bestCoupon(coupons)?.coupon?.code.orEmpty()
        store.recordHistory(product)
        history = store.history()
        if (originalInput.contains("meli.la", ignoreCase = true)) {
            store.saveAffiliate(product, originalInput)
            affiliates = store.affiliates()
        }
        searchState = reduceSearch(SearchAction.Succeed(product))
    }

    fun search(url: String) {
        val clean = url.trim()
        searchState = reduceSearch(SearchAction.Clear)
        currentPhrase = ""
        if (clean.isBlank()) {
            searchState = reduceSearch(SearchAction.Fail("Cole um link do Mercado Livre ou meli.la."))
            return
        }
        if (backendUrl.isBlank()) {
            searchState = reduceSearch(SearchAction.Fail("Configure o endereço do backend em Ajustes."))
            return
        }
        searchState = reduceSearch(SearchAction.Start(clean))
        scope.launch {
            api.resolveProduct(backendUrl, clean)
                .onSuccess { finishProduct(it, clean) }
                .onFailure { error ->
                    searchState = reduceSearch(
                        SearchAction.Fail(error.message ?: "Não foi possível confirmar o produto."),
                    )
                }
        }
    }

    fun copyText(text: String) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("Oferta CbOfertas", text))
        Toast.makeText(context, "Texto da oferta copiado!", Toast.LENGTH_SHORT).show()
    }

    fun shareText(text: String, whatsappOnly: Boolean, itemId: String = "", title: String = "") {
        val baseIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        if (!whatsappOnly) {
            runCatching {
                context.startActivity(Intent.createChooser(baseIntent, "Compartilhar oferta"))
                if (itemId.isNotBlank()) {
                    store.recordShare(itemId, title, "outros_aplicativos")
                    shareHistory = store.shareHistory()
                }
            }.onFailure { Toast.makeText(context, "Não foi possível abrir o compartilhamento.", Toast.LENGTH_LONG).show() }
            return
        }

        val packages = listOf("com.whatsapp.w4b", "com.whatsapp")
        val opened = packages.any { packageName ->
            runCatching {
                val intent = Intent(baseIntent).setPackage(packageName)
                if (intent.resolveActivity(context.packageManager) == null) return@runCatching false
                context.startActivity(intent)
                true
            }.getOrDefault(false)
        }
        if (opened) {
            if (itemId.isNotBlank()) {
                store.recordShare(itemId, title, "whatsapp_business")
                shareHistory = store.shareHistory()
            }
            PostingReminderScheduler.resetAfterPosting(context)
            postingReminderNextAt = store.postingReminderNextAt
        } else {
            Toast.makeText(context, "WhatsApp Business não encontrado. Abrindo outros aplicativos.", Toast.LENGTH_LONG).show()
            runCatching { context.startActivity(Intent.createChooser(baseIntent, "Compartilhar oferta")) }
        }
    }

    fun openUrl(url: String) {
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
            .onFailure { Toast.makeText(context, "Não foi possível abrir o link.", Toast.LENGTH_SHORT).show() }
    }

    fun prepareBatch(mode: BatchPreparationMode) {
        val targets = store.batchOffers().filter { it.status == "pending" && it.originalUrl.isNotBlank() }
        if (targets.isEmpty()) {
            batchAutomationMessage = "Nenhum anúncio pendente com link para preparar."
            return
        }
        if (backendUrl.isBlank() && mode != BatchPreparationMode.LINKS) {
            batchAutomationMessage = "Configure o backend em Ajustes para buscar produtos e fotos."
            return
        }
        if (batchAutomationRunning) return

        batchAutomationRunning = true
        batchAutomationMessage = "Iniciando preparação de ${targets.size} anúncios..."
        scope.launch {
            var processed = 0
            var newlyAppliedLinks = 0
            var newlyFoundPhotos = 0
            var failures = 0

            for (snapshot in targets) {
                var current = store.batchOffers().firstOrNull { it.id == snapshot.id } ?: continue
                batchLoadingIds = batchLoadingIds + current.id

                val shouldResolve = when (mode) {
                    BatchPreparationMode.ALL -> current.itemId.isBlank() || current.imageUrl.isNullOrBlank()
                    BatchPreparationMode.LINKS -> current.itemId.isBlank()
                    BatchPreparationMode.PHOTOS -> current.itemId.isBlank() || current.imageUrl.isNullOrBlank()
                }

                if (shouldResolve && backendUrl.isNotBlank()) {
                    val beforeImage = current.imageUrl
                    api.resolveProduct(backendUrl, current.originalUrl)
                        .onSuccess { product ->
                            current = current.copy(
                                itemId = product.itemId,
                                title = product.title.ifBlank { current.title },
                                imageUrl = when (mode) {
                                    BatchPreparationMode.LINKS -> current.imageUrl
                                    else -> product.imageUrl ?: current.imageUrl
                                },
                            )
                            if (beforeImage.isNullOrBlank() && !current.imageUrl.isNullOrBlank()) newlyFoundPhotos++
                        }
                        .onFailure { failures++ }
                }

                if (mode != BatchPreparationMode.PHOTOS || current.affiliateUrl.isBlank()) {
                    val known = current.itemId.takeIf(String::isNotBlank)?.let(store::affiliateFor)
                    if (current.affiliateUrl.isBlank() && known != null) {
                        current = current.copy(affiliateUrl = known.affiliateUrl)
                        store.markAffiliateUsed(current.itemId)
                        newlyAppliedLinks++
                    }
                }

                store.updateBatchOffer(current)
                processed++
                batchOffers = store.batchOffers()
                batchLoadingIds = batchLoadingIds - current.id
                batchAutomationMessage = "Preparando $processed de ${targets.size} • $newlyAppliedLinks links • $newlyFoundPhotos fotos"
            }

            val pendingNow = store.batchOffers().filter { it.status == "pending" }
            val readyNow = pendingNow.count { it.affiliateUrl.isNotBlank() && !it.imageUrl.isNullOrBlank() }
            val missingLinks = pendingNow.count { it.affiliateUrl.isBlank() }
            val missingPhotos = pendingNow.count { it.imageUrl.isNullOrBlank() }
            batchOffers = store.batchOffers()
            batchLoadingIds = emptySet()
            batchAutomationRunning = false
            batchAutomationMessage = buildString {
                append("Concluído: $readyNow prontos")
                append(" • $missingLinks sem link")
                append(" • $missingPhotos sem foto")
                if (failures > 0) append(" • $failures falhas de consulta")
            }
        }
    }

    LaunchedEffect(Unit) {
        PostingReminderScheduler.sync(context)
        postingReminderNextAt = store.postingReminderNextAt
    }

    LaunchedEffect(sharedUrl) {
        if (sharedUrl.isNotBlank()) {
            page = Page.HOME
            urlInput = sharedUrl
            onSharedUrlConsumed()
            search(sharedUrl)
        }
    }

    LaunchedEffect(requestedPage) {
        if (requestedPage.equals("batch", ignoreCase = true)) {
            page = Page.BATCH
            batchOffers = store.batchOffers()
            onRequestedPageConsumed()
        }
    }

    CbOfertasTheme(darkTheme) {
        Scaffold(
            topBar = {
                AppHeader(
                    darkTheme = darkTheme,
                    onToggleTheme = {
                        darkTheme = !darkTheme
                        store.darkTheme = darkTheme
                    },
                )
            },
            bottomBar = {
                NavigationBar {
                    Page.entries.forEach { item ->
                        NavigationBarItem(
                            selected = page == item,
                            onClick = {
                                page = item
                                if (item == Page.AGENDA) {
                                    schedules = store.schedules()
                                    shareHistory = store.shareHistory()
                                }
                                if (item == Page.SETTINGS) {
                                    postingReminderEnabled = store.postingReminderEnabled
                                    postingReminderNextAt = store.postingReminderNextAt
                                }
                            },
                            icon = { Text(item.symbol, fontSize = 20.sp) },
                            label = { Text(item.title, fontSize = 9.sp, maxLines = 1) },
                        )
                    }
                }
            },
        ) { innerPadding ->
            Box(Modifier.fillMaxSize().padding(innerPadding)) {
                when (page) {
                    Page.HOME -> HomeScreen(
                        url = urlInput,
                        onUrlChange = { urlInput = it },
                        searchState = searchState,
                        phrase = currentPhrase,
                        selectedCoupon = selectedCoupon,
                        onCouponChange = { selectedCoupon = it },
                        coupons = coupons,
                        affiliates = affiliates,
                        favorites = favorites,
                        onNewPhrase = newPhrase@ {
                            val product = (searchState as? SearchState.Success)?.product ?: return@newPhrase
                            currentPhrase = phrases.next(product.title)
                        },
                        onSearch = { search(urlInput) },
                        onFavorite = { product ->
                            store.toggleFavorite(product)
                            favorites = store.favorites()
                        },
                        onSaveAffiliate = { product ->
                            store.saveAffiliate(product, urlInput)
                            affiliates = store.affiliates()
                            Toast.makeText(context, "Link salvo na Biblioteca de Afiliados.", Toast.LENGTH_SHORT).show()
                        },
                        onCopy = ::copyText,
                        onShare = { product, text -> shareText(text, false, product.itemId, product.title) },
                        onWhatsApp = { product, text -> shareText(text, true, product.itemId, product.title) },
                        onSchedule = { draft ->
                            scheduleDraft = draft
                            scheduleMessage = null
                            page = Page.AGENDA
                        },
                        onOpen = ::openUrl,
                    )

                    Page.RADAR -> RadarScreen(
                        query = radarQuery,
                        onQueryChange = { radarQuery = it },
                        loading = radarLoading,
                        message = radarMessage,
                        products = radarProducts,
                        affiliates = affiliates,
                        coupons = coupons,
                        phraseFor = phrases::next,
                        onSearch = {
                            if (radarQuery.isBlank()) {
                                radarMessage = "Digite o produto que deseja procurar."
                                return@RadarScreen
                            }
                            if (backendUrl.isBlank()) {
                                radarMessage = "Configure o backend em Ajustes."
                                return@RadarScreen
                            }
                            radarLoading = true
                            radarMessage = null
                            scope.launch {
                                api.radar(backendUrl, radarQuery)
                                    .onSuccess {
                                        radarProducts = it
                                        radarMessage = if (it.isEmpty()) "Nenhuma oferta confirmada foi encontrada." else null
                                    }
                                    .onFailure { radarMessage = it.message }
                                radarLoading = false
                            }
                        },
                        onUse = { product ->
                            page = Page.HOME
                            urlInput = product.permalink
                            finishProduct(product, product.permalink)
                        },
                        onShare = { product, phrase ->
                            val affiliate = affiliates.firstOrNull { it.itemId == product.itemId }
                            val coupon = product.bestCoupon(coupons)
                            shareText(product.offerText(phrase, coupon, affiliate), true, product.itemId, product.title)
                        },
                        onOpen = ::openUrl,
                    )

                    Page.BATCH -> BatchWhatsAppScreen(
                        offers = batchOffers,
                        loadingIds = batchLoadingIds,
                        automationRunning = batchAutomationRunning,
                        automationMessage = batchAutomationMessage,
                        onImport = { pasted ->
                            val parsed = parseBatchOffers(pasted)
                            store.saveBatchOffers(parsed)
                            batchOffers = store.batchOffers()
                            batchAutomationMessage = if (parsed.isEmpty()) {
                                "Nenhum anúncio com link foi identificado."
                            } else {
                                "${parsed.size} anúncios separados. Toque em Preparar tudo automaticamente."
                            }
                            Toast.makeText(context, "${parsed.size} anúncios separados.", Toast.LENGTH_SHORT).show()
                        },
                        onPrepareAll = { prepareBatch(BatchPreparationMode.ALL) },
                        onApplyKnownAffiliates = { prepareBatch(BatchPreparationMode.LINKS) },
                        onFetchMissingPhotos = { prepareBatch(BatchPreparationMode.PHOTOS) },
                        onResolve = { offer ->
                            if (offer.originalUrl.isBlank()) {
                                Toast.makeText(context, "Este anúncio não possui link.", Toast.LENGTH_SHORT).show()
                            } else {
                                batchLoadingIds = batchLoadingIds + offer.id
                                scope.launch {
                                    api.resolveProduct(backendUrl, offer.originalUrl)
                                        .onSuccess { product ->
                                            val known = store.affiliateFor(product.itemId)
                                            val updated = offer.copy(
                                                itemId = product.itemId,
                                                title = product.title,
                                                imageUrl = product.imageUrl,
                                                affiliateUrl = offer.affiliateUrl.ifBlank { known?.affiliateUrl.orEmpty() },
                                            )
                                            store.updateBatchOffer(updated)
                                            batchOffers = store.batchOffers()
                                        }
                                        .onFailure { error ->
                                            Toast.makeText(context, error.message ?: "Não foi possível buscar o produto.", Toast.LENGTH_LONG).show()
                                        }
                                    batchLoadingIds = batchLoadingIds - offer.id
                                }
                            }
                        },
                        onUseClipboardAffiliate = { offer ->
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            val clip = clipboard.primaryClip?.getItemAt(0)?.coerceToText(context)?.toString().orEmpty().trim()
                            if (!clip.startsWith("https://")) {
                                Toast.makeText(context, "Copie primeiro o seu link afiliado.", Toast.LENGTH_LONG).show()
                            } else {
                                val updated = offer.copy(affiliateUrl = clip)
                                store.updateBatchOffer(updated)
                                batchOffers = store.batchOffers()
                                if (offer.itemId.isNotBlank()) {
                                    val product = Product(
                                        platform = "mercado_livre", itemId = offer.itemId, catalogProductId = null,
                                        title = offer.title, sellerId = null, sellerName = null, freeShipping = false,
                                        logisticType = null, imageUrl = offer.imageUrl, permalink = offer.originalUrl,
                                        sourceUrl = offer.originalUrl, resolvedUrl = offer.originalUrl,
                                        price = com.cbofertas.v6.domain.PriceInfo(false, null, null, null, null, null, 0, 0.0, 0.0),
                                    )
                                    store.saveAffiliate(product, clip)
                                    affiliates = store.affiliates()
                                }
                                Toast.makeText(context, "Link afiliado aplicado e salvo.", Toast.LENGTH_SHORT).show()
                            }
                        },
                        onOpen = ::openUrl,
                        onShare = { offer ->
                            scope.launch {
                                val opened = ShareUtils.shareToWhatsAppBusiness(context, offer.finalText, offer.imageUrl)
                                if (opened) {
                                    store.markBatchSent(offer.id, true)
                                    batchOffers = store.batchOffers()
                                    PostingReminderScheduler.resetAfterPosting(context)
                                    postingReminderNextAt = store.postingReminderNextAt
                                    Toast.makeText(context, "Anúncio movido para Enviados. Próximo lembrete reiniciado.", Toast.LENGTH_SHORT).show()
                                } else {
                                    Toast.makeText(context, "WhatsApp Business não encontrado.", Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                        onMarkSent = { offer, sent ->
                            store.markBatchSent(offer.id, sent)
                            batchOffers = store.batchOffers()
                            if (sent) {
                                PostingReminderScheduler.resetAfterPosting(context)
                                postingReminderNextAt = store.postingReminderNextAt
                            }
                        },
                        onDelete = { offer ->
                            store.removeBatchOffer(offer.id)
                            batchOffers = store.batchOffers()
                        },
                    )

                    Page.HISTORY -> HistoryScreen(history, onOpen = ::openUrl)
                    Page.FAVORITES -> FavoritesScreen(favorites, onOpen = ::openUrl)
                    Page.AFFILIATES -> AffiliatesScreen(
                        records = affiliates,
                        onCopy = ::copyText,
                        onOpen = ::openUrl,
                        onRemove = { itemId ->
                            store.removeAffiliate(itemId)
                            affiliates = store.affiliates()
                        },
                    )

                    Page.AGENDA -> ScheduleScreen(
                        draft = scheduleDraft,
                        schedules = schedules,
                        shareHistory = shareHistory,
                        message = scheduleMessage,
                        onDraftConsumed = { scheduleDraft = null },
                        onSchedule = { offer ->
                            store.saveSchedule(offer)
                            OfferScheduler.schedule(context, offer)
                            schedules = store.schedules()
                            scheduleMessage = "Oferta agendada para ${offer.scheduledAt.asDateTime()}."
                        },
                        onCancel = { offer ->
                            OfferScheduler.cancel(context, offer.id)
                            store.removeSchedule(offer.id)
                            schedules = store.schedules()
                            scheduleMessage = "Agendamento removido."
                        },
                        onShareNow = { offer ->
                            shareText(offer.offerText, true, offer.itemId, offer.title)
                        },
                    )

                    Page.SETTINGS -> SettingsScreen(
                        backendUrl = backendUrl,
                        onBackendChange = { backendUrl = it },
                        onSave = {
                            store.backendUrl = backendUrl
                            backendMessage = "Endereço salvo. A Alpha 4 aceita backend V5.2.1 e V6."
                        },
                        onTest = {
                            backendMessage = "Testando conexão..."
                            scope.launch {
                                backendMessage = api.health(backendUrl).fold(
                                    onSuccess = { "Conectado: $it" },
                                    onFailure = { it.message ?: "Falha na conexão." },
                                )
                            }
                        },
                        message = backendMessage,
                        darkTheme = darkTheme,
                        onDarkTheme = {
                            darkTheme = it
                            store.darkTheme = it
                        },
                        postingReminderEnabled = postingReminderEnabled,
                        postingReminderNextAt = postingReminderNextAt,
                        onPostingReminderEnabled = { enabled ->
                            postingReminderEnabled = enabled
                            store.postingReminderEnabled = enabled
                            store.postingReminderIntervalMinutes = 30
                            store.postingReminderStartHour = 8
                            store.postingReminderEndHour = 21
                            if (enabled) PostingReminderScheduler.sync(context) else PostingReminderScheduler.cancel(context)
                            postingReminderNextAt = store.postingReminderNextAt
                            backendMessage = if (enabled) {
                                "Lembretes ativados: a cada 30 minutos, das 8h às 21h."
                            } else {
                                "Lembretes de postagem desativados."
                            }
                        },
                        coupons = coupons,
                        onAddCoupon = { coupon ->
                            store.saveCoupon(coupon)
                            coupons = store.coupons()
                            val product = (searchState as? SearchState.Success)?.product
                            if (product != null) selectedCoupon = product.bestCoupon(coupons)?.coupon?.code.orEmpty()
                        },
                        onRemoveCoupon = { code ->
                            store.removeCoupon(code)
                            coupons = store.coupons()
                            if (selectedCoupon.equals(code, ignoreCase = true)) selectedCoupon = ""
                        },
                        onClear = {
                            PostingReminderScheduler.cancel(context)
                            store.clearLocalData()
                            postingReminderEnabled = false
                            postingReminderNextAt = 0L
                            history = emptyList()
                            favorites = emptyList()
                            affiliates = emptyList()
                            coupons = emptyList()
                            schedules.forEach { OfferScheduler.cancel(context, it.id) }
                            schedules = emptyList()
                            scheduleDraft = null
                            shareHistory = emptyList()
                            batchOffers = emptyList()
                            searchState = SearchState.Idle
                            backendMessage = "Dados locais apagados."
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun AppHeader(darkTheme: Boolean, onToggleTheme: () -> Unit) {
    Column {
        Box(
            modifier = Modifier.fillMaxWidth().height(7.dp).background(MercadoYellow),
        )
        Surface(tonalElevation = 3.dp) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text("🏷️ CbOfertas", fontSize = 27.sp, fontWeight = FontWeight.ExtraBold)
                    Text("V6 Alpha 5.2 • Consulta + Lote WhatsApp", style = MaterialTheme.typography.bodySmall)
                }
                TextButton(onClick = onToggleTheme) {
                    Text(if (darkTheme) "☀ Claro" else "☾ Escuro", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun HomeScreen(
    url: String,
    onUrlChange: (String) -> Unit,
    searchState: SearchState,
    phrase: String,
    selectedCoupon: String,
    onCouponChange: (String) -> Unit,
    coupons: List<CouponRecord>,
    affiliates: List<AffiliateRecord>,
    favorites: List<FavoriteRecord>,
    onNewPhrase: () -> Unit,
    onSearch: () -> Unit,
    onFavorite: (Product) -> Unit,
    onSaveAffiliate: (Product) -> Unit,
    onCopy: (String) -> Unit,
    onShare: (Product, String) -> Unit,
    onWhatsApp: (Product, String) -> Unit,
    onSchedule: (ScheduleDraft) -> Unit,
    onOpen: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            SearchCard(
                url = url,
                onUrlChange = onUrlChange,
                loading = searchState is SearchState.Loading,
                onSearch = onSearch,
            )
        }

        when (searchState) {
            SearchState.Idle -> item { WelcomeCard() }
            is SearchState.Loading -> item { LoadingCard("Conferindo anúncio, preço, vendedor e disponibilidade...") }
            is SearchState.Error -> item { ErrorCard(searchState.message) }
            is SearchState.Success -> {
                item {
                    val product = searchState.product
                    val affiliate = affiliates.firstOrNull { it.itemId == product.itemId }
                    val couponMatch = product.couponByCode(coupons, selectedCoupon) ?: product.bestCoupon(coupons)
                    val detectedInstallment = product.installmentText().orEmpty()
                    val detectedCount = Regex("(\\d{1,2})x", RegexOption.IGNORE_CASE).find(detectedInstallment)?.groupValues?.getOrNull(1).orEmpty()
                    var installmentCount by remember(product.itemId) { mutableStateOf(detectedCount) }
                    var installmentAmount by remember(product.itemId) {
                        mutableStateOf(product.price.installment?.amount?.let { String.format(java.util.Locale("pt", "BR"), "%.2f", it) }.orEmpty())
                    }
                    var installmentInterest by remember(product.itemId) {
                        mutableStateOf(
                            when {
                                detectedInstallment.contains("sem juros", ignoreCase = true) -> "sem_juros"
                                detectedInstallment.contains("com juros", ignoreCase = true) -> "com_juros"
                                else -> "nao_informar"
                            },
                        )
                    }
                    val installmentValue = installmentAmount.replace(".", "").replace(',', '.').toDoubleOrNull()
                    val installmentDisplay = if (installmentCount.toIntOrNull() != null && installmentValue != null && installmentValue > 0) {
                        buildString {
                            append("${installmentCount.toInt()}x ${installmentValue.asBrl()}")
                            when (installmentInterest) {
                                "sem_juros" -> append(" sem juros")
                                "com_juros" -> append(" com juros")
                            }
                        }
                    } else detectedInstallment
                    val offerText = product.offerText(phrase, couponMatch, affiliate, installmentDisplay)
                    ProductOfferCard(
                        product = product,
                        phrase = phrase,
                        selectedCoupon = selectedCoupon,
                        onCouponChange = onCouponChange,
                        coupons = coupons,
                        affiliate = affiliate,
                        favorite = favorites.any { it.itemId == product.itemId },
                        offerText = offerText,
                        installmentDisplay = installmentDisplay,
                        installmentCount = installmentCount,
                        installmentAmount = installmentAmount,
                        installmentInterest = installmentInterest,
                        onInstallmentCountChange = { installmentCount = it.filter(Char::isDigit).take(2) },
                        onInstallmentAmountChange = { installmentAmount = it.filter { ch -> ch.isDigit() || ch == ',' || ch == '.' }.take(12) },
                        onInstallmentInterestChange = { installmentInterest = it },
                        onNewPhrase = onNewPhrase,
                        onFavorite = { onFavorite(product) },
                        onSaveAffiliate = { onSaveAffiliate(product) },
                        onCopy = { onCopy(offerText) },
                        onShare = { onShare(product, offerText) },
                        onWhatsApp = { onWhatsApp(product, offerText) },
                        onSchedule = {
                            onSchedule(
                                ScheduleDraft(
                                    itemId = product.itemId,
                                    title = product.title,
                                    imageUrl = product.imageUrl,
                                    offerText = offerText,
                                    shareUrl = product.bestLink(affiliate),
                                ),
                            )
                        },
                        onOpen = { onOpen(product.bestLink(affiliate)) },
                    )
                }
            }
        }
    }
}

@Composable
private fun SearchCard(
    url: String,
    onUrlChange: (String) -> Unit,
    loading: Boolean,
    onSearch: () -> Unit,
) {
    SectionCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            StepBadge("1")
            Spacer(Modifier.width(12.dp))
            Column {
                Text("Buscar produto", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                Text("Cole o link do Mercado Livre ou meli.la")
            }
        }
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = url,
            onValueChange = onUrlChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("🔗 Link da oferta") },
            placeholder = { Text("https://meli.la/...") },
            minLines = 1,
            maxLines = 3,
        )
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = onSearch,
            enabled = !loading,
            modifier = Modifier.fillMaxWidth().height(56.dp),
        ) {
            Text(if (loading) "Conferindo oferta..." else "🔎 Buscar e confirmar oferta", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun WelcomeCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
        shape = RoundedCornerShape(22.dp),
    ) {
        Column(Modifier.padding(18.dp)) {
            Text("A oferta entra. O texto sai pronto. 😎", fontSize = 21.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(6.dp))
            Text("A CbOfertas confirma o produto, escolhe uma frase engraçada, monta o anúncio e aplica seu link afiliado automaticamente.")
        }
    }
}

@Composable
private fun ProductOfferCard(
    product: Product,
    phrase: String,
    selectedCoupon: String,
    onCouponChange: (String) -> Unit,
    coupons: List<CouponRecord>,
    affiliate: AffiliateRecord?,
    favorite: Boolean,
    offerText: String,
    installmentDisplay: String,
    installmentCount: String,
    installmentAmount: String,
    installmentInterest: String,
    onInstallmentCountChange: (String) -> Unit,
    onInstallmentAmountChange: (String) -> Unit,
    onInstallmentInterestChange: (String) -> Unit,
    onNewPhrase: () -> Unit,
    onFavorite: () -> Unit,
    onSaveAffiliate: () -> Unit,
    onCopy: () -> Unit,
    onShare: () -> Unit,
    onWhatsApp: () -> Unit,
    onSchedule: () -> Unit,
    onOpen: () -> Unit,
) {
    SectionCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            StepBadge("2")
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text("Oferta pronta", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                Text("Confira os dados e compartilhe")
            }
            if (product.price.discountPercent > 0) {
                DiscountBadge(product.price.discountPercent)
            }
        }

        Spacer(Modifier.height(14.dp))
        PhraseBanner(phrase = phrase, onNewPhrase = onNewPhrase)
        Spacer(Modifier.height(14.dp))
        RemoteImage(product.imageUrl, product.title, height = 230)
        Spacer(Modifier.height(14.dp))

        Text(product.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
        Text(product.itemId, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(12.dp))

        PricePanel(product, installmentDisplay)
        Spacer(Modifier.height(10.dp))
        InstallmentEditor(
            count = installmentCount,
            amount = installmentAmount,
            interest = installmentInterest,
            onCountChange = onInstallmentCountChange,
            onAmountChange = onInstallmentAmountChange,
            onInterestChange = onInstallmentInterestChange,
        )
        Spacer(Modifier.height(12.dp))

        ProductFacts(product)
        Spacer(Modifier.height(14.dp))

        CouponSelector(
            product = product,
            selected = selectedCoupon,
            onSelectedChange = onCouponChange,
            coupons = coupons,
        )
        Spacer(Modifier.height(8.dp))
        SmartCouponSummary(product = product, selectedCode = selectedCoupon, coupons = coupons)

        Spacer(Modifier.height(14.dp))
        if (affiliate != null) {
            InfoCard("✅ Link afiliado aplicado automaticamente para ${product.itemId}.")
        } else {
            OutlinedButton(onClick = onSaveAffiliate, modifier = Modifier.fillMaxWidth()) {
                Text("🔗 Salvar link atual como afiliado")
            }
        }

        Spacer(Modifier.height(14.dp))
        Text("Prévia do texto", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
        Spacer(Modifier.height(7.dp))
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            shape = RoundedCornerShape(16.dp),
        ) {
            Text(offerText, modifier = Modifier.fillMaxWidth().padding(14.dp), lineHeight = 21.sp)
        }

        Spacer(Modifier.height(14.dp))
        Button(
            onClick = onWhatsApp,
            modifier = Modifier.fillMaxWidth().height(54.dp),
            colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreen, contentColor = Color.White),
        ) { Text("💬 Compartilhar no WhatsApp Business", fontWeight = FontWeight.Bold) }
        Spacer(Modifier.height(8.dp))
        Button(onClick = onSchedule, modifier = Modifier.fillMaxWidth()) { Text("🗓️ Agendar publicação") }
        Spacer(Modifier.height(8.dp))
        Button(onClick = onCopy, modifier = Modifier.fillMaxWidth()) { Text("📋 Copiar texto completo") }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = onShare, modifier = Modifier.fillMaxWidth()) { Text("↗ Compartilhar em outro aplicativo") }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = onOpen, modifier = Modifier.fillMaxWidth()) { Text("🛒 Abrir anúncio") }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = onFavorite, modifier = Modifier.fillMaxWidth()) {
            Text(if (favorite) "★ Remover dos favoritos" else "☆ Salvar nos favoritos")
        }
    }
}

@Composable
private fun PhraseBanner(phrase: String, onNewPhrase: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(15.dp)) {
            Text("😂 ${phrase.ifBlank { "Essa oferta está boa demais para ficar escondida." }}", fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
            TextButton(onClick = onNewPhrase, modifier = Modifier.align(Alignment.End)) {
                Text("🎲 Trocar frase")
            }
        }
    }
}

@Composable
private fun PricePanel(product: Product, installmentDisplay: String) {
    val price = product.price
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            price.original?.let {
                Text(
                    "De ${it.amount.asBrl()}",
                    textDecoration = TextDecoration.LineThrough,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                price.current?.amount.asBrl(),
                fontSize = 35.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
            if (price.savings > 0) Text("Você economiza ${price.savings.asBrl()}", fontWeight = FontWeight.Bold)
            installmentDisplay.takeIf(String::isNotBlank)?.let { Text("💳 $it", textAlign = TextAlign.Center) }
        }
    }
}

@Composable
private fun InstallmentEditor(
    count: String,
    amount: String,
    interest: String,
    onCountChange: (String) -> Unit,
    onAmountChange: (String) -> Unit,
    onInterestChange: (String) -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text("💳 Corrigir parcelamento", fontWeight = FontWeight.ExtraBold)
            Text(
                "Confira no anúncio. O Mercado Livre pode oferecer uma quantidade diferente conforme cartão e forma de pagamento.",
                style = MaterialTheme.typography.bodySmall,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = count,
                    onValueChange = onCountChange,
                    modifier = Modifier.weight(0.35f),
                    label = { Text("Parcelas") },
                    placeholder = { Text("15") },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = amount,
                    onValueChange = onAmountChange,
                    modifier = Modifier.weight(0.65f),
                    label = { Text("Valor da parcela") },
                    placeholder = { Text("126,03") },
                    singleLine = true,
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                listOf(
                    "sem_juros" to "Sem juros",
                    "com_juros" to "Com juros",
                    "nao_informar" to "Não informar",
                ).forEach { (value, label) ->
                    AssistChip(
                        onClick = { onInterestChange(value) },
                        label = { Text(label) },
                        leadingIcon = { Text(if (interest == value) "✓" else "○") },
                    )
                }
            }
        }
    }
}

@Composable
private fun ProductFacts(product: Product) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        if (product.freeShipping) FactLine("🚚", "Frete grátis")
        product.sellerName?.takeIf(String::isNotBlank)?.let { FactLine("🏪", "Vendido por $it") }
        if (product.logisticType == "fulfillment") FactLine("📦", "Envio FULL")
        FactLine("🛡️", "Confiança do preço: ${(product.price.confidence * 100).toInt()}%")
        product.price.cashback?.let { FactLine("🪙", "Cashback separado: ${it.amount.asBrl()} — não usado como preço") }
        product.price.unit?.let { FactLine("⚖️", "Preço por unidade: ${it.amount.asBrl()} — não usado como preço") }
    }
}

@Composable
private fun FactLine(icon: String, text: String) {
    Row(verticalAlignment = Alignment.Top) {
        Text(icon)
        Spacer(Modifier.width(8.dp))
        Text(text, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun CouponSelector(
    product: Product,
    selected: String,
    onSelectedChange: (String) -> Unit,
    coupons: List<CouponRecord>,
) {
    Text("🎟️ Cupom da oferta", fontWeight = FontWeight.ExtraBold)
    Spacer(Modifier.height(6.dp))
    OutlinedTextField(
        value = selected,
        onValueChange = onSelectedChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Digite ou escolha um cupom") },
        singleLine = true,
    )
    val compatible = product.couponMatches(coupons)
    if (compatible.isNotEmpty()) {
        Spacer(Modifier.height(7.dp))
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            compatible.forEach { match ->
                val coupon = match.coupon
                AssistChip(
                    onClick = { onSelectedChange(coupon.code) },
                    label = { Text("${coupon.code}${if (match.estimatedDiscount > 0) " • -${match.estimatedDiscount.asBrl()}" else ""}") },
                    leadingIcon = { Text(if (selected.equals(coupon.code, ignoreCase = true)) "✓" else if (coupon.confirmed) "✅" else "💡") },
                )
            }
        }
    }
}

@Composable
private fun RadarScreen(
    query: String,
    onQueryChange: (String) -> Unit,
    loading: Boolean,
    message: String?,
    products: List<Product>,
    affiliates: List<AffiliateRecord>,
    coupons: List<CouponRecord>,
    phraseFor: (String) -> String,
    onSearch: () -> Unit,
    onUse: (Product) -> Unit,
    onShare: (Product, String) -> Unit,
    onOpen: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            SectionCard {
                Text("⚡ Radar de Ofertas", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                Text("Busca produtos e confirma o preço antes de exibir.")
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Ex.: creatina, toalha, celular") },
                    singleLine = true,
                )
                Spacer(Modifier.height(10.dp))
                Button(onClick = onSearch, enabled = !loading, modifier = Modifier.fillMaxWidth().height(54.dp)) {
                    Text(if (loading) "Buscando e confirmando..." else "🔍 Buscar ofertas", fontWeight = FontWeight.Bold)
                }
                if (loading) {
                    Spacer(Modifier.height(10.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.size(26.dp))
                        Spacer(Modifier.width(10.dp))
                        Text("Confirmando os preços encontrados...")
                    }
                }
                if (!message.isNullOrBlank()) {
                    Spacer(Modifier.height(10.dp))
                    Text(message, color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        if (products.isNotEmpty()) {
            item {
                val bestDiscount = products.maxOfOrNull { it.price.discountPercent } ?: 0
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                    shape = RoundedCornerShape(18.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(15.dp),
                        horizontalArrangement = Arrangement.SpaceAround,
                    ) {
                        RadarMetric(products.size.toString(), "Encontradas")
                        RadarMetric("$bestDiscount%", "Melhor desconto")
                    }
                }
            }
        }

        items(products, key = { it.itemId }) { product ->
            val phrase = remember(product.itemId) { phraseFor(product.title) }
            val affiliate = affiliates.firstOrNull { it.itemId == product.itemId }
            RadarProductCard(
                product = product,
                phrase = phrase,
                affiliate = affiliate,
                coupons = coupons,
                onUse = { onUse(product) },
                onShare = { onShare(product, phrase) },
                onOpen = { onOpen(product.bestLink(affiliate)) },
            )
        }
    }
}

@Composable
private fun RadarMetric(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 25.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)
        Text(label, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun RadarProductCard(
    product: Product,
    phrase: String,
    affiliate: AffiliateRecord?,
    coupons: List<CouponRecord>,
    onUse: () -> Unit,
    onShare: () -> Unit,
    onOpen: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                CompactRemoteImage(product.imageUrl, product.title)
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    if (product.price.discountPercent > 0) DiscountBadge(product.price.discountPercent)
                    Spacer(Modifier.height(6.dp))
                    Text(product.title, maxLines = 3, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
                    Text(product.price.current?.amount.asBrl(), color = MaterialTheme.colorScheme.primary, fontSize = 26.sp, fontWeight = FontWeight.Black)
                    product.price.original?.let {
                        Text(it.amount.asBrl(), textDecoration = TextDecoration.LineThrough, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Text("😂 $phrase", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            if (product.freeShipping) Text("🚚 Frete grátis", fontWeight = FontWeight.SemiBold)
            if (affiliate != null) Text("🔗 Link afiliado aplicado", color = MaterialTheme.colorScheme.primary)
            product.bestCoupon(coupons)?.let { match ->
                Text(
                    if (match.coupon.confirmed) "✅ Cupom ${match.coupon.code}: ${match.estimatedPrice.asBrl()}" else "💡 Cupom sugerido ${match.coupon.code}: ${match.estimatedPrice.asBrl()}",
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Spacer(Modifier.height(10.dp))
            Button(onClick = onUse, modifier = Modifier.fillMaxWidth()) { Text("✓ Usar esta oferta") }
            Spacer(Modifier.height(7.dp))
            OutlinedButton(onClick = onShare, modifier = Modifier.fillMaxWidth()) { Text("💬 Compartilhar") }
            Spacer(Modifier.height(7.dp))
            TextButton(onClick = onOpen, modifier = Modifier.fillMaxWidth()) { Text("↗ Abrir anúncio") }
        }
    }
}

@Composable
private fun HistoryScreen(records: List<HistoryRecord>, onOpen: (String) -> Unit) {
    RecordList(title = "Histórico", subtitle = "Acompanhe consultas e menores preços", emptyText = "Nenhuma consulta ainda.", showEmpty = records.isEmpty()) {
        items(records, key = { it.itemId }) { record ->
            SectionCard {
                Row(verticalAlignment = Alignment.Top) {
                    CompactRemoteImage(record.imageUrl, record.title)
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(record.title, fontWeight = FontWeight.ExtraBold, maxLines = 3, overflow = TextOverflow.Ellipsis)
                        PriceLine("Preço atual", record.currentPrice.asBrl(), emphasized = true)
                        PriceLine("Menor preço", record.minPrice.asBrl())
                        PriceLine("Maior desconto", "${record.maxDiscount}%")
                        PriceLine("Consultas", record.queryCount.toString())
                    }
                }
                Text("Última consulta: ${record.lastQueryAt.asDateTime()}", style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = { onOpen(record.permalink) }, modifier = Modifier.align(Alignment.End)) { Text("Abrir") }
            }
        }
    }
}

@Composable
private fun FavoritesScreen(records: List<FavoriteRecord>, onOpen: (String) -> Unit) {
    RecordList(title = "Favoritos", subtitle = "Suas ofertas guardadas", emptyText = "Nenhum favorito salvo.", showEmpty = records.isEmpty()) {
        items(records, key = { it.itemId }) { record ->
            SectionCard {
                Row(verticalAlignment = Alignment.Top) {
                    CompactRemoteImage(record.imageUrl, record.title)
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(record.title, fontWeight = FontWeight.ExtraBold, maxLines = 3, overflow = TextOverflow.Ellipsis)
                        Text(record.currentPrice.asBrl(), color = MaterialTheme.colorScheme.primary, fontSize = 23.sp, fontWeight = FontWeight.Black)
                        Text("Salvo em ${record.savedAt.asDateTime()}", style = MaterialTheme.typography.bodySmall)
                    }
                }
                Button(onClick = { onOpen(record.permalink) }, modifier = Modifier.fillMaxWidth()) { Text("Abrir oferta") }
            }
        }
    }
}

@Composable
private fun AffiliatesScreen(
    records: List<AffiliateRecord>,
    onCopy: (String) -> Unit,
    onOpen: (String) -> Unit,
    onRemove: (String) -> Unit,
) {
    RecordList(title = "Biblioteca de Afiliados", subtitle = "Um MLB, um link afiliado automático", emptyText = "Nenhum link afiliado salvo.", showEmpty = records.isEmpty()) {
        items(records, key = { it.itemId }) { record ->
            SectionCard {
                Text("🔗 ${record.itemId}", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.ExtraBold)
                Text(record.title, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(5.dp))
                Text(record.affiliateUrl, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text("Último uso: ${record.lastUsedAt.asDateTime()}", style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(8.dp))
                Button(onClick = { onCopy(record.affiliateUrl) }, modifier = Modifier.fillMaxWidth()) { Text("📋 Copiar link") }
                Spacer(Modifier.height(7.dp))
                OutlinedButton(onClick = { onOpen(record.affiliateUrl) }, modifier = Modifier.fillMaxWidth()) { Text("Abrir") }
                TextButton(onClick = { onRemove(record.itemId) }, modifier = Modifier.fillMaxWidth()) { Text("Remover") }
            }
        }
    }
}

@Composable
private fun SettingsScreen(
    backendUrl: String,
    onBackendChange: (String) -> Unit,
    onSave: () -> Unit,
    onTest: () -> Unit,
    message: String?,
    darkTheme: Boolean,
    onDarkTheme: (Boolean) -> Unit,
    postingReminderEnabled: Boolean,
    postingReminderNextAt: Long,
    onPostingReminderEnabled: (Boolean) -> Unit,
    coupons: List<CouponRecord>,
    onAddCoupon: (CouponRecord) -> Unit,
    onRemoveCoupon: (String) -> Unit,
    onClear: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            SectionCard {
                Text("🌐 Backend", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                Text("A Alpha 4 detecta automaticamente as rotas da V5.2.1 ou da V6.")
                Spacer(Modifier.height(9.dp))
                OutlinedTextField(
                    value = backendUrl,
                    onValueChange = onBackendChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("https://seu-backend.onrender.com") },
                    singleLine = true,
                )
                Spacer(Modifier.height(8.dp))
                Button(onClick = onSave, modifier = Modifier.fillMaxWidth()) { Text("Salvar endereço") }
                Spacer(Modifier.height(7.dp))
                OutlinedButton(onClick = onTest, modifier = Modifier.fillMaxWidth()) { Text("Testar conexão") }
                if (!message.isNullOrBlank()) {
                    Spacer(Modifier.height(8.dp))
                    InfoCard(message)
                }
            }
        }

        item {
            SectionCard {
                SmartCouponEditor(
                    coupons = coupons,
                    onSave = onAddCoupon,
                    onRemove = onRemoveCoupon,
                )
            }
        }

        item {
            SectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("🔔 Lembrete de postagem", fontWeight = FontWeight.ExtraBold)
                        Text("A cada 30 minutos, das 8h às 21h", style = MaterialTheme.typography.bodySmall)
                    }
                    Switch(checked = postingReminderEnabled, onCheckedChange = onPostingReminderEnabled)
                }
                Spacer(Modifier.height(8.dp))
                Text("Som e vibração ficam ativos pelo canal de notificações do Android.")
                Text("Às 21h os avisos pausam automaticamente e voltam às 8h do dia seguinte.", style = MaterialTheme.typography.bodySmall)
                if (postingReminderEnabled && postingReminderNextAt > 0L) {
                    Spacer(Modifier.height(8.dp))
                    InfoCard("Próximo aviso: ${postingReminderNextAt.asDateTime()}")
                }
            }
        }

        item {
            SectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text("Tema escuro", fontWeight = FontWeight.ExtraBold)
                        Text("Alterna a aparência do aplicativo", style = MaterialTheme.typography.bodySmall)
                    }
                    Switch(checked = darkTheme, onCheckedChange = onDarkTheme)
                }
            }
        }

        item {
            SectionCard {
                Text("💬 WhatsApp Business", fontWeight = FontWeight.ExtraBold)
                Text("A Alpha 4 tenta abrir primeiro o WhatsApp Business. Se ele não estiver instalado, tenta o WhatsApp comum e depois outros aplicativos.")
            }
        }

        item {
            SectionCard {
                Text("🧹 Dados locais", fontWeight = FontWeight.ExtraBold)
                Text("Apaga histórico, favoritos, cupons, agenda e afiliados, mantendo o endereço do backend.")
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = onClear, modifier = Modifier.fillMaxWidth()) { Text("Limpar dados locais") }
            }
        }
    }
}

@Composable
private fun RecordList(
    title: String,
    subtitle: String,
    emptyText: String,
    showEmpty: Boolean,
    content: androidx.compose.foundation.lazy.LazyListScope.() -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column {
                Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Black)
                Text(subtitle)
            }
        }
        content()
        if (showEmpty && emptyText.isNotBlank()) item { Text(emptyText, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun RemoteImage(url: String?, description: String, height: Int) {
    val bitmap by loadRemoteBitmap(url)
    Box(
        modifier = Modifier.fillMaxWidth().height(height.dp).clip(RoundedCornerShape(18.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap == null) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("🖼️", fontSize = 35.sp)
                Text("Imagem indisponível")
            }
        } else {
            Image(
                bitmap = bitmap!!.asImageBitmap(),
                contentDescription = description,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
            )
        }
    }
}

@Composable
private fun CompactRemoteImage(url: String?, description: String) {
    val bitmap by loadRemoteBitmap(url)
    Box(
        modifier = Modifier.size(105.dp).clip(RoundedCornerShape(16.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap == null) {
            Text("🛍️", fontSize = 30.sp)
        } else {
            Image(
                bitmap = bitmap!!.asImageBitmap(),
                contentDescription = description,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
            )
        }
    }
}

@Composable
private fun loadRemoteBitmap(url: String?) = produceState<Bitmap?>(initialValue = null, key1 = url) {
    value = if (url.isNullOrBlank()) null else withContext(Dispatchers.IO) {
        runCatching {
            val connection = URL(url).openConnection().apply {
                connectTimeout = 15_000
                readTimeout = 20_000
                setRequestProperty("User-Agent", "Mozilla/5.0 CbOfertas/6.0")
            }
            connection.getInputStream().use(BitmapFactory::decodeStream)
        }.getOrNull()
    }
}

@Composable
private fun StepBadge(value: String) {
    Box(
        modifier = Modifier.size(50.dp).background(
            brush = Brush.linearGradient(listOf(MercadoGreen, Color(0xFF00C853))),
            shape = CircleShape,
        ),
        contentAlignment = Alignment.Center,
    ) {
        Text(value, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun DiscountBadge(discount: Int) {
    Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(50)) {
        Text("🔥 $discount% OFF", modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.ExtraBold)
    }
}

@Composable
private fun PriceLine(label: String, value: String, emphasized: Boolean = false) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label)
        Text(
            value,
            color = if (emphasized) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            fontSize = if (emphasized) 21.sp else 15.sp,
            fontWeight = if (emphasized) FontWeight.Black else FontWeight.SemiBold,
        )
    }
}

@Composable
private fun SectionCard(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(22.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(17.dp), content = content)
    }
}

@Composable
private fun LoadingCard(message: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer), shape = RoundedCornerShape(18.dp)) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(Modifier.size(28.dp))
            Spacer(Modifier.width(12.dp))
            Text(message, modifier = Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun InfoCard(message: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer), shape = RoundedCornerShape(16.dp)) {
        Text(message, modifier = Modifier.fillMaxWidth().padding(13.dp), fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ErrorCard(message: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer), shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Text("Não deu certo desta vez", fontSize = 19.sp, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onErrorContainer)
            Spacer(Modifier.height(4.dp))
            Text(message, color = MaterialTheme.colorScheme.onErrorContainer)
            Spacer(Modifier.height(6.dp))
            Text("A Alpha 4 limpa o resultado anterior para não publicar dados incorretos.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onErrorContainer)
        }
    }
}
