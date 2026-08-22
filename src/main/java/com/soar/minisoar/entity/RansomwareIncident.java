package com.soar.minisoar.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "ransomware_incidents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RansomwareIncident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "alert_id", nullable = false)
    private Long alertId;

    @Column(name = "hostname", nullable = false, length = 128)
    private String hostname;

    @Column(name = "process_name", nullable = false, length = 128)
    private String processName;

    @Column(name = "pid", nullable = false)
    private Integer pid;

    @Column(name = "affected_files")
    private Integer affectedFiles;

    @Column(name = "containment_status", nullable = false, length = 64)
    private String containmentStatus;

    @CreationTimestamp
    @Column(name = "incident_time", nullable = false, updatable = false)
    private LocalDateTime incidentTime;
}
