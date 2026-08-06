package com.cbofertas.app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.graphics.Rect;
import android.graphics.Path;
import android.accessibilityservice.GestureDescription;
import android.content.Context;
import android.content.Intent;
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
    static final String KEY_CALIBRATION_MODE = "calibration_mode";
    static final String KEY_GROUP_X = "cal_group_x";
    static final String KEY_GROUP_Y = "cal_group_y";
    static final String KEY_SEND_X = "cal_send_x";
    static final String KEY_SEND_Y = "cal_send_y";
    static final String KEY_POST_SEND_LOCK_UNTIL = "post_send_lock_until";

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
                | AccessibilityEvent.TYPE_VIEW_CLICKED
                | AccessibilityEvent.TYPE_VIEW_SELECTED;
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

        long postSendLock = prefs.getLong(KEY_POST_SEND_LOCK_UNTIL, 0L);
        if (postSendLock > System.currentTimeMillis()) return;
        if (postSendLock > 0L) prefs.edit().remove(KEY_POST_SEND_LOCK_UNTIL).apply();

        String calibrationMode = prefs.getString(KEY_CALIBRATION_MODE, "");
        if (calibrationMode != null && !calibrationMode.trim().isEmpty()) {
            String safeMode = calibrationMode.trim();

            if (event.getEventType() == AccessibilityEvent.TYPE_VIEW_CLICKED
                    || event.getEventType() == AccessibilityEvent.TYPE_VIEW_SELECTED) {
                if (captureCalibration(event, safeMode)) return;
            }

            // Algumas versões do WhatsApp não entregam o clique da linha.
            // Nesse caso, assim que aparecer "1 selecionado", localiza o item
            // marcado/checkado na árvore e salva suas coordenadas.
            if ("group".equals(safeMode)
                    && (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
                    || event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)) {
                AccessibilityNodeInfo root = getRootInActiveWindow();
                String configuredGroup = prefs.getString(KEY_GROUP, "");
                if (root != null
                        && screenContainsAny(root, "1 selecionado", "1 selected")
                        && captureSelectedDestination(root, configuredGroup)) {
                    return;
                }
            }
        }

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
                // Depois do primeiro toque, apenas aguarda a confirmação visual.
                // Nunca repete o clique no grupo durante o mesmo trabalho.
                if (screenContainsAny(root, "1 selecionado", "1 selected")) {
                    updateStage(job, "confirm_destination");
                    handler.postDelayed(this::processCurrentScreen, 300L);
                    return;
                }

                boolean tapIssued = job.optBoolean("groupTapIssued", false);
                if (tapIssued) {
                    int checks = job.optInt("groupSelectionChecks", 0) + 1;
                    job.put("groupSelectionChecks", checks);
                    saveJob(job);

                    if (checks < 12) {
                        handler.postDelayed(this::processCurrentScreen, 450L);
                    } else {
                        failJob("O primeiro clique foi executado, mas o WhatsApp não confirmou o grupo.");
                    }
                    return;
                }

                // Marca ANTES do gesto para impedir repetição por eventos simultâneos.
                job.put("groupTapIssued", true);
                job.put("groupSelectionChecks", 0);
                saveJobCommit(job);

                boolean clicked = false;

                if (hasCalibration(KEY_GROUP_X, KEY_GROUP_Y)
                        && screenContainsAny(root, "Enviar para", "Send to")) {
                    clicked = tapCalibrated(KEY_GROUP_X, KEY_GROUP_Y, 160);
                }

                if (!clicked) {
                    AccessibilityNodeInfo groupNode = findDestinationNode(root, group);
                    if (groupNode != null) {
                        clicked = clickNodeOrParent(groupNode);
                        if (!clicked) clicked = clickNodeByCoordinates(groupNode);
                    }
                }

                if (clicked) {
                    lastActionAt = System.currentTimeMillis();
                    handler.postDelayed(this::processCurrentScreen, 650L);
                } else {
                    job.put("groupTapIssued", false);
                    saveJobCommit(job);
                    failJob("Não foi possível executar o primeiro clique no grupo.");
                }
                return;
            }

            if ("confirm_destination".equals(stage)) {
                if (!screenContainsAny(root, "1 selecionado", "1 selected")) {
                    updateStage(job, "pick_group");
                    handler.postDelayed(this::processCurrentScreen, 450L);
                    return;
                }

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
                if (!screenContains(root, group)) return;

                if (testMode) {
                    finishJob("test_ready", "Modo teste: mensagem pronta, sem tocar em Enviar.");
                    Toast.makeText(this, "Modo teste: confira a mensagem e envie manualmente.", Toast.LENGTH_LONG).show();
                    return;
                }

                // SEGUNDO E ÚLTIMO CLIQUE. O trabalho é encerrado antes do gesto.
                handler.removeCallbacksAndMessages(null);
                long lockUntil = System.currentTimeMillis() + 6500L;

                JSONObject result = new JSONObject();
                result.put("id", activeJobId);
                result.put("status", "send_triggered");
                result.put("message", "Envio acionado com dois cliques.");
                result.put("at", System.currentTimeMillis());

                getSharedPreferences(PREFS, MODE_PRIVATE)
                        .edit()
                        .remove(KEY_JOB)
                        .putLong(KEY_POST_SEND_LOCK_UNTIL, lockUntil)
                        .putString(KEY_LAST_RESULT, result.toString())
                        .commit();

                boolean clicked = false;
                if (hasCalibration(KEY_SEND_X, KEY_SEND_Y)) {
                    clicked = tapCalibrated(KEY_SEND_X, KEY_SEND_Y, 160);
                }
                if (!clicked) {
                    AccessibilityNodeInfo send = findSendControl(root);
                    if (send != null) {
                        clicked = clickNodeOrParent(send);
                        if (!clicked) clicked = clickNodeByCoordinates(send);
                    }
                }
                if (!clicked) clicked = tapBottomRightOnce();

                if (clicked) {
                    lastActionAt = System.currentTimeMillis();
                    Toast.makeText(this, "Oferta enviada. Voltando ao CbOfertas.", Toast.LENGTH_SHORT).show();
                    handler.postDelayed(this::returnToCbOfertas, 1100L);
                } else {
                    getSharedPreferences(PREFS, MODE_PRIVATE)
                            .edit()
                            .remove(KEY_POST_SEND_LOCK_UNTIL)
                            .apply();
                    failJob("Não foi possível executar o clique final.");
                }
                return;
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
                // Permanece em pick_group até o WhatsApp mostrar "1 selecionado".
                lastActionAt = System.currentTimeMillis();
                handler.postDelayed(WhatsAppAutomationService.this::processCurrentScreen, 900L);
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

    private boolean captureSelectedDestination(AccessibilityNodeInfo root, String configuredGroup) {
        List<AccessibilityNodeInfo> all = new ArrayList<>();
        collect(root, all);

        AccessibilityNodeInfo selected = null;
        String target = normalizeText(configuredGroup);

        // Primeira opção: usa o nome do grupo configurado.
        // O WhatsApp costuma repetir esse nome na parte inferior da tela
        // depois que o destino fica selecionado.
        if (!target.isEmpty()) {
            AccessibilityNodeInfo bestMatch = null;
            int bestScore = -1;

            for (AccessibilityNodeInfo node : all) {
                if (node == null) continue;

                String nodeText = node.getText() == null
                        ? ""
                        : normalizeText(node.getText().toString());
                String nodeDesc = node.getContentDescription() == null
                        ? ""
                        : normalizeText(node.getContentDescription().toString());

                boolean matches = nodeText.equals(target)
                        || nodeDesc.equals(target)
                        || (!nodeText.isEmpty() && nodeText.contains(target))
                        || (!nodeDesc.isEmpty() && nodeDesc.contains(target));

                if (!matches) continue;

                Rect bounds = bestRowBounds(node);
                if (bounds.isEmpty()) continue;

                int score = 0;
                if (node.isChecked() || node.isSelected()) score += 100;
                if (bounds.height() >= 45 && bounds.height() <= 250) score += 40;
                if (bounds.width() > 250) score += 20;

                // Prefere a linha da lista, não o texto repetido na prévia inferior.
                Rect screen = new Rect();
                root.getBoundsInScreen(screen);
                if (!screen.isEmpty() && bounds.exactCenterY() < screen.height() * 0.72f) {
                    score += 60;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = node;
                }
            }

            selected = bestMatch;
        }

        // Segunda opção: procura nós marcados/checkados.
        if (selected == null) {
            for (AccessibilityNodeInfo node : all) {
                if (node == null) continue;

                boolean marked = node.isChecked() || node.isSelected();
                String desc = node.getContentDescription() == null
                        ? ""
                        : normalizeText(node.getContentDescription().toString());

                if (!marked && !(desc.contains("selecionado") || desc.contains("selected"))) {
                    continue;
                }

                Rect bounds = bestRowBounds(node);
                if (bounds.isEmpty() || bounds.height() < 40) continue;

                selected = node;
                break;
            }
        }

        if (selected == null) return false;

        Rect rowBounds = bestRowBounds(selected);
        Rect screenBounds = new Rect();
        root.getBoundsInScreen(screenBounds);

        if (rowBounds.isEmpty() || screenBounds.isEmpty()) return false;

        float x = (rowBounds.exactCenterX() - screenBounds.left)
                / Math.max(1f, screenBounds.width());
        float y = (rowBounds.exactCenterY() - screenBounds.top)
                / Math.max(1f, screenBounds.height());

        x = Math.max(0.02f, Math.min(0.98f, x));
        y = Math.max(0.02f, Math.min(0.98f, y));

        boolean saved = getSharedPreferences(PREFS, MODE_PRIVATE)
                .edit()
                .putFloat(KEY_GROUP_X, x)
                .putFloat(KEY_GROUP_Y, y)
                .remove(KEY_CALIBRATION_MODE)
                .commit();

        if (!saved) return false;

        Toast.makeText(
                this,
                "Posição do grupo salva neste aparelho.",
                Toast.LENGTH_LONG
        ).show();

        // Dá tempo para o SharedPreferences terminar e só então reabre o app.
        handler.postDelayed(this::returnToCbOfertas, 900L);
        return true;
    }

    private boolean captureCalibration(AccessibilityEvent event, String mode) {
        AccessibilityNodeInfo source = event.getSource();
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (source == null || root == null) return false;

        Rect sourceBounds = bestRowBounds(source);
        Rect screenBounds = new Rect();
        root.getBoundsInScreen(screenBounds);
        if (sourceBounds.isEmpty() || screenBounds.isEmpty()) return false;

        float x = (sourceBounds.exactCenterX() - screenBounds.left) / Math.max(1f, screenBounds.width());
        float y = (sourceBounds.exactCenterY() - screenBounds.top) / Math.max(1f, screenBounds.height());
        x = Math.max(0.02f, Math.min(0.98f, x));
        y = Math.max(0.02f, Math.min(0.98f, y));

        // Ao calibrar a seta, ignora o primeiro toque feito no contato/grupo.
        // Somente um toque no quadrante inferior direito é aceito.
        if ("send".equals(mode) && (x < 0.62f || y < 0.62f)) {
            return false;
        }

        SharedPreferences.Editor editor = getSharedPreferences(PREFS, MODE_PRIVATE).edit();
        if ("group".equals(mode)) {
            editor.putFloat(KEY_GROUP_X, x).putFloat(KEY_GROUP_Y, y);
        } else if ("send".equals(mode)) {
            editor.putFloat(KEY_SEND_X, x).putFloat(KEY_SEND_Y, y);
        } else {
            return false;
        }
        editor.remove(KEY_CALIBRATION_MODE).apply();

        String label = "group".equals(mode) ? "grupo" : "seta de envio";
        Toast.makeText(this, "Posição do " + label + " salva neste aparelho.", Toast.LENGTH_LONG).show();
        handler.postDelayed(this::returnToCbOfertas, 650L);
        return true;
    }

    private boolean hasCalibration(String xKey, String yKey) {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        return prefs.contains(xKey) && prefs.contains(yKey);
    }

    private boolean tapCalibrated(String xKey, String yKey, long duration) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;

        Rect screen = new Rect();
        root.getBoundsInScreen(screen);
        if (screen.isEmpty()) return false;

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        float rx = prefs.getFloat(xKey, -1f);
        float ry = prefs.getFloat(yKey, -1f);
        if (rx <= 0f || ry <= 0f) return false;

        float x = screen.left + screen.width() * rx;
        float y = screen.top + screen.height() * ry;

        Path path = new Path();
        path.moveTo(x, y);
        GestureDescription gesture = new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, 0, duration))
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

        private boolean isConversationScreen(AccessibilityNodeInfo root, String group) {
        if (!screenContains(root, group)) return false;

        // Indicadores comuns da conversa aberta.
        if (screenContainsAny(root, "Mensagem", "Digite uma mensagem", "Message", "Type a message")) {
            return true;
        }

        String[] ids = {
                "com.whatsapp:id/entry",
                "com.whatsapp.w4b:id/entry",
                "com.whatsapp:id/conversation_entry_action_button",
                "com.whatsapp.w4b:id/conversation_entry_action_button"
        };

        for (String id : ids) {
            try {
                List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByViewId(id);
                if (nodes != null && !nodes.isEmpty()) return true;
            } catch (Exception ignored) { }
        }

        // A tela de seleção não mostra mais "1 selecionado".
        return !screenContainsAny(root, "1 selecionado", "1 selected", "Enviar para");
    }

    private boolean tapBottomRightOnce() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;

        Rect screen = new Rect();
        root.getBoundsInScreen(screen);
        if (screen.isEmpty()) return false;

        float x = screen.right - Math.max(70f, screen.width() * 0.085f);
        float y = screen.bottom - Math.max(105f, screen.height() * 0.09f);

        Path path = new Path();
        path.moveTo(x, y);

        GestureDescription gesture = new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, 0, 170))
                .build();

        return dispatchGesture(gesture, null, null);
    }

    private void saveJob(JSONObject job) {
        try {
            getSharedPreferences(PREFS, MODE_PRIVATE)
                    .edit()
                    .putString(KEY_JOB, job.toString())
                    .apply();
        } catch (Exception ignored) { }
    }

    private void saveJobCommit(JSONObject job) {
        try {
            getSharedPreferences(PREFS, MODE_PRIVATE)
                    .edit()
                    .putString(KEY_JOB, job.toString())
                    .commit();
        } catch (Exception ignored) { }
    }

    private void returnToCbOfertas() {
        try {
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch == null) return;
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(launch);
        } catch (Exception ignored) { }
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
