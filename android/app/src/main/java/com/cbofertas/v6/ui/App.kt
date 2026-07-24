package com.cbofertas.v6.ui

import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cbofertas.v6.data.ApiClient
import com.cbofertas.v6.data.LocalStore
import com.cbofertas.v6.data.PhraseLibrary
import com.cbofertas.v6.domain.AffiliateRecord
import com.cbofertas.v6.domain.CouponRecord
import com.cbofertas.v6.domain.FavoriteRecord
import com.cbofertas.v6.domain.HistoryRecord
import com.cbofertas.v6.domain.Product
import com.cbofertas.v6.domain.SearchAction
import com.cbofertas.v6.domain.SearchState
import com.cbofertas.v6.domain.asBrl
import com.cbofertas.v6.domain.asDateTime
import com.cbofertas.v6.domain.reduceSearch
import com.cbofertas.v6.ui.theme.CbOfertasTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

enum class Page(val label: String, val emoji: String) {
    HOME("Início", "⌂"),
    RADAR("Radar", "⚡"),
    HISTORY("Histórico", "◷"),
    FAVORITES("Favoritos", "★"),
    COUPONS("Cupons", "🎟"),
    SETTINGS("Ajustes", "⚙"),
}

@Composable
fun CbOfertasApp(sharedUrl: String, onSharedUrlConsumed: () -> Unit) {
    val context = LocalContext.current
    val store = remember { LocalStore(context) }
    val api = remember { ApiClient() }
    val phrases = remember { PhraseLibrary(context) }
    val scope = rememberCoroutineScope()

    var page by remember { mutableStateOf(Page.HOME) }
    var darkTheme by remember { mutableStateOf(store.darkTheme) }
    var backendUrl by remember { mutableStateOf(store.backendUrl) }
    var urlInput by remember { mutableStateOf("") }
    var searchState by remember { mutableStateOf<SearchState>(SearchState.Idle) }
    var favorites by remember { mutableStateOf(store.favorites()) }
    var history by remember { mutableStateOf(store.history()) }
    var affiliates by remember { mutableStateOf(store.affiliates()) }
    var coupons by remember { mutableStateOf(store.coupons()) }
    var radarQuery by remember { mutableStateOf("") }
    var radarProducts by remember { mutableStateOf<List<Product>>(emptyList()) }
    var radarLoading by remember { mutableStateOf(false) }
    var radarError by remember { mutableStateOf<String?>(null) }
    var healthStatus by remember { mutableStateOf<String?>(null) }
    var showAbout by remember { mutableStateOf(false) }

    fun search(url: String) {
        val clean = url.trim()
        if (clean.isBlank()) {
            searchState = SearchState.Error("Cole um link do Mercado Livre.")
            return
        }
        if (backendUrl.isBlank()) {
            searchState = SearchState.Error("Configure o endereço do backend em Ajustes.")
            return
        }
        searchState = reduceSearch(searchState, SearchAction.Start(clean))
        scope.launch {
            api.resolveProduct(backendUrl, clean)
                .onSuccess { product ->
                    store.recordHistory(product)
                    history = store.history()
                    if (runCatching { Uri.parse(clean).host == "meli.la" }.getOrDefault(false)) {
                        store.saveAffiliate(product, clean)
                        affiliates = store.affiliates()
                    }
                    searchState = reduceSearch(searchState, SearchAction.Succeed(product))
                }
                .onFailure { error ->
                    searchState = reduceSearch(searchState, SearchAction.Fail(error.message ?: "Não foi possível confirmar o produto."))
                }
        }
    }

    LaunchedEffect(sharedUrl) {
        if (sharedUrl.isNotBlank()) {
            page = Page.HOME
            urlInput = sharedUrl
            onSharedUrlConsumed()
            search(sharedUrl)
        }
    }

    CbOfertasTheme(darkTheme = darkTheme) {
        Scaffold(
            topBar = {
                Header(
                    darkTheme = darkTheme,
                    onTheme = {
                        darkTheme = !darkTheme
                        store.darkTheme = darkTheme
                    },
                    onAbout = { showAbout = true },
                )
            },
            bottomBar = {
                NavigationBar {
                    Page.entries.forEach { item ->
                        NavigationBarItem(
                            selected = page == item,
                            onClick = { page = item },
                            icon = { Text(item.emoji, fontSize = 22.sp) },
                            label = { Text(item.label, fontSize = 9.sp, maxLines = 1) },
                        )
                    }
                }
            },
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                when (page) {
                    Page.HOME -> HomeScreen(
                        url = urlInput,
                        onUrl = { urlInput = it },
                        state = searchState,
                        affiliates = affiliates,
                        favorites = favorites,
                        onSearch = ::search,
                        onFavorite = { product ->
                            store.toggleFavorite(product)
                            favorites = store.favorites()
                        },
                        onSaveAffiliate = { product ->
                            store.saveAffiliate(product, urlInput)
                            affiliates = store.affiliates()
                        },
                        onAffiliateUsed = { product ->
                            store.markAffiliateUsed(product.itemId)
                            affiliates = store.affiliates()
                        },
                        phraseFor = phrases::next,
                    )
                    Page.RADAR -> RadarScreen(
                        query = radarQuery,
                        onQuery = { radarQuery = it },
                        products = radarProducts,
                        loading = radarLoading,
                        error = radarError,
                        onSearch = {
                            if (radarQuery.isNotBlank()) {
                                radarLoading = true
                                radarError = null
                                scope.launch {
                                    api.radar(backendUrl, radarQuery)
                                        .onSuccess { radarProducts = it }
                                        .onFailure { radarError = it.message }
                                    radarLoading = false
                                }
                            }
                        },
                        onUse = { product ->
                            page = Page.HOME
                            urlInput = product.permalink
                            searchState = SearchState.Success(product)
                            store.recordHistory(product)
                            history = store.history()
                        },
                    )
                    Page.HISTORY -> HistoryScreen(history)
                    Page.FAVORITES -> FavoritesScreen(favorites)
                    Page.COUPONS -> CouponsScreen(
                        coupons = coupons,
                        onAdd = { code, description ->
                            store.addCoupon(code, description)
                            coupons = store.coupons()
                        },
                        onRemove = { code ->
                            store.removeCoupon(code)
                            coupons = store.coupons()
                        },
                    )
                    Page.SETTINGS -> SettingsScreen(
                        backendUrl = backendUrl,
                        onBackendUrl = { backendUrl = it },
                        onSaveBackend = {
                            store.backendUrl = backendUrl
                            healthStatus = "Endereço salvo."
                        },
                        onTestBackend = {
                            healthStatus = "Testando..."
                            scope.launch {
                                healthStatus = api.health(backendUrl).fold(
                                    onSuccess = { "Conectado: $it" },
                                    onFailure = { "Falha: ${it.message}" },
                                )
                            }
                        },
                        healthStatus = healthStatus,
                        darkTheme = darkTheme,
                        onDarkTheme = {
                            darkTheme = it
                            store.darkTheme = it
                        },
                        affiliates = affiliates,
                        onRemoveAffiliate = { itemId ->
                            store.removeAffiliate(itemId)
                            affiliates = store.affiliates()
                        },
                    )
                }
            }
        }

        if (showAbout) {
            AlertDialog(
                onDismissRequest = { showAbout = false },
                confirmButton = { TextButton(onClick = { showAbout = false }) { Text("Fechar") } },
                title = { Text("CbOfertas V6") },
                text = { Text("Nova base nativa. Preços, parcelas, cashback e preço por unidade são campos separados. Versão 6.0.0-alpha.1.") },
            )
        }
    }
}

