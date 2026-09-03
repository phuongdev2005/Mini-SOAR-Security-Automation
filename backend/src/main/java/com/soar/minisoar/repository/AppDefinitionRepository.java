package com.soar.minisoar.repository;

import com.soar.minisoar.entity.AppDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AppDefinitionRepository extends JpaRepository<AppDefinition, String> {
}
