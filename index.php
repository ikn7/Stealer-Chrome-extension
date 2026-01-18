<?php
/**
 * SIEM Server - Form Monitor
 * Reçoit et stocke les logs de formulaires POST
 *
 * Installation:
 * 1. Placer ce fichier dans votre serveur web (Apache/Nginx avec PHP)
 * 2. Créer le dossier 'logs' avec droits d'écriture
 * 3. Configurer l'URL dans l'extension Chrome (background.js)
 */

// Configuration
define('LOG_FILE', __DIR__ . '/logs/siem_logs.json');
define('LOG_DIR', __DIR__ . '/logs');

// Headers CORS pour l'extension Chrome
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
//header('Access-Control-Allow-Headers: Content-Type');
//header('Content-Type: application/json; charset=utf-8');

// Gérer les requêtes OPTIONS (preflight CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Créer le dossier logs si nécessaire
if (!is_dir(LOG_DIR)) {
    mkdir(LOG_DIR, 0755, true);
}

// Charger les logs existants
function loadLogs() {
    if (file_exists(LOG_FILE)) {
        $content = file_get_contents(LOG_FILE);
        return json_decode($content, true) ?: [];
    }
    return [];
}

// Sauvegarder les logs
function saveLogs($logs) {
    file_put_contents(LOG_FILE, json_encode($logs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// POST: Recevoir un nouveau log
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $log = json_decode($input, true);

    if (!$log) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
        exit;
    }

    // Ignorer les tests
    if (isset($log['test']) && $log['test']) {
        echo json_encode(['success' => true, 'message' => 'Test OK']);
        exit;
    }

    // Ajouter métadonnées serveur
    $log['server_received'] = date('c');
    $log['client_ip'] = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    // Sauvegarder
    $logs = loadLogs();
    $logs[] = $log;

    // Garder les 1000 derniers logs
    if (count($logs) > 1000) {
        $logs = array_slice($logs, -1000);
    }

    saveLogs($logs);

    // Log dans fichier texte aussi (pour tail -f)
    $logLine = sprintf(
        "[%s] %s | %s -> %s | Champs: %s\n",
        date('Y-m-d H:i:s'),
        $log['client_ip'],
        $log['url'] ?? 'N/A',
        $log['form']['action'] ?? 'N/A',
        json_encode($log['form_data'] ?? [])
    );
    file_put_contents(LOG_DIR . '/siem.log', $logLine, FILE_APPEND);

    echo json_encode(['success' => true, 'id' => $log['id'] ?? 'unknown']);
    exit;
}

// GET: Afficher le dashboard ou l'API
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    // API JSON
    if (isset($_GET['api'])) {
        $logs = loadLogs();
        echo json_encode($logs);
        exit;
    }

    // Dashboard HTML
    $logs = loadLogs();
    $totalLogs = count($logs);

    ?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SIEM Dashboard</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Consolas', 'Monaco', monospace;
            background: #0d1117;
            color: #e6edf3;
            padding: 20px;
        }
        h1 { color: #e94560; margin-bottom: 5px; }
        .subtitle { color: #7d8590; font-size: 14px; margin-bottom: 20px; }
        .stats {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat {
            background: #161b22;
            padding: 15px 25px;
            border-radius: 8px;
            border-left: 4px solid #e94560;
        }
        .stat-value { font-size: 28px; font-weight: bold; color: #e94560; }
        .stat-label { font-size: 11px; color: #7d8590; }
        .controls { margin-bottom: 15px; }
        .btn {
            background: #238636;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            margin-right: 10px;
        }
        .btn:hover { background: #2ea043; }
        .btn-danger { background: #da3633; }
        .btn-danger:hover { background: #f85149; }
        .logs {
            background: #161b22;
            border-radius: 8px;
            max-height: 70vh;
            overflow-y: auto;
        }
        .log {
            padding: 15px;
            border-bottom: 1px solid #21262d;
        }
        .log:hover { background: #1c2128; }
        .log-header {
            display: flex;
            gap: 15px;
            align-items: center;
            margin-bottom: 10px;
        }
        .time { color: #7d8590; font-size: 12px; }
        .ip { color: #f0883e; font-size: 12px; }
        .url { color: #3fb950; word-break: break-all; }
        .action { color: #d29922; word-break: break-all; font-size: 13px; }
        .cross { color: #f85149; font-weight: bold; margin-left: 10px; }
        .fields {
            margin-top: 10px;
            background: #0d1117;
            padding: 10px;
            border-radius: 4px;
            font-size: 13px;
        }
        .field { margin: 4px 0; }
        .field-name { color: #79c0ff; }
        .field-value { color: #a5d6ff; }
        .empty { color: #7d8590; text-align: center; padding: 40px; }
    </style>
</head>
<body>
    <h1>🛡️ SIEM Dashboard</h1>
    <p class="subtitle">Surveillance des formulaires POST</p>

    <div class="stats">
        <div class="stat">
            <div class="stat-value"><?= $totalLogs ?></div>
            <div class="stat-label">TOTAL LOGS</div>
        </div>
    </div>

    <div class="controls">
        <button class="btn" onclick="location.reload()">↻ Actualiser</button>
        <button class="btn" onclick="window.open('?api=1')">📥 Export JSON</button>
        <button class="btn btn-danger" onclick="if(confirm('Supprimer tous les logs?')) location.href='?clear=1'">🗑️ Vider</button>
    </div>

    <div class="logs">
        <?php if (empty($logs)): ?>
            <div class="empty">Aucun log reçu. Soumettez un formulaire pour tester.</div>
        <?php else: ?>
            <?php foreach (array_reverse($logs) as $log): ?>
                <div class="log">
                    <div class="log-header">
                        <span class="time"><?= htmlspecialchars($log['timestamp'] ?? 'N/A') ?></span>
                        <span class="ip">IP: <?= htmlspecialchars($log['client_ip'] ?? 'N/A') ?></span>
                        <?php if (!empty($log['form']['is_cross_domain'])): ?>
                            <span class="cross">⚠️ CROSS-DOMAIN</span>
                        <?php endif; ?>
                    </div>
                    <div><strong>URL:</strong> <span class="url"><?= htmlspecialchars($log['url'] ?? $log['page']['url'] ?? 'N/A') ?></span></div>
                    <div><strong>Action:</strong> <span class="action"><?= htmlspecialchars($log['form']['action'] ?? 'N/A') ?></span></div>
                    <div class="fields">
                        <strong>Champs:</strong>
                        <?php if (!empty($log['form_data'])): ?>
                            <?php foreach ($log['form_data'] as $name => $value): ?>
                                <div class="field">
                                    <span class="field-name"><?= htmlspecialchars($name) ?>:</span>
                                    <span class="field-value"><?= htmlspecialchars($value ?: '(vide)') ?></span>
                                </div>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <div class="field">(aucun champ)</div>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>

    <script>
        // Auto-refresh toutes les 10 secondes
        setTimeout(() => location.reload(), 10000);
    </script>
</body>
</html>
    <?php
    exit;
}

// Vider les logs
if (isset($_GET['clear'])) {
    saveLogs([]);
    if (file_exists(LOG_DIR . '/siem.log')) {
        unlink(LOG_DIR . '/siem.log');
    }
    header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
    exit;
}

// Méthode non supportée
http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
