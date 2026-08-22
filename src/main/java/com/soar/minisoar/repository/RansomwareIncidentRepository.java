package com.soar.minisoar.repository;

import com.soar.minisoar.entity.RansomwareIncident;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RansomwareIncidentRepository extends JpaRepository<RansomwareIncident, Long> {
    List<RansomwareIncident> findByHostname(String hostname);
}
