-- Mini-SOAR MySQL Schema Initializer
CREATE DATABASE IF NOT EXISTS mini_soar_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mini_soar_db;

-- 1. Table for Security Alerts (SSH & Ransomware)
CREATE TABLE IF NOT EXISTS alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_type VARCHAR(32) NOT NULL, -- SSH_BRUTEFORCE, RANSOMWARE_DETECTION
    severity VARCHAR(16) NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    source_ip VARCHAR(45) NULL,
    hostname VARCHAR(128) NOT NULL,
    description TEXT,
    raw_payload TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'NEW', -- NEW, PROCESSING, RESOLVED, IGNORED, FAILED
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_alert_type (alert_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Table for Workflow Executions
CREATE TABLE IF NOT EXISTS workflow_executions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_id BIGINT NOT NULL,
    playbook_name VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL, -- PENDING, IN_PROGRESS, COMPLETED, FAILED
    execution_time_ms BIGINT NULL,
    result_summary TEXT,
    execution_log LONGTEXT,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
    INDEX idx_alert_id (alert_id),
    INDEX idx_exec_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Table for Workflow Builder Definitions (Persistent Canvas JSON)
CREATE TABLE IF NOT EXISTS workflow_definitions (
    workflow_id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    definition_json LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_workflow_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Table for Custom App Definitions (Persistent App Catalog JSON)
CREATE TABLE IF NOT EXISTS app_definitions (
    app_id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(128) NULL,
    definition_json LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_app_name (name),
    INDEX idx_app_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Table for Blocked IPs (SSH Playbook result)
CREATE TABLE IF NOT EXISTS blocked_ips (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_id BIGINT NULL,
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    reason VARCHAR(255) NOT NULL,
    threat_score INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    blocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Table for Ransomware Incidents (Ransomware Playbook result)
CREATE TABLE IF NOT EXISTS ransomware_incidents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_id BIGINT NOT NULL,
    hostname VARCHAR(128) NOT NULL,
    process_name VARCHAR(128) NOT NULL,
    pid INT NOT NULL,
    affected_files INT DEFAULT 0,
    containment_status VARCHAR(64) NOT NULL, -- PROCESS_KILLED_HOST_ISOLATED
    incident_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Table for Dynamic System Configurations (Database-backed Settings)
CREATE TABLE IF NOT EXISTS system_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(128) NOT NULL UNIQUE,
    config_value TEXT NULL,
    description VARCHAR(255) NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'GENERAL',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Table for SOC Users & RBAC Roles
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'ROLE_ANALYST', -- ROLE_ADMIN, ROLE_ANALYST
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
