package com.soar.minisoar.dto;

import lombok.*;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemConfigDTO {
    private Long id;
    private String configKey;
    private String configValue;
    private String description;
    private String category;
    private LocalDateTime updatedAt;
}
