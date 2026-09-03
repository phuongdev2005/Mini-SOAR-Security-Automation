package com.soar.minisoar.service;

import com.soar.minisoar.config.RabbitMQConfig;
import com.soar.minisoar.entity.Alert;
import com.soar.minisoar.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class RabbitMQAlertConsumer {

    private final WorkflowEngineService workflowEngineService;
    private final AlertRepository alertRepository;

    @RabbitListener(queues = RabbitMQConfig.QUEUE_NAME, autoStartup = "${soar.rabbitmq.enabled:true}")
    public void consumeAlertMessage(Long alertId) {
        log.info("[RabbitMQ Consumer] Dequeued Alert ID: {} from Queue: {}", alertId, RabbitMQConfig.QUEUE_NAME);

        Alert alert = alertRepository.findById(alertId).orElse(null);
        if (alert != null) {
            workflowEngineService.processAlertWorkflow(alert);
            log.info("[RabbitMQ Consumer] Successfully processed Alert ID: {} via RabbitMQ Consumer Pool", alertId);
        } else {
            log.warn("[RabbitMQ Consumer] Alert ID {} not found in database", alertId);
        }
    }
}
