package com.cbofertas.app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

public class WhatsAppAutomationService extends AccessibilityService {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private long lastActionAt = 0L;
    private boolean processing = false;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        SharedPreferences prefs = getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE);
        if (!prefs.getBoolean("enabled", false)) return;

        String expectedPackage = prefs.getString("wa_package", MainActivity.PKG_BUSINESS);
        CharSequence eventPackage = event.getPackageName();
        if (eventPackage == null || !expectedPackage.contentEquals(eventPackage)) return;

        long lockUntil = prefs.getLong("post_send_lock_until", 0L);
        if (lockUntil > System.currentTimeMillis()) return;

        if (processing || System.currentTimeMillis() - lastActionAt < 250L) return;
        processing = true;
        handler.postDelayed(() -> {
            try {
                processCurrentScreen();
            } finally {
                processing = false;
            }
        }, 120L);
    }

    @Override
    public void onInterrupt() {
        processing = false;
        handler.removeCallbacksAndMessages(null);
    }

    private void processCurrentScreen() {
        SharedPreferences prefs = getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE);
        if (!prefs.getBoolean("enabled", false)) return;

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;

        String stage = prefs.getString("stage", "");
        String group = prefs.getString("group_name", "");
        int attempt = prefs.getInt("attempt", 0);
        int maxAttempts = prefs.getInt("max_attempts", 2);

        try {
            if ("WAIT_DESTINATION".equals(stage)) {
                if (prefs.getBoolean("group_clicked", false)) {
                    if (screenContainsAny(root, "1 selecionado", "1 selected", "Selecionado")) {
                        prefs.edit().putString("stage", "WAIT_SEND").commit();
                        handler.postDelayed(this::processCurrentScreen,
                                prefs.getInt("group_delay", 800));
                    }
                    return;
                }

                AccessibilityNodeInfo destination = findExactText(root, group);
                if (destination == null) {
                    if (attempt + 1 >= maxAttempts) {
                        fail("Grupo não encontrado: " + group);
                    } else {
                        prefs.edit().putInt("attempt", attempt + 1).apply();
                    }
                    return;
                }

                prefs.edit().putBoolean("group_clicked", true).commit();
                if (!clickNodeOrParent(destination)) {
                    prefs.edit().putBoolean("group_clicked", false).apply();
                    fail("Não foi possível tocar no grupo.");
                    return;
                }

                lastActionAt = System.currentTimeMillis();
                handler.postDelayed(this::processCurrentScreen,
                        prefs.getInt("group_delay", 800));
                return;
            }

            if ("WAIT_SEND".equals(stage)) {
                if (prefs.getBoolean("send_clicked", false)) return;

                AccessibilityNodeInfo send = findSendNode(root);
                if (send == null) return;

                // O segundo e último clique é bloqueado antes de acontecer.
                long lockUntil = System.currentTimeMillis() + 7000L;
                prefs.edit()
                        .putBoolean("send_clicked", true)
                        .putString("stage", "RETURNING")
                        .putLong("post_send_lock_until", lockUntil)
                        .commit();

                boolean clicked = clickNodeOrParent(send);
                if (!clicked) {
                    prefs.edit()
                            .putBoolean("send_clicked", false)
                            .remove("post_send_lock_until")
                            .putString("stage", "WAIT_SEND")
                            .apply();
                    fail("Botão Enviar não encontrado ou não clicável.");
                    return;
                }

                lastActionAt = System.currentTimeMillis();
                handler.removeCallbacksAndMessages(null);
                handler.postDelayed(this::finishAndReturn,
                        prefs.getInt("return_delay", 1200));
            }
        } catch (Exception error) {
            fail("Erro da automação: " + error.getMessage());
        }
    }

    private AccessibilityNodeInfo findExactText(AccessibilityNodeInfo root, String text) {
        if (text == null || text.trim().isEmpty()) return null;
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(text.trim());
        if (nodes == null) return null;
        for (AccessibilityNodeInfo node : nodes) {
            CharSequence nodeText = node.getText();
            CharSequence description = node.getContentDescription();
            if ((nodeText != null && text.trim().equalsIgnoreCase(nodeText.toString().trim())) ||
                (description != null && text.trim().equalsIgnoreCase(description.toString().trim()))) {
                return node;
            }
        }
        return nodes.isEmpty() ? null : nodes.get(0);
    }

    private AccessibilityNodeInfo findSendNode(AccessibilityNodeInfo root) {
        String[] ids = {
                "com.whatsapp.w4b:id/send",
                "com.whatsapp:id/send",
                "com.whatsapp.w4b:id/send_button",
                "com.whatsapp:id/send_button"
        };
        for (String id : ids) {
            List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByViewId(id);
            if (nodes != null && !nodes.isEmpty()) return nodes.get(0);
        }

        String[] labels = {"Enviar", "Send", "Enviar mensagem", "Send message"};
        for (String label : labels) {
            List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(label);
            if (nodes != null) {
                for (AccessibilityNodeInfo node : nodes) {
                    if (isBottomRight(node)) return node;
                }
            }
        }

        List<AccessibilityNodeInfo> all = new ArrayList<>();
        collectNodes(root, all);
        AccessibilityNodeInfo best = null;
        int bestScore = Integer.MIN_VALUE;
        for (AccessibilityNodeInfo node : all) {
            CharSequence desc = node.getContentDescription();
            String value = desc == null ? "" : desc.toString().toLowerCase();
            if (!value.contains("enviar") && !value.contains("send")) continue;
            Rect rect = new Rect();
            node.getBoundsInScreen(rect);
            int score = rect.centerX() + rect.centerY();
            if (score > bestScore) {
                best = node;
                bestScore = score;
            }
        }
        return best;
    }

    private boolean isBottomRight(AccessibilityNodeInfo node) {
        Rect rect = new Rect();
        node.getBoundsInScreen(rect);
        return rect.centerX() > getResources().getDisplayMetrics().widthPixels / 2;
    }

    private void collectNodes(AccessibilityNodeInfo node, List<AccessibilityNodeInfo> output) {
        if (node == null) return;
        output.add(node);
        for (int i = 0; i < node.getChildCount(); i++) {
            collectNodes(node.getChild(i), output);
        }
    }

    private boolean clickNodeOrParent(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo current = node;
        for (int i = 0; current != null && i < 6; i++) {
            if (current.isClickable() &&
                    current.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                return true;
            }
            current = current.getParent();
        }
        return tapCenter(node);
    }

    private boolean tapCenter(AccessibilityNodeInfo node) {
        Rect rect = new Rect();
        node.getBoundsInScreen(rect);
        if (rect.isEmpty()) return false;
        Path path = new Path();
        path.moveTo(rect.centerX(), rect.centerY());
        GestureDescription gesture = new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, 0, 80))
                .build();
        return dispatchGesture(gesture, null, null);
    }

    private boolean screenContainsAny(AccessibilityNodeInfo root, String... values) {
        for (String value : values) {
            List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(value);
            if (nodes != null && !nodes.isEmpty()) return true;
        }
        return false;
    }

    private void finishAndReturn() {
        SharedPreferences prefs = getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE);
        String jobId = prefs.getString("job_id", "");
        try {
            JSONObject result = new JSONObject();
            result.put("status", "sent");
            result.put("jobId", jobId);
            result.put("message", "Mensagem enviada automaticamente.");
            result.put("at", System.currentTimeMillis());

            prefs.edit()
                    .putBoolean("enabled", false)
                    .putString("last_result", result.toString())
                    .remove("stage")
                    .remove("job_text")
                    .remove("group_clicked")
                    .remove("send_clicked")
                    .apply();

            Intent launch = getPackageManager()
                    .getLaunchIntentForPackage(getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                        Intent.FLAG_ACTIVITY_CLEAR_TOP |
                        Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(launch);
            }
        } catch (Exception error) {
            fail("Mensagem enviada, mas houve falha ao voltar ao CbOfertas.");
        }
    }

    private void fail(String message) {
        SharedPreferences prefs = getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE);
        String jobId = prefs.getString("job_id", "");
        try {
            JSONObject result = new JSONObject();
            result.put("status", "failed");
            result.put("jobId", jobId);
            result.put("message", message);
            result.put("at", System.currentTimeMillis());
            prefs.edit()
                    .putBoolean("enabled", false)
                    .putString("last_result", result.toString())
                    .remove("stage")
                    .remove("group_clicked")
                    .remove("send_clicked")
                    .remove("post_send_lock_until")
                    .apply();
        } catch (Exception ignored) {}
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }
}
