package com.soar.minisoar.controller;

import com.soar.minisoar.dto.LoginRequestDTO;
import com.soar.minisoar.dto.LoginResponseDTO;
import com.soar.minisoar.entity.User;
import com.soar.minisoar.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "${soar.security.allowed-origins:http://localhost:8080}", allowedHeaders = "*")
public class AuthController {

    private final UserService userService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO request) {
        try {
            LoginResponseDTO response = userService.login(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader(value = "X-SOAR-SESSION-TOKEN", required = false) String token) {
        userService.logout(token);
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@RequestHeader(value = "X-SOAR-SESSION-TOKEN", required = false) String token) {
        User user = userService.getUserByToken(token);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized / Invalid Session"));
        }
        return ResponseEntity.ok(Map.of(
                "username", user.getUsername(),
                "fullName", user.getFullName(),
                "role", user.getRole()
        ));
    }
}
