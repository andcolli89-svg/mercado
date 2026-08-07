package com.cbofertas.app;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import java.util.List;
import org.json.JSONObject;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    public static final String PREFS = "cb_automation";
    public static final String PKG_BUSINESS = "com.whatsapp.w4b";
    public static final String PKG_NORMAL = "com.whatsapp";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        webView.clearCache(true);
        webView.addJavascriptInterface(new AndroidBridge(), "Android");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/www/index.html?v=1220");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    private boolean openShare(String packageName, String text) {
        try {
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("text/plain");
            intent.putExtra(Intent.EXTRA_TEXT, text);
            intent.setPackage(packageName);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            return true;
        } catch (Exception error) {
            return false;
        }
    }

    public class AndroidBridge {
        @JavascriptInterface
        public String getVersion() {
            return "12.2.0";
        }

        @JavascriptInterface
        public void openExternal(String url) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void openAccessibilitySettings() {
            try {
                startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public boolean isAutomationServiceEnabled() {
            AccessibilityManager manager =
                    (AccessibilityManager) getSystemService(Context.ACCESSIBILITY_SERVICE);
            if (manager == null) return false;

            List<AccessibilityServiceInfo> services =
                    manager.getEnabledAccessibilityServiceList(
                            AccessibilityServiceInfo.FEEDBACK_ALL_MASK);

            String expected = getPackageName() + "/.WhatsAppAutomationService";
            for (AccessibilityServiceInfo info : services) {
                String id = info.getId();
                if (id != null && (
                        TextUtils.equals(id, expected) ||
                        id.endsWith("/.WhatsAppAutomationService"))) {
                    return true;
                }
            }
            return false;
        }

        @JavascriptInterface
        public boolean startCalibration(String type, boolean useBusiness) {
            if (!"group".equals(type) && !"send".equals(type)) return false;

            String packageName = useBusiness ? PKG_BUSINESS : PKG_NORMAL;
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

            prefs.edit()
                    .putString("wa_package", packageName)
                    .putString("calibration_mode", type)
                    .putLong("calibration_started_at", System.currentTimeMillis())
                    .remove("calibration_result")
                    .commit();

            String text = "group".equals(type)
                    ? "CALIBRAÇÃO CBOFERTAS — selecione o destino. Esta mensagem não será enviada."
                    : "CALIBRAÇÃO CBOFERTAS — selecione um contato de teste e toque em Enviar.";

            boolean opened = openShare(packageName, text);
            if (!opened) {
                prefs.edit()
                        .remove("calibration_mode")
                        .putString("calibration_result",
                                "{\"status\":\"failed\",\"message\":\"Não foi possível abrir o WhatsApp.\"}")
                        .apply();
            }
            return opened;
        }

        @JavascriptInterface
        public String getCalibrationData() {
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            try {
                JSONObject result = new JSONObject();
                result.put("groupX", prefs.getInt("group_x", 0));
                result.put("groupY", prefs.getInt("group_y", 0));
                result.put("sendX", prefs.getInt("send_x", 0));
                result.put("sendY", prefs.getInt("send_y", 0));
                result.put("mode", prefs.getString("calibration_mode", ""));
                result.put("result", prefs.getString("calibration_result", ""));
                return result.toString();
            } catch (Exception error) {
                return "{}";
            }
        }

        @JavascriptInterface
        public void saveCalibrationCoordinates(int groupX, int groupY, int sendX, int sendY) {
            getSharedPreferences(PREFS, MODE_PRIVATE)
                    .edit()
                    .putInt("group_x", Math.max(0, groupX))
                    .putInt("group_y", Math.max(0, groupY))
                    .putInt("send_x", Math.max(0, sendX))
                    .putInt("send_y", Math.max(0, sendY))
                    .putString("calibration_result",
                            "{\"status\":\"saved\",\"message\":\"Coordenadas salvas manualmente.\"}")
                    .apply();
        }

        @JavascriptInterface
        public void clearCalibration() {
            getSharedPreferences(PREFS, MODE_PRIVATE)
                    .edit()
                    .remove("group_x")
                    .remove("group_y")
                    .remove("send_x")
                    .remove("send_y")
                    .remove("calibration_mode")
                    .putString("calibration_result",
                            "{\"status\":\"cleared\",\"message\":\"Calibração apagada.\"}")
                    .apply();
        }

        @JavascriptInterface
        public boolean startAutomaticMessage(
                String jobId,
                String text,
                String group,
                boolean useBusiness,
                int openDelayMs,
                int groupDelayMs,
                int returnDelayMs,
                int maxAttempts,
                boolean stopOnError,
                int clickStrategy
        ) {
            if (text == null || text.trim().isEmpty()) return false;
            if (group == null || group.trim().isEmpty()) return false;

            String packageName = useBusiness ? PKG_BUSINESS : PKG_NORMAL;
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            long now = System.currentTimeMillis();

            prefs.edit()
                    .putBoolean("enabled", true)
                    .putString("job_id", jobId == null ? "" : jobId)
                    .putString("job_text", text)
                    .putString("group_name", group.trim())
                    .putString("wa_package", packageName)
                    .putString("stage", "WAIT_DESTINATION")
                    .putBoolean("group_clicked", false)
                    .putBoolean("send_clicked", false)
                    .putInt("attempt", 0)
                    .putInt("send_attempt", 0)
                    .putInt("max_attempts", Math.max(1, Math.min(8, maxAttempts)))
                    .putInt("open_delay", Math.max(300, openDelayMs))
                    .putInt("group_delay", Math.max(200, groupDelayMs))
                    .putInt("return_delay", Math.max(400, returnDelayMs))
                    .putInt("click_strategy", Math.max(0, Math.min(2, clickStrategy)))
                    .putLong("job_started_at", now)
                    .putLong("stage_started_at", now)
                    .putBoolean("stop_on_error", stopOnError)
                    .remove("post_send_lock_until")
                    .remove("last_result")
                    .commit();

            boolean opened = openShare(packageName, text);
            if (!opened) {
                prefs.edit()
                        .putBoolean("enabled", false)
                        .putString("last_result",
                                "{\"status\":\"failed\",\"message\":\"Não foi possível abrir o WhatsApp.\"}")
                        .remove("stage")
                        .apply();
            }
            return opened;
        }

        @JavascriptInterface
        public String getAutomationLastResult() {
            return getSharedPreferences(PREFS, MODE_PRIVATE)
                    .getString("last_result", "");
        }

        @JavascriptInterface
        public void clearAutomationLastResult() {
            getSharedPreferences(PREFS, MODE_PRIVATE)
                    .edit().remove("last_result").apply();
        }

        @JavascriptInterface
        public void stopAutomation() {
            getSharedPreferences(PREFS, MODE_PRIVATE)
                    .edit()
                    .putBoolean("enabled", false)
                    .remove("stage")
                    .remove("job_id")
                    .remove("post_send_lock_until")
                    .putString("last_result",
                            "{\"status\":\"stopped\",\"message\":\"Automação interrompida.\"}")
                    .apply();
        }
    }
}
