package com.soar.minisoar.repository;

import com.soar.minisoar.entity.WorkflowExecution;
import com.soar.minisoar.enums.ExecutionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkflowExecutionRepository extends JpaRepository<WorkflowExecution, Long> {
    List<WorkflowExecution> findByAlertId(Long alertId);
    List<WorkflowExecution> findByStatus(ExecutionStatus status);
    long countByStatus(ExecutionStatus status);
}
