package com.soar.minisoar.controller;

import com.soar.minisoar.entity.Alert;
import com.soar.minisoar.entity.AuditLog;
import com.soar.minisoar.entity.BlockedIP;
import com.soar.minisoar.entity.RansomwareIncident;
import com.soar.minisoar.enums.AlertStatus;
import com.soar.minisoar.enums.AlertType;
import com.soar.minisoar.enums.SeverityLevel;
import com.soar.minisoar.repository.AlertRepository;
import com.soar.minisoar.repository.AuditLogRepository;
import com.soar.minisoar.repository.BlockedIPRepository;
import com.soar.minisoar.repository.RansomwareIncidentRepository;
import com.soar.minisoar.service.RemoteSshExecutionService;
import com.soar.minisoar.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/api/v1/actions")
@RequiredArgsConstructor
@CrossOrigin(origins = "${soar.security.allowed-origins:http://localhost:8080}", allowedHeaders = "*")
public class SecurityActionController {

    private final BlockedIPRepository blockedIPRepository;
    private final RansomwareIncidentRepository ransomwareIncidentRepository;
    private final AlertRepository alertRepository;
    private final AuditLogRepository auditLogRepository;
    private final RemoteSshExecutionService remoteSshExecutionService;
    private final SystemConfigService systemConfigService;

    @GetMapping("/check-ip")
    public ResponseEntity<Map<String, Object>> checkIpReputation(
            @RequestParam("ip") String ip,
            @RequestParam(value = "apiKey", required = false) String apiKey,
            @RequestParam(value = "maxAgeDays", defaultValue = "90") int maxAgeDays,
            @RequestParam(value = "demoMode", defaultValue = "false") boolean demoMode) {
        
        String configuredKey = systemConfigService.getConfigValue("ABUSEIPDB_API_KEY", "");
        String key = (apiKey != null && !apiKey.isBlank() && !apiKey.equalsIgnoreCase("ABUSEIPDB_API_KEY"))
                ? apiKey.trim()
                : (configuredKey != null && !configuredKey.equalsIgnoreCase("ABUSEIPDB_API_KEY") ? configuredKey.trim() : "");

        Map<String, Object> result = new HashMap<>();
        boolean isDemo = demoMode || "DEMO".equalsIgnoreCase(apiKey) || "true".equalsIgnoreCase(String.valueOf(apiKey));

        if (key.isBlank() || key.contains("MOCK")) {
            if (isDemo) {
                // Explicit demo / simulation mode requested
                int hash = Math.abs(ip.hashCode());
                int score = (ip.startsWith("10.") || ip.startsWith("192.168.")) ? 0 : (hash % 60 + 40);
                result.put("threat_score", score);
                result.put("total_reports", (score > 50) ? (hash % 30 + 10) : 0);
                result.put("is_malicious", score >= 50);
                result.put("threat_category", score >= 50 ? "SSH Brute-Force Attacker (Simulated)" : "Clean Host (Simulated)");
                result.put("provider", "AbuseIPDB Giả Lập (Demo Mode)");
                result.put("queried_ip", ip);
                result.put("status", "DEMO_SIMULATED");
                result.put("status_code", 200);
                result.put("is_real_api", false);
                result.put("message", "Chạy ở chế độ Giả Lập Demo do không có API Key thực tế.");
                return ResponseEntity.ok(result);
            }

            // Reject with 401 when user expects real API but has no key configured
            result.put("status", "ERROR");
            result.put("error", "MISSING_API_KEY");
            result.put("status_code", 401);
            result.put("message", "Chưa cấu hình API Key AbuseIPDB ('ABUSEIPDB_API_KEY' là giá trị mẫu). Cần nhập API Key thật để truy vấn AbuseIPDB API v2, hoặc nhấn 'Chạy Thử Demo Giả Lập'.");
            result.put("queried_ip", ip);
            result.put("is_real_api", false);
            result.put("provider", "AbuseIPDB API v2 (Unauthenticated)");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(result);
        }

        try (java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(5))
                .build()) {

            String targetUrl = String.format("https://api.abuseipdb.com/api/v2/check?ipAddress=%s&maxAgeInDays=%d&verbose=true",
                    java.net.URLEncoder.encode(ip, java.nio.charset.StandardCharsets.UTF_8), maxAgeDays);

            java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(targetUrl))
                    .header("Key", key)
                    .header("Accept", "application/json")
                    .header("User-Agent", "Mini-SOAR/1.0")
                    .GET()
                    .build();

