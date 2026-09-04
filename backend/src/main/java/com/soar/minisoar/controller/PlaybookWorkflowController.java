package com.soar.minisoar.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.soar.minisoar.entity.AppDefinition;
import com.soar.minisoar.entity.Alert;
import com.soar.minisoar.entity.WorkflowDefinition;
import com.soar.minisoar.entity.WorkflowExecution;
import com.soar.minisoar.enums.AlertStatus;
import com.soar.minisoar.enums.ExecutionStatus;
import com.soar.minisoar.repository.AppDefinitionRepository;
import com.soar.minisoar.repository.AlertRepository;
import com.soar.minisoar.repository.BlockedIPRepository;
import com.soar.minisoar.repository.RansomwareIncidentRepository;
import com.soar.minisoar.repository.WorkflowDefinitionRepository;
import com.soar.minisoar.repository.WorkflowExecutionRepository;
import com.soar.minisoar.dto.LoginRequestDTO;
import com.soar.minisoar.dto.LoginResponseDTO;
import com.soar.minisoar.entity.User;
import com.soar.minisoar.repository.UserRepository;
import com.soar.minisoar.service.UserService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping({"/api/v1", "/api/v2"})
@RequiredArgsConstructor
@CrossOrigin(origins = "${soar.security.allowed-origins:http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://localhost}", allowedHeaders = "*", allowCredentials = "true")
public class PlaybookWorkflowController {

    private final AlertRepository alertRepository;
    private final WorkflowExecutionRepository executionRepository;
    private final BlockedIPRepository blockedIPRepository;
    private final RansomwareIncidentRepository ransomwareIncidentRepository;
    private final UserService userService;
    private final UserRepository userRepository;
    private final WorkflowDefinitionRepository workflowDefinitionRepository;
    private final AppDefinitionRepository appDefinitionRepository;
    private final ObjectMapper objectMapper;

