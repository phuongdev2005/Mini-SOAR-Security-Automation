package com.soar.minisoar.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardSummaryDTO {
    private long totalAlerts;
    private long sshAlerts;
    private long ransomwareAlerts;
    private long resolvedAlerts;
    private long totalExecutions;
    private long completedExecutions;
    private long totalBlockedIps;
    private long totalRansomwareIncidents;
    
    // Queue metrics
    private int pendingQueueTasks;
    private int activeWorkerThreads;
}
