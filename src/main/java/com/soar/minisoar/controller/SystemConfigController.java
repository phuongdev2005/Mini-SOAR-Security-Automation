package com.soar.minisoar.controller;

import com.soar.minisoar.dto.SystemConfigDTO;
import com.soar.minisoar.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/configs")
@RequiredArgsConstructor
@CrossOrigin(origins = "${soar.security.allowed-origins:http://localhost:8080}", allowedHeaders = "*")
public class SystemConfigController {

    private final SystemConfigService configService;

    @GetMapping
    public ResponseEntity<List<SystemConfigDTO>> getAllConfigs() {
        return ResponseEntity.ok(configService.getAllConfigs());
    }

    @PostMapping
    public ResponseEntity<List<SystemConfigDTO>> updateConfigs(@RequestBody Map<String, String> newConfigs) {
        List<SystemConfigDTO> updatedList = configService.updateConfigs(newConfigs);
        return ResponseEntity.ok(updatedList);
    }
}
