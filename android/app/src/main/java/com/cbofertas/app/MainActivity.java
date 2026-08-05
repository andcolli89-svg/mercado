package com.cbofertas.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Toast;
import android.widget.FrameLayout;
import android.view.ViewGroup;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final int NOTIFICATION_PERMISSION_REQUEST = 3201;
    private static final int FILE_CHOOSER_REQUEST = 3202;
    private WebView webView;
    private CbDatabaseHelper database;
    private boolean pageReady = false;
    private Intent pendingScheduledIntent;
    private String pendingSharedProductLink;
    private ValueCallback<Uri[]> fileChooserCallback;

    private final ArrayList<ShareQueueItem> separateShareQueue = new ArrayList<>();
    private int separateShareIndex = 0;
    private boolean separateSharePreferWhatsapp = true;
    private boolean waitingForExternalShare = false;
    private boolean pausedForExternalShare = false;
    private boolean preparingSeparateShare = false;

    private static final class PreparedImage {
        final Uri uri;
        final String mimeType;

        PreparedImage(Uri uri, String mimeType) {
            this.uri = uri;
            this.mimeType = mimeType;
        }
    }

    private static final class ShareQueueItem {
        final String text;
        final String imageUrl;

        ShareQueueItem(String text, String imageUrl) {
            this.text = text == null ? "" : text;
            this.imageUrl = imageUrl == null ? "" : imageUrl;
        }
    }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        database = new CbDatabaseHelper(this);
        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setDefaultTextEncodingName("UTF-8");

        webView.addJavascriptInterface(new AndroidBridge(), "Android");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                if (MainActivity.this.fileChooserCallback != null) {
                    MainActivity.this.fileChooserCallback.onReceiveValue(null);
                }
                MainActivity.this.fileChooserCallback = filePathCallback;

                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);

                String[] acceptTypes = fileChooserParams == null ? null : fileChooserParams.getAcceptTypes();
                boolean queueImport = false;
                if (acceptTypes != null) {
                    for (String accept : acceptTypes) {
                        String normalized = accept == null ? "" : accept.toLowerCase(java.util.Locale.ROOT);
                        if (normalized.contains("cbofertas") || normalized.contains("application/json") || normalized.contains(".json")) {
                            queueImport = true;
                            break;
                        }
                    }
                }

                if (queueImport) {
                    picker.setType("application/json");
                    picker.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                            "application/json",
                            "application/octet-stream",
                            "text/plain"
                    });
                } else {
                    picker.setType("image/*");
                }
                picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);

                try {
                    startActivityForResult(Intent.createChooser(picker, queueImport ? "Selecionar fila CbOfertas" : "Escolher foto"), FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception error) {
                    MainActivity.this.fileChooserCallback.onReceiveValue(null);
                    MainActivity.this.fileChooserCallback = null;
                    Toast.makeText(MainActivity.this, "Não foi possível abrir a galeria.", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    String host = uri.getHost();
                    if (host != null && (host.contains("mercadolivre") || host.contains("meli.la") || host.contains("whatsapp") || host.contains("wa.me"))) {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                        return true;
                    }
                }
                return false;
            }

            @Override public void onPageFinished(WebView view, String url) {
                pageReady = true;
                if (pendingScheduledIntent != null) {
                    Intent intent = pendingScheduledIntent;
                    pendingScheduledIntent = null;
                    deliverScheduledShare(intent);
                }
                if (pendingSharedProductLink != null) {
                    String link = pendingSharedProductLink;
                    pendingSharedProductLink = null;
                    deliverSharedProductLink(link);
                }
            }
        });
        webView.loadUrl("file:///android_asset/www/index.html");
        handleIntent(getIntent());
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST) return;
        if (fileChooserCallback == null) return;

        Uri[] results = null;
        if (resultCode == Activity.RESULT_OK && data != null) {
            Uri selected = data.getData();
            if (selected != null) {
                try {
                    getContentResolver().takePersistableUriPermission(selected, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Exception ignored) { }
                results = new Uri[]{selected};
            } else {
                results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            }
        }
        fileChooserCallback.onReceiveValue(results);
        fileChooserCallback = null;
    }

    @Override protected void onPause() {
        super.onPause();
        if (waitingForExternalShare) pausedForExternalShare = true;
    }

    @Override protected void onResume() {
        super.onResume();
        if (waitingForExternalShare && pausedForExternalShare) {
            waitingForExternalShare = false;
            pausedForExternalShare = false;
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (separateShareIndex < separateShareQueue.size()) {
                    openNextSeparateShare();
                } else {
                    int total = separateShareQueue.size();
                    clearSeparateShareQueue();
                    Toast.makeText(MainActivity.this, total + " mensagem(ns) processada(s) separadamente.", Toast.LENGTH_SHORT).show();
                }
            }, 600);
        }
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;

        if (intent.getBooleanExtra("scheduled_share", false)) {
            if (!pageReady) pendingScheduledIntent = intent;
            else deliverScheduledShare(intent);
            return;
        }

        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            CharSequence shared = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if ((shared == null || shared.toString().trim().isEmpty()) && intent.getClipData() != null && intent.getClipData().getItemCount() > 0) {
                shared = intent.getClipData().getItemAt(0).coerceToText(this);
            }
            String link = firstMercadoLivreLink(shared == null ? "" : shared.toString());
            intent.removeExtra(Intent.EXTRA_TEXT);
            intent.setAction(Intent.ACTION_MAIN);
            if (link != null) {
                if (!pageReady) pendingSharedProductLink = link;
                else deliverSharedProductLink(link);
            } else {
                Toast.makeText(this, "O compartilhamento não contém um link de produto do Mercado Livre.", Toast.LENGTH_LONG).show();
            }
        }
    }

    private String firstMercadoLivreLink(String text) {
        Matcher matcher = Pattern.compile("https?://[^\\s<>\"']+", Pattern.CASE_INSENSITIVE).matcher(text == null ? "" : text);
        while (matcher.find()) {
            String candidate = matcher.group().replaceAll("[),.;!?]+$", "");
            try {
                Uri uri = Uri.parse(candidate);
                String host = uri.getHost();
                if (host == null) continue;
                String normalized = host.toLowerCase();
                if (normalized.equals("meli.la") || normalized.endsWith(".meli.la") ||
                        normalized.contains("mercadolivre.com") || normalized.contains("mercadolibre.com")) {
                    return candidate;
                }
            } catch (Exception ignored) { }
        }
        return null;
    }

    private void deliverSharedProductLink(String link) {
        final String javascript = "window.CbOfertasReceiveSharedLink && window.CbOfertasReceiveSharedLink(" + JSONObject.quote(link) + ");";
        new Handler(Looper.getMainLooper()).postDelayed(() -> webView.evaluateJavascript(javascript, null), 180);
        Toast.makeText(this, "Link compartilhado recebido no CbOfertas.", Toast.LENGTH_SHORT).show();
    }

    private void deliverScheduledShare(Intent intent) {
        String text = intent.getStringExtra("scheduled_text");
        String image = intent.getStringExtra("scheduled_image");
        String group = intent.getStringExtra("scheduled_group");
        boolean automatic = intent.getBooleanExtra("scheduled_automatic", false);
        boolean testMode = intent.getBooleanExtra("scheduled_test_mode", true);
        String scheduleId = intent.getStringExtra("scheduled_id");
        intent.removeExtra("scheduled_share");
        intent.removeExtra("scheduled_text");
        intent.removeExtra("scheduled_image");
        intent.removeExtra("scheduled_group");
        intent.removeExtra("scheduled_automatic");
        intent.removeExtra("scheduled_test_mode");
        final String finalText = text == null ? "" : text;
        final String finalImage = image == null ? "" : image;
        final String finalGroup = group == null ? "" : group;
        if (automatic && !finalGroup.trim().isEmpty()) {
            new Handler(Looper.getMainLooper()).postDelayed(
                    () -> startAutomatedWhatsAppShare(scheduleId, finalImage, finalText, finalGroup, testMode),
                    350
            );
        } else {
            new Handler(Looper.getMainLooper()).postDelayed(() -> new AndroidBridge().shareToWhatsAppBusiness(finalImage, finalText, finalGroup), 350);
        }
    }

    private void startAutomatedWhatsAppShare(String id, String imageUrl, String text, String groupName, boolean testMode) {
        if (!WhatsAppAutomationService.isEnabled(this)) {
            Toast.makeText(this, "Ative o serviço Piloto Automático nas configurações de acessibilidade.", Toast.LENGTH_LONG).show();
            return;
        }
        new Thread(() -> {
            PreparedImage prepared = prepareImage(imageUrl);
            try {
                JSONObject job = new JSONObject();
                job.put("id", id == null ? "" : id);
                job.put("group", groupName == null ? "" : groupName.trim());
                job.put("stage", "pick_group");
                job.put("testMode", testMode);
                job.put("createdAt", System.currentTimeMillis());
                getSharedPreferences(WhatsAppAutomationService.PREFS, MODE_PRIVATE).edit()
                        .putString(WhatsAppAutomationService.KEY_JOB, job.toString())
                        .apply();
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Não foi possível preparar a automação.", Toast.LENGTH_LONG).show());
                return;
            }
            runOnUiThread(() -> openWhatsAppBusiness(prepared.uri, prepared.mimeType, text, groupName));
        }).start();
    }


    private static boolean looksLikeMercadoLivreProductImage(String value) {
        if (value == null) return false;
        String url = value.replace("\\u002F", "/").replace("\\/", "/").replace("&amp;", "&").trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
        String lower = url.toLowerCase();
        if (!lower.contains("mlstatic.com")) return false;
        if (lower.contains("/navigation/") || lower.contains("/frontend-assets/") || lower.contains("logo") || lower.contains("sprite") || lower.contains("icon")) return false;
        return lower.contains("d_nq_np_") || lower.contains("d_nq_nq_") || lower.matches(".*[0-9]{5,}-mla?[0-9]+_[0-9]{4,}.*");
    }

    private static String normalizeImageCandidate(String value) {
        if (value == null) return "";
        String cleaned = value.replace("\\u002F", "/").replace("\\/", "/").replace("&amp;", "&").trim();
        if (cleaned.startsWith("//")) cleaned = "https:" + cleaned;
        return looksLikeMercadoLivreProductImage(cleaned) ? cleaned : "";
    }

    private void resolveImageInsideAndroid(final String requestId, final String sourceUrl) {
        runOnUiThread(() -> {
            final WebView resolver = new WebView(MainActivity.this);
            final Set<String> networkCandidates = new LinkedHashSet<>();
            final Handler handler = new Handler(Looper.getMainLooper());
            final boolean[] completed = { false };
            final boolean[] polling = { false };
            final String[] currentPageUrl = { sourceUrl };
            final String[] currentTitle = { "" };
            final int[] attempt = { 0 };

            WebSettings settings = resolver.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setLoadsImagesAutomatically(true);
            settings.setBlockNetworkImage(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);
            settings.setDefaultTextEncodingName("UTF-8");
            settings.setUserAgentString("Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");

            CookieManager cookies = CookieManager.getInstance();
            cookies.setAcceptCookie(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) cookies.setAcceptThirdPartyCookies(resolver, true);

            FrameLayout root = (FrameLayout) webView.getParent();
            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(1080, 1920);
            resolver.setAlpha(0.001f);
            resolver.setFocusable(false);
            resolver.setClickable(false);
            resolver.setTranslationX(3000f);
            root.addView(resolver, params);

            final Runnable timeout = () -> {
                if (completed[0]) return;
                completed[0] = true;
                String fallback = networkCandidates.isEmpty() ? "" : networkCandidates.iterator().next();
                if (!fallback.isEmpty()) {
                    downloadImageAsDataUrl(resolver, requestId, fallback, currentTitle[0], currentPageUrl[0]);
                } else {
                    finishLocalImageRequest(resolver, requestId, "", currentTitle[0], "A página abriu, mas nenhuma imagem principal foi encontrada.");
                }
            };
            handler.postDelayed(timeout, 35000);

            final Runnable[] poll = new Runnable[1];
            poll[0] = () -> {
                if (completed[0]) return;
                attempt[0]++;
                String script = "(function(){" +
                        "function clean(v){return String(v||'').replace(/&amp;/g,'&').replace(/\\\\u002F/g,'/').replace(/\\\\\\//g,'/').trim();}" +
                        "function add(a,v){v=clean(v);if(v&&/^https?:/i.test(v)&&a.indexOf(v)<0)a.push(v);}" +
                        "var out=[],title='';" +
                        "var og=document.querySelector('meta[property=\\\"og:image\\\"]');add(out,og&&og.content);" +
                        "var tw=document.querySelector('meta[name=\\\"twitter:image\\\"],meta[property=\\\"twitter:image\\\"]');add(out,tw&&tw.content);" +
                        "var ot=document.querySelector('meta[property=\\\"og:title\\\"]');title=clean(ot&&ot.content)||clean(document.title);" +
                        "var imgs=document.querySelectorAll('.ui-pdp-gallery__figure img,.ui-pdp-image,.ui-pdp-gallery img,picture img,img[data-zoom],img[src*=\\\"mlstatic\\\"]');" +
                        "for(var i=0;i<imgs.length;i++){var im=imgs[i];add(out,im.currentSrc);add(out,im.src);add(out,im.getAttribute('data-src'));var ss=im.getAttribute('srcset')||'';ss.split(',').forEach(function(x){add(out,x.trim().split(/\\s+/)[0]);});}" +
                        "var sources=document.querySelectorAll('picture source[srcset]');for(var j=0;j<sources.length;j++){String(sources[j].srcset||'').split(',').forEach(function(x){add(out,x.trim().split(/\\s+/)[0]);});}" +
                        "try{performance.getEntriesByType('resource').forEach(function(e){if(/mlstatic\\.com/i.test(e.name))add(out,e.name);});}catch(e){}" +
                        "var html=document.documentElement?document.documentElement.innerHTML:'';" +
                        "var rx=/https?:\\\\?\\/\\\\?\\/[^\\\"'<>\\s]*mlstatic\\.com[^\\\"'<>\\s]*/ig,m;while((m=rx.exec(html))&&out.length<80)add(out,m[0]);" +
                        "var ids=html.match(/[0-9]{5,}-ML[AB][0-9]+_[0-9]{4,}/ig)||[];ids.slice(0,20).forEach(function(id){add(out,'https://http2.mlstatic.com/D_NQ_NP_'+id+'-O.webp');});" +
                        "return JSON.stringify({images:out,title:title,url:location.href,ready:document.readyState});})()";

                resolver.evaluateJavascript(script, raw -> {
                    if (completed[0]) return;
                    try {
                        String decoded = raw == null ? "" : raw;
                        if (decoded.startsWith("\"") && decoded.endsWith("\"")) decoded = new JSONArray("[" + decoded + "]").getString(0);
                        JSONObject result = new JSONObject(decoded);
                        currentTitle[0] = result.optString("title", currentTitle[0]);
                        currentPageUrl[0] = result.optString("url", currentPageUrl[0]);
                        JSONArray images = result.optJSONArray("images");
                        String chosen = "";
                        if (images != null) {
                            for (int i = 0; i < images.length(); i++) {
                                String candidate = normalizeImageCandidate(images.optString(i));
                                if (candidate.isEmpty()) continue;
                                networkCandidates.add(candidate);
                                if (chosen.isEmpty()) chosen = candidate;
                                if (candidate.contains("D_NQ_NP_")) { chosen = candidate; break; }
                            }
                        }
                        if (!chosen.isEmpty()) {
                            completed[0] = true;
                            handler.removeCallbacks(timeout);
                            downloadImageAsDataUrl(resolver, requestId, chosen, currentTitle[0], currentPageUrl[0]);
                            return;
                        }
                    } catch (Exception ignored) { }
                    if (attempt[0] < 18) handler.postDelayed(poll[0], 1200);
                    else timeout.run();
                });
            };

            resolver.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    String scheme = uri == null ? "" : String.valueOf(uri.getScheme());
                    return !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme));
                }

                @Override public void onLoadResource(WebView view, String url) {
                    String candidate = normalizeImageCandidate(url);
                    if (!candidate.isEmpty()) networkCandidates.add(candidate);
                }

                @Override public void onPageFinished(WebView view, String url) {
                    currentPageUrl[0] = url == null ? currentPageUrl[0] : url;
                    Uri current = Uri.parse(currentPageUrl[0]);
                    String host = current.getHost() == null ? "" : current.getHost().toLowerCase();
                    if (host.equals("meli.la") || host.endsWith(".meli.la")) return;
                    if (!polling[0]) {
                        polling[0] = true;
                        handler.postDelayed(poll[0], 700);
                    }
                }
            });

            java.util.HashMap<String, String> headers = new java.util.HashMap<>();
            headers.put("Accept-Language", "pt-BR,pt;q=0.9,en;q=0.8");
            headers.put("DNT", "1");
            resolver.loadUrl(sourceUrl, headers);
        });
    }

    private List<String> imageDownloadCandidates(String imageUrl) {
        LinkedHashSet<String> urls = new LinkedHashSet<>();
        String normalized = normalizeImageCandidate(imageUrl);
        if (!normalized.isEmpty()) urls.add(normalized);
        if (!normalized.isEmpty()) {
            urls.add(normalized.replace("-O.webp", "-F.webp"));
            urls.add(normalized.replace("-O.webp", "-V.webp"));
            urls.add(normalized.replace("-F.webp", "-O.webp"));
            urls.add(normalized.replace("-V.webp", "-O.webp"));
        }
        return new ArrayList<>(urls);
    }

    private void downloadImageAsDataUrl(final WebView resolver, final String requestId, final String imageUrl, final String title, final String finalUrl) {
        new Thread(() -> {
            String lastError = "Não foi possível baixar a imagem.";
            for (String candidate : imageDownloadCandidates(imageUrl)) {
                HttpURLConnection connection = null;
                try {
                    connection = (HttpURLConnection) new URL(candidate).openConnection();
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(22000);
                    connection.setInstanceFollowRedirects(true);
                    connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36");
                    connection.setRequestProperty("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");
                    connection.setRequestProperty("Accept-Language", "pt-BR,pt;q=0.9");
                    connection.setRequestProperty("Referer", finalUrl == null || finalUrl.isEmpty() ? "https://www.mercadolivre.com.br/" : finalUrl);
                    String cookie = CookieManager.getInstance().getCookie(finalUrl == null ? "https://www.mercadolivre.com.br/" : finalUrl);
                    if (cookie != null && !cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);
                    connection.connect();
                    int code = connection.getResponseCode();
                    if (code < 200 || code >= 300) throw new Exception("A imagem respondeu com código " + code + ".");
                    String mime = connection.getContentType();
                    if (mime == null || !mime.toLowerCase().startsWith("image/")) throw new Exception("O endereço não retornou uma imagem.");
                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    try (InputStream input = connection.getInputStream()) {
                        byte[] buffer = new byte[8192]; int read;
                        while ((read = input.read(buffer)) != -1) {
                            output.write(buffer, 0, read);
                            if (output.size() > 8 * 1024 * 1024) throw new Exception("A imagem é grande demais.");
                        }
                    }
                    if (output.size() < 500) throw new Exception("A imagem retornou vazia ou inválida.");
                    String dataUrl = "data:" + mime + ";base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
                    finishLocalImageRequest(resolver, requestId, dataUrl, title, "");
                    return;
                } catch (Exception error) {
                    lastError = error.getMessage() == null ? lastError : error.getMessage();
                } finally {
                    if (connection != null) connection.disconnect();
                }
            }
            finishLocalImageRequest(resolver, requestId, "", title, lastError);
        }).start();
    }

    private void finishLocalImageRequest(final WebView resolver, final String requestId, final String dataUrl, final String title, final String error) {
        runOnUiThread(() -> {
            try {
                if (resolver != null) {
                    if (resolver.getParent() instanceof ViewGroup) ((ViewGroup) resolver.getParent()).removeView(resolver);
                    resolver.stopLoading();
                    resolver.destroy();
                }
            } catch (Exception ignored) { }
            String javascript = "window.CbOfertasLocalImageResolved(" +
                    JSONObject.quote(requestId == null ? "" : requestId) + "," +
                    JSONObject.quote(dataUrl == null ? "" : dataUrl) + "," +
                    JSONObject.quote(title == null ? "" : title) + "," +
                    JSONObject.quote(error == null ? "" : error) + ");";
            webView.evaluateJavascript(javascript, null);
        });
    }

    public class AndroidBridge {
        @JavascriptInterface public String dbUpsertOffer(String json) { return database.upsertOffer(json); }
        @JavascriptInterface public String dbListOffers() { return database.listOffers(); }
        @JavascriptInterface public boolean dbDeleteOffer(String id) { return database.deleteOffer(id == null ? "" : id); }
        @JavascriptInterface public void dbRecordUsage(String offerId, String type, String coupon, String details) { database.recordUsage(offerId, type, coupon, details); }
        @JavascriptInterface public String dbListUsage(String offerId) { return database.listUsage(offerId); }
        @JavascriptInterface public boolean dbSaveExport(String id, String name, String payload, int count) { return database.saveExport(id, name, payload, count); }
        @JavascriptInterface public String dbListExports() { return database.listExports(); }
        @JavascriptInterface public boolean dbDeleteExport(String id) { return database.deleteExport(id == null ? "" : id); }

        @JavascriptInterface
        public void resolveProductImage(String requestId, String sourceUrl) {
            final String id = requestId == null ? "" : requestId.trim();
            final String url = sourceUrl == null ? "" : sourceUrl.trim();
            if (id.isEmpty() || firstMercadoLivreLink(url) == null) {
                finishLocalImageRequest(null, id, "", "", "Link do Mercado Livre inválido.");
                return;
            }
            resolveImageInsideAndroid(id, url);
        }

        @JavascriptInterface
        public void openExternalLink(String value) {
            final String link = value == null ? "" : value.trim();
            if (firstMercadoLivreLink(link) == null) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Link do Mercado Livre inválido.", Toast.LENGTH_LONG).show());
                return;
            }
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(link)));
                } catch (Exception error) {
                    Toast.makeText(MainActivity.this, "Não foi possível abrir o Mercado Livre.", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void copyText(String value) {
            final String text = value == null ? "" : value.trim();
            runOnUiThread(() -> {
                ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (clipboard != null) {
                    clipboard.setPrimaryClip(ClipData.newPlainText("CbOfertas", text));
                    Toast.makeText(MainActivity.this, "Link copiado.", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public String getClipboardText() {
            try {
                ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (clipboard == null || !clipboard.hasPrimaryClip() || clipboard.getPrimaryClip() == null) return "";
                ClipData.Item item = clipboard.getPrimaryClip().getItemAt(0);
                CharSequence text = item.coerceToText(MainActivity.this);
                return text == null ? "" : text.toString();
            } catch (Exception ignored) {
                return "";
            }
        }

        @JavascriptInterface
        public void shareTextFile(String fileName, String mimeType, String content) {
            final String safeName = (fileName == null || fileName.trim().isEmpty()) ? "CbOfertas_Fila.cbofertas" : fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
            final String safeMime = (mimeType == null || mimeType.trim().isEmpty()) ? "application/json" : mimeType;
            final String safeContent = content == null ? "" : content;
            new Thread(() -> {
                try {
                    File directory = new File(getCacheDir(), "exports");
                    if (!directory.exists() && !directory.mkdirs()) throw new Exception("Não foi possível criar a pasta de exportação.");
                    File file = new File(directory, safeName);
                    try (FileOutputStream output = new FileOutputStream(file)) {
                        output.write(safeContent.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    }
                    Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", file);
                    runOnUiThread(() -> {
                        Intent share = new Intent(Intent.ACTION_SEND);
                        share.setType(safeMime);
                        share.putExtra(Intent.EXTRA_STREAM, uri);
                        share.putExtra(Intent.EXTRA_TEXT, "Fila CbOfertas exportada em " + new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm", java.util.Locale.getDefault()).format(new java.util.Date()));
                        share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        share.setClipData(ClipData.newRawUri("CbOfertas", uri));
                        share.setPackage("com.whatsapp.w4b");
                        grantUriPermission("com.whatsapp.w4b", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        try {
                            startActivity(share);
                        } catch (Exception businessError) {
                            Toast.makeText(MainActivity.this, "WhatsApp Business não encontrado. Abrindo opções de compartilhamento.", Toast.LENGTH_LONG).show();
                            Intent fallback = new Intent(Intent.ACTION_SEND);
                            fallback.setType(safeMime);
                            fallback.putExtra(Intent.EXTRA_STREAM, uri);
                            fallback.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            fallback.setClipData(ClipData.newRawUri("CbOfertas", uri));
                            startActivity(Intent.createChooser(fallback, "Exportar fila CbOfertas"));
                        }
                    });
                } catch (Exception error) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Não foi possível exportar a fila: " + error.getMessage(), Toast.LENGTH_LONG).show());
                }
            }).start();
        }

        @JavascriptInterface
        public void shareImageAndText(String imageUrl, String text) {
            new Thread(() -> {
                PreparedImage prepared = prepareImage(imageUrl);
                runOnUiThread(() -> openShareSheet(prepared.uri, prepared.mimeType, text));
            }).start();
        }

        @JavascriptInterface
        public void shareToWhatsAppBusiness(String imageUrl, String text, String groupName) {
            new Thread(() -> {
                PreparedImage prepared = prepareImage(imageUrl);
                runOnUiThread(() -> openWhatsAppBusiness(prepared.uri, prepared.mimeType, text, groupName));
            }).start();
        }

        @JavascriptInterface
        public void shareMessagesSeparately(String imageUrl, String messagesJson, boolean preferWhatsapp) {
            final List<ShareQueueItem> items = new ArrayList<>();
            try {
                JSONArray array = new JSONArray(messagesJson == null ? "[]" : messagesJson);
                for (int i = 0; i < array.length(); i++) {
                    String message = array.optString(i, "").trim();
                    if (!message.isEmpty()) items.add(new ShareQueueItem(message, imageUrl));
                }
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Não foi possível preparar as mensagens.", Toast.LENGTH_LONG).show());
                return;
            }
            if (items.isEmpty()) return;
            runOnUiThread(() -> startSeparateShareQueue(items, preferWhatsapp));
        }

        @JavascriptInterface
        public void shareSavedMessagesSeparately(String itemsJson, boolean preferWhatsapp) {
            final List<ShareQueueItem> items = new ArrayList<>();
            try {
                JSONArray array = new JSONArray(itemsJson == null ? "[]" : itemsJson);
                for (int i = 0; i < array.length(); i++) {
                    JSONObject object = array.optJSONObject(i);
                    if (object == null) continue;
                    String text = object.optString("text", "").trim();
                    String image = object.optString("image", "").trim();
                    if (!text.isEmpty()) items.add(new ShareQueueItem(text, image));
                }
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Não foi possível preparar os itens salvos.", Toast.LENGTH_LONG).show());
                return;
            }
            if (items.isEmpty()) return;
            runOnUiThread(() -> startSeparateShareQueue(items, preferWhatsapp));
        }

        @JavascriptInterface
        public String scheduleMessage(String id, long when, String title, String text, String imageUrl) {
            try {
                if (id == null || id.trim().isEmpty()) return "Identificador inválido.";
                if (when <= System.currentTimeMillis() + 30000L) return "Escolha um horário futuro.";
                ScheduleManager.schedule(MainActivity.this, id, when, title, text, imageUrl, "", false, true, true);
                return "ok";
            } catch (Exception error) {
                return error.getMessage() == null ? "Não foi possível agendar." : error.getMessage();
            }
        }

        @JavascriptInterface
        public String scheduleAutomaticMessage(String id, long when, String title, String text, String imageUrl, String groupName, boolean testMode) {
            try {
                if (id == null || id.trim().isEmpty()) return "Identificador inválido.";
                if (when <= System.currentTimeMillis() + 30000L) return "Escolha um horário futuro.";
                String safeGroup = groupName == null ? "" : groupName.trim();
                if (safeGroup.isEmpty()) return "Informe o nome exato do grupo.";
                if (!WhatsAppAutomationService.isEnabled(MainActivity.this)) return "Ative o Piloto Automático nas configurações de acessibilidade.";
                ScheduleManager.schedule(MainActivity.this, id, when, title, text, imageUrl, safeGroup, true, testMode, true);
                return "ok";
            } catch (Exception error) {
                return error.getMessage() == null ? "Não foi possível agendar automaticamente." : error.getMessage();
            }
        }

        @JavascriptInterface
        public void configureAutomation(String groupName, boolean enabled, boolean testMode) {
            String safeGroup = groupName == null ? "" : groupName.trim();
            getSharedPreferences(WhatsAppAutomationService.PREFS, MODE_PRIVATE).edit()
                    .putString(WhatsAppAutomationService.KEY_GROUP, safeGroup)
                    .putBoolean(WhatsAppAutomationService.KEY_ENABLED, enabled)
                    .putBoolean(WhatsAppAutomationService.KEY_TEST_MODE, testMode)
                    .apply();
        }

        @JavascriptInterface
        public boolean isAutomationServiceEnabled() {
            return WhatsAppAutomationService.isEnabled(MainActivity.this);
        }

        @JavascriptInterface
        public String getAutomationLastResult() {
            return getSharedPreferences(WhatsAppAutomationService.PREFS, MODE_PRIVATE)
                    .getString(WhatsAppAutomationService.KEY_LAST_RESULT, "");
        }

        @JavascriptInterface
        public void openAutomationSettings() {
            runOnUiThread(() -> {
                try {
                    Intent settings = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
                    startActivity(settings);
                } catch (Exception error) {
                    Toast.makeText(MainActivity.this, "Abra Configurações > Acessibilidade e ative Piloto Automático CbOfertas.", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void testAutomaticShare(String imageUrl, String text, String groupName, boolean testMode) {
            runOnUiThread(() -> startAutomatedWhatsAppShare("test-" + System.currentTimeMillis(), imageUrl, text, groupName, testMode));
        }

        @JavascriptInterface
        public void cancelScheduledMessage(String id) {
            if (id != null && !id.trim().isEmpty()) ScheduleManager.cancel(MainActivity.this, id);
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                    ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(() -> ActivityCompat.requestPermissions(
                        MainActivity.this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        NOTIFICATION_PERMISSION_REQUEST
                ));
            }
        }
    }

    private PreparedImage prepareImage(String imageUrl) {
        Uri imageUri = null;
        String mimeType = "image/jpeg";
        try {
            String safeUrl = imageUrl == null ? "" : imageUrl.trim();
            if (safeUrl.startsWith("data:image/")) {
                int comma = safeUrl.indexOf(',');
                if (comma > 0) {
                    String header = safeUrl.substring(0, comma);
                    String encoded = safeUrl.substring(comma + 1);
                    mimeType = header.contains("image/png") ? "image/png" : header.contains("image/webp") ? "image/webp" : "image/jpeg";
                    String extension = mimeType.contains("png") ? ".png" : mimeType.contains("webp") ? ".webp" : ".jpg";
                    File directory = new File(getCacheDir(), "shared");
                    if (!directory.exists()) directory.mkdirs();
                    File imageFile = new File(directory, "promocao-" + Math.abs(safeUrl.hashCode()) + extension);
                    try (FileOutputStream output = new FileOutputStream(imageFile)) {
                        output.write(Base64.decode(encoded, Base64.DEFAULT));
                    }
                    imageUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", imageFile);
                }
            } else if (!safeUrl.isEmpty() && safeUrl.startsWith("http")) {
                HttpURLConnection connection = (HttpURLConnection) new URL(safeUrl).openConnection();
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(30000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 Android CbOfertas");
                connection.connect();
                if (connection.getResponseCode() >= 200 && connection.getResponseCode() < 300) {
                    String contentType = connection.getContentType();
                    if (contentType != null && contentType.startsWith("image/")) mimeType = contentType.split(";")[0];
                    String extension = mimeType.contains("png") ? ".png" : mimeType.contains("webp") ? ".webp" : ".jpg";
                    File directory = new File(getCacheDir(), "shared");
                    if (!directory.exists()) directory.mkdirs();
                    File imageFile = new File(directory, "promocao-" + Math.abs(safeUrl.hashCode()) + extension);
                    try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(imageFile)) {
                        byte[] buffer = new byte[8192];
                        int count;
                        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    }
                    imageUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", imageFile);
                }
                connection.disconnect();
            }
        } catch (Exception ignored) { }
        return new PreparedImage(imageUri, mimeType);
    }

    private void startSeparateShareQueue(List<ShareQueueItem> items, boolean preferWhatsapp) {
        clearSeparateShareQueue();
        separateShareQueue.addAll(items);
        separateShareIndex = 0;
        separateSharePreferWhatsapp = preferWhatsapp;
        Toast.makeText(this, items.size() + " mensagem(ns) serão abertas uma por vez.", Toast.LENGTH_LONG).show();
        openNextSeparateShare();
    }

    private void openNextSeparateShare() {
        if (preparingSeparateShare) return;
        if (separateShareIndex >= separateShareQueue.size()) {
            int total = separateShareQueue.size();
            clearSeparateShareQueue();
            if (total > 0) Toast.makeText(this, total + " mensagem(ns) processada(s) separadamente.", Toast.LENGTH_SHORT).show();
            return;
        }

        ShareQueueItem item = separateShareQueue.get(separateShareIndex);
        separateShareIndex++;
        preparingSeparateShare = true;

        new Thread(() -> {
            PreparedImage prepared = prepareImage(item.imageUrl);
            runOnUiThread(() -> {
                preparingSeparateShare = false;
                Intent share = buildShareIntent(prepared.uri, prepared.mimeType, item.text);
                try {
                    if (separateSharePreferWhatsapp) {
                        String whatsappPackage = findWhatsAppPackage();
                        if (whatsappPackage != null) {
                            share.setPackage(whatsappPackage);
                            waitingForExternalShare = true;
                            startActivity(share);
                        } else {
                            waitingForExternalShare = true;
                            startActivity(Intent.createChooser(share, "Compartilhar mensagem " + separateShareIndex));
                        }
                    } else {
                        waitingForExternalShare = true;
                        startActivity(Intent.createChooser(share, "Compartilhar mensagem " + separateShareIndex));
                    }
                } catch (Exception error) {
                    clearSeparateShareQueue();
                    Toast.makeText(MainActivity.this, "Não foi possível abrir o compartilhamento.", Toast.LENGTH_LONG).show();
                }
            });
        }).start();
    }

    private String findWhatsAppPackage() {
        if (getPackageManager().getLaunchIntentForPackage("com.whatsapp.w4b") != null) return "com.whatsapp.w4b";
        if (getPackageManager().getLaunchIntentForPackage("com.whatsapp") != null) return "com.whatsapp";
        return null;
    }

    private void clearSeparateShareQueue() {
        separateShareQueue.clear();
        separateShareIndex = 0;
        waitingForExternalShare = false;
        pausedForExternalShare = false;
        preparingSeparateShare = false;
    }

    private Intent buildShareIntent(Uri imageUri, String mimeType, String text) {
        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType(imageUri != null ? mimeType : "text/plain");
        share.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
        if (imageUri != null) {
            share.putExtra(Intent.EXTRA_STREAM, imageUri);
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            share.setClipData(android.content.ClipData.newRawUri("CbOfertas", imageUri));
        }
        return share;
    }

    private void openShareSheet(Uri imageUri, String mimeType, String text) {
        try {
            startActivity(Intent.createChooser(buildShareIntent(imageUri, mimeType, text), "Compartilhar oferta"));
        } catch (Exception error) {
            Toast.makeText(this, "Não foi possível abrir o compartilhamento.", Toast.LENGTH_LONG).show();
        }
    }

    private void openWhatsAppBusiness(Uri imageUri, String mimeType, String text, String groupName) {
        String businessPackage = "com.whatsapp.w4b";
        if (getPackageManager().getLaunchIntentForPackage(businessPackage) == null) {
            Toast.makeText(this, "WhatsApp Business não está instalado.", Toast.LENGTH_LONG).show();
            return;
        }
        try {
            Intent share = buildShareIntent(imageUri, mimeType, text);
            share.setPackage(businessPackage);
            String safeGroup = groupName == null ? "" : groupName.trim();
            if (!safeGroup.isEmpty()) {
                Toast.makeText(this, "Selecione o grupo: " + safeGroup, Toast.LENGTH_LONG).show();
            }
            startActivity(share);
        } catch (Exception error) {
            Toast.makeText(this, "Não foi possível abrir o WhatsApp Business.", Toast.LENGTH_LONG).show();
        }
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
