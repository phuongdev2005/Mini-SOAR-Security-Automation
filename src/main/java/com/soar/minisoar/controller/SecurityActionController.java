package com.soar.minisoar.controller;

import com.soar.minisoar.entity.BlockedIP;
import com.soar.minisoar.entity.RansomwareIncident;
import com.soar.minisoar.repository.BlockedIPRepository;
import com.soar.minisoar.repository.RansomwareIncidentRepository;
import com.soar.minisoar.service.RemoteSshExecutionService;
import com.soar.minisoar.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/actions")
@RequiredArgsConstructor
@CrossOrigin(origins = "${soar.security.allowed-origins:http://localhost:8080}", allowedHeaders = "*")
public class SecurityActionController {

    private final BlockedIPRepository blockedIPRepository;
    private final RansomwareIncidentRepository ransomwareIncidentRepository;
    private final RemoteSshExecutionService remoteSshExecutionService;
    private final SystemConfigService systemConfigService;

    @GetMapping("/blocked-ips")
    public ResponseEntity<List<BlockedIP>> getBlockedIPs() {
        return ResponseEntity.ok(blockedIPRepository.findAll());
    }

    @DeleteMapping("/blocked-ips/{id}")
    public ResponseEntity<Map<String, Object>> unblockIp(@PathVariable Long id) {
        BlockedIP blockedIP = blockedIPRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Blocked IP record not found for ID: " + id));

        String ipAddress = blockedIP.getIpAddress();
        blockedIP.setIsActive(false);
        blockedIPRepository.save(blockedIP);
        log.info("Unblocked IP record in MySQL DB: {}", ipAddress);

        // Execute OS Firewall unblock command
        String unblockCmd = "iptables -D INPUT -s " + ipAddress + " -p tcp --dport 22 -j DROP";
        String mode = systemConfigService.getConfigValue("SOAR_EXECUTION_MODE", "SIMULATION");
        String detail = "[SIMULATION] Unblock rule generated for " + ipAddress;

        if ("REAL".equalsIgnoreCase(mode)) {
            try {
                ProcessBuilder pb = new ProcessBuilder("iptables", "-D", "INPUT", "-s", ipAddress, "-p", "tcp", "--dport", "22", "-j", "DROP");
                Process p = pb.start();
                p.waitFor();
                detail = "Firewall rule removed on local host via iptables -D.";
            } catch (Exception ex) {
                log.error("Failed to execute iptables -D for IP {}", ipAddress, ex);
            }

            // Check if Remote VPS execution is enabled
            Map<String, String> configs = systemConfigService.getAllConfigsAsMap();
            String vpsHost = configs.get("REMOTE_VPS_HOST");
            String vpsUser = configs.getOrDefault("REMOTE_VPS_USER", "root");
            String vpsKey = configs.get("REMOTE_VPS_SSH_KEY");

            if (vpsHost != null && !vpsHost.trim().isEmpty() && !"vps.example.com".equalsIgnoreCase(vpsHost)) {
                RemoteSshExecutionService.SshExecutionResult sshResult =
                        remoteSshExecutionService.executeRemoteCommand(vpsHost, vpsUser, unblockCmd, vpsKey, null, 22, 10);
                detail += " | Remote VPS: " + sshResult.getDetail();
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", "SUCCESS");
        response.put("message", "IP " + ipAddress + " has been unblocked successfully.");
        response.put("unblocked_ip", ipAddress);
        response.put("detail", detail);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/ransomware-incidents")
    public ResponseEntity<List<RansomwareIncident>> getRansomwareIncidents() {
        return ResponseEntity.ok(ransomwareIncidentRepository.findAll());
    }
}