@Composable
private fun Header(darkTheme: Boolean, onTheme: () -> Unit, onAbout: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.primaryContainer).padding(horizontal = 18.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("🏷️", fontSize = 34.sp)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text("CbOfertas", fontWeight = FontWeight.Black, fontSize = 27.sp)
            Text("Criador de Ofertas Inteligente • V6", fontSize = 12.sp)
        }
        TextButton(onClick = onAbout) { Text("ⓘ") }
        FilledTonalButton(onClick = onTheme, contentPadding = PaddingValues(horizontal = 14.dp)) {
            Text(if (darkTheme) "☀" else "☾", fontSize = 21.sp)
        }
    }
}

@Composable
private fun HomeScreen(
    url: String,
    onUrl: (String) -> Unit,
    state: SearchState,
    affiliates: List<AffiliateRecord>,
    favorites: List<FavoriteRecord>,
    onSearch: (String) -> Unit,
    onFavorite: (Product) -> Unit,
    onSaveAffiliate: (Product) -> Unit,
    onAffiliateUsed: (Product) -> Unit,
    phraseFor: (String) -> String,
) {
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            SectionCard(title = "1  Buscar produto", subtitle = "Cada nova busca limpa os dados anteriores") {
                OutlinedTextField(
                    value = url,
                    onValueChange = onUrl,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Link do Mercado Livre ou meli.la") },
                    singleLine = true,
                )
                Spacer(Modifier.height(10.dp))
                Button(onClick = { onSearch(url) }, modifier = Modifier.fillMaxWidth(), enabled = state !is SearchState.Loading) {
                    Text(if (state is SearchState.Loading) "Consultando..." else "🔎 Buscar e confirmar")
                }
            }
        }

        when (state) {
            SearchState.Idle -> item { InfoCard("Cole ou compartilhe um link. O produto só será exibido depois de título, MLB e preço serem validados.") }
            is SearchState.Loading -> item {
                Card(Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(22.dp), verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.size(28.dp))
                        Spacer(Modifier.width(14.dp))
                        Column {
                            Text("Confirmando a oferta", fontWeight = FontWeight.Bold)
                            Text("Resolvendo redirecionamentos, MLB e preço de venda.")
                        }
                    }
                }
            }
            is SearchState.Error -> item { ErrorCard(state.message) }
            is SearchState.Success -> {
                val product = state.product
                val affiliate = affiliates.firstOrNull { it.itemId == product.itemId }
                item {
                    ProductCard(
                        product = product,
                        affiliate = affiliate,
                        favorite = favorites.any { it.itemId == product.itemId },
                        onFavorite = { onFavorite(product) },
                        onSaveAffiliate = { onSaveAffiliate(product) },
                        onAffiliateUsed = { onAffiliateUsed(product) },
                        phraseFor = phraseFor,
                    )
                }
            }
        }
    }
}

