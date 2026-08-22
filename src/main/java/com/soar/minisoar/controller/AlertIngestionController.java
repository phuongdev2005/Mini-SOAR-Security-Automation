package com.soar.minisoar.controller;

import com.soar.minisoar.dto.AlertResponseDTO;
import com.soar.minisoar.dto.RansomwareAlertRequest;
import com.soar.minisoar.dto.SSHAlertRequest;
import com.soar.minisoar.service.AlertService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/alerts")
@RequiredArgsConstructor
@CrossOrigin(origins = "${soar.security.allowed-origins:http://localhost:8080}", allowedHeaders = "*")
public class AlertIngestionController {

    private final AlertService alertService;

    @PostMapping("/ssh")
    public ResponseEntity<AlertResponseDTO> ingestSSHAlert(@Valid @RequestBody SSHAlertRequest request) {
        AlertResponseDTO response = alertService.ingestSSHAlert(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/ransomware")
    public ResponseEntity<AlertResponseDTO> ingestRansomwareAlert(@Valid @RequestBody RansomwareAlertRequest request) {
        AlertResponseDTO response = alertService.ingestRansomwareAlert(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<AlertResponseDTO>> getAllAlerts() {
        return ResponseEntity.ok(alertService.getAllAlerts());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AlertResponseDTO> getAlertById(@PathVariable Long id) {
        return ResponseEntity.ok(alertService.getAlertById(id));
    }
}