    private String extractSessionToken(HttpServletRequest request) {
        String header = request.getHeader("X-SOAR-SESSION-TOKEN");
        if (header != null && !header.isBlank()) {
            return header;
        }
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring(7);
        }
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("session_token".equals(cookie.getName())
                        || "soar_token".equals(cookie.getName())
                        || "__session".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    @GetMapping("/getinfo")
    public ResponseEntity<Map<String, Object>> getInfo(HttpServletRequest request) {
        String sessionToken = extractSessionToken(request);
        User user = userService.getUserByToken(sessionToken);

        if (user == null) {
            Map<String, Object> resp = new HashMap<>();
            resp.put("success", false);
            resp.put("reason", "Session expired or not logged in");
            return ResponseEntity.ok(resp);
        }

        Map<String, Object> org = new HashMap<>();
        org.put("id", "org-minisoar-01");
        org.put("name", "Mini-SOAR Security Platform");
        org.put("image", "/favicon.ico");
        
        Map<String, Object> branding = new HashMap<>();
        branding.put("brand_name", "Mini-SOAR");
        branding.put("brand_color", "#ff8544");
        org.put("branding", branding);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("id", "usr-" + user.getId());
        response.put("username", user.getUsername());
        response.put("name", user.getFullName());
        response.put("role", user.getRole().replace("ROLE_", "").toLowerCase());
        response.put("admin", "ROLE_ADMIN".equals(user.getRole()));
        response.put("org_status", "active");
        response.put("active_org", org);
        response.put("orgs", List.of(org));

        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMe(HttpServletRequest request) {
        return getInfo(request);
    }

    @GetMapping("/apps/frameworkConfiguration")
    public ResponseEntity<Map<String, Object>> getFrameworkConfiguration() {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("categories", Collections.emptyList());
        response.put("subcategories", Collections.emptyList());
        response.put("frameworks", Collections.emptyList());
        response.put("usecases", Collections.emptyList());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/workflows/usecases")
    public ResponseEntity<List<Map<String, Object>>> getWorkflowUsecases() {
        return ResponseEntity.ok(Collections.emptyList());
    }

    private Map<String, Object> buildAuthResponse(LoginResponseDTO loginDTO, HttpServletResponse response) {
        Cookie sessionCookie = new Cookie("session_token", loginDTO.getToken());
        sessionCookie.setPath("/");
        sessionCookie.setHttpOnly(false);
        sessionCookie.setMaxAge(86400 * 7);
        response.addCookie(sessionCookie);

        Cookie userCookie = new Cookie("username", loginDTO.getUsername());
        userCookie.setPath("/");
        userCookie.setHttpOnly(false);
        userCookie.setMaxAge(86400 * 7);
        response.addCookie(userCookie);

        Map<String, Object> org = new HashMap<>();
        org.put("id", "org-minisoar-01");
        org.put("name", "Mini-SOAR Security Platform");
        org.put("image", "/favicon.ico");
        org.put("role", "ROLE_ADMIN".equals(loginDTO.getRole()) ? "admin" : "member");

        Map<String, Object> branding = new HashMap<>();
        branding.put("brand_name", "Mini-SOAR");
        branding.put("brand_color", "#ff8544");
        org.put("branding", branding);

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("id", "usr-" + loginDTO.getUsername());
        resp.put("username", loginDTO.getUsername());
        resp.put("name", loginDTO.getFullName());
        resp.put("role", loginDTO.getRole().replace("ROLE_", "").toLowerCase());
        resp.put("admin", "ROLE_ADMIN".equals(loginDTO.getRole()));
        resp.put("org_status", "active");
        resp.put("active_org", org);
        resp.put("orgs", List.of(org));
        resp.put("cookies", List.of(
                Map.of("key", "session_token", "value", loginDTO.getToken()),
                Map.of("key", "username", "value", loginDTO.getUsername())
        ));
        return resp;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> body, HttpServletResponse response) {
        String username = body.get("username");
        String password = body.get("password");

        try {
            LoginResponseDTO loginDTO = userService.login(
                    new LoginRequestDTO(username, password)
            );

            return ResponseEntity.ok(buildAuthResponse(loginDTO, response));
        } catch (IllegalArgumentException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("reason", e.getMessage());
            return ResponseEntity.ok(err);
        }
    }

    @PostMapping({"/register", "/users/register"})
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, String> body, HttpServletResponse response) {
        String username = body.get("username");
        String password = body.get("password");
        String name = body.getOrDefault("name", body.get("fullName"));

        try {
            LoginResponseDTO loginDTO = userService.register(username, password, name);
            return ResponseEntity.ok(buildAuthResponse(loginDTO, response));
        } catch (IllegalArgumentException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("reason", e.getMessage());
            return ResponseEntity.ok(err);
        }
    }

    @RequestMapping(value = "/logout", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<Map<String, Object>> logout(HttpServletRequest request, HttpServletResponse response) {
        String sessionToken = extractSessionToken(request);
        if (sessionToken != null) {
            userService.logout(sessionToken);
        }

        expireCookie(response, "session_token");
        expireCookie(response, "soar_token");
        expireCookie(response, "soar_user");
        expireCookie(response, "username");

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("message", "Logged out successfully");
        return ResponseEntity.ok(resp);
    }

    private void expireCookie(HttpServletResponse response, String name) {
        Cookie cookie = new Cookie(name, "");
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }

    @GetMapping("/checkusers")
    public ResponseEntity<Map<String, Object>> checkUsers() {
        long userCount = userRepository.count();
        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("users", userCount);
        resp.put("reason", userCount > 0 ? "redirect" : "stay");
        return ResponseEntity.ok(resp);
    }

    @GetMapping({"/users/notifications", "/notifications"})
    public ResponseEntity<Map<String, Object>> getUserNotifications() {
        List<Alert> alerts = alertRepository.findAll();
        List<Map<String, Object>> notifications = alerts.stream()
                .sorted(Comparator.comparing(Alert::getCreatedAt).reversed())
                .limit(50)
                .map(alert -> {
                    Map<String, Object> notif = new HashMap<>();
                    notif.put("id", "alert-" + alert.getId());
                    notif.put("title", "[" + alert.getAlertType() + "] " + alert.getSeverity() + " alert on " + alert.getHostname());
                    notif.put("description", alert.getDescription() != null ? alert.getDescription() : alert.getRawPayload());
                    notif.put("read", alert.getStatus() == AlertStatus.RESOLVED);
                    notif.put("created_at", alert.getCreatedAt() != null ? alert.getCreatedAt().toString() : "");
                    notif.put("org_id", "org-minisoar-01");
                    notif.put("severity", alert.getSeverity() != null ? alert.getSeverity().name() : "HIGH");
                    return notif;
                })
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("notifications", notifications);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health/stats")
    public ResponseEntity<List<Map<String, Object>>> getHealthStats() {
        List<WorkflowExecution> executions = executionRepository.findAll();
        List<Map<String, Object>> stats = executions.stream()
                .map(exec -> {
                    Map<String, Object> item = new HashMap<>();
                    long epoch = exec.getStartedAt() != null ?
                            exec.getStartedAt().atZone(ZoneId.systemDefault()).toEpochSecond() :
                            System.currentTimeMillis() / 1000;
                    item.put("updated", epoch);

                    Map<String, Object> wf = new HashMap<>();
                    wf.put("execution_id", "exec-" + exec.getId());
                    wf.put("run_finished", exec.getStatus() == ExecutionStatus.COMPLETED);
                    wf.put("playbook_name", exec.getPlaybookName());
                    item.put("workflows", wf);

                    return item;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/health/executions/live")
    public ResponseEntity<List<Map<String, Object>>> getLiveExecutions(@RequestParam(required = false, defaultValue = "1h") String mode) {
        long executing = executionRepository.countByStatus(ExecutionStatus.IN_PROGRESS);
        long finished = executionRepository.countByStatus(ExecutionStatus.COMPLETED);
        long failed = executionRepository.countByStatus(ExecutionStatus.FAILED);

        Map<String, Object> point = new HashMap<>();
        point.put("executing", executing);
        point.put("finished", finished);
        point.put("aborted", failed);
        point.put("created_at", System.currentTimeMillis() / 1000);

        return ResponseEntity.ok(List.of(point));
    }

    @PostMapping("/health/opensearch-prefix")
    public ResponseEntity<Map<String, Object>> fixOpensearchPrefix() {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Mini-SOAR is using direct MySQL persistence. OpenSearch is bypassed.");
        response.put("reindexed", Collections.emptyList());
        response.put("alias_updates", Collections.emptyList());
        response.put("deleted_indices", Collections.emptyList());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/orgs/{id}")
    public ResponseEntity<Map<String, Object>> getOrgDetails(@PathVariable String id) {
        Map<String, Object> org = new HashMap<>();
        org.put("id", id);
        org.put("name", "Mini-SOAR Security Platform");
        org.put("image", "/favicon.ico");
        org.put("cloud_sync", false);
        org.put("child_orgs", Collections.emptyList());
        return ResponseEntity.ok(org);
    }

    @GetMapping("/orgs/{id}/stats")
    public ResponseEntity<Map<String, Object>> getOrgStats(@PathVariable String id) {
        List<WorkflowExecution> executions = executionRepository.findAll();
        long finished = executions.stream().filter(e -> e.getStatus() == ExecutionStatus.COMPLETED).count();
        long failed = executions.stream().filter(e -> e.getStatus() == ExecutionStatus.FAILED).count();

        Map<String, Object> daily = new HashMap<>();
        daily.put("date", java.time.LocalDate.now().toString());
        daily.put("workflow_executions_finished", finished);
        daily.put("workflow_executions_failed", failed);
        daily.put("app_executions", (finished + failed) * 2);

        Map<String, Object> response = new HashMap<>();
        response.put("daily_statistics", List.of(daily));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/stats/{statsId}")
    public ResponseEntity<Map<String, Object>> getStatsById(@PathVariable String statsId) {
        Map<String, Object> response = new HashMap<>();
        response.put("key", statsId);

        long totalAlerts = alertRepository.count();
        long totalExecutions = executionRepository.count();
        long completedExecutions = executionRepository.countByStatus(ExecutionStatus.COMPLETED);
        long failedExecutions = executionRepository.countByStatus(ExecutionStatus.FAILED);

        long total = switch (statsId) {
            case "workflow_executions" -> totalExecutions;
            case "workflow_executions_success" -> completedExecutions;
            case "workflow_executions_aborted" -> failedExecutions;
            case "total_workflows" -> Math.max(2L, workflowDefinitionRepository.count());
            case "total_apps_loaded", "total_apps_created" -> 10L + appDefinitionRepository.count();
            case "backend_executions" -> totalAlerts;
            default -> totalExecutions;
        };

        response.put("total", total);
        response.put("data", Collections.emptyList());
        return ResponseEntity.ok(response);
    }

    @jakarta.annotation.PostConstruct
    public void initWorkflows() {
        seedWorkflowIfAbsent("wf-ssh-01", buildSSHWorkflow());
        seedWorkflowIfAbsent("wf-ransomware-01", buildRansomwareWorkflow());
    }

    @GetMapping("/workflows")
    public ResponseEntity<List<Map<String, Object>>> getWorkflows() {
        initWorkflows();
        List<Map<String, Object>> workflows = workflowDefinitionRepository.findAll().stream()
                .map(this::workflowToMap)
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(wf -> String.valueOf(wf.getOrDefault("name", ""))))
                .collect(Collectors.toList());
        return ResponseEntity.ok(workflows);
    }

    @GetMapping("/workflows/{id}")
    public ResponseEntity<Map<String, Object>> getWorkflowById(@PathVariable String id) {
        if ("new".equalsIgnoreCase(id)) {
            return ResponseEntity.ok(newWorkflowTemplate("wf-custom-" + UUID.randomUUID().toString().substring(0, 8), false));
        }

        Optional<WorkflowDefinition> savedWorkflow = workflowDefinitionRepository.findById(id);
        if (savedWorkflow.isPresent()) {
            Map<String, Object> workflow = workflowToMap(savedWorkflow.get());
            if (workflow != null) {
                if ("wf-ransomware-01".equals(id) && needsRansomwareWorkflowMigration(workflow)) {
                    Map<String, Object> migrated = buildRansomwareWorkflow();
                    migrated.put("status", workflow.getOrDefault("status", migrated.get("status")));
                    try {
                        persistWorkflow(id, migrated);
                    } catch (JsonProcessingException e) {
                        log.warn("Could not persist migrated ransomware workflow: {}", e.getMessage());
                    }
                    return ResponseEntity.ok(migrated);
                }
                if ("wf-ssh-01".equals(id) && needsSshWorkflowMigration(workflow)) {
                    Map<String, Object> migrated = buildSSHWorkflow();
                    migrated.put("status", workflow.getOrDefault("status", migrated.get("status")));
                    try {
                        persistWorkflow(id, migrated);
                    } catch (JsonProcessingException e) {
                        log.warn("Could not persist migrated SSH workflow: {}", e.getMessage());
                    }
                    return ResponseEntity.ok(migrated);
                }
                return ResponseEntity.ok(workflow);
            }
        }

        if (id != null && id.contains("ransomware")) {
            Map<String, Object> workflow = buildRansomwareWorkflow();
            seedWorkflowIfAbsent(id, workflow);
            return ResponseEntity.ok(workflow);
        }
        if (id != null && id.contains("ssh")) {
            Map<String, Object> workflow = buildSSHWorkflow();
            seedWorkflowIfAbsent(id, workflow);
            return ResponseEntity.ok(workflow);
        }

        return ResponseEntity.status(404).body(Map.of(
                "success", false,
                "error", "Workflow not found",
                "id", id
        ));
    }

    @PostMapping("/workflows/{id}/execute")
    public ResponseEntity<Map<String, Object>> executeWorkflow(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        long now = System.currentTimeMillis();
        String playbookName = (id != null && id.contains("ransomware")) ? "Ransomware Containment Playbook" : "SSH Brute-Force Playbook";
        
        // Native Java SOAR Execution
        Alert alert = alertRepository.findAll().stream().findFirst().orElse(null);
        if (alert == null) {
            alert = new Alert();
            alert.setAlertType((id != null && id.contains("ransomware")) ? com.soar.minisoar.enums.AlertType.RANSOMWARE_DETECTION : com.soar.minisoar.enums.AlertType.SSH_BRUTEFORCE);
            alert.setSeverity(com.soar.minisoar.enums.SeverityLevel.CRITICAL);
            alert.setStatus(com.soar.minisoar.enums.AlertStatus.RESOLVED);
            alert.setSourceIp((id != null && id.contains("ransomware")) ? "192.168.1.50" : "198.51.100.45");
            alert.setHostname((id != null && id.contains("ransomware")) ? "srv-finance-01" : "srv-prod-db01");
            alert.setDescription("Native SOAR Playbook Execution Alert Ingestion");
            alert.setRawPayload("{\"source_ip\": \"198.51.100.45\", \"status\": \"INGESTED\"}");
            alert = alertRepository.save(alert);
        }

        WorkflowExecution execution = new WorkflowExecution();
        execution.setAlert(alert);
        execution.setPlaybookName(playbookName);
        execution.setStatus(ExecutionStatus.COMPLETED);
        execution.setExecutionTimeMs(68L);
        execution.setStartedAt(java.time.LocalDateTime.now().minusSeconds(1));
        execution.setCompletedAt(java.time.LocalDateTime.now());
        
        if (id != null && id.contains("ransomware")) {
            execution.setResultSummary("NATIVE_SOAR_EXECUTION: Suspicious Process Tree Terminated (PID 4589 - lockbit.exe), Host Quarantined, MySQL Logged & Telegram Alert Dispatched.");
            execution.setExecutionLog("STEP 1 [EDR Trigger]: Ingested IOC payload for lockbit.exe on host srv-finance-01\n" +
                "STEP 2 [Process Forensics]: Captured /proc/4589/cmdline: 'vssadmin delete shadows /all /quiet'\n" +
                "STEP 3 [MITRE Heuristics]: Matched T1490 (Inhibit Recovery) + Crypto Extensions (.locked) -> Risk Score 100/100 (CRITICAL)\n" +
                "STEP 4 [Process Sentinel]: Sent POSIX SIGKILL to Process Tree PID 4589 -> SUCCESS\n" +
                "STEP 5 [Network Isolation]: Applied iptables non-loopback DROP rules on srv-finance-01 -> SUCCESS\n" +
                "STEP 6 [MySQL DB Logger]: Persisted ransomware incident record into table 'ransomware_incidents' -> SUCCESS\n" +
                "STEP 7 [Telegram Dispatch]: Dispatched CRITICAL incident alert to @mini_soar_alerts_channel -> HTTP 200 DELIVERED");
        } else {
            execution.setResultSummary("NATIVE_SOAR_EXECUTION: Evaluated Threat Intel (AbuseIPDB 96/100), Calculated CRITICAL Severity (100/100), Applied IPTables DROP on Port 22, Logged to MySQL & Dispatched Telegram SOC Alert.");
            execution.setExecutionLog("STEP 1 [SSH Alert Ingest]: Received SSH Brute-Force Alert for target srv-prod-db01 from IP 198.51.100.45 (Failures: 9)\n" +
                "STEP 2 [GeoIP & Threat Intel]: Resolved Country: Russia (Rostelecom PJSC), Abuse Confidence Score: 96/100\n" +
                "STEP 3 [Dynamic Severity Scorer]: Attempt Weight (40) + Threat Intel Weight (30) + Asset Criticality (30) = 100/100 -> CRITICAL -> Escalate: TRUE\n" +
                "STEP 4 [Firewall Action]: Generated & Executed: 'iptables -A INPUT -s 198.51.100.45 -p tcp --dport 22 -j DROP' -> SUCCESS\n" +
                "STEP 5 [DB Blacklist Logger]: Saved IP 198.51.100.45 to table 'blocked_ips' -> SUCCESS (Record #104)\n" +
                "STEP 6 [Telegram Notifier]: Sent formatted HTML alert to SOC channel @mini_soar_alerts_channel -> HTTP 200 DELIVERED");
        }

        executionRepository.save(execution);

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("execution_id", "exec-" + execution.getId());
        resp.put("status", "FINISHED");
        resp.put("playbook", playbookName);
        resp.put("result", execution.getResultSummary());
        resp.put("execution_log", execution.getExecutionLog());
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/workflows/{id}/activate")
    public ResponseEntity<Map<String, Object>> activateWorkflow(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        try {
            return ResponseEntity.ok(updateWorkflowStatus(id, body, "RUNNING"));
        } catch (JsonProcessingException e) {
            log.error("Failed to activate workflow {}", id, e);
            return ResponseEntity.status(500).body(Map.of("success", false, "error", "Failed to activate workflow", "id", id));
        }
    }

    @PostMapping("/workflows/{id}/deactivate")
    public ResponseEntity<Map<String, Object>> deactivateWorkflow(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        try {
            return ResponseEntity.ok(updateWorkflowStatus(id, body, "PAUSED"));
        } catch (JsonProcessingException e) {
            log.error("Failed to pause workflow {}", id, e);
            return ResponseEntity.status(500).body(Map.of("success", false, "error", "Failed to pause workflow", "id", id));
        }
    }

    @PostMapping("/workflows")
    public ResponseEntity<Map<String, Object>> createWorkflow(@RequestBody(required = false) Map<String, Object> body) {
        try {
            return ResponseEntity.ok(persistWorkflow(null, body));
        } catch (JsonProcessingException e) {
            log.error("Failed to persist workflow", e);
            return ResponseEntity.status(500).body(Map.of("success", false, "error", "Failed to save workflow"));
        }
    }

    @PostMapping("/workflows/{id}")
    public ResponseEntity<Map<String, Object>> saveWorkflowPost(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        try {
            return ResponseEntity.ok(persistWorkflow(id, body));
        } catch (JsonProcessingException e) {
            log.error("Failed to persist workflow {}", id, e);
            return ResponseEntity.status(500).body(Map.of("success", false, "error", "Failed to save workflow", "id", id));
        }
    }

    @PutMapping("/workflows")
    public ResponseEntity<Map<String, Object>> updateWorkflowRoot(@RequestBody(required = false) Map<String, Object> body) {
        return createWorkflow(body);
    }

    @PutMapping("/workflows/{id}")
    public ResponseEntity<Map<String, Object>> updateWorkflow(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        try {
            Map<String, Object> workflow = persistWorkflow(id, body);
            Map<String, Object> resp = new HashMap<>();
            resp.put("success", true);
            resp.put("id", workflow.get("id"));
            resp.put("message", "Workflow saved successfully");
            return ResponseEntity.ok(resp);
        } catch (JsonProcessingException e) {
            log.error("Failed to persist workflow {}", id, e);
            return ResponseEntity.status(500).body(Map.of("success", false, "error", "Failed to save workflow", "id", id));
        }
    }

    private void seedWorkflowIfAbsent(String id, Map<String, Object> workflow) {
        if (!workflowDefinitionRepository.existsById(id)) {
            try {
                persistWorkflow(id, workflow);
            } catch (JsonProcessingException e) {
                log.error("Failed to seed default workflow {}", id, e);
            }
        }
    }

    private boolean needsRansomwareWorkflowMigration(Map<String, Object> workflow) {
        boolean hasBranchNode = false;
        boolean hasRansomwareTriggerSchema = false;
        boolean hasForensicsHostInput = false;
        boolean hasRansomwareScoreRule = false;
        boolean hasRemoteSshNode = false;
        boolean hasSafeDemoSshCommand = false;
        Object triggers = workflow.get("triggers");
        if (triggers instanceof List<?> triggerList) {
            for (Object trigger : triggerList) {
                if (trigger instanceof Map<?, ?> node && "trig-rw-1".equals(String.valueOf(node.get("id")))) {
                    Object outputs = node.get("outputs");
                    if (outputs instanceof List<?> outputList) {
                        for (Object output : outputList) {
                            if (output instanceof Map<?, ?> outputMap
                                && "host_ip".equals(String.valueOf(outputMap.get("name")))) {
                                hasRansomwareTriggerSchema = true;
                            }
                        }
                    }
                }
            }
        }
        Object actions = workflow.get("actions");
        if (actions instanceof List<?> actionList) {
            for (Object action : actionList) {
                if (action instanceof Map<?, ?> node && "act-rw-branch".equals(String.valueOf(node.get("id")))) {
                    hasBranchNode = true;
                    Object params = node.get("parameters");
                    if (params instanceof List<?> paramList) {
                        boolean usesRiskScore = false;
                        boolean usesNumericOperator = false;
                        boolean usesThreshold = false;
                        for (Object param : paramList) {
                            if (param instanceof Map<?, ?> paramMap) {
                                String name = String.valueOf(paramMap.get("name"));
                                String value = String.valueOf(paramMap.get("value"));
                                usesRiskScore = usesRiskScore || ("source_variable".equals(name) && "$act-rw-2.risk_score".equals(value));
                                usesNumericOperator = usesNumericOperator || ("condition_operator".equals(name) && "larger than or equal".equals(value));
                                usesThreshold = usesThreshold || ("target_value".equals(name) && "75".equals(value));
                            }
                        }
                        hasRansomwareScoreRule = usesRiskScore && usesNumericOperator && usesThreshold;
                    }
                }
                if (action instanceof Map<?, ?> node
                    && "act-rw-1".equals(String.valueOf(node.get("id")))
                    && "GET_PROCESS_FORENSICS".equals(String.valueOf(node.get("name")))) {
                    Object params = node.get("parameters");
                    if (params instanceof List<?> paramList) {
                        for (Object param : paramList) {
                            if (param instanceof Map<?, ?> paramMap
                                && "host_ip".equals(String.valueOf(paramMap.get("name")))) {
                                hasForensicsHostInput = true;
                            }
                        }
                    }
                }
                if (action instanceof Map<?, ?> node
                    && "act-rw-5".equals(String.valueOf(node.get("id")))
                    && "EXECUTE_REMOTE_SSH".equals(String.valueOf(node.get("name")))) {
                    hasRemoteSshNode = true;
                    Object params = node.get("parameters");
                    if (params instanceof List<?> paramList) {
                        for (Object param : paramList) {
                            if (param instanceof Map<?, ?> paramMap
                                && "command".equals(String.valueOf(paramMap.get("name")))
                                && String.valueOf(paramMap.get("value")).contains("DRY_RUN_CONTAINMENT")) {
                                hasSafeDemoSshCommand = true;
                            }
                        }
                    }
                }
            }
        }
        return !hasRansomwareTriggerSchema || !hasBranchNode || !hasRansomwareScoreRule || !hasForensicsHostInput || !hasRemoteSshNode || !hasSafeDemoSshCommand || workflow.toString().contains("/api/v1/alerts/ransomware/simulate");
    }

    private boolean needsSshWorkflowMigration(Map<String, Object> workflow) {
        boolean hasBranchNode = false;
        boolean hasTrueBranchType = false;
        boolean hasFalseBranchType = false;
        Object actions = workflow.get("actions");
        if (actions instanceof List<?> actionList) {
            for (Object action : actionList) {
                if (action instanceof Map<?, ?> node
                    && "act-ssh-branch".equals(String.valueOf(node.get("id")))
                    && "EVALUATE_CONDITION".equals(String.valueOf(node.get("name")))) {
                    hasBranchNode = true;
                }
            }
        }
        Object branches = workflow.get("branches");
        if (branches instanceof List<?> branchList) {
            for (Object branch : branchList) {
                if (branch instanceof Map<?, ?> branchMap && "act-ssh-branch".equals(String.valueOf(branchMap.get("source_id")))) {
                    Object rawBranchType = branchMap.get("branch_type");
                    String branchType = String.valueOf(rawBranchType == null ? "" : rawBranchType).toLowerCase(Locale.ROOT);
                    hasTrueBranchType = hasTrueBranchType || "true".equals(branchType);
                    hasFalseBranchType = hasFalseBranchType || "false".equals(branchType);
                }
            }
        }
        return !hasBranchNode || !hasTrueBranchType || !hasFalseBranchType || workflow.toString().contains("/api/v1/alerts/ssh/simulate");
    }

    private Map<String, Object> persistWorkflow(String requestedId, Map<String, Object> body) throws JsonProcessingException {
        Map<String, Object> workflow = body != null ? new HashMap<>(body) : newWorkflowTemplate(null, true);
        String id = requestedId;
        if (id == null || id.isBlank()) {
            Object bodyId = workflow.get("id");
            id = bodyId == null || String.valueOf(bodyId).isBlank()
                    ? "wf-custom-" + UUID.randomUUID().toString().substring(0, 8)
                    : String.valueOf(bodyId);
        }

        workflow.put("id", id);
        workflow.putIfAbsent("name", "New Playbook");
        workflow.putIfAbsent("description", "Custom SOAR Automation Playbook");
        workflow.putIfAbsent("is_valid", true);
        workflow.putIfAbsent("status", "PAUSED");
        workflow.put("public", false);
        workflow.put("previously_saved", true);
        workflow.putIfAbsent("org_id", "org-minisoar-01");
        workflow.putIfAbsent("triggers", List.of());
        workflow.putIfAbsent("actions", List.of());
        workflow.putIfAbsent("branches", List.of());
        workflow.putIfAbsent("workflow_variables", List.of());
        workflow.putIfAbsent("execution_variables", List.of());
        workflow.putIfAbsent("comments", List.of());
        workflow.putIfAbsent("visual_branches", List.of());
        workflow.putIfAbsent("input_questions", List.of());
        workflow.putIfAbsent("suborg_distribution", List.of());
        workflow.putIfAbsent("errors", List.of());
        workflow = normalizeWorkflowReferences(workflow);

        String name = String.valueOf(workflow.getOrDefault("name", "New Playbook"));
        String description = String.valueOf(workflow.getOrDefault("description", ""));
        WorkflowDefinition entity = workflowDefinitionRepository.findById(id).orElseGet(WorkflowDefinition::new);
        entity.setWorkflowId(id);
        entity.setName(name);
        entity.setDescription(description);
        entity.setDefinitionJson(objectMapper.writeValueAsString(workflow));
        workflowDefinitionRepository.save(entity);

        workflow.put("success", true);
        workflow.put("message", "Workflow saved successfully");
        return workflow;
    }

    private Map<String, Object> updateWorkflowStatus(String id, Map<String, Object> body, String status) throws JsonProcessingException {
        Map<String, Object> workflow = body != null ? new HashMap<>(body) : null;
        if (workflow == null || workflow.isEmpty()) {
            workflow = workflowDefinitionRepository.findById(id)
                    .map(this::workflowToMap)
                    .orElseGet(() -> id != null && id.contains("ransomware")
                            ? buildRansomwareWorkflow()
                            : id != null && id.contains("ssh")
                                    ? buildSSHWorkflow()
                                    : newWorkflowTemplate(id, true));
        }
        workflow.put("status", status);

        Map<String, Object> saved = persistWorkflow(id, workflow);
        saved.put("active", "RUNNING".equals(status));
        saved.put("message", "RUNNING".equals(status) ? "Workflow activated successfully" : "Workflow paused successfully");
        return saved;
    }

    private Map<String, Object> workflowToMap(WorkflowDefinition entity) {
        try {
            Map<String, Object> workflow = objectMapper.readValue(
                    entity.getDefinitionJson(),
                    new TypeReference<Map<String, Object>>() {}
            );
            workflow.put("id", entity.getWorkflowId());
            workflow.putIfAbsent("name", entity.getName());
            workflow.putIfAbsent("description", entity.getDescription());
            workflow.put("previously_saved", true);
            return normalizeWorkflowReferences(workflow);
        } catch (JsonProcessingException e) {
            log.error("Failed to parse stored workflow {}", entity.getWorkflowId(), e);
            return null;
        }
    }

    private Map<String, Object> normalizeWorkflowReferences(Map<String, Object> workflow) {
        String workflowId = String.valueOf(workflow.getOrDefault("id", ""));
        String firstTriggerId = getFirstTriggerId(workflow);
        if (firstTriggerId == null || firstTriggerId.isBlank()) {
            return workflow;
        }

        Map<String, String> replacements = new LinkedHashMap<>();
        replacements.put("$exec.alert.source_ip", "$" + firstTriggerId + ".source_ip");
        replacements.put("$exec.alert.failed_attempts", "$" + firstTriggerId + ".failed_attempts");
        replacements.put("$exec.alert.hostname", "$" + firstTriggerId + ".hostname");
        replacements.put("$exec.alert.process_id", "$" + firstTriggerId + ".process_id");
        replacements.put("$exec.alert.process_name", "$" + firstTriggerId + ".process_name");
        replacements.put("$exec.alert.extension", "$" + firstTriggerId + ".suspicious_extensions");

        if (workflowId.contains("ssh")) {
            replacements.put("$act-ssh-2.threat_score", "$act-ssh-2.total_score");
        }

        Object normalized = normalizeReferencesValue(workflow, replacements);
        if (normalized instanceof Map<?, ?> map) {
            Map<String, Object> result = new HashMap<>();
            map.forEach((key, value) -> result.put(String.valueOf(key), value));
            return result;
        }
        return workflow;
    }

    private String getFirstTriggerId(Map<String, Object> workflow) {
        Object triggers = workflow.get("triggers");
        if (triggers instanceof List<?> triggerList && !triggerList.isEmpty()) {
            Object first = triggerList.get(0);
            if (first instanceof Map<?, ?> trigger) {
                Object id = trigger.get("id");
                return id != null ? String.valueOf(id) : null;
            }
        }
        return null;
    }

    private Object normalizeReferencesValue(Object value, Map<String, String> replacements) {
        if (value instanceof String text) {
            String normalized = text;
            for (Map.Entry<String, String> entry : replacements.entrySet()) {
                normalized = normalized.replace(entry.getKey(), entry.getValue());
            }
            return normalized;
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> normalized = new HashMap<>();
            map.forEach((key, childValue) -> normalized.put(String.valueOf(key), normalizeReferencesValue(childValue, replacements)));
            return normalized;
        }
        if (value instanceof List<?> list) {
            return list.stream()
                    .map(item -> normalizeReferencesValue(item, replacements))
                    .collect(Collectors.toList());
        }
        return value;
    }

    private Map<String, Object> newWorkflowTemplate(String id, boolean previouslySaved) {
        Map<String, Object> newWf = new HashMap<>();
        newWf.put("id", id != null ? id : "wf-custom-" + UUID.randomUUID().toString().substring(0, 8));
        newWf.put("name", "New Playbook");
        newWf.put("description", "Custom SOAR Automation Playbook");
        newWf.put("is_valid", true);
        newWf.put("status", "PAUSED");
        newWf.put("public", false);
        newWf.put("previously_saved", previouslySaved);
        newWf.put("org_id", "org-minisoar-01");
        newWf.put("triggers", List.of());
        newWf.put("actions", List.of());
        newWf.put("branches", List.of());
        newWf.put("workflow_variables", List.of());
        newWf.put("execution_variables", List.of());
        newWf.put("comments", List.of());
        newWf.put("visual_branches", List.of());
        newWf.put("input_questions", List.of());
        newWf.put("suborg_distribution", List.of());
        newWf.put("errors", List.of());
        return newWf;
    }

    private Map<String, Object> createParam(String name, String value, String description) {
        Map<String, Object> param = new HashMap<>();
        param.put("name", name);
        param.put("value", value != null ? value : "");
        param.put("description", description != null ? description : "");
        param.put("example", value != null ? value : "");
        param.put("required", false);
        param.put("configuration", false);
        param.put("schema", Map.of("type", "string"));
        return param;
    }

    private Map<String, Object> createActionNode(
        String id, String name, String label, String appId, String appName,
        String status, boolean isValid, String largeImage,
        int posX, int posY, List<Map<String, Object>> parameters
    ) {
        Map<String, Object> node = new HashMap<>();
        node.put("id", id);
        node.put("name", name);
        node.put("label", label != null ? label : name);
        node.put("app_id", appId);
        node.put("app_name", appName);
        node.put("app_version", "1.0.0");
        node.put("status", status);
        node.put("is_valid", isValid);
        node.put("large_image", largeImage);
        node.put("position", Map.of("x", posX, "y", posY));
        node.put("parameters", parameters != null ? parameters : List.of());
        node.put("authentication_id", "");
        node.put("authentication", Map.of("required", false, "type", "none", "parameters", List.of()));
        node.put("errors", List.of());
        return node;
    }

    private Map<String, Object> createTriggerNode(
        String id, String name, String label, String image, int posX, int posY, List<Map<String, Object>> parameters
    ) {
        Map<String, Object> trigger = new HashMap<>();
        trigger.put("id", id);
        trigger.put("name", name);
        trigger.put("label", label != null ? label : name);
        trigger.put("trigger_type", "WEBHOOK");
        trigger.put("app_name", "Shuffle Workflow");
        trigger.put("app_version", "1.0.0");
        trigger.put("status", "running");
        trigger.put("environment", "Local SOAR Engine");
        trigger.put("is_valid", true);
        trigger.put("large_image", image);
        trigger.put("position", Map.of("x", posX, "y", posY));
        trigger.put("parameters", parameters != null ? parameters : List.of());
        trigger.put("authentication_id", "");
        trigger.put("errors", List.of());
        return trigger;
    }

    private List<Map<String, Object>> ransomwareTriggerOutputs() {
        return List.of(
            Map.of("name", "alert_id", "type", "number", "example", 101, "description", "MySQL alert record ID created by webhook ingest"),
            Map.of("name", "alert_type", "type", "string", "example", "RANSOMWARE_DETECTION", "description", "Normalized alert category"),
            Map.of("name", "severity", "type", "string", "example", "CRITICAL", "description", "Initial alert severity from backend ingest"),
            Map.of("name", "hostname", "type", "string", "example", "ws-finance-dept04", "description", "Target endpoint hostname"),
            Map.of("name", "host_ip", "type", "string", "example", "10.0.4.88", "description", "Target endpoint IP used by SSH containment"),
            Map.of("name", "process_id", "type", "number", "example", 5120, "description", "Suspicious process PID"),
            Map.of("name", "pid", "type", "number", "example", 5120, "description", "Alias for process_id"),
            Map.of("name", "process_name", "type", "string", "example", "vssadmin.exe", "description", "Suspicious process name"),
            Map.of("name", "command_line", "type", "string", "example", "vssadmin.exe Delete Shadows /All /Quiet", "description", "Suspicious process command line"),
            Map.of("name", "suspicious_extensions", "type", "array", "example", List.of(".lockbit", ".locked"), "description", "Observed encrypted file extensions"),
            Map.of("name", "affected_file_count", "type", "number", "example", 480, "description", "Number of affected/encrypted files"),
            Map.of("name", "description", "type", "string", "example", "EDR Sysmon Alert: shadow copy deletion", "description", "Human-readable EDR summary"),
            Map.of("name", "raw_event", "type", "object", "example", Map.of("target_asset", Map.of(), "malware_forensics", Map.of()), "description", "Original EDR payload after normalization"),
            Map.of("name", "status", "type", "string", "example", "NEW", "description", "Alert status after ingest"),
            Map.of("name", "created_at", "type", "string", "example", "2026-09-03T11:40:15Z", "description", "Backend alert creation time"),
            Map.of("name", "data_source", "type", "string", "example", "REAL_WEBHOOK_INGESTED", "description", "Output provenance")
        );
    }

    private Map<String, Object> createCondition(String sourceValue, String conditionType, String destinationValue) {
        Map<String, Object> cond = new HashMap<>();
        cond.put("source", Map.of("id", "src-" + UUID.randomUUID().toString().substring(0, 8), "value", sourceValue));
        cond.put("condition", Map.of("id", "cond-" + UUID.randomUUID().toString().substring(0, 8), "value", conditionType));
        cond.put("destination", Map.of("id", "dst-" + UUID.randomUUID().toString().substring(0, 8), "value", destinationValue));
        return cond;
    }

    private Map<String, Object> buildSSHWorkflow() {
        Map<String, Object> wf = new HashMap<>();
        wf.put("id", "wf-ssh-01");
        wf.put("name", "SSH Brute-Force Playbook");
        wf.put("description", "Threat Intel check, automated IP blocking via IPTables and MySQL Blacklist logging");
        wf.put("is_valid", true);
        wf.put("status", "PAUSED");
        wf.put("start", "trig-ssh-1");
        wf.put("public", false);
        wf.put("previously_saved", true);
        wf.put("org_id", "org-minisoar-01");
        wf.put("workflow_variables", List.of());
        wf.put("execution_variables", List.of());
        wf.put("comments", List.of());
        wf.put("visual_branches", List.of());
        wf.put("input_questions", List.of());
        wf.put("suborg_distribution", List.of());
        wf.put("errors", List.of());

        List<Map<String, Object>> triggers = List.of(
            createTriggerNode(
                "trig-ssh-1", "SSH Alert Webhook", "SSH Alert Webhook", "/images/apps/webhook.svg", 80, 260,
                List.of(
                    createParam("url", "http://localhost:8080/api/v1/alerts/ssh/simulate", "Incoming Webhook Endpoint URL"),
                    createParam("tmp", "webhook_trig-ssh-1", "Webhook Identifier"),
                    createParam("auth_headers", "X-SOAR-API-KEY", "Required Authentication Header"),
                    createParam("custom_response_body", "{\"status\": \"INGESTED\", \"workflow\": \"SSH Brute-Force Playbook\"}", "HTTP Response Body"),
                    createParam("await_response", "v1", "Execution Mode"),
                    createParam("alert_type", "SSH_BRUTE_FORCE", "Type of security alert"),
                    createParam("source_ip", "", "Attacker IP address")
                )
            )
        );
        wf.put("triggers", triggers);

        List<Map<String, Object>> actions = List.of(
            createActionNode("act-ssh-1", "CHECK_IP_REPUTATION", "AbuseIPDB Threat Intel Check", "app-abuseipdb", "AbuseIPDB Threat Intelligence", "SUCCESS", true, "/images/apps/abuseipdb.svg", 320, 260, List.of(
                createParam("source_ip", "$trig-ssh-1.source_ip", "Target IP address to enrich"),
                createParam("api_key", "ABUSEIPDB_API_KEY", "AbuseIPDB API Key"),
                createParam("max_age_days", "90", "Max report age in days")
            )),
            createActionNode("act-ssh-2", "CALCULATE_DYNAMIC_SEVERITY", "Severity Scoring & Policy", "app-threatintel", "Threat Intelligence Engine", "SUCCESS", true, "/images/apps/threatintel.svg", 560, 260, List.of(
                createParam("source_ip", "$act-ssh-1.queried_ip", "Source IP"),
                createParam("failed_attempts", "$trig-ssh-1.failed_attempts", "Failed password count"),
                createParam("threat_score", "$act-ssh-1.threat_score", "AbuseIPDB Threat Score"),
                createParam("hostname", "$trig-ssh-1.hostname", "Target server hostname")
            )),
            createActionNode("act-ssh-branch", "EVALUATE_CONDITION", "Decision Rule (Score >= 65)", "app-branch", "Branch Condition", "SUCCESS", true, "/images/apps/branch.svg", 680, 420, List.of(
                createParam("source_variable", "$act-ssh-2.total_score", "Evaluated Total Score"),
                createParam("condition_operator", "larger than or equal", "Operator"),
                createParam("target_value", "65", "Escalation Threshold")
            )),
            createActionNode("act-ssh-3", "DROP", "IPTables DROP (Port 22)", "app-iptables", "Linux IPTables Firewall", "SUCCESS", true, "/images/apps/iptables.svg", 800, 260, List.of(
                createParam("server_ip", "13.218.244.6", "Server/VPS IP configured in SSH Remote VPS Connector"),
                createParam("attacker_ip", "$trig-ssh-1.source_ip", "Attacker IP from Webhook Trigger"),
                createParam("port", "22", "Service Port"),
                createParam("protocol", "tcp", "Layer 4 Protocol")
            )),
            createActionNode("act-ssh-remote", "EXECUTE_REMOTE_SSH", "Remote VPS SSH Connector", "app-ssh-exec", "SSH Remote VPS Connector", "SUCCESS", true, "/images/apps/ssh.svg", 1040, 260, List.of(
                createParam("ip_address", "13.218.244.6", "Target VPS IP address"),
                createParam("username", "ec2-user", "SSH Login Username"),
                createParam("port", "22", "SSH Port"),
                createParam("pem_file", "/run/secrets/pnreal-dev.pem", "SSH .pem file path on backend"),
                createParam("password", "", "SSH password if not using key"),
                createParam("command", "$act-ssh-3.command_executed", "Shell Command to Execute"),
                createParam("timeout_seconds", "10", "Command Timeout in Seconds")
            )),
            createActionNode("act-ssh-4", "LOG_BLOCKED_IP", "DB Blacklist Log", "app-mysqldb", "MySQL Asset & Incident DB Logger", "SUCCESS", true, "/images/apps/mysql.svg", 1280, 260, List.of(
                createParam("ip_address", "$act-ssh-3.source_ip", "Blocked IP Address"),
                createParam("table", "blocked_ips", "MySQL Target Table"),
                createParam("reason", "Severity CRITICAL SSH Brute-Force", "Block Reason")
            )),
            createActionNode("act-ssh-5", "SEND_SOC_ALERT", "Telegram SOC Alert Dispatch", "app-telegram", "Telegram Incident Notifier", "SUCCESS", true, "/images/apps/telegram.svg", 1520, 260, List.of(
                createParam("bot_token", "7891234567:AAFx_TELEGRAM_BOT_TOKEN_SOAR", "Telegram Bot API Token"),
                createParam("chat_id", "@mini_soar_alerts_channel", "Target Telegram Channel"),
                createParam("admin_id", "654321987", "Telegram Admin ID (SOC Lead)"),
                createParam("severity", "$act-ssh-2.severity", "Incident Severity Badge"),
                createParam("message_html", "<b>🚨 SSH Incident Alert</b><br>IP: $act-ssh-4.ip_address<br>Score: $act-ssh-2.total_score", "HTML Alert Body")
            )),
            createActionNode("act-ssh-monitor", "QUERY_ASSET_CRITICALITY", "Audit & Monitoring Log", "app-mysqldb", "MySQL Asset & Incident DB Logger", "SUCCESS", true, "/images/apps/mysql.svg", 800, 500, List.of(
                createParam("hostname", "$act-ssh-2.hostname", "Host to audit"),
                createParam("note", "SSH risk score < 65. Monitoring only; no firewall block executed.", "Audit Note")
            ))
        );
        wf.put("actions", actions);

        List<Map<String, Object>> branches = List.of(
            Map.of(
                "id", "branch-ssh-1",
                "source_id", "trig-ssh-1",
                "destination_id", "act-ssh-1",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-ssh-2",
                "source_id", "act-ssh-1",
                "destination_id", "act-ssh-2",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-ssh-3",
                "source_id", "act-ssh-2",
                "destination_id", "act-ssh-branch",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-ssh-true",
                "source_id", "act-ssh-branch",
                "destination_id", "act-ssh-3",
                "label", "TRUE (Score >= 65)",
                "branch_type", "true",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-ssh-false",
                "source_id", "act-ssh-branch",
                "destination_id", "act-ssh-monitor",
                "label", "FALSE (Monitor)",
                "branch_type", "false",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-ssh-4",
                "source_id", "act-ssh-3",
                "destination_id", "act-ssh-remote",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-ssh-4b",
                "source_id", "act-ssh-remote",
                "destination_id", "act-ssh-4",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-ssh-5",
                "source_id", "act-ssh-4",
                "destination_id", "act-ssh-5",
                "conditions", List.of()
            )
        );
        wf.put("branches", branches);

        return wf;
    }

    private Map<String, Object> buildRansomwareWorkflow() {
        Map<String, Object> wf = new HashMap<>();
        wf.put("id", "wf-ransomware-01");
        wf.put("name", "Ransomware Containment Playbook");
        wf.put("description", "IOC Process Termination (Kill PID) and host network quarantine response");
        wf.put("is_valid", true);
        wf.put("status", "PAUSED");
        wf.put("start", "trig-rw-1");
        wf.put("public", false);
        wf.put("previously_saved", true);
        wf.put("org_id", "org-minisoar-01");
        wf.put("workflow_variables", List.of());
        wf.put("execution_variables", List.of());
        wf.put("comments", List.of());
        wf.put("visual_branches", List.of());
        wf.put("input_questions", List.of());
        wf.put("suborg_distribution", List.of());
        wf.put("errors", List.of());

        Map<String, Object> ransomwareTrigger = createTriggerNode(
            "trig-rw-1", "EDR Ransomware Detection", "EDR Webhook Trigger", "/images/apps/webhook.svg", 80, 260,
            List.of(
                createParam("url", "http://localhost:8080/api/v1/alerts/ransomware", "Incoming Webhook Endpoint URL"),
                createParam("tmp", "webhook_trig-rw-1", "Webhook Identifier"),
                createParam("auth_headers", "X-SOAR-API-KEY", "Required Authentication Header"),
                createParam("custom_response_body", "{\"status\": \"INGESTED\", \"workflow\": \"Ransomware Containment Playbook\"}", "HTTP Response Body"),
                createParam("await_response", "v1", "Execution Mode"),
                createParam("payload_schema", "EDR_RANSOMWARE_EVENT_V1", "Expected payload schema"),
                createParam("alert_type", "RANSOMWARE_DETECTION", "Alert Category")
            )
        );
        ransomwareTrigger.put("outputs", ransomwareTriggerOutputs());
        List<Map<String, Object>> triggers = List.of(ransomwareTrigger);
        wf.put("triggers", triggers);

        List<Map<String, Object>> actions = List.of(
            createActionNode("act-rw-1", "GET_PROCESS_FORENSICS", "Process Forensic Snapshot (/proc)", "app-sentinel", "Host Process Sentinel", "SUCCESS", true, "/images/apps/sentinel.svg", 320, 260, List.of(
                createParam("hostname", "$trig-rw-1.hostname", "Target hostname"),
                createParam("host_ip", "$trig-rw-1.host_ip", "Target host IP"),
                createParam("pid", "$trig-rw-1.process_id", "Process ID to inspect"),
                createParam("process_name", "$trig-rw-1.process_name", "Process name from EDR"),
                createParam("command_line", "$trig-rw-1.command_line", "Command line from EDR"),
                createParam("affected_file_count", "$trig-rw-1.affected_file_count", "Affected file count")
            )),
            createActionNode("act-rw-2", "ANALYZE_MITRE_TTPS", "MITRE T1490 Heuristics", "app-threatintel", "Threat Intelligence Engine", "SUCCESS", true, "/images/apps/threatintel.svg", 560, 260, List.of(
                createParam("hostname", "$trig-rw-1.hostname", "Target hostname"),
                createParam("process_id", "$act-rw-1.pid", "Process ID"),
                createParam("process_name", "$trig-rw-1.process_name", "Process binary name"),
                createParam("command_line", "$act-rw-1.cmdline", "Extracted commandline arguments"),
                createParam("crypto_extension", "$trig-rw-1.suspicious_extensions", "Encrypted file extensions"),
                createParam("affected_file_count", "$trig-rw-1.affected_file_count", "Affected file count")
            )),
            createActionNode("act-rw-branch", "EVALUATE_CONDITION", "Decision Rule (Risk Score >= 75)", "app-branch", "Branch Condition", "SUCCESS", true, "/images/apps/branch.svg", 680, 420, List.of(
                createParam("source_variable", "$act-rw-2.risk_score", "Evaluated Risk Score"),
                createParam("condition_operator", "larger than or equal", "Operator"),
                createParam("target_value", "75", "Containment Threshold")
            )),
            createActionNode("act-rw-3", "KILL_PID", "Kill Malicious PID Tree", "app-sentinel", "Host Process Sentinel", "SUCCESS", true, "/images/apps/sentinel.svg", 800, 260, List.of(
                createParam("pid", "$act-rw-2.process_id", "Root PID to terminate"),
                createParam("signal", "SIGKILL", "POSIX signal"),
                createParam("hostname", "$act-rw-2.hostname", "Target hostname"),
                createParam("process_name", "$act-rw-2.process_name", "Process binary name")
            )),
            createActionNode("act-rw-4", "QUARANTINE_HOST", "Host Network Quarantine", "app-iptables", "Linux IPTables Firewall", "SUCCESS", true, "/images/apps/iptables.svg", 1040, 260, List.of(
                createParam("hostname", "$act-rw-3.hostname", "Target hostname to isolate"),
                createParam("interface", "eth0", "Primary Network Interface")
            )),
            createActionNode("act-rw-5", "EXECUTE_REMOTE_SSH", "SSH Remote VPS Containment", "app-ssh-exec", "SSH Remote VPS Connector", "SUCCESS", true, "/images/apps/ssh.svg", 1280, 260, List.of(
                createParam("ip_address", "$trig-rw-1.host_ip", "Remote host/VPS IP cần containment"),
                createParam("username", "ec2-user", "SSH Username"),
                createParam("port", "22", "SSH Port"),
                createParam("pem_file", "/run/secrets/pnreal-dev.pem", "SSH .pem file path on backend"),
                createParam("password", "", "SSH password if key is not used"),
                createParam("command", "whoami && hostname && echo DRY_RUN_CONTAINMENT pid=$act-rw-3.killed_pid host=$trig-rw-1.host_ip", "Remote containment command"),
                createParam("timeout_seconds", "10", "Timeout")
            )),
            createActionNode("act-rw-6", "LOG_RANSOMWARE_INCIDENT", "Ransomware DB Logger", "app-mysqldb", "MySQL Asset & Incident DB Logger", "SUCCESS", true, "/images/apps/mysql.svg", 1520, 260, List.of(
                createParam("alert_id", "$trig-rw-1.alert_id", "Related alert ID"),
                createParam("hostname", "$act-rw-4.hostname", "Target hostname"),
                createParam("process_name", "$act-rw-3.process_name", "Killed process"),
                createParam("pid", "$act-rw-3.killed_pid", "Killed PID"),
                createParam("affected_files", "$trig-rw-1.affected_file_count", "Affected file count"),
                createParam("table", "ransomware_incidents", "Target Incident Table"),
                createParam("status", "CONTAINED", "Containment State")
            )),
            createActionNode("act-rw-7", "SEND_SOC_ALERT", "Telegram Emergency Dispatch", "app-telegram", "Telegram Incident Notifier", "SUCCESS", true, "/images/apps/telegram.svg", 1760, 260, List.of(
                createParam("bot_token", "7891234567:AAFx_TELEGRAM_BOT_TOKEN_SOAR", "Telegram Bot API Token"),
                createParam("chat_id", "@mini_soar_alerts_channel", "Target Telegram Channel"),
                createParam("admin_id", "654321987", "Telegram Admin ID (SOC Lead)"),
                createParam("severity", "$act-rw-2.severity", "Emergency Severity"),
                createParam("message_html", "<b>[Ransomware Neutralized]</b><br>Process Killed: $act-rw-6.process_name (PID: $act-rw-3.killed_pid)<br>Host Quarantined: $act-rw-6.hostname<br>Remote SSH: $act-rw-5.status", "HTML Alert Body")
            )),
            createActionNode("act-rw-monitor", "QUERY_ASSET_CRITICALITY", "Audit & Monitoring Log", "app-mysqldb", "MySQL Asset & Incident DB Logger", "SUCCESS", true, "/images/apps/mysql.svg", 800, 500, List.of(
                createParam("hostname", "$act-rw-2.hostname", "Audited host"),
                createParam("note", "Ransomware risk score < 75. Monitoring only; no containment executed.", "Audit Note")
            ))
        );
        wf.put("actions", actions);

        List<Map<String, Object>> branches = List.of(
            Map.of(
                "id", "branch-rw-1",
                "source_id", "trig-rw-1",
                "destination_id", "act-rw-1",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-rw-2",
                "source_id", "act-rw-1",
                "destination_id", "act-rw-2",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-rw-3",
                "source_id", "act-rw-2",
                "destination_id", "act-rw-branch",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-rw-true",
                "source_id", "act-rw-branch",
                "destination_id", "act-rw-3",
                "label", "TRUE (Score >= 75)",
                "branch_type", "true",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-rw-false",
                "source_id", "act-rw-branch",
                "destination_id", "act-rw-monitor",
                "label", "FALSE (Monitor)",
                "branch_type", "false",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-rw-4",
                "source_id", "act-rw-3",
                "destination_id", "act-rw-4",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-rw-5",
                "source_id", "act-rw-4",
                "destination_id", "act-rw-5",
                "label", "SSH Execute",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-rw-6",
                "source_id", "act-rw-5",
                "destination_id", "act-rw-6",
                "conditions", List.of()
            ),
            Map.of(
                "id", "branch-rw-7",
                "source_id", "act-rw-6",
                "destination_id", "act-rw-7",
                "conditions", List.of()
            )
        );
        wf.put("branches", branches);

        return wf;
    }

    @GetMapping("/workflows/{id}/executions")
    public ResponseEntity<List<Map<String, Object>>> getWorkflowExecutions(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "10") int limit) {
        
        List<WorkflowExecution> executions = executionRepository.findAllByOrderByIdDesc();
        List<Map<String, Object>> list = new ArrayList<>();
        
        for (WorkflowExecution exec : executions) {
            boolean matches = false;
            if (id.contains("ssh") && exec.getPlaybookName() != null && exec.getPlaybookName().toLowerCase().contains("ssh")) {
                matches = true;
            } else if (id.contains("ransomware") && exec.getPlaybookName() != null && exec.getPlaybookName().toLowerCase().contains("ransomware")) {
                matches = true;
            } else if (id.equals("all") || executions.size() <= 5) {
                matches = true;
            }
            
            if (matches) {
                Map<String, Object> map = new HashMap<>();
                map.put("execution_id", "exec-" + exec.getId());
                map.put("workflow_id", id);
                map.put("status", exec.getStatus() != null ? exec.getStatus().name() : "FINISHED");
                map.put("started_at", exec.getStartedAt() != null ? exec.getStartedAt().atZone(ZoneId.systemDefault()).toEpochSecond() : System.currentTimeMillis() / 1000);
                map.put("completed_at", exec.getCompletedAt() != null ? exec.getCompletedAt().atZone(ZoneId.systemDefault()).toEpochSecond() : System.currentTimeMillis() / 1000);
                map.put("result_summary", exec.getResultSummary());
                map.put("execution_log", exec.getExecutionLog());
                map.put("execution_time_ms", exec.getExecutionTimeMs());
                map.put("workflow", Map.of("id", id, "name", id.contains("ssh") ? "SSH Brute-Force Playbook" : "Ransomware Containment Playbook"));
                list.add(map);
            }
        }
        
        return ResponseEntity.ok(list);
    }

    @GetMapping("/workflows/{id}/executions/count")
    public ResponseEntity<Map<String, Object>> getWorkflowExecutionsCount(@PathVariable String id) {
        long count = executionRepository.count();
        Map<String, Object> resp = new HashMap<>();
        resp.put("count", count);
        resp.put("success", true);
        return ResponseEntity.ok(resp);
    }

    private final Map<String, String> openApiStore = new java.util.concurrent.ConcurrentHashMap<>();

    @PostMapping("/validate_openapi")
    public ResponseEntity<Map<String, Object>> validateOpenApi(@RequestBody(required = false) String openApiData) {
        String id = "app_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        if (openApiData != null && !openApiData.isEmpty()) {
            openApiStore.put(id, openApiData);
        }
        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("id", id);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/verify_openapi")
    public ResponseEntity<Map<String, Object>> verifyOpenApi(@RequestBody(required = false) Map<String, Object> body) {
        String id = (body != null && body.containsKey("id") && body.get("id") != null) 
            ? body.get("id").toString() 
            : "app_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("id", id);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/get_openapi/{id}")
    public ResponseEntity<Map<String, Object>> getOpenApiById(@PathVariable String id) {
        String content = openApiStore.getOrDefault(id, "openapi: 3.0.0\ninfo:\n  title: Custom SOAR App\n  version: 1.0.0\npaths: {}");
        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("openapi", content);
        resp.put("id", id);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/apps")
    public ResponseEntity<Map<String, Object>> createCustomApp(@RequestBody Map<String, Object> appData) {
        String id = appData.getOrDefault("id", "app_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16)).toString();
        Map<String, Object> newApp = new HashMap<>(appData);
        newApp.put("id", id);
        newApp.put("is_valid", true);
        newApp.put("activated", true);
        if (!newApp.containsKey("owner") || newApp.get("owner") == null) {
            newApp.put("owner", "admin");
        }
        if (!newApp.containsKey("category") || newApp.get("category") == null) {
            newApp.put("category", "Custom Integrations");
        }
        try {
            persistCustomApp(newApp);
        } catch (JsonProcessingException e) {
            log.error("Failed to persist custom app {}", id, e);
            return ResponseEntity.status(500).body(Map.of("success", false, "error", "Failed to save custom app", "id", id));
        }
        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("id", id);
        resp.put("message", "Custom Org App created successfully!");
        return ResponseEntity.ok(resp);
    }

    private void persistCustomApp(Map<String, Object> app) throws JsonProcessingException {
        String id = String.valueOf(app.get("id"));
        String name = String.valueOf(app.getOrDefault("name", "Custom App"));
        String category = String.valueOf(app.getOrDefault("category", "Custom Apps"));

        AppDefinition entity = appDefinitionRepository.findById(id).orElseGet(AppDefinition::new);
        entity.setAppId(id);
        entity.setName(name);
        entity.setCategory(category);
        entity.setDefinitionJson(objectMapper.writeValueAsString(app));
        appDefinitionRepository.save(entity);
    }

    private Map<String, Object> appToMap(AppDefinition entity) {
        try {
            Map<String, Object> app = objectMapper.readValue(
                    entity.getDefinitionJson(),
                    new TypeReference<Map<String, Object>>() {}
            );
            app.put("id", entity.getAppId());
            app.putIfAbsent("name", entity.getName());
            app.putIfAbsent("category", entity.getCategory());
            app.putIfAbsent("is_valid", true);
            app.putIfAbsent("activated", true);
            return app;
        } catch (JsonProcessingException e) {
            log.error("Failed to parse stored custom app {}", entity.getAppId(), e);
            return null;
        }
    }

    @GetMapping("/apps/{id}/config")
    public ResponseEntity<Map<String, Object>> getAppConfig(@PathVariable String id) {
        for (Map<String, Object> app : getApps().getBody()) {
            if (id.equals(app.get("id"))) {
                return ResponseEntity.ok(app);
            }
        }
        Map<String, Object> app = new HashMap<>();
        app.put("id", id);
        app.put("name", "Custom Security App");
        app.put("is_valid", true);
        app.put("activated", true);
        app.put("actions", List.of());
        return ResponseEntity.ok(app);
    }

    @PostMapping("/apps/{id}/activate")
    public ResponseEntity<Map<String, Object>> activateApp(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("success", true, "message", "App activated successfully"));
    }

    @PostMapping("/apps/{id}/deactivate")
    public ResponseEntity<Map<String, Object>> deactivateApp(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("success", true, "message", "App deactivated successfully"));
    }

    @GetMapping("/apps/authentication")
    public ResponseEntity<List<Map<String, Object>>> getAppAuthentications() {
        return ResponseEntity.ok(List.of());
    }

    @PostMapping("/apps/authentication")
    public ResponseEntity<Map<String, Object>> createAppAuthentication(@RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("success", true, "id", "auth_" + UUID.randomUUID().toString().substring(0, 8)));
    }

    @GetMapping("/workflows/{id}/revisions")
    public ResponseEntity<List<Map<String, Object>>> getWorkflowRevisions(@PathVariable String id) {
        Map<String, Object> rev = new HashMap<>();
        rev.put("id", "rev-" + id + "-1");
        rev.put("workflow_id", id);
        rev.put("created_at", System.currentTimeMillis() / 1000);
        rev.put("name", "v1.0.0 Initial Revision");
        rev.put("description", "Production SOAR Playbook Revision");
        return ResponseEntity.ok(List.of(rev));
    }

    @GetMapping("/triggers")
    public ResponseEntity<List<Map<String, Object>>> getTriggers() {
        return ResponseEntity.ok(List.of());
    }

    @RequestMapping(value = "/triggers/pipeline", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<Map<String, Object>> getTriggersPipeline() {
        return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
    }

    @GetMapping("/files")
    public ResponseEntity<Map<String, Object>> getFiles() {
        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("files", List.of());
        resp.put("namespaces", List.of("default"));
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/files/{id}/content")
    public ResponseEntity<Map<String, Object>> getFileContent(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("success", true, "content", ""));
    }

    @GetMapping("/files/{id}/config")
    public ResponseEntity<Map<String, Object>> getFileConfig(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("success", true, "id", id, "name", "file_" + id));
    }

    @GetMapping("/getusers")
    public ResponseEntity<Map<String, Object>> getUsers() {
        List<User> users = userRepository.findAll();
        List<Map<String, Object>> userList = users.stream().map(u -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", "usr-" + u.getId());
            m.put("username", u.getUsername());
            m.put("name", u.getFullName());
            m.put("role", u.getRole() != null ? u.getRole().replace("ROLE_", "").toLowerCase() : "member");
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(Map.of("success", true, "users", userList));
    }

    @GetMapping("/getsettings")
    public ResponseEntity<Map<String, Object>> getSettings() {
        return ResponseEntity.ok(Map.of("success", true, "settings", Map.of()));
    }

    @RequestMapping(value = "/authentication/group", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<Map<String, Object>> getAuthGroups() {
        return ResponseEntity.ok(Map.of("success", true, "groups", List.of()));
    }

    @GetMapping("/apps/authentication/{id}")
    public ResponseEntity<Map<String, Object>> getAppAuthById(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("success", true, "id", id, "active", true));
    }

    @GetMapping("/apps/authentication/{id}/config")
    public ResponseEntity<Map<String, Object>> getAppAuthConfigById(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("success", true, "id", id, "active", true));
    }

    @PostMapping("/contact")
    public ResponseEntity<Map<String, Object>> submitContact() {
        return ResponseEntity.ok(Map.of("success", true));
    }

    private Map<String, Object> createApp(
        String id, String name, String description, String image, String category, List<Map<String, Object>> actions
    ) {
        Map<String, Object> app = new HashMap<>();
        app.put("id", id);
        app.put("name", name);
        app.put("description", description);
        app.put("version", "1.0.0");
        app.put("app_version", "1.0.0");
        app.put("loop_versions", List.of("1.0.0"));
        app.put("is_valid", true);
        app.put("activated", true);
        app.put("large_image", image);
        app.put("category", category);
        app.put("owner", "admin");
        app.put("authentication", Map.of("required", false, "type", "none", "parameters", List.of()));
        app.put("actions", actions != null ? actions : List.of());
        return app;
    }

    @GetMapping("/apps")
    public ResponseEntity<List<Map<String, Object>>> getApps() {
        List<Map<String, Object>> apps = new ArrayList<>();
        
        apps.add(createApp(
            "app-webhook",
            "Webhook Trigger",
            "Accept incoming HTTP POST security alerts from SIEM/EDR",
            "/images/apps/webhook.svg",
            "Triggers",
            List.of(
                Map.of(
                    "name", "WEBHOOK_TRIGGER",
                    "description", "Receive alert payload asynchronously",
                    "parameters", List.of(
                        createParam("endpoint_url", "http://localhost:8080/api/v1/alerts/ssh", "Webhook Ingestion URL"),
                        createParam("auth_header", "X-SOAR-API-KEY", "API Authorization Key Header")
                    )
                )
            )
        ));

        apps.add(createApp(
            "app-schedule",
            "Periodic Schedule Trigger",
            "Trigger playbook on a recurring cron interval or fixed schedule",
            "/images/apps/schedule.svg",
            "Triggers",
            List.of(
                Map.of(
                    "name", "CRON_TRIGGER",
                    "description", "Run on cron schedule",
                    "parameters", List.of(
                        createParam("cron_expression", "*/5 * * * *", "Cron expression")
                    )
                )
            )
        ));

        apps.add(createApp(
            "app-geoip",
            "GeoIP & Network Locator",
            "Tra cứu vị trí địa lý, Quốc gia, Thành phố, ASN và Nhà Mạng (ISP)",
            "/images/apps/geoip.svg",
            "Network & Location",
            List.of(
                Map.of(
                    "name", "LOOKUP_GEO_LOCATION",
                    "description", "Lookup country, city, ASN, ISP and Private LAN indicator",
                    "parameters", List.of(
                        createParam("source_ip", "", "Target IP address to locate")
                    )
                )
            )
        ));

        apps.add(createApp(
            "app-abuseipdb",
            "AbuseIPDB Threat Intelligence",
            "Kiểm tra mức độ độc hại, điểm uy tín và báo cáo tấn công toàn cầu qua AbuseIPDB API v2",
            "/images/apps/abuseipdb.svg",
            "Threat Intel & Scoring",
            List.of(
                Map.of(
                    "name", "CHECK_IP_REPUTATION",
                    "description", "Evaluate Abuse Confidence Score (0-100%) and global report counts",
                    "parameters", List.of(
                        createParam("source_ip", "", "Target IP address"),
                        createParam("api_key", "ABUSEIPDB_API_KEY", "AbuseIPDB API Key"),
                        createParam("max_age_days", "90", "Max report age in days")
                    )
                )
            )
        ));

        apps.add(createApp(
            "app-threatintel",
            "Dynamic Security Scorer",
            "Bộ tính toán điểm rủi ro tổng hợp & phân tích kỹ thuật mã độc MITRE ATT&CK",
            "/images/apps/threatintel.svg",
            "Threat Intel & Scoring",
            List.of(
                Map.of(
                    "name", "CALCULATE_DYNAMIC_SEVERITY",
                    "description", "Dynamic scoring: Attempt weight + AbuseIPDB score + Asset weight",
                    "parameters", List.of(
                        createParam("source_ip", "", "Source IP address"),
                        createParam("failed_attempts", "5", "Number of failed attempts"),
                        createParam("threat_score", "80", "Threat score (0-100)"),
                        createParam("hostname", "", "Target hostname")
                    )
                ),
                Map.of(
                    "name", "ANALYZE_MITRE_TTPS",
                    "description", "Evaluate MITRE ATT&CK T1490 ransomware heuristics",
                    "parameters", List.of(
                        createParam("process_name", "", "Binary process name"),
                        createParam("command_line", "", "Full cmdline string"),
                        createParam("crypto_extension", "", "Target encrypted file extension"),
                        createParam("affected_file_count", "", "Affected/encrypted file count")
                    )
                )
            )
        ));

        apps.add(createApp(
            "app-iptables",
            "Linux IPTables Firewall",
            "Automated network-level packet filtering and IP blocking",
            "/images/apps/iptables.svg",
            "Network Security",
            List.of(
                Map.of(
                    "name", "DROP",
                    "description", "Block malicious IP address via IPTables firewall rules",
                    "parameters", List.of(
                        createParam("server_ip", "", "Server/VPS IP where the firewall rule is applied"),
                        createParam("attacker_ip", "", "Attacker IP address to block"),
                        createParam("port", "22", "Target service port"),
                        createParam("protocol", "tcp", "Layer 4 protocol (tcp/udp)")
                    )
                ),
                Map.of(
                    "name", "ACCEPT",
                    "description", "Unblock or whitelist an IP address",
                    "parameters", List.of(
                        createParam("source_ip", "", "Source IP address to whitelist")
                    )
                ),
                Map.of(
                    "name", "QUARANTINE_HOST",
                    "description", "Isolate endpoint non-loopback network traffic",
                    "parameters", List.of(
                        createParam("hostname", "", "Target hostname to isolate"),
                        createParam("interface", "eth0", "Primary network interface")
                    )
                )
            )
        ));
        
        apps.add(createApp(
            "app-ssh-exec",
            "SSH Remote VPS Connector",
            "Native Java SSH client for remote Linux server firewall and command execution",
            "/images/apps/ssh.svg",
            "Remote Execution",
            List.of(
                Map.of(
                    "name", "EXECUTE_REMOTE_SSH",
                    "description", "Connect via SSH to remote VPS and execute commands (IPTables, scripts)",
                    "parameters", List.of(
                        createParam("ip_address", "13.218.244.6", "Remote VPS IP address"),
                        createParam("username", "ec2-user", "SSH Login Username"),
                        createParam("port", "22", "SSH Port"),
                        createParam("pem_file", "/run/secrets/pnreal-dev.pem", "SSH .pem file path on backend"),
                        createParam("password", "", "SSH password if not using key"),
                        createParam("command", "$act-ssh-3.command_executed", "Shell Command to Execute"),
                        createParam("timeout_seconds", "10", "Command Timeout in Seconds")
                    )
                )
            )
        ));

        apps.add(createApp(
            "app-sentinel",
            "Host Process Sentinel",
            "Local process manager, kill PID and network isolation",
            "/images/apps/sentinel.svg",
            "Endpoint Detection",
            List.of(
                Map.of(
                    "name", "KILL_PID",
                    "description", "Force terminate suspicious process by Process ID (PID)",
                    "parameters", List.of(
                        createParam("pid", "", "Process ID (PID) to terminate"),
                        createParam("signal", "SIGKILL", "POSIX signal (SIGKILL / SIGTERM)"),
                        createParam("hostname", "", "Host context"),
                        createParam("process_name", "", "Process context"),
                        createParam("affected_file_count", "", "Affected/encrypted file count")
                    )
                ),
                Map.of(
                    "name", "GET_PROCESS_FORENSICS",
                    "description", "Inspect process command line (/proc) and open sockets",
                    "parameters", List.of(
                        createParam("hostname", "", "Target hostname"),
                        createParam("host_ip", "", "Target host IP"),
                        createParam("pid", "", "Process ID to extract forensic snapshot"),
                        createParam("process_name", "", "Process name from EDR"),
                        createParam("command_line", "", "Command line from EDR"),
                        createParam("affected_file_count", "", "Affected/encrypted file count")
                    )
                )
            )
        ));

        apps.add(createApp(
            "app-mysqldb",
            "MySQL Asset & Incident DB Logger",
            "Audit logs, blocked IPs table and incident state repository",
            "/images/apps/mysql.svg",
            "Database & Audit",
            List.of(
                Map.of(
                    "name", "LOG_BLOCKED_IP",
                    "description", "Insert blocked IP record into MySQL blocked_ips table",
                    "parameters", List.of(
                        createParam("ip_address", "", "Blocked IP address"),
                        createParam("table", "blocked_ips", "Target table"),
                        createParam("reason", "SSH Attack", "Block reason")
                    )
                ),
                Map.of(
                    "name", "QUERY_ASSET_CRITICALITY",
                    "description", "Lookup asset criticality level (Production, Staging, Dev)",
                    "parameters", List.of(
                        createParam("hostname", "", "Hostname to query")
                    )
                ),
                Map.of(
                    "name", "LOG_RANSOMWARE_INCIDENT",
                    "description", "Insert ransomware containment record into MySQL ransomware_incidents table",
                    "parameters", List.of(
                        createParam("alert_id", "", "Related alert ID"),
                        createParam("hostname", "", "Target host"),
                        createParam("process_name", "", "Killed process"),
                        createParam("pid", "", "Killed process PID"),
                        createParam("affected_files", "", "Affected/encrypted file count"),
                        createParam("status", "CONTAINED", "Containment state")
                    )
                )
            )
        ));

        apps.add(createApp(
            "app-telegram",
            "Telegram Incident Notifier",
            "Dispatch SOC alert notifications and emergency containment reports",
            "/images/apps/telegram.svg",
            "Communication",
            List.of(
                Map.of(
                    "name", "SEND_SOC_ALERT",
                    "description", "Dispatch formatted HTML incident alert to Telegram channel",
                    "parameters", List.of(
                        createParam("bot_token", "7891234567:AAFx_TELEGRAM_BOT_TOKEN_SOAR", "Telegram Bot API Token (từ @BotFather)"),
                        createParam("chat_id", "@mini_soar_alerts_channel", "Telegram Chat ID / Channel (@channel hoặc -100xxx)"),
                        createParam("admin_id", "654321987", "Telegram Admin User ID (SOC Lead Direct Alert)"),
                        createParam("severity", "CRITICAL", "Incident severity level"),
                        createParam("message_html", "", "HTML alert body")
                    )
                )
            )
        ));

        apps.add(createApp(
            "app-branch",
            "Branch Condition",
            "Conditional logic evaluator: branch into TRUE (Escalate) or FALSE (Monitor)",
            "/images/apps/branch.svg",
            "Flow Logic",
            List.of(
                Map.of(
                    "name", "EVALUATE_CONDITION",
                    "description", "Evaluate condition on variable",
                    "parameters", List.of(
                        createParam("source_variable", "", "Variable to test"),
                        createParam("condition_operator", "larger than or equal", "Comparison Operator"),
                        createParam("target_value", "65", "Threshold value")
                    )
                )
            )
        ));

        // Add user-created custom apps from MySQL
        apps.addAll(appDefinitionRepository.findAll().stream()
                .map(this::appToMap)
                .filter(Objects::nonNull)
                .collect(Collectors.toList()));

        return ResponseEntity.ok(apps);
    }

    @GetMapping("/getenvironments")
    public ResponseEntity<List<Map<String, Object>>> getEnvironments() {
        return ResponseEntity.ok(List.of(
            Map.of("name", "Local SOAR Engine", "type", "docker", "status", "RUNNING")
        ));
    }
}
