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

        String expectedPackage = prefs.getString("wa_package", MainActivity.PKG_BUSINESS);
        CharSequence eventPackage = event.getPackageName();
        if (eventPackage == null || !expectedPackage.contentEquals(eventPackage)) return;

        if (handleCalibration(event, prefs)) return;
        if (!prefs.getBoolean("enabled", false)) return;

        long lockUntil = prefs.getLong("post_send_lock_until", 0L);
        if (lockUntil > System.currentTimeMillis()) return;

        if (processing || System.currentTimeMillis() - lastActionAt < 220L) return;

        processing = true;
        handler.postDelayed(() -> {
            try {
                processCurrentScreen();
            } finally {
                processing = false;
            }
        }, 100L);
    }

    @Override
    public void onInterrupt() {
        processing = false;
        handler.removeCallbacksAndMessages(null);
    }

    private boolean handleCalibration(
            AccessibilityEvent event,
            SharedPreferences prefs
    ) {
        String mode = prefs.getString("calibration_mode", "");
        if (mode.isEmpty()) return false;
        if (event.getEventType() != AccessibilityEvent.TYPE_VIEW_CLICKED) return true;

        AccessibilityNodeInfo source = event.getSource();
        if (source == null) return true;

        if ("send".equals(mode) && !isSendLike(source)) {
            // Na calibração do botão Enviar, o clique no grupo é ignorado.
            return true;
        }

        Rect rect = new Rect();
        source.getBoundsInScreen(rect);
        if (rect.isEmpty()) return true;

        int x = rect.centerX();
        int y = rect.centerY();

        SharedPreferences.Editor editor = prefs.edit();
        if ("group".equals(mode)) {
            editor.putInt("group_x", x).putInt("group_y", y);
        } else {
            editor.putInt("send_x", x).putInt("send_y", y);
        }

        try {
            JSONObject result = new JSONObject();
            result.put("status", "captured");
            result.put("type", mode);
            result.put("x", x);
            result.put("y", y);
            result.put("message",
                    "group".equals(mode)
                            ? "Clique do destino calibrado."
                            : "Clique do botão Enviar calibrado.");
            editor.putString("calibration_result", result.toString());
        } catch (Exception ignored) {}

        editor.remove("calibration_mode").commit();
        handler.postDelayed(this::returnToCbOfertas, 500L);
        return true;
    }

    private void processCurrentScreen() {
        SharedPreferences prefs = getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE);
        if (!prefs.getBoolean("enabled", false)) return;

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            scheduleRetry(450L);
            return;
        }

        String stage = prefs.getString("stage", "");
        int maxAttempts = prefs.getInt("max_attempts", 3);

        try {
            if ("WAIT_DESTINATION".equals(stage)) {
                long startedAt = prefs.getLong("job_started_at", System.currentTimeMillis());
                long requiredDelay = prefs.getInt("open_delay", 1500);
                long elapsed = System.currentTimeMillis() - startedAt;

                if (elapsed < requiredDelay) {
                    scheduleRetry(requiredDelay - elapsed);
                    return;
                }

                if (prefs.getBoolean("group_clicked", false)) return;

                boolean clicked = clickDestination(root, prefs);
                if (!clicked) {
                    int attempt = prefs.getInt("attempt", 0) + 1;
                    prefs.edit().putInt("attempt", attempt).apply();

                    if (attempt >= maxAttempts) {
                        fail("Não foi possível localizar ou clicar no destino.");
                    } else {
                        scheduleRetry(650L);
                    }
                    return;
                }

                long now = System.currentTimeMillis();
                prefs.edit()
                        .putBoolean("group_clicked", true)
                        .putString("stage", "WAIT_SEND")
                        .putLong("group_clicked_at", now)
                        .putLong("stage_started_at", now)
                        .commit();

                lastActionAt = now;
                scheduleRetry(prefs.getInt("group_delay", 1000));
                return;
            }

            if ("WAIT_SEND".equals(stage)) {
                if (prefs.getBoolean("send_clicked", false)) return;

                long clickedAt = prefs.getLong("group_clicked_at", System.currentTimeMillis());
                long requiredDelay = prefs.getInt("group_delay", 1000);
                long elapsed = System.currentTimeMillis() - clickedAt;

                if (elapsed < requiredDelay) {
                    scheduleRetry(requiredDelay - elapsed);
                    return;
                }

                boolean available = canClickSend(root, prefs);
                if (!available) {
                    int attempt = prefs.getInt("send_attempt", 0) + 1;
                    prefs.edit().putInt("send_attempt", attempt).apply();

                    if (attempt >= maxAttempts) {
                        fail("Não foi possível localizar o botão Enviar.");
                    } else {
                        scheduleRetry(500L);
                    }
                    return;
                }

                // Trava o trabalho antes do segundo clique.
                long lockUntil = System.currentTimeMillis() + 8000L;
                prefs.edit()
                        .putBoolean("send_clicked", true)
                        .putString("stage", "RETURNING")
                        .putLong("post_send_lock_until", lockUntil)
                        .commit();

                boolean clicked = clickSend(root, prefs);
                if (!clicked) {
                    prefs.edit()
                            .putBoolean("send_clicked", false)
                            .remove("post_send_lock_until")
                            .putString("stage", "WAIT_SEND")
                            .apply();
                    fail("O segundo clique não pôde ser executado.");
                    return;
                }

                lastActionAt = System.currentTimeMillis();
                handler.removeCallbacksAndMessages(null);
                handler.postDelayed(
                        this::finishAndReturn,
                        prefs.getInt("return_delay", 1300)
                );
            }
        } catch (Exception error) {
            fail("Erro da automação: " + error.getMessage());
        }
    }

    private boolean clickDestination(
            AccessibilityNodeInfo root,
            SharedPreferences prefs
    ) {
        int strategy = prefs.getInt("click_strategy", 2);
        int offsetX = prefs.getInt("group_offset_x", 0);
        int offsetY = prefs.getInt("group_offset_y", 0);
        int x = prefs.getInt("group_x", 0);
        int y = prefs.getInt("group_y", 0);
        boolean hasCoordinates = x > 0 && y > 0;

        if (strategy == 1 && hasCoordinates) {
            return tapPoint(
                    x + offsetX,
                    y + offsetY,
                    prefs.getInt("tap_duration", 180)
            );
        }

        AccessibilityNodeInfo destination =
                findBestDestinationNode(root, prefs.getString("group_name", ""));

        if (destination != null &&
                clickDestinationNode(destination, prefs)) {
            return true;
        }

        return strategy == 2 &&
                hasCoordinates &&
                tapPoint(
                        x + offsetX,
                        y + offsetY,
                        prefs.getInt("tap_duration", 180)
                );
    }

    private boolean canClickSend(
            AccessibilityNodeInfo root,
            SharedPreferences prefs
    ) {
        int strategy = prefs.getInt("click_strategy", 2);
        int x = prefs.getInt("send_x", 0);
        int y = prefs.getInt("send_y", 0);

        if (strategy == 1) return x > 0 && y > 0;
        if (findSendNode(root) != null) return true;
        return strategy == 2 && x > 0 && y > 0;
    }

    private boolean clickSend(
            AccessibilityNodeInfo root,
            SharedPreferences prefs
    ) {
        int strategy = prefs.getInt("click_strategy", 2);
        int offsetX = prefs.getInt("send_offset_x", 0);
        int offsetY = prefs.getInt("send_offset_y", 0);
        int x = prefs.getInt("send_x", 0);
        int y = prefs.getInt("send_y", 0);
        boolean hasCoordinates = x > 0 && y > 0;

        if (strategy == 1 && hasCoordinates) {
            return tapPoint(
                    x + offsetX,
                    y + offsetY,
                    prefs.getInt("tap_duration", 180)
            );
        }

        AccessibilityNodeInfo node = findSendNode(root);
        if (node != null &&
                clickNodeOrParentWithOffset(
                        node,
                        offsetX,
                        offsetY,
                        prefs.getInt("tap_duration", 180)
                )) {
            return true;
        }

        return strategy == 2 &&
                hasCoordinates &&
                tapPoint(
                        x + offsetX,
                        y + offsetY,
                        prefs.getInt("tap_duration", 180)
                );
    }


    private AccessibilityNodeInfo findBestDestinationNode(
            AccessibilityNodeInfo root,
            String text
    ) {
        AccessibilityNodeInfo exact = findExactText(root, text);
        if (exact != null) return exact;

        if (text == null || text.trim().isEmpty()) return null;
        List<AccessibilityNodeInfo> nodes =
                root.findAccessibilityNodeInfosByText(text.trim());

        if (nodes == null || nodes.isEmpty()) return null;

        AccessibilityNodeInfo best = null;
        int bestArea = 0;

        for (AccessibilityNodeInfo node : nodes) {
            AccessibilityNodeInfo row = findWidestRow(node);
            Rect rect = new Rect();
            row.getBoundsInScreen(rect);
            int area = Math.max(0, rect.width()) * Math.max(0, rect.height());

            if (area > bestArea) {
                best = node;
                bestArea = area;
            }
        }
        return best == null ? nodes.get(0) : best;
    }

    private AccessibilityNodeInfo findWidestRow(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo current = node;
        AccessibilityNodeInfo best = node;
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int bestWidth = 0;

        for (int i = 0; current != null && i < 8; i++) {
            Rect rect = new Rect();
            current.getBoundsInScreen(rect);

            if (rect.width() > bestWidth &&
                    rect.height() >= 38 &&
                    rect.height() <= 360 &&
                    rect.width() <= screenWidth) {
                best = current;
                bestWidth = rect.width();
            }

            current = current.getParent();
        }
        return best;
    }

    private boolean clickDestinationNode(
            AccessibilityNodeInfo node,
            SharedPreferences prefs
    ) {
        AccessibilityNodeInfo row = findWidestRow(node);
        AccessibilityNodeInfo current = row;

        for (int i = 0; current != null && i < 7; i++) {
            if (current.isClickable() &&
                    current.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                return true;
            }
            current = current.getParent();
        }

        Rect rect = new Rect();
        row.getBoundsInScreen(rect);
        if (rect.isEmpty()) {
            node.getBoundsInScreen(rect);
        }

        return !rect.isEmpty() &&
                tapPoint(
                        rect.centerX() + prefs.getInt("group_offset_x", 0),
                        rect.centerY() + prefs.getInt("group_offset_y", 0),
                        prefs.getInt("tap_duration", 180)
                );
    }

    private AccessibilityNodeInfo findExactText(
            AccessibilityNodeInfo root,
            String text
    ) {
        if (text == null || text.trim().isEmpty()) return null;

        List<AccessibilityNodeInfo> nodes =
                root.findAccessibilityNodeInfosByText(text.trim());
        if (nodes == null) return null;

        for (AccessibilityNodeInfo node : nodes) {
            CharSequence nodeText = node.getText();
            CharSequence description = node.getContentDescription();

            if ((nodeText != null &&
                    text.trim().equalsIgnoreCase(nodeText.toString().trim())) ||
                (description != null &&
                    text.trim().equalsIgnoreCase(description.toString().trim()))) {
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
            List<AccessibilityNodeInfo> nodes =
                    root.findAccessibilityNodeInfosByViewId(id);
            if (nodes != null && !nodes.isEmpty()) return nodes.get(0);
        }

        List<AccessibilityNodeInfo> all = new ArrayList<>();
        collectNodes(root, all);

        AccessibilityNodeInfo best = null;
        int bestScore = Integer.MIN_VALUE;

        for (AccessibilityNodeInfo node : all) {
            if (!isSendLike(node)) continue;

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

    private boolean isSendLike(AccessibilityNodeInfo node) {
        if (node == null) return false;

        String viewId = node.getViewIdResourceName();
        String text = node.getText() == null
                ? ""
                : node.getText().toString().toLowerCase();
        String description = node.getContentDescription() == null
                ? ""
                : node.getContentDescription().toString().toLowerCase();

        if (viewId != null &&
                (viewId.endsWith(":id/send") ||
                 viewId.endsWith(":id/send_button"))) {
            return true;
        }

        boolean label = text.equals("enviar") ||
                text.equals("send") ||
                description.contains("enviar") ||
                description.contains("send");

        if (!label) return false;

        Rect rect = new Rect();
        node.getBoundsInScreen(rect);
        return rect.centerX() >
                getResources().getDisplayMetrics().widthPixels / 2;
    }

    private void collectNodes(
            AccessibilityNodeInfo node,
            List<AccessibilityNodeInfo> output
    ) {
        if (node == null) return;
        output.add(node);

        for (int i = 0; i < node.getChildCount(); i++) {
            collectNodes(node.getChild(i), output);
        }
    }

    private boolean clickNodeOrParent(AccessibilityNodeInfo node) {
        return clickNodeOrParentWithOffset(node, 0, 0, 180);
    }

    private boolean clickNodeOrParentWithOffset(
            AccessibilityNodeInfo node,
            int offsetX,
            int offsetY,
            int duration
    ) {
        AccessibilityNodeInfo current = node;

        for (int i = 0; current != null && i < 7; i++) {
            if (current.isClickable() &&
                    current.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                return true;
            }
            current = current.getParent();
        }

        Rect rect = new Rect();
        node.getBoundsInScreen(rect);

        return !rect.isEmpty() &&
                tapPoint(
                        rect.centerX() + offsetX,
                        rect.centerY() + offsetY,
                        duration
                );
    }

    private boolean tapPoint(int x, int y) {
        return tapPoint(x, y, 180);
    }

    private boolean tapPoint(int x, int y, int duration) {
        if (x <= 0 || y <= 0) return false;

        Path path = new Path();
        path.moveTo(x, y);

        GestureDescription gesture = new GestureDescription.Builder()
                .addStroke(
                        new GestureDescription.StrokeDescription(
                                path,
                                0,
                                Math.max(60, Math.min(800, duration))
                        )
                )
                .build();

        return dispatchGesture(gesture, null, null);
    }

    private void scheduleRetry(long delay) {
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(
                this::processCurrentScreen,
                Math.max(120L, Math.min(delay, 5000L))
        );
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
                    .remove("attempt")
                    .remove("send_attempt")
                    .apply();

            returnToCbOfertas();
        } catch (Exception error) {
            fail("Mensagem enviada, mas houve falha ao voltar ao CbOfertas.");
        }
    }

    private void returnToCbOfertas() {
        Intent launch =
                getPackageManager().getLaunchIntentForPackage(getPackageName());

        if (launch != null) {
            launch.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK |
                    Intent.FLAG_ACTIVITY_CLEAR_TOP |
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            startActivity(launch);
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
        returnToCbOfertas();
    }
}
