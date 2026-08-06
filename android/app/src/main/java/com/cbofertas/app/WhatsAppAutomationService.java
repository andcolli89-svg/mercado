package com.cbofertas.app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.graphics.Rect;
import android.graphics.Path;
import android.accessibilityservice.GestureDescription;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;

import org.json.JSONObject;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Automação supervisionada do WhatsApp Business para um aparelho dedicado.
 * Atua somente quando existe um trabalho explícito criado pela CbOfertas e
 * somente dentro dos pacotes oficiais do WhatsApp.
 */
public class WhatsAppAutomationService extends AccessibilityService {
    static final String PREFS = "cbofertas_automation";
    static final String KEY_ENABLED = "enabled";
    static final String KEY_GROUP = "group";
    static final String KEY_TEST_MODE = "test_mode";
    static final String KEY_JOB = "active_job";
    static final String KEY_LAST_RESULT = "last_result";

    private static final String WA = "com.whatsapp";
    private static final String WAB = "com.whatsapp.w4b";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private long lastActionAt = 0L;
    private String activeJobId = "";

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        AccessibilityServiceInfo info = getServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                | AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
                | AccessibilityEvent.TYPE_VIEW_CLICKED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 150;
        info.flags |= AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
        info.flags |= AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        info.packageNames = new String[]{WA, WAB};
        setServiceInfo(info);
        Toast.makeText(this, "Piloto automático CbOfertas ativado.", Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;
        String pkg = event.getPackageName().toString();
        if (!WA.equals(pkg) && !WAB.equals(pkg)) return;

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (!prefs.getBoolean(KEY_ENABLED, false)) return;
        String raw = prefs.getString(KEY_JOB, "");
        if (raw == null || raw.trim().isEmpty()) return;
        if (System.currentTimeMillis() - lastActionAt < 600L) return;

        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(this::processCurrentScreen, 700L);
    }

    @Override public void onInterrupt() { }

    private void processCurrentScreen() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String raw = prefs.getString(KEY_JOB, "");
        if (raw == null || raw.trim().isEmpty()) return;

        try {
            JSONObject job = new JSONObject(raw);
            activeJobId = job.optString("id", "");
            String group = job.optString("group", prefs.getString(KEY_GROUP, "")).trim();
            String stage = job.optString("stage", "pick_group");
            boolean testMode = job.optBoolean("testMode", prefs.getBoolean(KEY_TEST_MODE, true));
            if (group.isEmpty()) {
                failJob("Nome do grupo não configurado.");
                return;
            }

            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) return;

            if ("pick_group".equals(stage)) {
                AccessibilityNodeInfo groupNode = findDestinationNode(root, group);
                if (groupNode != null) {
                    boolean clicked = clickNodeOrParent(groupNode);
                    if (clicked) {
                        updateStage(job, "confirm_destination");
                        lastActionAt = System.currentTimeMillis();
                        handler.postDelayed(this::processCurrentScreen, 1200L);
                        return;
                    }
                    if (clickDestinationByCoordinates(groupNode, job)) return;
                }
                // Em algumas versões o compartilhamento abre direto em uma conversa já escolhida.
                if (screenContains(root, group) && hasSendControl(root)) {
                    updateStage(job, "send");
                    handler.postDelayed(this::processCurrentScreen, 500L);
                }
                return;
            }

            if ("confirm_destination".equals(stage)) {
                AccessibilityNodeInfo next = findByDescriptions(root,
                        "Avançar", "Próximo", "Next", "Enviar para", "Continuar");
                if (next != null) {
                    boolean clicked = clickNodeOrParent(next);
                    if (!clicked) clicked = clickNodeByCoordinates(next);
                    if (clicked) {
                        updateStage(job, "send");
                        lastActionAt = System.currentTimeMillis();
                        handler.postDelayed(this::processCurrentScreen, 1000L);
                        return;
                    }
                }
                // A tela nova do WhatsApp mostra "1 selecionado" e uma seta preta
                // circular no canto inferior direito, frequentemente sem ID ou descrição.
                if (screenContainsAny(root, "1 selecionado", "selected")) {
                    if (tapBottomRightAction(job, "send")) return;
                }

                // Algumas versões já entram na tela final sem botão intermediário.
                if (screenContains(root, group) && hasSendControl(root)) {
                    updateStage(job, "send");
                    handler.postDelayed(this::processCurrentScreen, 500L);
                }
                return;
            }

