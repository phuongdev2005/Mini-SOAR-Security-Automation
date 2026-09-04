package com.soar.minisoar.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.soar.minisoar.config.RabbitMQConfig;
import com.soar.minisoar.dto.AlertResponseDTO;
import com.soar.minisoar.dto.RansomwareAlertRequest;
import com.soar.minisoar.dto.SSHAlertRequest;
import com.soar.minisoar.entity.Alert;
import com.soar.minisoar.entity.WorkflowExecution;
import com.soar.minisoar.enums.AlertStatus;
import com.soar.minisoar.enums.AlertType;
import com.soar.minisoar.enums.ExecutionStatus;
import com.soar.minisoar.enums.SeverityLevel;
import com.soar.minisoar.repository.AlertRepository;
import com.soar.minisoar.repository.WorkflowExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AlertService {

    private final AlertRepository alertRepository;
    private final WorkflowExecutionRepository executionRepository;
    private final WorkflowEngineService workflowEngineService;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private RabbitTemplate rabbitTemplate;

    @Transactional
    public AlertResponseDTO ingestSSHAlert(SSHAlertRequest request) {
        log.info("Received SSH Alert ingestion request: IP={}, Target Host={}", request.getSourceIp(), request.getHostname());

        SeverityLevel severity = (request.getFailedAttempts() != null && request.getFailedAttempts() >= 5)
                ? SeverityLevel.HIGH : SeverityLevel.MEDIUM;

        String rawPayload;
        try {
            rawPayload = objectMapper.writeValueAsString(request);
        } catch (Exception e) {
            rawPayload = request.toString();
        }

        Alert alert = Alert.builder()
                .alertType(AlertType.SSH_BRUTEFORCE)
                .severity(severity)
                .sourceIp(request.getSourceIp())
                .hostname(request.getHostname())
                .description(request.getDescription() != null ? request.getDescription()
                        : "SSH Brute-force attempt detected from IP: " + request.getSourceIp())
                .rawPayload(rawPayload)
                .status(AlertStatus.NEW)
                .build();

        alert = alertRepository.save(alert);
        log.info("Saved SSH Alert to MySQL DB with ID: {}", alert.getId());

        // Create PENDING execution immediately so it appears in history right when enqueued
        WorkflowExecution execution = WorkflowExecution.builder()
                .alert(alert)
                .playbookName("ssh_playbook.py")
                .status(ExecutionStatus.PENDING)
                .resultSummary("Đã tiếp nhận cảnh báo SSH, đang xếp hàng đợi (RabbitMQ Queue)...")
                .startedAt(LocalDateTime.now())
                .build();
        execution = executionRepository.save(execution);
        log.info("Created PENDING SSH WorkflowExecution #{} for Alert ID {}", execution.getId(), alert.getId());

        // Dispatch to RabbitMQ Queue or fallback to Workflow Engine
        dispatchToQueueOrExecute(alert);

        return mapToDTO(alert);
    }

    @Transactional
    public AlertResponseDTO ingestRansomwareAlert(RansomwareAlertRequest request) {
        log.info("Received Ransomware Alert ingestion request: Host={}, Process={}", request.getHostname(), request.getProcessName());

        String rawPayload;
        try {
            rawPayload = objectMapper.writeValueAsString(request);
        } catch (Exception e) {
            rawPayload = request.toString();
        }

        Alert alert = Alert.builder()
                .alertType(AlertType.RANSOMWARE_DETECTION)
                .severity(SeverityLevel.CRITICAL)
                .sourceIp(null)
                .hostname(request.getHostname())
                .description(request.getDescription() != null ? request.getDescription()
                        : "Ransomware / Malicious Encryption process detected: " + request.getProcessName() + " (PID " + request.getPid() + ")")
                .rawPayload(rawPayload)
                .status(AlertStatus.NEW)
                .build();

        alert = alertRepository.save(alert);
        log.info("Saved Ransomware Alert to MySQL DB with ID: {}", alert.getId());

        // Create PENDING execution immediately so it appears in history right when enqueued
        WorkflowExecution execution = WorkflowExecution.builder()
                .alert(alert)
                .playbookName("ransomware_playbook.py")
                .status(ExecutionStatus.PENDING)
                .resultSummary("Đã tiếp nhận cảnh báo Ransomware, đang xếp hàng đợi (RabbitMQ Queue)...")
                .startedAt(LocalDateTime.now())
                .build();
        execution = executionRepository.save(execution);
        log.info("Created PENDING Ransomware WorkflowExecution #{} for Alert ID {}", execution.getId(), alert.getId());

        // Dispatch to RabbitMQ Queue or fallback to Workflow Engine
        dispatchToQueueOrExecute(alert);

        return mapToDTO(alert);
    }

    private void dispatchToQueueOrExecute(Alert alert) {
        if (rabbitTemplate != null) {
            try {
                rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, RabbitMQConfig.ROUTING_KEY, alert.getId());
                log.info("[RabbitMQ Publisher] Dispatched Alert ID {} to Exchange '{}' with Routing Key '{}'",
                        alert.getId(), RabbitMQConfig.EXCHANGE_NAME, RabbitMQConfig.ROUTING_KEY);
                return;
            } catch (Exception e) {
                log.warn("RabbitMQ broker not reachable or offline, falling back to direct workflow execution: {}", e.getMessage());
            }
        }
        workflowEngineService.processAlertWorkflow(alert);
    }

    public List<AlertResponseDTO> getAllAlerts() {
        return alertRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    public AlertResponseDTO getAlertById(Long id) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Alert not found with ID: " + id));
        return mapToDTO(alert);
    }

    private AlertResponseDTO mapToDTO(Alert alert) {
        return AlertResponseDTO.builder()
                .id(alert.getId())
                .alertType(alert.getAlertType())
                .severity(alert.getSeverity())
                .sourceIp(alert.getSourceIp())
                .hostname(alert.getHostname())
                .description(alert.getDescription())
                .rawPayload(alert.getRawPayload())
                .status(alert.getStatus())
                .createdAt(alert.getCreatedAt())
                .updatedAt(alert.getUpdatedAt())
                .build();
    }
}
