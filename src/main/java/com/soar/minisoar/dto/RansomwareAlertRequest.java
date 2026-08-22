package com.soar.minisoar.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RansomwareAlertRequest {

    @NotBlank(message = "hostname is required")
    private String hostname;

    @NotBlank(message = "processName is required")
    private String processName;

    @NotNull(message = "pid is required")
    private Integer pid;

    private List<String> suspiciousExtensions;

    private Integer affectedFileCount;

    private String description;
}
