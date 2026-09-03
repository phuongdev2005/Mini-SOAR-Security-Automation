package com.soar.minisoar.service;

import com.soar.minisoar.entity.Alert;
import com.soar.minisoar.enums.AlertStatus;
import com.soar.minisoar.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class LogPollerScheduler {

    private final AlertRepository alertRepository;
    private final WorkflowEngineService workflowEngineService;

    /**
     * Poll MySQL database every 15 seconds for unhandled alerts (Status = NEW)
     * inserted by external log collectors or direct DB ingestors.
     */
    @Scheduled(fixedDelay = 15000)
    public void pollAndProcessNewAlerts() {
        List<Alert> newAlerts = alertRepository.findByStatus(AlertStatus.NEW);
        if (!newAlerts.isEmpty()) {
            log.info("LogPollerScheduler found {} NEW alerts in MySQL database to process.", newAlerts.size());
            for (Alert alert : newAlerts) {
                try {
                    workflowEngineService.processAlertWorkflow(alert);
                } catch (Exception e) {
                    log.error("Failed background processing for Alert ID {}: {}", alert.getId(), e.getMessage());
                }
            }
        }
    }
}
