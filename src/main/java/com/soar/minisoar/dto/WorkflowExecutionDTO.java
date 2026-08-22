package com.soar.minisoar.dto;

import com.soar.minisoar.enums.ExecutionStatus;
import lombok.*;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkflowExecutionDTO {
    private Long id;
    private Long alertId;
    private String playbookName;
    private ExecutionStatus status;
    private Long executionTimeMs;
    private String resultSummary;
    private String executionLog;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
}
