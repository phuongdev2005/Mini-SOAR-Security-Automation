package com.soar.minisoar.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "alert_id")
    private Long alertId;

    @Column(name = "playbook_name", length = 64)
    private String playbookName;

    @Column(name = "hostname", nullable = false, length = 128)
    private String hostname;

    @Column(name = "source_ip", length = 45)
    private String sourceIp;

    @Column(name = "action_type", nullable = false, length = 64)
    @Builder.Default
    private String actionType = "MONITOR_ONLY";

    @Column(name = "tier", length = 32)
    @Builder.Default
    private String tier = "PRODUCTION";

    @Column(name = "risk_score")
    @Builder.Default
    private Integer riskScore = 0;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @CreationTimestamp
    @Column(name = "logged_at", nullable = false, updatable = false)
    private LocalDateTime loggedAt;
}