@Composable
private fun ProductCard(
    product: Product,
    affiliate: AffiliateRecord?,
    favorite: Boolean,
    onFavorite: () -> Unit,
    onSaveAffiliate: () -> Unit,
    onAffiliateUsed: () -> Unit,
    phraseFor: (String) -> String,
) {
    val context = LocalContext.current
    val price = product.price
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                NetworkImage(product.imageUrl, Modifier.size(112.dp))
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    if (price.discountPercent > 0) {
                        Text("🔥 ${price.discountPercent}% OFF", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                    }
                    Text(product.title, fontSize = 19.sp, fontWeight = FontWeight.Black, maxLines = 4, overflow = TextOverflow.Ellipsis)
                    Text(product.itemId, fontSize = 12.sp)
                }
            }

            if (!price.confirmed) {
                ErrorCard(price.reason ?: "O preço não possui confiança suficiente para publicação automática.")
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                PriceColumn("Original", price.original?.amount.asBrl(), strike = price.original != null)
                PriceColumn("Preço final", price.current?.amount.asBrl(), highlight = true)
                PriceColumn("Economia", price.savings.asBrl())
            }

            price.installment?.let { InfoLine("💳 Parcelamento", it.amount.asBrl(), it.label) }
            price.cashback?.let { InfoLine("🪙 Cashback", it.amount.asBrl(), "Informativo; nunca usado como preço") }
            price.unit?.let { InfoLine("⚖️ Preço por unidade", it.amount.asBrl(), "Informativo; nunca usado como preço") }
            InfoLine("🏪 Vendedor", product.sellerName ?: product.sellerId ?: "Não informado", null)
            InfoLine("🚚 Frete", if (product.freeShipping) "Grátis" else "Consultar", product.logisticType)
            InfoLine("🔐 Confiança", "${(price.confidence * 100).toInt()}%", price.current?.source)

            if (affiliate != null) {
                InfoCard("✅ Link afiliado aplicado automaticamente para ${product.itemId}")
            } else if (Uri.parse(product.sourceUrl).host == "meli.la") {
                FilledTonalButton(onClick = onSaveAffiliate, modifier = Modifier.fillMaxWidth()) { Text("💰 Salvar este link como afiliado") }
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        val link = affiliate?.affiliateUrl ?: product.permalink
                        if (affiliate != null) onAffiliateUsed()
                        val phrase = phraseFor(product.title)
                        val text = buildOfferText(product, link, phrase)
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, text)
                        }
                        context.startActivity(Intent.createChooser(intent, "Compartilhar oferta"))
                    },
                    modifier = Modifier.weight(1f),
                    enabled = price.confirmed && price.current != null,
                ) { Text("Compartilhar") }
                OutlinedButton(onClick = onFavorite, modifier = Modifier.weight(1f)) {
                    Text(if (favorite) "★ Favorito" else "☆ Favoritar")
                }
            }
            OutlinedButton(
                onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(product.permalink))) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("↗ Abrir anúncio original") }
        }
    }
}

