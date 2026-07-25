package com.cbofertas.v6.ui

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import java.net.URL

enum class Page(val title: String, val symbol: String) {
    HOME("Início", "⌂"),
    RADAR("Radar", "⚡"),
    HISTORY("Histórico", "◷"),
    FAVORITES("Favoritos", "★"),
    AFFILIATES("Afiliados", "🔗"),
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
    var history by remember { mutableStateOf(store.history()) }
    var favorites by remember { mutableStateOf(store.favorites()) }
    var affiliates by remember { mutableStateOf(store.affiliates()) }
    var radarQuery by remember { mutableStateOf("") }
    var radarProducts by remember { mutableStateOf<List<Product>>(emptyList()) }
    var radarLoading by remember { mutableStateOf(false) }
    var radarMessage by remember { mutableStateOf<String?>(null) }
    var backendMessage by remember { mutableStateOf<String?>(null) }

    fun search(url: String) {
        val clean = url.trim()
        searchState = reduceSearch(SearchAction.Clear)
        if (clean.isBlank()) {
            searchState = reduceSearch(SearchAction.Fail("Cole um link do Mercado Livre."))
            return
        }
        if (backendUrl.isBlank()) {
            searchState = reduceSearch(SearchAction.Fail("Configure o backend V6 em Ajustes."))
            return
        }
        searchState = reduceSearch(SearchAction.Start(clean))
        scope.launch {
            api.resolveProduct(backendUrl, clean)
                .onSuccess { product ->
                    store.recordHistory(product)
                    history = store.history()
                    searchState = reduceSearch(SearchAction.Succeed(product))
                }
                .onFailure { error ->
                    searchState = reduceSearch(SearchAction.Fail(error.message ?: "Não foi possível confirmar o produto."))
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

    CbOfertasTheme(darkTheme) {
        Scaffold(
            topBar = {
                Surface(tonalElevation = 2.dp) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column {
                            Text("🏷️ CbOfertas", fontSize = 25.sp, fontWeight = FontWeight.Bold)
                            Text("V6 Alpha 2 • Android nativo", style = MaterialTheme.typography.bodySmall)
                        }
                        TextButton(onClick = {
                            darkTheme = !darkTheme
                            store.darkTheme = darkTheme
                        }) { Text(if (darkTheme) "☀ Claro" else "☾ Escuro") }
                    }
                }
            },
            bottomBar = {
                NavigationBar {
                    Page.entries.forEach { item ->
                        NavigationBarItem(
                            selected = page == item,
                            onClick = { page = item },
                            icon = { Text(item.symbol, fontSize = 19.sp) },
                            label = { Text(item.title, fontSize = 8.sp, maxLines = 1) },
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
                        affiliates = affiliates,
                        favorites = favorites,
                        phraseFor = phrases::next,
                        onSearch = { search(urlInput) },
                        onFavorite = { product ->
                            store.toggleFavorite(product)
                            favorites = store.favorites()
                        },
                        onSaveAffiliate = { product ->
                            store.saveAffiliate(product, urlInput)
                            affiliates = store.affiliates()
                        },
                    )

                    Page.RADAR -> RadarScreen(
                        query = radarQuery,
                        onQueryChange = { radarQuery = it },
                        loading = radarLoading,
                        message = radarMessage,
                        products = radarProducts,
                        onSearch = {
                            if (radarQuery.isBlank()) return@RadarScreen
                            if (backendUrl.isBlank()) {
                                radarMessage = "Configure o backend V6 em Ajustes."
                                return@RadarScreen
                            }
                            radarLoading = true
                            radarMessage = null
                            scope.launch {
                                api.radar(backendUrl, radarQuery)
                                    .onSuccess { radarProducts = it }
                                    .onFailure { radarMessage = it.message }
                                radarLoading = false
                            }
                        },
                        onUse = { product ->
                            page = Page.HOME
                            urlInput = product.permalink
                            searchState = reduceSearch(SearchAction.Succeed(product))
                            store.recordHistory(product)
                            history = store.history()
                        },
                    )

                    Page.HISTORY -> HistoryScreen(history)
                    Page.FAVORITES -> FavoritesScreen(favorites)
                    Page.AFFILIATES -> AffiliatesScreen(affiliates)
                    Page.SETTINGS -> SettingsScreen(
                        backendUrl = backendUrl,
                        onBackendChange = { backendUrl = it },
                        onSave = {
                            store.backendUrl = backendUrl
                            backendMessage = "Endereço salvo."
                        },
                        onTest = {
                            backendMessage = "Testando conexão..."
                            scope.launch {
                                backendMessage = api.health(backendUrl).fold(
                                    onSuccess = { "Conectado: $it" },
                                    onFailure = { "Falha: ${it.message}" },
                                )
                            }
                        },
                        message = backendMessage,
                        darkTheme = darkTheme,
                        onDarkTheme = {
                            darkTheme = it
                            store.darkTheme = it
                        },
                        onClear = {
                            store.clearLocalData()
                            history = emptyList()
                            favorites = emptyList()
                            affiliates = emptyList()
                            backendMessage = "Histórico local apagado."
                        },
                    )
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
    affiliates: List<AffiliateRecord>,
    favorites: List<FavoriteRecord>,
    phraseFor: (String) -> String,
    onSearch: () -> Unit,
    onFavorite: (Product) -> Unit,
    onSaveAffiliate: (Product) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            SectionCard {
                Text("1. Buscar produto", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = url,
                    onValueChange = onUrlChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Link Mercado Livre ou meli.la") },
                    singleLine = true,
                )
                Spacer(Modifier.height(10.dp))
                Button(onClick = onSearch, modifier = Modifier.fillMaxWidth()) { Text("Buscar e confirmar oferta") }
            }
        }

        when (searchState) {
            SearchState.Idle -> item { InfoCard("Aguardando um link. Nenhum produto anterior fica preso na tela.") }
            is SearchState.Loading -> item {
                SectionCard {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        CircularProgressIndicator(Modifier.size(30.dp))
                        Text("Consultando backend e confirmando anúncio...")
                    }
                }
            }
            is SearchState.Error -> item { ErrorCard(searchState.message) }
            is SearchState.Success -> item {
                val product = searchState.product
                ProductCard(
                    product = product,
                    affiliate = affiliates.firstOrNull { it.itemId == product.itemId },
                    favorite = favorites.any { it.itemId == product.itemId },
                    phrase = phraseFor(product.title),
                    onFavorite = { onFavorite(product) },
                    onSaveAffiliate = { onSaveAffiliate(product) },
                )
            }
        }
    }
}

@Composable
private fun ProductCard(
    product: Product,
    affiliate: AffiliateRecord?,
    favorite: Boolean,
    phrase: String,
    onFavorite: () -> Unit,
    onSaveAffiliate: () -> Unit,
) {
    val context = LocalContext.current
    SectionCard {
        Text("2. Produto confirmado", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text("“$phrase”", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(12.dp))
        RemoteImage(product.imageUrl, product.title)
        Spacer(Modifier.height(12.dp))
        Text(product.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text("Anúncio: ${product.itemId}", style = MaterialTheme.typography.bodySmall)
        if (!product.sellerName.isNullOrBlank()) Text("Vendido por: ${product.sellerName}")
        Spacer(Modifier.height(12.dp))

        PriceLine("Preço atual", product.price.current?.amount.asBrl(), emphasized = true)
        PriceLine("Preço original", product.price.original?.amount.asBrl(), crossed = product.price.original != null)
        PriceLine("Desconto", if (product.price.discountPercent > 0) "${product.price.discountPercent}%" else "—")
        PriceLine("Economia", product.price.savings.takeIf { it > 0.0 }.asBrl())
        PriceLine("Parcelamento", product.price.installment?.label ?: product.price.installment?.amount.asBrl())
        PriceLine("Cashback (separado)", product.price.cashback?.amount.asBrl())
        PriceLine("Preço por unidade", product.price.unit?.amount.asBrl())
        PriceLine("Confiança", "${(product.price.confidence * 100).toInt()}%")

        if (!product.price.confirmed) {
            Spacer(Modifier.height(8.dp))
            ErrorCard(product.price.reason ?: "Preço não confirmado.")
        }

        Spacer(Modifier.height(12.dp))
        Button(
            onClick = {
                val destination = affiliate?.affiliateUrl ?: product.permalink
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(destination)))
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (affiliate == null) "Abrir anúncio" else "Abrir link afiliado") }

        Spacer(Modifier.height(8.dp))
        OutlinedButton(
            onClick = {
                val destination = affiliate?.affiliateUrl ?: product.permalink
                val text = "$phrase\n\n${product.title}\n${product.price.current?.amount.asBrl()}\n$destination"
                context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                }, "Compartilhar oferta"))
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Compartilhar oferta") }

        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = onFavorite) { Text(if (favorite) "★ Remover favorito" else "☆ Favoritar") }
            TextButton(onClick = onSaveAffiliate) { Text(if (affiliate == null) "Salvar link atual" else "✓ Afiliado salvo") }
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
    onSearch: () -> Unit,
    onUse: (Product) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            SectionCard {
                Text("Radar V6", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Somente ofertas cujo preço atual foi confirmado pelo backend.")
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Ex.: creatina, cadeira, celular") },
                    singleLine = true,
                )
                Spacer(Modifier.height(8.dp))
                Button(onClick = onSearch, enabled = !loading, modifier = Modifier.fillMaxWidth()) {
                    Text(if (loading) "Buscando..." else "Buscar ofertas")
                }
                if (loading) {
                    Spacer(Modifier.height(8.dp))
                    CircularProgressIndicator(Modifier.size(28.dp))
                }
                if (!message.isNullOrBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(message, color = MaterialTheme.colorScheme.error)
                }
            }
        }
        items(products, key = { it.itemId }) { product ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Text(product.title, maxLines = 2, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Bold)
                    Text(product.price.current?.amount.asBrl(), color = MaterialTheme.colorScheme.primary, fontSize = 23.sp, fontWeight = FontWeight.Bold)
                    if (product.price.original != null) {
                        Text(product.price.original.amount.asBrl(), textDecoration = TextDecoration.LineThrough)
                    }
                    Text("${product.price.discountPercent}% OFF • confiança ${(product.price.confidence * 100).toInt()}%")
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { onUse(product) }, modifier = Modifier.fillMaxWidth()) { Text("Usar oferta confirmada") }
                }
            }
        }
    }
}

