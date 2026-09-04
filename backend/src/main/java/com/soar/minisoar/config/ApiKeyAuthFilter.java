package com.soar.minisoar.config;

import com.soar.minisoar.service.SystemConfigService;
import com.soar.minisoar.service.UserService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    private static final String API_KEY_HEADER = "X-SOAR-API-KEY";
    private static final String SESSION_TOKEN_HEADER = "X-SOAR-SESSION-TOKEN";

    private final SystemConfigService configService;
    private final UserService userService;

    @Value("${soar.security.api-key:SOAR-SECRET-API-KEY-2026}")
    private String defaultApiKey;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();

        // Allow public static resources and authentication login endpoint
        if (isPublicPath(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Handle OPTIONS preflight requests for CORS safely
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        // 1. Check User Session Token (from Header, Authorization Bearer, or Cookie)
        String sessionToken = request.getHeader(SESSION_TOKEN_HEADER);
        if (sessionToken == null) {
            String auth = request.getHeader("Authorization");
            if (auth != null && auth.startsWith("Bearer ")) {
                sessionToken = auth.substring(7).trim();
            }
        }
        if (sessionToken == null && request.getCookies() != null) {
            for (jakarta.servlet.http.Cookie c : request.getCookies()) {
                if ("session_token".equals(c.getName()) || "soar_token".equals(c.getName()) || "__session".equals(c.getName())) {
                    sessionToken = c.getValue();
                    break;
                }
            }
        }
        if (sessionToken != null && userService.validateSession(sessionToken)) {
            filterChain.doFilter(request, response);
            return;
        }

        // 2. Check API Key Header (from Webhooks & External Systems)
        String requestApiKey = request.getHeader(API_KEY_HEADER);
        String validApiKey = configService.getConfigValue("SOAR_API_KEY", defaultApiKey);

        if (requestApiKey != null && requestApiKey.equals(validApiKey)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Fail Unauthorized
        if (isBrowserPageRequest(request)) {
            response.sendRedirect("/login");
            return;
        }

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\": \"Unauthorized - Please login or present a valid X-SOAR-API-KEY header\"}");
    }

    private boolean isPublicPath(String path) {
        return path.equals("/login") ||
               path.equals("/login.html") ||
               path.equals("/favicon.ico") ||
               path.startsWith("/css/") ||
               path.startsWith("/js/") ||
               path.startsWith("/images/") ||
               path.startsWith("/api/v1/auth/") ||
               path.equals("/api/v1/login") ||
               path.equals("/api/v1/register") ||
               path.equals("/api/v1/checkusers") ||
               path.startsWith("/api/v1/health") ||
               path.equals("/api/status");
    }

    private boolean isBrowserPageRequest(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path.startsWith("/api/")) {
            return false;
        }

        String accept = request.getHeader("Accept");
        return accept == null || accept.contains("text/html") || accept.contains("*/*");
    }
}
