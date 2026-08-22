package com.soar.minisoar.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SSHAlertRequest {

    @NotBlank(message = "sourceIp is required")
    private String sourceIp;

    @NotBlank(message = "hostname is required")
    private String hostname;

    private String username;

    @NotNull(message = "failedAttempts is required")
    private Integer failedAttempts;

    private String description;
}
