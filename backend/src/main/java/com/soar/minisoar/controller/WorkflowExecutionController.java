package com.soar.minisoar.controller;

import com.soar.minisoar.dto.WorkflowExecutionDTO;
import com.soar.minisoar.entity.WorkflowExecution;
import com.soar.minisoar.repository.WorkflowExecutionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/executions")
@RequiredArgsConstructor
@CrossOrigin(origins = "${soar.security.allowed-origins:http://localhost:8080}", allowedHeaders = "*")
public class WorkflowExecutionController {

    private final WorkflowExecutionRepository executionRepository;

    @GetMapping
    public ResponseEntity<List<WorkflowExecutionDTO>> getAllExecutions() {
        List<WorkflowExecutionDTO> list = executionRepository.findAllByOrderByIdDesc().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<WorkflowExecutionDTO> getExecutionById(@PathVariable Long id) {
        WorkflowExecution execution = executionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Execution log not found with ID: " + id));
        return ResponseEntity.ok(mapToDTO(execution));
    }

    @GetMapping("/alert/{alertId}")
    public ResponseEntity<List<WorkflowExecutionDTO>> getExecutionsByAlertId(@PathVariable Long alertId) {
        List<WorkflowExecutionDTO> list = executionRepository.findByAlertId(alertId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    private WorkflowExecutionDTO mapToDTO(WorkflowExecution entity) {
        return WorkflowExecutionDTO.builder()
                .id(entity.getId())
                .alertId(entity.getAlert() != null ? entity.getAlert().getId() : null)
                .playbookName(entity.getPlaybookName())
                .status(entity.getStatus())
                .executionTimeMs(entity.getExecutionTimeMs())
                .resultSummary(entity.getResultSummary())
                .executionLog(entity.getExecutionLog())
                .startedAt(entity.getStartedAt())
                .completedAt(entity.getCompletedAt())
                .build();
    }
}
