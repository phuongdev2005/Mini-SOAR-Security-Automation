package com.soar.minisoar.repository;

import com.soar.minisoar.entity.Alert;
import com.soar.minisoar.enums.AlertStatus;
import com.soar.minisoar.enums.AlertType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {
    List<Alert> findByStatus(AlertStatus status);
    List<Alert> findByAlertType(AlertType alertType);
    long countByStatus(AlertStatus status);
    long countByAlertType(AlertType alertType);
}
