package com.cbofertas.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final int NOTIFICATION_PERMISSION_REQUEST = 3201;
    private static final int FILE_CHOOSER_REQUEST = 3202;
    private WebView webView;
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
        webView = new WebView(this);
        setContentView(webView);

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

                Intent picker;
                try {
                    picker = fileChooserParams != null ? fileChooserParams.createIntent() : new Intent(Intent.ACTION_OPEN_DOCUMENT);
                } catch (Exception error) {
                    picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                }
                picker.setAction(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("image/*");
                picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                try {
                    startActivityForResult(Intent.createChooser(picker, "Escolher foto"), FILE_CHOOSER_REQUEST);
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
                    if (host != null && (host.contains("mercadolivre") || host.contains("meli.la") || host.contains("shopee") || host.contains("shope.ee") || host.contains("whatsapp") || host.contains("wa.me"))) {
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
        if (resultCode == Activity.RESULT_OK) {
            results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
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
            String link = firstSupportedProductLink(shared == null ? "" : shared.toString());
            intent.removeExtra(Intent.EXTRA_TEXT);
            intent.setAction(Intent.ACTION_MAIN);
            if (link != null) {
                if (!pageReady) pendingSharedProductLink = link;
                else deliverSharedProductLink(link);
            } else {
                Toast.makeText(this, "O compartilhamento não contém um link de produto do Mercado Livre ou Shopee.", Toast.LENGTH_LONG).show();
            }
        }
    }

    private String firstSupportedProductLink(String text) {
        Matcher matcher = Pattern.compile("https?://[^\\s<>\"']+", Pattern.CASE_INSENSITIVE).matcher(text == null ? "" : text);
        while (matcher.find()) {
            String candidate = matcher.group().replaceAll("[),.;!?]+$", "");
            try {
                Uri uri = Uri.parse(candidate);
                String host = uri.getHost();
                if (host == null) continue;
                String normalized = host.toLowerCase();
                if (normalized.equals("meli.la") || normalized.endsWith(".meli.la") ||
                        normalized.contains("mercadolivre.com") || normalized.contains("mercadolibre.com") || normalized.contains("shopee.com.br") || normalized.equals("shope.ee") || normalized.endsWith(".shope.ee")) {
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
        intent.removeExtra("scheduled_share");
        intent.removeExtra("scheduled_text");
        intent.removeExtra("scheduled_image");
        final String finalText = text == null ? "" : text;
        final String finalImage = image == null ? "" : image;
        new Handler(Looper.getMainLooper()).postDelayed(() -> new AndroidBridge().shareToWhatsAppBusiness(finalImage, finalText, ""), 350);
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void openExternalLink(String value) {
            final String link = value == null ? "" : value.trim();
            if (firstSupportedProductLink(link) == null) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Link do Mercado Livre ou Shopee inválido.", Toast.LENGTH_LONG).show());
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
                ScheduleManager.schedule(MainActivity.this, id, when, title, text, imageUrl, true);
                return "ok";
            } catch (Exception error) {
                return error.getMessage() == null ? "Não foi possível agendar." : error.getMessage();
            }
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
