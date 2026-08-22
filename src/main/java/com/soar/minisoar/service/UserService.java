package com.soar.minisoar.service;

import com.soar.minisoar.dto.LoginRequestDTO;
import com.soar.minisoar.dto.LoginResponseDTO;
import com.soar.minisoar.entity.User;
import com.soar.minisoar.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final SystemConfigService configService;

    // Active Session Tokens store (Token -> User)
    private final Map<String, User> activeSessions = new ConcurrentHashMap<>();

    @PostConstruct
    @Transactional
    public void initDefaultUsers() {
        if (!userRepository.existsByUsername("admin")) {
            User admin = User.builder()
                    .username("admin")
                    .passwordHash("admin123") // Plaintext for simple demo or SHA-256
                    .fullName("SOC Lead Administrator")
                    .role("ROLE_ADMIN")
                    .isActive(true)
                    .build();
            userRepository.save(admin);
            log.info("Initialized default SOC Admin user in MySQL: admin / admin123");
        }

        if (!userRepository.existsByUsername("analyst")) {
            User analyst = User.builder()
                    .username("analyst")
                    .passwordHash("analyst123")
                    .fullName("Junior SOC Analyst")
                    .role("ROLE_ANALYST")
                    .isActive(true)
                    .build();
            userRepository.save(analyst);
            log.info("Initialized default SOC Analyst user in MySQL: analyst / analyst123");
        }
    }

    public LoginResponseDTO login(LoginRequestDTO request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new IllegalArgumentException("Invalid username or password"));

        if (!user.getPasswordHash().equals(request.getPassword())) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new IllegalArgumentException("Account is disabled");
        }

        String sessionToken = "SOAR-SESSION-" + UUID.randomUUID().toString();
        activeSessions.put(sessionToken, user);

        String currentApiKey = configService.getConfigValue("SOAR_API_KEY", "SOAR-SECRET-API-KEY-2026");

        log.info("User '{}' ({}) successfully logged into Mini-SOAR Dashboard", user.getUsername(), user.getRole());

        return LoginResponseDTO.builder()
                .token(sessionToken)
                .username(user.getUsername())
                .fullName(user.getFullName())
                .role(user.getRole())
                .apiKey(currentApiKey)
                .build();
    }

    public boolean validateSession(String token) {
        return token != null && activeSessions.containsKey(token);
    }

    public User getUserByToken(String token) {
        if (token == null) {
            return null;
        }
        return activeSessions.get(token);
    }

    public void logout(String token) {
        if (token != null) {
            activeSessions.remove(token);
        }
    }
}