private fun buildOfferText(product: Product, link: String, phrase: String): String = buildString {
    appendLine(phrase)
    appendLine()
    appendLine("🔥 ${product.title}")
    product.price.original?.amount?.let { appendLine("De: ${it.asBrl()}") }
    product.price.current?.amount?.let { appendLine("💰 Por: ${it.asBrl()}") }
    if (product.price.discountPercent > 0) appendLine("📉 ${product.price.discountPercent}% OFF")
    product.price.installment?.let { appendLine("💳 ${it.label ?: it.amount.asBrl()}") }
    if (product.freeShipping) appendLine("🚚 Frete grátis")
    appendLine()
    append(link)
}

@Composable
private fun RadarScreen(
    query: String,
    onQuery: (String) -> Unit,
    products: List<Product>,
    loading: Boolean,
    error: String?,
    onSearch: () -> Unit,
    onUse: (Product) -> Unit,
) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            SectionCard("Radar V6", "Somente ofertas com preço confirmado entram na lista") {
                OutlinedTextField(query, onQuery, Modifier.fillMaxWidth(), label = { Text("Ex.: celular, creatina, cadeira") }, singleLine = true)
                Spacer(Modifier.height(8.dp))
                Button(onClick = onSearch, Modifier.fillMaxWidth(), enabled = !loading && query.isNotBlank()) {
                    Text(if (loading) "Classificando..." else "⚡ Buscar ofertas")
                }
            }
        }
        if (loading) item { CircularProgressIndicator(Modifier.padding(24.dp)) }
        error?.let { item { ErrorCard(it) } }
        if (!loading && products.isEmpty() && error == null) item { InfoCard("O Radar consulta candidatos e confirma cada MLB antes de exibir.") }
        items(products, key = { it.itemId }) { product ->
            Card(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    NetworkImage(product.imageUrl, Modifier.size(86.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(product.title, fontWeight = FontWeight.Bold, maxLines = 3, overflow = TextOverflow.Ellipsis)
                        Text(product.price.current?.amount.asBrl(), color = MaterialTheme.colorScheme.primary, fontSize = 22.sp, fontWeight = FontWeight.Black)
                        Text("${product.price.discountPercent}% OFF • confiança ${(product.price.confidence * 100).toInt()}%")
                        Button(onClick = { onUse(product) }) { Text("Usar oferta") }
                    }
                }
            }
        }
    }
}

@Composable
private fun HistoryScreen(records: List<HistoryRecord>) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Histórico", fontSize = 26.sp, fontWeight = FontWeight.Black) }
        if (records.isEmpty()) item { InfoCard("Nenhuma consulta registrada.") }
        items(records, key = { it.itemId }) { record ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    Text(record.title, fontWeight = FontWeight.Bold)
                    Text("Menor preço: ${record.minPrice.asBrl()}")
                    Text("Maior desconto: ${record.maxDiscount}%")
                    Text("Consultas: ${record.queryCount}")
                    Text("Última: ${record.lastQueryAt.asDateTime()}", fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun FavoritesScreen(records: List<FavoriteRecord>) {
    val context = LocalContext.current
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Favoritos", fontSize = 26.sp, fontWeight = FontWeight.Black) }
        if (records.isEmpty()) item { InfoCard("Nenhum favorito salvo.") }
        items(records, key = { it.itemId }) { record ->
            Card(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    NetworkImage(record.imageUrl, Modifier.size(78.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(record.title, fontWeight = FontWeight.Bold)
                        Text(record.currentPrice.asBrl(), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Black)
                        TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(record.permalink))) }) { Text("Abrir") }
                    }
                }
            }
        }
    }
}

@Composable
private fun CouponsScreen(coupons: List<CouponRecord>, onAdd: (String, String) -> Unit, onRemove: (String) -> Unit) {
    var code by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            SectionCard("Biblioteca de cupons", "Os cupons ficam separados do preço do produto") {
                OutlinedTextField(code, { code = it }, Modifier.fillMaxWidth(), label = { Text("Código") }, singleLine = true)
                OutlinedTextField(description, { description = it }, Modifier.fillMaxWidth(), label = { Text("Descrição ou regra") })
                Button(onClick = { onAdd(code, description); code = ""; description = "" }, enabled = code.isNotBlank()) { Text("Salvar cupom") }
            }
        }
        items(coupons, key = { it.code }) { coupon ->
            Card(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(coupon.code, fontWeight = FontWeight.Black, fontSize = 19.sp)
                        Text(coupon.description.ifBlank { "Sem regra cadastrada" })
                    }
                    TextButton(onClick = { onRemove(coupon.code) }) { Text("Excluir") }
                }
            }
        }
    }
}

