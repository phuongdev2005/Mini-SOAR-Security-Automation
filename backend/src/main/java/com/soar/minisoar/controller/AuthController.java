package com.soar.minisoar.controller;

import com.soar.minisoar.dto.LoginRequestDTO;
import com.soar.minisoar.dto.LoginResponseDTO;
import com.soar.minisoar.entity.User;
import com.soar.minisoar.service.UserService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "${soar.security.allowed-origins:http://localhost:8080}", allowedHeaders = "*", allowCredentials = "true")
public class AuthController {

    private final UserService userService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO request, HttpServletResponse servletResponse) {
        try {
            LoginResponseDTO response = userService.login(request);
            addAuthCookie(servletResponse, "soar_token", response.getToken(), 86400);
            addAuthCookie(servletResponse, "session_token", response.getToken(), 86400);
            addAuthCookie(servletResponse, "soar_user", response.getUsername(), 86400);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        String token = extractSessionToken(servletRequest);
        userService.logout(token);
        expireAuthCookie(servletResponse, "soar_token");
        expireAuthCookie(servletResponse, "session_token");
        expireAuthCookie(servletResponse, "soar_user");
        expireAuthCookie(servletResponse, "username");
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(HttpServletRequest servletRequest) {
        String token = extractSessionToken(servletRequest);
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

    private String extractSessionToken(HttpServletRequest request) {
        String header = request.getHeader("X-SOAR-SESSION-TOKEN");
        if (header != null && !header.isBlank()) {
            return header;
        }

        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring(7);
        }

        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("session_token".equals(cookie.getName())
                        || "soar_token".equals(cookie.getName())
                        || "__session".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    private void addAuthCookie(HttpServletResponse response, String name, String value, int maxAgeSeconds) {
        Cookie cookie = new Cookie(name, value == null ? "" : value);
        cookie.setPath("/");
        cookie.setMaxAge(maxAgeSeconds);
        cookie.setHttpOnly(false);
        response.addCookie(cookie);
    }

    private void expireAuthCookie(HttpServletResponse response, String name) {
        addAuthCookie(response, name, "", 0);
    }
}
