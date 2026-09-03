package com.soar.minisoar.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class RansomwareAlertRequest {

    @NotBlank(message = "hostname is required")
    @JsonAlias({"hostname", "host", "target_host"})
    private String hostname;

    @JsonAlias({"hostIp", "host_ip", "target_ip", "targetHostIp"})
    private String hostIp;

    @NotBlank(message = "processName is required")
    @JsonAlias({"processName", "process_name", "proc_name"})
    private String processName;

    @NotNull(message = "pid is required")
    @JsonAlias({"pid", "process_id", "processId"})
    private Integer pid;

    @JsonAlias({"suspiciousExtensions", "suspicious_extensions", "crypto_extensions"})
    private List<String> suspiciousExtensions;

    @JsonAlias({"commandLine", "command_line", "cmdline"})
    private String commandLine;

    @JsonAlias({"affectedFileCount", "affected_file_count", "file_count"})
    private Integer affectedFileCount;

    private String description;
}
