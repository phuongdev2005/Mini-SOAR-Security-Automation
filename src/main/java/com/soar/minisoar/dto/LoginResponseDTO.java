package com.soar.minisoar.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginResponseDTO {
    private String token;
    private String username;
    private String fullName;
    private String role;
    private String apiKey;
}
