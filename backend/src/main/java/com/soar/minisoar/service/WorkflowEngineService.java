package com.soar.minisoar.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.soar.minisoar.entity.Alert;
import com.soar.minisoar.entity.BlockedIP;
import com.soar.minisoar.entity.RansomwareIncident;
import com.soar.minisoar.entity.WorkflowExecution;
import com.soar.minisoar.enums.AlertStatus;
import com.soar.minisoar.enums.AlertType;
import com.soar.minisoar.enums.ExecutionStatus;
import com.soar.minisoar.repository.AlertRepository;
import com.soar.minisoar.repository.BlockedIPRepository;
import com.soar.minisoar.repository.RansomwareIncidentRepository;
import com.soar.minisoar.repository.WorkflowDefinitionRepository;
import com.soar.minisoar.repository.WorkflowExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowEngineService {

    private final PythonWorkerExecutorService pythonWorkerExecutor;
    private final WorkflowExecutionRepository executionRepository;
    private final AlertRepository alertRepository;
    private final BlockedIPRepository blockedIPRepository;
    private final RansomwareIncidentRepository ransomwareIncidentRepository;
    private final WorkflowDefinitionRepository workflowDefinitionRepository;
    private final ObjectMapper objectMapper;

    private final SystemConfigService systemConfigService;
    private final RemoteSshExecutionService remoteSshExecutionService;

    @Transactional
    public WorkflowExecution processAlertWorkflow(Alert alert) {
        log.info("Triggering SOAR workflow engine for Alert ID: {}, Type: {}", alert.getId(), alert.getAlertType());

        if (!isWorkflowActiveForAlert(alert)) {
            log.info("Skipping Alert ID {} because its playbook is not active", alert.getId());
            alert.setStatus(AlertStatus.IGNORED);
            alertRepository.save(alert);
            return null;
        }

        alert.setStatus(AlertStatus.PROCESSING);
        alertRepository.save(alert);

        String playbookScript;
        if (alert.getAlertType() == AlertType.SSH_BRUTEFORCE) {
            playbookScript = "ssh_playbook.py";
        } else if (alert.getAlertType() == AlertType.RANSOMWARE_DETECTION) {
            playbookScript = "ransomware_playbook.py";
        } else {
            throw new IllegalArgumentException("Unsupported alert type: " + alert.getAlertType());
        }

        WorkflowExecution execution = WorkflowExecution.builder()
                .alert(alert)
                .playbookName(playbookScript)
                .status(ExecutionStatus.IN_PROGRESS)
                .startedAt(LocalDateTime.now())
                .build();
        execution = executionRepository.save(execution);

        long startTime = System.currentTimeMillis();

        try {
            // Build JSON payload to send to Python worker script
            JsonNode rawJsonNode = objectMapper.readTree(alert.getRawPayload());
            Map<String, Object> payloadMap = objectMapper.convertValue(rawJsonNode, Map.class);
            payloadMap.put("alert_id", alert.getId());
            payloadMap.put("hostname", alert.getHostname());
            if (alert.getSourceIp() != null) {
                payloadMap.put("source_ip", alert.getSourceIp());
            }

            // Include live database-backed system configurations
            payloadMap.put("system_configs", systemConfigService.getAllConfigsAsMap());

            String inputPayloadJson = objectMapper.writeValueAsString(payloadMap);
            log.info("Invoking Python worker script [{}] with input payload: {}", playbookScript, inputPayloadJson);

            // Execute Python Worker
            String pythonOutput = pythonWorkerExecutor.executePlaybook(playbookScript, inputPayloadJson);
            long executionTimeMs = System.currentTimeMillis() - startTime;

            JsonNode resultNode = objectMapper.readTree(pythonOutput);
            String statusStr = resultNode.path("status").asText("COMPLETED");
            String summary = resultNode.path("summary").asText("Playbook executed successfully.");

            execution.setExecutionTimeMs(executionTimeMs);
            execution.setResultSummary(summary);
            execution.setExecutionLog(pythonOutput);
            execution.setCompletedAt(LocalDateTime.now());

            if ("COMPLETED".equalsIgnoreCase(statusStr)) {
                execution.setStatus(ExecutionStatus.COMPLETED);
                alert.setStatus(AlertStatus.RESOLVED);

                // Handle post-execution actions for specific playbooks
                if (alert.getAlertType() == AlertType.SSH_BRUTEFORCE) {
                    handleSSHPostExecution(alert, resultNode);
                } else if (alert.getAlertType() == AlertType.RANSOMWARE_DETECTION) {
                    handleRansomwarePostExecution(alert, resultNode);
                }

            } else {
                execution.setStatus(ExecutionStatus.FAILED);
                alert.setStatus(AlertStatus.FAILED);
            }

        } catch (Exception e) {
            long executionTimeMs = System.currentTimeMillis() - startTime;
            log.error("Error executing SOAR workflow for alert {}: {}", alert.getId(), e.getMessage(), e);

            execution.setExecutionTimeMs(executionTimeMs);
            execution.setStatus(ExecutionStatus.FAILED);
            execution.setResultSummary("Execution error: " + e.getMessage());
            execution.setExecutionLog("Error stacktrace: " + e.toString());
            execution.setCompletedAt(LocalDateTime.now());

            alert.setStatus(AlertStatus.FAILED);
        }

        alertRepository.save(alert);
        return executionRepository.save(execution);
    }

    private boolean isWorkflowActiveForAlert(Alert alert) {
        String workflowId;
        if (alert.getAlertType() == AlertType.SSH_BRUTEFORCE) {
            workflowId = "wf-ssh-01";
        } else if (alert.getAlertType() == AlertType.RANSOMWARE_DETECTION) {
            workflowId = "wf-ransomware-01";
        } else {
            return false;
        }

        return workflowDefinitionRepository.findById(workflowId)
                .map(workflow -> {
                    try {
                        JsonNode definition = objectMapper.readTree(workflow.getDefinitionJson());
                        return "RUNNING".equalsIgnoreCase(definition.path("status").asText("PAUSED"));
                    } catch (Exception e) {
                        log.warn("Cannot read workflow status for {}: {}", workflowId, e.getMessage());
                        return false;
                    }
                })
                .orElse(false);
    }

    private void handleSSHPostExecution(Alert alert, JsonNode resultNode) {
        String blockedIpStr = resultNode.path("blocked_ip").asText(null);
        int threatScore = resultNode.path("threat_score").asInt(75);

        if (blockedIpStr != null && !blockedIpStr.isEmpty() && !"null".equalsIgnoreCase(blockedIpStr)) {
            if (!blockedIPRepository.existsByIpAddress(blockedIpStr)) {
                BlockedIP blockedIP = BlockedIP.builder()
                        .alertId(alert.getId())
                        .ipAddress(blockedIpStr)
                        .reason("Blocked by SSH Brute-force SOAR Playbook")
                        .threatScore(threatScore)
                        .isActive(true)
                        .build();
                blockedIPRepository.save(blockedIP);
                log.info("Persisted blocked IP record in MySQL: {}", blockedIpStr);
            }

            // Trigger Java Backend Remote SSH Execution Module
            Map<String, String> configs = systemConfigService.getAllConfigsAsMap();
            String vpsHost = configs.get("REMOTE_VPS_HOST");
            String vpsUser = configs.getOrDefault("REMOTE_VPS_USER", "root");
            String vpsKey = configs.get("REMOTE_VPS_SSH_KEY");

            if (vpsHost != null && !vpsHost.trim().isEmpty()) {
                String ruleCmd = "iptables -A INPUT -s " + blockedIpStr + " -p tcp --dport 22 -j DROP";
                log.info("Triggering Java RemoteSshExecutionService module for host: {}", vpsHost);
                RemoteSshExecutionService.SshExecutionResult sshResult =
                        remoteSshExecutionService.executeRemoteCommand(vpsHost, vpsUser, ruleCmd, vpsKey, null, 22, 10);
                log.info("Remote SSH Execution Result from Java Module: {}", sshResult.getDetail());
            }
        }
    }

    private void handleRansomwarePostExecution(Alert alert, JsonNode resultNode) {
        String hostname = alert.getHostname();
        int pid = resultNode.path("terminated_pid").asInt(0);
        String actionTaken = resultNode.path("action_taken").asText("PROCESS_KILLED_HOST_ISOLATED");

        JsonNode rawJson = null;
        try {
            rawJson = objectMapper.readTree(alert.getRawPayload());
        } catch (Exception ignored) {}

        String procName = rawJson != null ? rawJson.path("processName").asText("vssadmin.exe") : "unknown_proc.exe";
        int fileCount = rawJson != null ? rawJson.path("affectedFileCount").asInt(100) : 100;

        RansomwareIncident incident = RansomwareIncident.builder()
                .alertId(alert.getId())
                .hostname(hostname)
                .processName(procName)
                .pid(pid)
                .affectedFiles(fileCount)
                .containmentStatus(actionTaken)
                .build();

        ransomwareIncidentRepository.save(incident);
        log.info("Persisted Ransomware Incident containment record in MySQL for host: {}", hostname);
    }
}
