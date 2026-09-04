package com.soar.minisoar.service;

import com.soar.minisoar.dto.SystemConfigDTO;
import com.soar.minisoar.entity.SystemConfig;
import com.soar.minisoar.repository.SystemConfigRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SystemConfigService {

    private final SystemConfigRepository configRepository;

    @PostConstruct
    @Transactional
    public void initDefaultConfigs() {
        initIfAbsent("SOAR_EXECUTION_MODE", "SIMULATION", "Execution mode: SIMULATION (Dry-run) or REAL (Live OS enforcement)", "CORE_ENGINE");
        initIfAbsent("SOAR_API_KEY", "SOAR-SECRET-API-KEY-2026", "Security API Key for REST / Webhook authentication", "SECURITY");
        initIfAbsent("TELEGRAM_BOT_TOKEN", "7891234567:AAFx_MOCK_TELEGRAM_BOT_TOKEN_SOAR", "Telegram Bot API Token from @BotFather", "NOTIFICATIONS");
        initIfAbsent("TELEGRAM_CHAT_ID", "@mini_soar_alerts_channel", "Telegram Chat ID or Public Channel Name (@channel_id)", "NOTIFICATIONS");
        initIfAbsent("REMOTE_VPS_HOST", "13.218.244.6", "Remote VPS Hostname / IP address for remote SSH containment", "REMOTE_SSH");
        initIfAbsent("REMOTE_VPS_USER", "ec2-user", "Remote VPS SSH Username", "REMOTE_SSH");
        initIfAbsent("REMOTE_VPS_SSH_KEY", "/run/secrets/pnreal-dev.pem", "Remote VPS Private Key File Path", "REMOTE_SSH");
    }

    private void initIfAbsent(String key, String defaultValue, String description, String category) {
        if (!configRepository.existsByConfigKey(key)) {
            SystemConfig config = SystemConfig.builder()
                    .configKey(key)
                    .configValue(defaultValue)
                    .description(description)
                    .category(category)
                    .build();
            configRepository.save(config);
            log.info("Initialized default system config in MySQL: {} = {}", key, defaultValue);
        }
    }

    public List<SystemConfigDTO> getAllConfigs() {
        return configRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    public Map<String, String> getAllConfigsAsMap() {
        Map<String, String> map = new HashMap<>();
        configRepository.findAll().forEach(c -> map.put(c.getConfigKey(), c.getConfigValue()));
        return map;
    }

    public String getConfigValue(String key, String defaultValue) {
        return configRepository.findByConfigKey(key)
                .map(SystemConfig::getConfigValue)
                .orElse(defaultValue);
    }

    @Transactional
    public List<SystemConfigDTO> updateConfigs(Map<String, String> newConfigs) {
        for (Map.Entry<String, String> entry : newConfigs.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();

            SystemConfig config = configRepository.findByConfigKey(key)
                    .orElse(SystemConfig.builder()
                            .configKey(key)
                            .category("CUSTOM")
                            .description("Custom User Configuration")
                            .build());

            config.setConfigValue(value);
            configRepository.save(config);
            log.info("Updated system config in MySQL: {} = {}", key, value);
        }
        return getAllConfigs();
    }

    private SystemConfigDTO mapToDTO(SystemConfig entity) {
        return SystemConfigDTO.builder()
                .id(entity.getId())
                .configKey(entity.getConfigKey())
                .configValue(entity.getConfigValue())
                .description(entity.getDescription())
                .category(entity.getCategory())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