            if ("send".equals(stage)) {
                // Trava principal: só envia se o nome exato do grupo estiver visível.
                if (!screenContains(root, group)) return;
                AccessibilityNodeInfo send = findSendControl(root);
                if (send == null) {
                    // Reserva para o botão circular preto de envio.
                    if (!testMode && tapBottomRightAction(job, "verify")) return;
                    return;
                }
                if (testMode) {
                    finishJob("test_ready", "Modo teste: mensagem pronta, sem tocar em Enviar.");
                    Toast.makeText(this, "Modo teste: confira a mensagem e envie manualmente.", Toast.LENGTH_LONG).show();
                    return;
                }
                boolean sentClick = clickNodeOrParent(send);
                if (!sentClick) sentClick = clickNodeByCoordinates(send);
                if (sentClick) {
                    lastActionAt = System.currentTimeMillis();
                    updateStage(job, "verify");
                    handler.postDelayed(this::processCurrentScreen, 2500L);
                }
                return;
            }

            if ("verify".equals(stage)) {
                if (!screenContains(root, group)) return;
                AccessibilityNodeInfo retry = findByDescriptions(root, "Tentar novamente", "Retry", "Não enviada", "Falha ao enviar");
                if (retry != null) {
                    int attempts = job.optInt("attempts", 0) + 1;
                    job.put("attempts", attempts);
                    if (attempts < 3 && clickNodeOrParent(retry)) {
                        updateStage(job, "verify");
                        handler.postDelayed(this::processCurrentScreen, 2500L);
                        return;
                    }
                    failJob("O WhatsApp não confirmou o envio após " + attempts + " tentativa(s).");
                    return;
                }
                finishJob("sent", "Mensagem apresentada no grupo sem erro visível após o envio.");
                Toast.makeText(this, "Oferta processada para " + group + ".", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception error) {
            failJob("Falha na automação: " + (error.getMessage() == null ? "erro desconhecido" : error.getMessage()));
        }
    }

    private boolean hasSendControl(AccessibilityNodeInfo root) {
        return findSendControl(root) != null;
    }

    private AccessibilityNodeInfo findSendControl(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo byDesc = findByDescriptions(root, "Enviar", "Send");
        if (byDesc != null) return byDesc;
        String[] ids = {
                "com.whatsapp:id/send",
                "com.whatsapp.w4b:id/send",
                "com.whatsapp:id/send_button",
                "com.whatsapp.w4b:id/send_button"
        };
        for (String id : ids) {
            try {
                List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByViewId(id);
                if (nodes != null && !nodes.isEmpty()) return nodes.get(0);
            } catch (Exception ignored) { }
        }
        return null;
    }

    private AccessibilityNodeInfo findDestinationNode(AccessibilityNodeInfo root, String wanted) {
        String target = normalizeText(wanted);
        List<AccessibilityNodeInfo> all = new ArrayList<>();
        collect(root, all);
        AccessibilityNodeInfo partial = null;
        for (AccessibilityNodeInfo node : all) {
            String text = node.getText() == null ? "" : node.getText().toString();
            String desc = node.getContentDescription() == null ? "" : node.getContentDescription().toString();
            String normalizedText = normalizeText(text);
            String normalizedDesc = normalizeText(desc);
            if (target.equals(normalizedText) || target.equals(normalizedDesc)) return node;
            if (partial == null && ((!normalizedText.isEmpty() && normalizedText.contains(target)) ||
                    (!normalizedDesc.isEmpty() && normalizedDesc.contains(target)))) partial = node;
        }
        return partial;
    }

    private String normalizeText(String value) {
        String normalized = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return normalized.replaceAll("[^\\p{L}\\p{N}\\s#]+", " ")
                .replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
    }

    private AccessibilityNodeInfo findExactText(AccessibilityNodeInfo root, String wanted) {
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(wanted);
        if (nodes == null) return null;
        for (AccessibilityNodeInfo node : nodes) {
            CharSequence text = node.getText();
            if (text != null && wanted.equalsIgnoreCase(text.toString().trim())) return node;
        }
        return null;
    }

    private boolean screenContains(AccessibilityNodeInfo root, String wanted) {
        return findDestinationNode(root, wanted) != null;
    }

    private AccessibilityNodeInfo findByDescriptions(AccessibilityNodeInfo root, String... values) {
        List<AccessibilityNodeInfo> all = new ArrayList<>();
        collect(root, all);
        for (AccessibilityNodeInfo node : all) {
            String desc = node.getContentDescription() == null ? "" : node.getContentDescription().toString().trim();
            String text = node.getText() == null ? "" : node.getText().toString().trim();
            for (String value : values) {
                if (value.equalsIgnoreCase(desc) || value.equalsIgnoreCase(text)) return node;
            }
        }
        return null;
    }

    private void collect(AccessibilityNodeInfo node, List<AccessibilityNodeInfo> out) {
        if (node == null || out.size() > 1200) return;
        out.add(node);
        for (int i = 0; i < node.getChildCount(); i++) collect(node.getChild(i), out);
    }