            java.net.http.HttpResponse<String> resp = client.send(req, java.net.http.HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
                Map<String, Object> body = om.readValue(resp.body(), Map.class);
                Map<String, Object> data = (Map<String, Object>) body.get("data");
                if (data != null) {
                    int score = ((Number) data.getOrDefault("abuseConfidenceScore", 0)).intValue();
                    int reports = ((Number) data.getOrDefault("totalReports", 0)).intValue();
                    result.put("status", "SUCCESS");
                    result.put("status_code", 200);
                    result.put("threat_score", score);
                    result.put("total_reports", reports);
                    result.put("is_malicious", score >= 50 || reports >= 5);
                    result.put("threat_category", String.valueOf(data.getOrDefault("usageType", "Verified Threat")));
                    result.put("country_code", data.get("countryCode"));
                    result.put("isp", data.get("isp"));
                    result.put("last_reported_at", data.get("lastReportedAt"));
                    result.put("provider", "AbuseIPDB API v2 (REAL_LOOKUP)");
                    result.put("queried_ip", ip);
                    result.put("is_real_api", true);
                    return ResponseEntity.ok(result);
                }
            } else if (resp.statusCode() == 401 || resp.statusCode() == 403) {
                result.put("status", "ERROR");
                result.put("error", "INVALID_API_KEY");
                result.put("status_code", resp.statusCode());
                result.put("message", "API Key AbuseIPDB không hợp lệ hoặc đã hết hạn (HTTP " + resp.statusCode() + ").");
                result.put("is_real_api", true);
                result.put("provider", "AbuseIPDB API v2");
                return ResponseEntity.status(HttpStatus.valueOf(resp.statusCode())).body(result);
            } else if (resp.statusCode() == 429) {
                result.put("status", "ERROR");
                result.put("error", "RATE_LIMITED");
                result.put("status_code", 429);
                result.put("message", "Vượt quá giới hạn lượt truy vấn trong ngày của AbuseIPDB (Rate Limited).");
                result.put("is_real_api", true);
                result.put("provider", "AbuseIPDB API v2");
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(result);
            }
            
