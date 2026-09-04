package com.soar.minisoar.repository;

import com.soar.minisoar.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByHostname(String hostname);
    List<AuditLog> findBySourceIp(String sourceIp);
}
