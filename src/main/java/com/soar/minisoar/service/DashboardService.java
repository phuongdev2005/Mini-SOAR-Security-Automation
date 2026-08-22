package com.soar.minisoar.service;

import com.soar.minisoar.dto.DashboardSummaryDTO;
import com.soar.minisoar.enums.AlertStatus;
import com.soar.minisoar.enums.AlertType;
import com.soar.minisoar.enums.ExecutionStatus;
import com.soar.minisoar.repository.AlertRepository;
import com.soar.minisoar.repository.BlockedIPRepository;
import com.soar.minisoar.repository.RansomwareIncidentRepository;
import com.soar.minisoar.repository.WorkflowExecutionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final AlertRepository alertRepository;
    private final WorkflowExecutionRepository executionRepository;
    private final BlockedIPRepository blockedIPRepository;
    private final RansomwareIncidentRepository ransomwareIncidentRepository;

    @Qualifier("soarQueueExecutor")
    private final ThreadPoolTaskExecutor soarQueueExecutor;

    public DashboardSummaryDTO getSummary() {
        long totalAlerts = alertRepository.count();
        long sshAlerts = alertRepository.countByAlertType(AlertType.SSH_BRUTEFORCE);
        long ransomwareAlerts = alertRepository.countByAlertType(AlertType.RANSOMWARE_DETECTION);
        long resolvedAlerts = alertRepository.countByStatus(AlertStatus.RESOLVED);

        long totalExecutions = executionRepository.count();
        long completedExecutions = executionRepository.countByStatus(ExecutionStatus.COMPLETED);

        long totalBlockedIps = blockedIPRepository.count();
        long totalRansomwareIncidents = ransomwareIncidentRepository.count();

        int pendingQueueTasks = soarQueueExecutor.getThreadPoolExecutor() != null ?
                soarQueueExecutor.getThreadPoolExecutor().getQueue().size() : 0;
        int activeWorkerThreads = soarQueueExecutor.getActiveCount();

        return DashboardSummaryDTO.builder()
                .totalAlerts(totalAlerts)
                .sshAlerts(sshAlerts)
                .ransomwareAlerts(ransomwareAlerts)
                .resolvedAlerts(resolvedAlerts)
                .totalExecutions(totalExecutions)
                .completedExecutions(completedExecutions)
                .totalBlockedIps(totalBlockedIps)
                .totalRansomwareIncidents(totalRansomwareIncidents)
                .pendingQueueTasks(pendingQueueTasks)
                .activeWorkerThreads(activeWorkerThreads)
                .build();
    }
}
