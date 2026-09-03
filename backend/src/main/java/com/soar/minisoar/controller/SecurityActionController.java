package com.soar.minisoar.controller;

import com.soar.minisoar.entity.BlockedIP;
import com.soar.minisoar.entity.Alert;
import com.soar.minisoar.entity.RansomwareIncident;
import com.soar.minisoar.enums.AlertStatus;
import com.soar.minisoar.enums.AlertType;
import com.soar.minisoar.enums.SeverityLevel;
import com.soar.minisoar.repository.AlertRepository;
import com.soar.minisoar.repository.BlockedIPRepository;
import com.soar.minisoar.repository.RansomwareIncidentRepository;
import com.soar.minisoar.service.RemoteSshExecutionService;
import com.soar.minisoar.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
    private final RemoteSshExecutionService remoteSshExecutionService;
    private final SystemConfigService systemConfigService;

    @GetMapping("/check-ip")
    public ResponseEntity<Map<String, Object>> checkIpReputation(
            @RequestParam("ip") String ip,
            @RequestParam(value = "apiKey", required = false) String apiKey,
            @RequestParam(value = "maxAgeDays", defaultValue = "90") int maxAgeDays) {
        
        String key = (apiKey != null && !apiKey.isBlank() && !apiKey.equalsIgnoreCase("ABUSEIPDB_API_KEY"))
                ? apiKey.trim()
                : systemConfigService.getConfigValue("ABUSEIPDB_API_KEY", "");

        Map<String, Object> result = new HashMap<>();
        if (key == null || key.isBlank() || key.contains("MOCK")) {
            // Local fallback calculation if no real key provided
            int hash = Math.abs(ip.hashCode());
            int score = (ip.startsWith("10.") || ip.startsWith("192.168.")) ? 0 : (hash % 60 + 40);
            result.put("threat_score", score);
            result.put("total_reports", (score > 50) ? (hash % 30 + 10) : 0);
            result.put("is_malicious", score >= 50);
            result.put("threat_category", score >= 50 ? "SSH Brute-Force Attacker (Heuristic)" : "Clean Host");
            result.put("provider", "AbuseIPDB Local Engine (No Key)");
            result.put("queried_ip", ip);
            result.put("is_real_api", false);
            return ResponseEntity.ok(result);
        }

        try {
            java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                    .connectTimeout(java.time.Duration.ofSeconds(5))
                    .build();

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
            }
            
            result.put("threat_score", 0);
            result.put("error", "AbuseIPDB API returned status " + resp.statusCode() + ": " + resp.body());
            result.put("is_real_api", true);
            result.put("provider", "AbuseIPDB API v2 (ERROR)");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Failed to query AbuseIPDB for IP {}", ip, e);
            result.put("error", e.getMessage());
            result.put("threat_score", 75);
            result.put("is_real_api", false);
            result.put("provider", "AbuseIPDB Fallback (Network error)");
            return ResponseEntity.ok(result);
        }
    }

    @GetMapping("/check-ip-history")
    public ResponseEntity<Map<String, Object>> checkIpHistory(@RequestParam("ip") String ip) {
        Map<String, Object> res = new HashMap<>();
        String cleanIp = ip != null ? ip.trim() : "";
        
        Optional<BlockedIP> blockedOpt = blockedIPRepository.findByIpAddress(cleanIp);
        boolean isBlockedBefore = blockedOpt.isPresent();
        
        res.put("ip_address", cleanIp);
        res.put("is_repeat_offender", isBlockedBefore);
        res.put("previous_blocks_count", isBlockedBefore ? 1 : 0);
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
        blockedIP = blockedIPRepository.save(blockedIP);

        response.put("status", "SUCCESS");
        response.put("record_id", blockedIP.getId());
        response.put("table_name", "blocked_ips");
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

    @PostMapping("/remote-ssh/execute")
    public ResponseEntity<Map<String, Object>> executeRemoteSsh(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body != null ? body : Map.of();
        Map<String, String> configs = systemConfigService.getAllConfigsAsMap();

        String host = stringValue(payload.get("host"), configs.get("REMOTE_VPS_HOST"));
        String username = stringValue(payload.get("username"), configs.getOrDefault("REMOTE_VPS_USER", "root"));
        String command = stringValue(payload.get("command"), "whoami && hostname && echo Mini-SOAR SSH OK");
        String keyFilename = stringValue(payload.get("key_filename"), configs.get("REMOTE_VPS_SSH_KEY"));
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

        if (botToken.isBlank()) {
            botToken = systemConfigService.getConfigValue("TELEGRAM_BOT_TOKEN", "8891227861:AAHHkDF9GqZ-IRPbr1gXVgw8FtmaIoGRb-I");
        }
        if (chatId.isBlank()) {
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

            Map<String, Object> reqBody = new HashMap<>();
            reqBody.put("chat_id", chatId);
            reqBody.put("text", messageHtml);
            reqBody.put("parse_mode", "HTML");

            byte[] input = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsBytes(reqBody);
            try (java.io.OutputStream os = conn.getOutputStream()) {
                os.write(input, 0, input.length);
            }

            int code = conn.getResponseCode();
            result.put("status", code == 200 ? "SUCCESS" : "ERROR");
            result.put("http_code", code);
            result.put("chat_id", chatId);
            result.put("sent_message", messageHtml);
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