@Composable
private fun SettingsScreen(
    backendUrl: String,
    onBackendUrl: (String) -> Unit,
    onSaveBackend: () -> Unit,
    onTestBackend: () -> Unit,
    healthStatus: String?,
    darkTheme: Boolean,
    onDarkTheme: (Boolean) -> Unit,
    affiliates: List<AffiliateRecord>,
    onRemoveAffiliate: (String) -> Unit,
) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        SectionCard("Servidor V6", "Use um serviço Render separado da V5") {
            OutlinedTextField(backendUrl, onBackendUrl, Modifier.fillMaxWidth(), label = { Text("URL do backend") }, singleLine = true)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onSaveBackend) { Text("Salvar") }
                OutlinedButton(onClick = onTestBackend) { Text("Testar") }
            }
            healthStatus?.let { Text(it, color = if (it.startsWith("Falha")) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary) }
        }
        Card(Modifier.fillMaxWidth()) {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Tema escuro", fontWeight = FontWeight.Bold)
                    Text("Preferência salva no aparelho")
                }
                Switch(checked = darkTheme, onCheckedChange = onDarkTheme)
            }
        }
        Text("Biblioteca de afiliados (${affiliates.size})", fontSize = 22.sp, fontWeight = FontWeight.Black)
        if (affiliates.isEmpty()) InfoCard("Compartilhe um link meli.la com a CbOfertas. Depois de confirmar o MLB, ele será salvo aqui.")
        affiliates.forEach { record ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    Text(record.title.ifBlank { record.itemId }, fontWeight = FontWeight.Bold)
                    Text(record.itemId)
                    Text(record.affiliateUrl, maxLines = 2, overflow = TextOverflow.Ellipsis, fontSize = 12.sp)
                    TextButton(onClick = { onRemoveAffiliate(record.itemId) }) { Text("Remover associação") }
                }
            }
        }
        Spacer(Modifier.height(30.dp))
    }
}

@Composable
private fun SectionCard(title: String, subtitle: String, content: @Composable ColumnScope.() -> Unit) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp)) {
        Column(Modifier.padding(18.dp)) {
            Text(title, fontSize = 23.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.68f))
            Spacer(Modifier.height(14.dp))
            content()
        }
    }
}

@Composable
private fun InfoCard(message: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer), modifier = Modifier.fillMaxWidth()) {
        Text(message, Modifier.padding(14.dp), color = MaterialTheme.colorScheme.onPrimaryContainer)
    }
}

@Composable
private fun ErrorCard(message: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)), modifier = Modifier.fillMaxWidth()) {
        Text(message, Modifier.padding(14.dp), color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun PriceColumn(label: String, value: String, strike: Boolean = false, highlight: Boolean = false) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(5.dp)) {
        Text(label, fontSize = 12.sp)
        Text(
            value,
            fontSize = if (highlight) 22.sp else 15.sp,
            fontWeight = FontWeight.Black,
            color = if (highlight) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            textDecoration = if (strike) TextDecoration.LineThrough else null,
        )
    }
}

@Composable
private fun InfoLine(label: String, value: String, detail: String?) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Text(label, Modifier.width(145.dp), fontWeight = FontWeight.Bold)
        Column(Modifier.weight(1f)) {
            Text(value)
            detail?.takeIf { it.isNotBlank() }?.let { Text(it, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f)) }
        }
    }
    HorizontalDivider()
}

@Composable
private fun NetworkImage(url: String?, modifier: Modifier = Modifier) {
    val bitmap by produceState<android.graphics.Bitmap?>(initialValue = null, url) {
        value = if (url.isNullOrBlank()) null else withContext(Dispatchers.IO) {
            runCatching {
                val connection = URL(url).openConnection() as HttpURLConnection
                connection.connectTimeout = 12_000
                connection.readTimeout = 15_000
                connection.setRequestProperty("User-Agent", "CbOfertas-Android/6.0")
                try {
                    connection.inputStream.use { stream -> BitmapFactory.decodeStream(stream) }
                } finally {
                    connection.disconnect()
                }
            }.getOrNull()
        }
    }
    Box(modifier.background(MaterialTheme.colorScheme.surfaceContainer, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
        if (bitmap != null) {
            Image(bitmap!!.asImageBitmap(), contentDescription = "Imagem do produto", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
        } else {
            Text("🛍️", fontSize = 35.sp)
        }
    }
}
