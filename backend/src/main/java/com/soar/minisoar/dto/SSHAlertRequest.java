package com.soar.minisoar.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class SSHAlertRequest {

    @NotBlank(message = "sourceIp is required")
    @JsonAlias({"source_ip", "sourceIp", "src_ip", "attacker_ip"})
    private String sourceIp;

    @NotBlank(message = "hostname is required")
    @JsonAlias({"hostname", "host", "target_host"})
    private String hostname;

    @JsonAlias({"username", "user", "target_user"})
    private String username;

    @NotNull(message = "failedAttempts is required")
    @JsonAlias({"failed_attempts", "failedAttempts", "attempt_count"})
    private Integer failedAttempts;

    private String description;
}