@Composable
private fun HistoryScreen(records: List<HistoryRecord>) {
    RecordList(title = "Histórico", emptyText = "Nenhuma consulta ainda.") {
        items(records, key = { it.itemId }) { record ->
            SectionCard {
                Text(record.title, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                PriceLine("Preço atual", record.currentPrice.asBrl(), emphasized = true)
                PriceLine("Menor preço", record.minPrice.asBrl())
                PriceLine("Maior desconto", "${record.maxDiscount}%")
                PriceLine("Consultas", record.queryCount.toString())
                Text("Última: ${record.lastQueryAt.asDateTime()}", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun FavoritesScreen(records: List<FavoriteRecord>) {
    RecordList(title = "Favoritos", emptyText = "Nenhum favorito salvo.") {
        items(records, key = { it.itemId }) { record ->
            SectionCard {
                Text(record.title, fontWeight = FontWeight.Bold)
                Text(record.currentPrice.asBrl(), color = MaterialTheme.colorScheme.primary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text("Salvo em ${record.savedAt.asDateTime()}", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun AffiliatesScreen(records: List<AffiliateRecord>) {
    RecordList(title = "Biblioteca de afiliados", emptyText = "Nenhum link afiliado salvo.") {
        items(records, key = { it.itemId }) { record ->
            SectionCard {
                Text(record.title, fontWeight = FontWeight.Bold)
                Text(record.itemId, style = MaterialTheme.typography.bodySmall)
                Text(record.affiliateUrl, maxLines = 2, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.primary)
                Text("Salvo em ${record.savedAt.asDateTime()}", style = MaterialTheme.typography.bodySmall)
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
    onClear: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            SectionCard {
                Text("Backend V6", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Use um serviço Render separado da V5 enquanto a versão nova está em testes.")
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = backendUrl,
                    onValueChange = onBackendChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("https://seu-backend-v6.onrender.com") },
                    singleLine = true,
                )
                Spacer(Modifier.height(8.dp))
                Button(onClick = onSave, modifier = Modifier.fillMaxWidth()) { Text("Salvar endereço") }
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = onTest, modifier = Modifier.fillMaxWidth()) { Text("Testar conexão") }
                if (!message.isNullOrBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(message)
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
                    Text("Tema escuro", fontWeight = FontWeight.Bold)
                    Switch(checked = darkTheme, onCheckedChange = onDarkTheme)
                }
            }
        }
        item {
            SectionCard {
                Text("Dados locais", fontWeight = FontWeight.Bold)
                Text("Apaga histórico, favoritos e afiliados desta Alpha, mantendo o endereço do backend.")
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = onClear, modifier = Modifier.fillMaxWidth()) { Text("Limpar dados locais") }
            }
        }
    }
}

@Composable
private fun RecordList(
    title: String,
    emptyText: String,
    content: androidx.compose.foundation.lazy.LazyListScope.() -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold) }
        content()
        item { Text(emptyText, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun RemoteImage(url: String?, description: String) {
    val bitmap by produceState<Bitmap?>(initialValue = null, key1 = url) {
        value = if (url.isNullOrBlank()) null else withContext(Dispatchers.IO) {
            runCatching { URL(url).openStream().use(BitmapFactory::decodeStream) }.getOrNull()
        }
    }
    Box(
        modifier = Modifier.fillMaxWidth().height(210.dp).background(
            MaterialTheme.colorScheme.surfaceVariant,
            RoundedCornerShape(16.dp),
        ),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap == null) {
            Text("Imagem indisponível", style = MaterialTheme.typography.bodyMedium)
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
private fun PriceLine(label: String, value: String, emphasized: Boolean = false, crossed: Boolean = false) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label)
        Text(
            value,
            color = if (emphasized) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            fontSize = if (emphasized) 23.sp else 16.sp,
            fontWeight = if (emphasized) FontWeight.Bold else FontWeight.Medium,
            textDecoration = if (crossed) TextDecoration.LineThrough else null,
        )
    }
}

@Composable
private fun SectionCard(content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) { content() }
    }
}

@Composable
private fun InfoCard(message: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
        Text(message, modifier = Modifier.fillMaxWidth().padding(14.dp))
    }
}

@Composable
private fun ErrorCard(message: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
        Text(
            message,
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            color = MaterialTheme.colorScheme.onErrorContainer,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
