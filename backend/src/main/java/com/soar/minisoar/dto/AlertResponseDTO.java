package com.soar.minisoar.dto;

import com.soar.minisoar.enums.AlertStatus;
import com.soar.minisoar.enums.AlertType;
import com.soar.minisoar.enums.SeverityLevel;
import lombok.*;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertResponseDTO {
    private Long id;
    private AlertType alertType;
    private SeverityLevel severity;
    private String sourceIp;
    private String hostname;
    private String description;
    private String rawPayload;
    private AlertStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