            result.put("status", "ERROR");
            result.put("error", "UPSTREAM_ERROR");
            result.put("status_code", resp.statusCode());
            result.put("message", "AbuseIPDB API trả về lỗi HTTP " + resp.statusCode() + ": " + resp.body());
            result.put("is_real_api", true);
            result.put("provider", "AbuseIPDB API v2 (ERROR)");
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(result);
        } catch (Exception e) {
            log.error("Failed to query AbuseIPDB for IP {}", ip, e);
            result.put("status", "ERROR");
            result.put("error", "CONNECTION_FAILED");
            result.put("status_code", 502);
            result.put("message", "Không thể kết nối đến AbuseIPDB API: " + e.getMessage());
            result.put("is_real_api", false);
            result.put("provider", "AbuseIPDB (Network Error)");
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(result);
        }
    }

    @GetMapping("/check-ip-history")
    public ResponseEntity<Map<String, Object>> checkIpHistory(
            @RequestParam(value = "ip", required = false) String ip,
            @RequestParam(value = "ip_address", required = false) String ipAddress) {
        Map<String, Object> res = new HashMap<>();
        String cleanIp = (ip != null && !ip.isBlank()) ? ip.trim() : (ipAddress != null ? ipAddress.trim() : "");
        
        Optional<BlockedIP> blockedOpt = !cleanIp.isBlank() ? blockedIPRepository.findByIpAddress(cleanIp) : Optional.empty();
        boolean isBlockedBefore = blockedOpt.isPresent();
        
        long priorAlertsCount = !cleanIp.isBlank() ? alertRepository.countBySourceIp(cleanIp) : 0;
        
        res.put("ip_address", cleanIp);
        res.put("is_repeat_offender", isBlockedBefore);
        res.put("previous_blocks_count", isBlockedBefore ? 1 : 0);
        res.put("total_prior_alerts", priorAlertsCount);
        res.put("history_penalty_score", isBlockedBefore ? 25 : 0);
        res.put("last_incident_reason", isBlockedBefore ? blockedOpt.get().getReason() : "No prior violation recorded");
        res.put("first_seen_at", isBlockedBefore && blockedOpt.get().getBlockedAt() != null 
                ? blockedOpt.get().getBlockedAt().toString() : "N/A");
        res.put("is_active_in_blacklist", isBlockedBefore && Boolean.TRUE.equals(blockedOpt.get().getIsActive()));
        res.put("data_source", "MYSQL_DATABASE");

        return ResponseEntity.ok(res);
    }

    @GetMapping("/blocked-ips")
    public ResponseEntity<List<BlockedIP>> getBlockedIPs() {
        return ResponseEntity.ok(blockedIPRepository.findAll());
    }

    @PostMapping("/blocked-ips")
    public ResponseEntity<Map<String, Object>> logBlockedIp(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body != null ? body : Map.of();
        String ipAddress = stringValue(payload.get("ip_address"), stringValue(payload.get("source_ip"), ""));
        String reason = stringValue(payload.get("reason"), "Blocked by Mini-SOAR workflow");
        int threatScore = intValue(payload.get("threat_score"), 75);
        Long alertId = longValue(payload.get("alert_id"), null);
        if (reason == null || reason.isBlank() || "...".equals(reason.trim())) {
            reason = "SSH Brute-Force automated block | score=" + threatScore;
        }
        final String blockReason = reason;

        Map<String, Object> response = new HashMap<>();
        if (ipAddress == null || ipAddress.isBlank()) {
            response.put("status", "ERROR");
            response.put("error", "ip_address is required");
            response.put("persisted", false);
            return ResponseEntity.badRequest().body(response);
        }

        BlockedIP blockedIP = blockedIPRepository.findByIpAddress(ipAddress)
                .orElseGet(() -> BlockedIP.builder()
                        .ipAddress(ipAddress)
                        .reason(blockReason)
                        .threatScore(threatScore)
                        .isActive(true)
                        .build());
        blockedIP.setReason(blockReason);
        blockedIP.setThreatScore(threatScore);
        blockedIP.setIsActive(true);
        if (alertId != null && alertId > 0 && alertRepository.existsById(alertId)) {
            blockedIP.setAlertId(alertId);
            alertRepository.findById(alertId).ifPresent(a -> {
                a.setStatus(AlertStatus.RESOLVED);
                alertRepository.save(a);
            });
        }
        blockedIP = blockedIPRepository.save(blockedIP);

        response.put("status", "SUCCESS");
        response.put("record_id", blockedIP.getId());
        response.put("table_name", "blocked_ips");
        response.put("alert_id", blockedIP.getAlertId());
        response.put("ip_address", blockedIP.getIpAddress());
        response.put("reason", blockedIP.getReason());
        response.put("threat_score", blockedIP.getThreatScore());
        response.put("is_active", blockedIP.getIsActive());
        response.put("blocked_at", blockedIP.getBlockedAt());
        response.put("persisted", true);
        response.put("persisted_in_mysql", true);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/ransomware-incidents")
    public ResponseEntity<Map<String, Object>> logRansomwareIncident(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body != null ? body : Map.of();
        String hostname = stringValue(payload.get("hostname"), "");
        String processName = stringValue(payload.get("process_name"), stringValue(payload.get("processName"), ""));
        int pid = intValue(payload.get("pid"), intValue(payload.get("process_id"), 0));
        int affectedFiles = intValue(payload.get("affected_files"), intValue(payload.get("affected_file_count"), 0));
        String containmentStatus = stringValue(payload.get("status"), stringValue(payload.get("containment_status"), "CONTAINED"));
        Long alertId = longValue(payload.get("alert_id"), 0L);

        Map<String, Object> response = new HashMap<>();
        if (hostname == null || hostname.isBlank() || processName == null || processName.isBlank() || pid <= 0) {
            response.put("status", "ERROR");
            response.put("error", "hostname, process_name and pid are required");
            response.put("persisted", false);
            return ResponseEntity.badRequest().body(response);
        }

        if (alertId == null || alertId <= 0 || !alertRepository.existsById(alertId)) {
            Alert alert = Alert.builder()
                    .alertType(AlertType.RANSOMWARE_DETECTION)
                    .severity(SeverityLevel.CRITICAL)
                    .hostname(hostname)
                    .description("Ransomware incident logged by Mini-SOAR test node: " + processName + " (PID " + pid + ")")
                    .rawPayload(String.valueOf(payload))
                    .status(AlertStatus.NEW)
                    .build();
            alertId = alertRepository.save(alert).getId();
        }

        RansomwareIncident incident = RansomwareIncident.builder()
                .alertId(alertId)
                .hostname(hostname)
                .processName(processName)
                .pid(pid)
                .affectedFiles(affectedFiles)
                .containmentStatus(containmentStatus)
                .build();
        incident = ransomwareIncidentRepository.save(incident);

        response.put("status", "SUCCESS");
        response.put("incident_id", incident.getId());
        response.put("table_name", "ransomware_incidents");
        response.put("hostname", incident.getHostname());
        response.put("process_name", incident.getProcessName());
        response.put("pid", incident.getPid());
        response.put("affected_files", incident.getAffectedFiles());
        response.put("containment_status", incident.getContainmentStatus());
        response.put("logged_at", incident.getIncidentTime());
        response.put("persisted", true);
        response.put("persisted_in_mysql", true);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<List<AuditLog>> getAuditLogs() {
        return ResponseEntity.ok(auditLogRepository.findAll());
    }

    @PostMapping({"/audit-log", "/audit-logs"})
    public ResponseEntity<Map<String, Object>> logAuditMonitoring(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body != null ? body : Map.of();
        String hostname = stringValue(payload.get("hostname"), "srv-prod-ssh01");
        String sourceIp = stringValue(payload.get("source_ip"), stringValue(payload.get("ip_address"), ""));
        String playbookName = stringValue(payload.get("playbook_name"), "SSH_RESPONSE_PLAYBOOK");
        String actionType = stringValue(payload.get("action_type"), "MONITOR_ONLY");
        String tier = stringValue(payload.get("tier"), "PRODUCTION");
        int riskScore = intValue(payload.get("risk_score"), intValue(payload.get("threat_score"), intValue(payload.get("total_score"), 0)));
        String note = stringValue(payload.get("note"), "Audit recorded: risk below escalation threshold; monitoring only.");
        Long alertId = longValue(payload.get("alert_id"), null);

        Map<String, Object> response = new HashMap<>();

        if (alertId != null && alertId > 0 && alertRepository.existsById(alertId)) {
            alertRepository.findById(alertId).ifPresent(alert -> {
                alert.setStatus(AlertStatus.RESOLVED);
                alertRepository.save(alert);
            });
        }

        AuditLog auditLog = AuditLog.builder()
                .alertId(alertId)
                .playbookName(playbookName)
                .hostname(hostname)
                .sourceIp(sourceIp.isBlank() ? null : sourceIp)
                .actionType(actionType)
                .tier(tier)
                .riskScore(riskScore)
                .note(note)
                .build();
        auditLog = auditLogRepository.save(auditLog);

        response.put("status", "SUCCESS");
        response.put("record_id", auditLog.getId());
        response.put("table_name", "audit_logs");
        response.put("alert_id", auditLog.getAlertId());
        response.put("playbook_name", auditLog.getPlaybookName());
        response.put("hostname", auditLog.getHostname());
        response.put("source_ip", auditLog.getSourceIp());
        response.put("action_type", auditLog.getActionType());
        response.put("tier", auditLog.getTier());
        response.put("weight", 30);
        response.put("risk_score", auditLog.getRiskScore());
        response.put("note", auditLog.getNote());
        response.put("logged_at", auditLog.getLoggedAt());
        response.put("persisted", true);
        response.put("persisted_in_mysql", true);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/remote-ssh/execute")
    public ResponseEntity<Map<String, Object>> executeRemoteSsh(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body != null ? body : Map.of();
        Map<String, String> configs = systemConfigService.getAllConfigsAsMap();

        String host = stringValue(payload.get("ip_address"), stringValue(payload.get("server_ip"), stringValue(payload.get("host"), configs.get("REMOTE_VPS_HOST"))));
        String username = stringValue(payload.get("username"), configs.getOrDefault("REMOTE_VPS_USER", "root"));
        String command = stringValue(payload.get("command"), "whoami && hostname && echo Mini-SOAR SSH OK");
        String keyFilename = stringValue(payload.get("pem_file"), stringValue(payload.get("key_filename"), configs.get("REMOTE_VPS_SSH_KEY")));
        String password = stringValue(payload.get("password"), null);
        int port = intValue(payload.get("port"), 22);
        int timeoutSeconds = intValue(payload.get("timeout_seconds"), 10);

        RemoteSshExecutionService.SshExecutionResult result =
                remoteSshExecutionService.executeRemoteCommand(host, username, command, keyFilename, password, port, timeoutSeconds);

        Map<String, Object> response = new HashMap<>();
        response.put("status", result.isSuccess() ? "SUCCESS" : "FAILED");
        response.put("mode", result.getMode());
        response.put("executed_host", host);
        response.put("ssh_user", username);
        response.put("ssh_port", port);
        response.put("command_executed", command);
        response.put("exit_code", result.getExitCode());
        response.put("stdout", result.getStdout());
        response.put("stderr", result.getStderr());
        response.put("detail", result.getDetail());
        response.put("verification_status",
                result.getStdout() != null && result.getStdout().contains("RULE_PRESENT") ? "VERIFIED" : "NOT_VERIFIED");
        response.put("server_ip", payload.getOrDefault("server_ip", host));
        response.put("attacker_ip", payload.getOrDefault("attacker_ip", payload.getOrDefault("source_ip", "")));
        response.put("source_ip", payload.getOrDefault("source_ip", payload.getOrDefault("attacker_ip", "")));
        return ResponseEntity.ok(response);
    }

    private String stringValue(Object value, String defaultValue) {
        if (value == null) return defaultValue;
        String str = String.valueOf(value).trim();
        return str.isEmpty() ? defaultValue : str;
    }

    private int intValue(Object value, int defaultValue) {
        if (value == null) return defaultValue;
        try {
            return Integer.parseInt(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private Long longValue(Object value, Long defaultValue) {
        if (value == null) return defaultValue;
        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    @DeleteMapping("/blocked-ips/{id}")
    public ResponseEntity<Map<String, Object>> unblockIp(@PathVariable Long id) {
        BlockedIP blockedIP = blockedIPRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Blocked IP record not found for ID: " + id));

        String ipAddress = blockedIP.getIpAddress();
        blockedIP.setIsActive(false);
        blockedIPRepository.save(blockedIP);
        log.info("Unblocked IP record in MySQL DB: {}", ipAddress);

        // Execute OS Firewall unblock command
        String unblockCmd = "iptables -D INPUT -s " + ipAddress + " -p tcp --dport 22 -j DROP";
        String mode = systemConfigService.getConfigValue("SOAR_EXECUTION_MODE", "SIMULATION");
        String detail = "[SIMULATION] Unblock rule generated for " + ipAddress;

        if ("REAL".equalsIgnoreCase(mode)) {
            try {
                ProcessBuilder pb = new ProcessBuilder("iptables", "-D", "INPUT", "-s", ipAddress, "-p", "tcp", "--dport", "22", "-j", "DROP");
                Process p = pb.start();
                p.waitFor();
                detail = "Firewall rule removed on local host via iptables -D.";
            } catch (Exception ex) {
                log.error("Failed to execute iptables -D for IP {}", ipAddress, ex);
            }

            // Check if Remote VPS execution is enabled
            Map<String, String> configs = systemConfigService.getAllConfigsAsMap();
            String vpsHost = configs.get("REMOTE_VPS_HOST");
            String vpsUser = configs.getOrDefault("REMOTE_VPS_USER", "root");
            String vpsKey = configs.get("REMOTE_VPS_SSH_KEY");

            if (vpsHost != null && !vpsHost.trim().isEmpty() && !"vps.example.com".equalsIgnoreCase(vpsHost)) {
                RemoteSshExecutionService.SshExecutionResult sshResult =
                        remoteSshExecutionService.executeRemoteCommand(vpsHost, vpsUser, unblockCmd, vpsKey, null, 22, 10);
                detail += " | Remote VPS: " + sshResult.getDetail();
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", "SUCCESS");
        response.put("message", "IP " + ipAddress + " has been unblocked successfully.");
        response.put("unblocked_ip", ipAddress);
        response.put("detail", detail);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/send-telegram")
    public ResponseEntity<Map<String, Object>> sendTelegram(
            @RequestBody(required = false) Map<String, Object> payload) {
        Map<String, Object> body = payload != null ? payload : new HashMap<>();
        String botToken = (String) body.getOrDefault("bot_token", "");
        String chatId = (String) body.getOrDefault("chat_id", "");
        String messageHtml = (String) body.getOrDefault("message_html", "<b>[MINI-SOAR TEST] Test Node Telegram Incident Alert</b>");

        if (botToken.isBlank() || botToken.contains("AAFx_") || botToken.startsWith("7891234567")) {
            botToken = systemConfigService.getConfigValue("TELEGRAM_BOT_TOKEN", "8891227861:AAHHkDF9GqZ-IRPbr1gXVgw8FtmaIoGRb-I");
        }
        if (chatId.isBlank() || chatId.contains("@mini_soar_alerts_channel")) {
            chatId = systemConfigService.getConfigValue("TELEGRAM_CHAT_ID", "6891551250");
        }

        Map<String, Object> result = new HashMap<>();
        try {
            String urlStr = "https://api.telegram.org/bot" + botToken + "/sendMessage";
            java.net.URL url = new java.net.URI(urlStr).toURL();
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setDoOutput(true);
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);

            // Telegram HTML mode only supports <b>, <i>, <code>, <a>, <pre>. Convert <br> or <p> to newlines.
            String cleanText = messageHtml
                    .replace("<br>", "\n")
                    .replace("<br/>", "\n")
                    .replace("<br />", "\n")
                    .replace("</p>", "\n")
                    .replace("<p>", "");

            Map<String, Object> reqBody = new HashMap<>();
            reqBody.put("chat_id", chatId);
            reqBody.put("text", cleanText);
            reqBody.put("parse_mode", "HTML");

            byte[] input = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsBytes(reqBody);
            try (java.io.OutputStream os = conn.getOutputStream()) {
                os.write(input, 0, input.length);
            }

            int code = conn.getResponseCode();
            String responseBody = "";
            java.io.InputStream is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
            if (is != null) {
                try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(is, java.nio.charset.StandardCharsets.UTF_8))) {
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    responseBody = sb.toString();
                }
            }

            result.put("status", code == 200 ? "SUCCESS" : "ERROR");
            result.put("http_code", code);
            result.put("chat_id", chatId);
            result.put("sent_message", cleanText);
            result.put("telegram_response", responseBody);
            result.put("is_real_api", true);
            result.put("timestamp", java.time.LocalDateTime.now().toString());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            result.put("status", "ERROR");
            result.put("error", e.getMessage());
            result.put("chat_id", chatId);
            return ResponseEntity.ok(result);
        }
    }

    @GetMapping("/ransomware-incidents")
    public ResponseEntity<List<RansomwareIncident>> getRansomwareIncidents() {
        return ResponseEntity.ok(ransomwareIncidentRepository.findAll());
    }
}