    private boolean clickNodeOrParent(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo current = node;
        for (int i = 0; i < 10 && current != null; i++) {
            if (current.isClickable() && current.isEnabled()) {
                return current.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            }
            current = current.getParent();
        }
        return node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
    }

    private boolean clickDestinationByCoordinates(AccessibilityNodeInfo node, JSONObject job) {
        if (node == null) return false;
        Rect bounds = bestRowBounds(node);
        if (bounds.isEmpty()) return false;
        Path path = new Path();
        path.moveTo(bounds.exactCenterX(), bounds.exactCenterY());
        GestureDescription gesture = new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, 0, 160))
                .build();
        return dispatchGesture(gesture, new GestureResultCallback() {
            @Override public void onCompleted(GestureDescription gestureDescription) {
                updateStage(job, "confirm_destination");
                lastActionAt = System.currentTimeMillis();
                handler.postDelayed(WhatsAppAutomationService.this::processCurrentScreen, 1200L);
            }
            @Override public void onCancelled(GestureDescription gestureDescription) {
                handler.postDelayed(WhatsAppAutomationService.this::processCurrentScreen, 800L);
            }
        }, null);
    }

    private Rect bestRowBounds(AccessibilityNodeInfo node) {
        Rect best = new Rect();
        AccessibilityNodeInfo current = node;
        for (int i = 0; i < 8 && current != null; i++) {
            Rect candidate = new Rect();
            current.getBoundsInScreen(candidate);
            if (!candidate.isEmpty() && candidate.height() >= 45 && candidate.height() <= 260 && candidate.width() > best.width()) {
                best.set(candidate);
            }
            current = current.getParent();
        }
        if (best.isEmpty()) node.getBoundsInScreen(best);
        return best;
    }

    private boolean clickNodeByCoordinates(AccessibilityNodeInfo node) {
        if (node == null) return false;
        Rect bounds = bestRowBounds(node);
        if (bounds.isEmpty()) return false;
        Path path = new Path();
        path.moveTo(bounds.exactCenterX(), bounds.exactCenterY());
        GestureDescription gesture = new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, 0, 140))
                .build();
        return dispatchGesture(gesture, null, null);
    }

    private boolean screenContainsAny(AccessibilityNodeInfo root, String... values) {
        List<AccessibilityNodeInfo> all = new ArrayList<>();
        collect(root, all);
        for (AccessibilityNodeInfo node : all) {
            String text = node.getText() == null ? "" : normalizeText(node.getText().toString());
            String desc = node.getContentDescription() == null ? "" : normalizeText(node.getContentDescription().toString());
            for (String value : values) {
                String target = normalizeText(value);
                if ((!text.isEmpty() && text.contains(target)) ||
                        (!desc.isEmpty() && desc.contains(target))) return true;
            }
        }
        return false;
    }

    private boolean tapBottomRightAction(JSONObject job, String nextStage) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;

        Rect screen = new Rect();
        root.getBoundsInScreen(screen);
        if (screen.isEmpty()) return false;

        // Centro aproximado do botão circular mostrado pelo WhatsApp.
        float x = screen.right - Math.max(70f, screen.width() * 0.085f);
        float y = screen.bottom - Math.max(95f, screen.height() * 0.085f);

        Path path = new Path();
        path.moveTo(x, y);
        GestureDescription gesture = new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, 0, 170))
                .build();

        return dispatchGesture(gesture, new GestureResultCallback() {
            @Override public void onCompleted(GestureDescription gestureDescription) {
                updateStage(job, nextStage);
                lastActionAt = System.currentTimeMillis();
                handler.postDelayed(WhatsAppAutomationService.this::processCurrentScreen, 1200L);
            }

            @Override public void onCancelled(GestureDescription gestureDescription) {
                handler.postDelayed(WhatsAppAutomationService.this::processCurrentScreen, 800L);
            }
        }, null);
    }

    private void updateStage(JSONObject job, String stage) {
        try {
            job.put("stage", stage);
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_JOB, job.toString()).apply();
        } catch (Exception ignored) { }
    }

    private void finishJob(String status, String message) {
        try {
            JSONObject result = new JSONObject();
            result.put("id", activeJobId);
            result.put("status", status);
            result.put("message", message);
            result.put("at", System.currentTimeMillis());
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                    .remove(KEY_JOB)
                    .putString(KEY_LAST_RESULT, result.toString())
                    .apply();
        } catch (Exception ignored) { }
    }

    private void failJob(String message) {
        finishJob("failed", message);
    }

    static boolean isEnabled(Context context) {
        String enabled = android.provider.Settings.Secure.getString(
                context.getContentResolver(),
                android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        );
        if (enabled == null) return false;
        String component = context.getPackageName() + "/" + WhatsAppAutomationService.class.getName();
        return enabled.toLowerCase().contains(component.toLowerCase());
    }
}
