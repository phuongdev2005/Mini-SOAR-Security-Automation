#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:8080"

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}   Mini-SOAR Security Automation - Live Incident Response Simulator   ${NC}"
echo -e "${CYAN}======================================================================${NC}"
echo ""

API_KEY="SOAR-SECRET-API-KEY-2026"

# Scenario 1: External SSH Brute Force
echo -e "${YELLOW}[SCENARIO 1] Ingesting External High-Risk SSH Brute-Force Alert...${NC}"
echo "Attacker IP: 203.0.113.195 | Target: srv-prod-ssh01 | Failed Attempts: 9"
curl -s -X POST "$BASE_URL/api/v1/alerts/ssh" \
  -H "Content-Type: application/json" \
  -H "X-SOAR-API-KEY: $API_KEY" \
  -d '{
    "sourceIp": "203.0.113.195",
    "hostname": "srv-prod-ssh01",
    "username": "root",
    "failedAttempts": 9,
    "description": "SIEM Alert: 9 failed SSH login attempts from external IP 203.0.113.195"
  }' | jq .
echo -e "${GREEN}✓ Scenario 1 Processed by Playbook!${NC}"
echo ""
sleep 2

# Scenario 2: Internal LAN SSH Login Attempt (Low Risk)
echo -e "${YELLOW}[SCENARIO 2] Ingesting Internal Private LAN SSH Attempt...${NC}"
echo "Source IP: 192.168.1.50 | Target: srv-dev-01 | Failed Attempts: 1"
curl -s -X POST "$BASE_URL/api/v1/alerts/ssh" \
  -H "Content-Type: application/json" \
  -H "X-SOAR-API-KEY: $API_KEY" \
  -d '{
    "sourceIp": "192.168.1.50",
    "hostname": "srv-dev-01",
    "username": "developer",
    "failedAttempts": 1,
    "description": "Internal developer typo during SSH login"
  }' | jq .
echo -e "${GREEN}✓ Scenario 2 Processed! Monitored without blocking.${NC}"
echo ""
sleep 2

# Scenario 3: Critical Ransomware Detection
echo -e "${YELLOW}[SCENARIO 3] Ingesting Critical Ransomware Containment Event...${NC}"
echo "Target Host: ws-finance-04 | Process: vssadmin.exe (PID 5120) | Files Modified: 480"
curl -s -X POST "$BASE_URL/api/v1/alerts/ransomware" \
  -H "Content-Type: application/json" \
  -H "X-SOAR-API-KEY: $API_KEY" \
  -d '{
    "hostname": "ws-finance-04",
    "processName": "vssadmin.exe",
    "pid": 5120,
    "suspiciousExtensions": [".locked", ".crypto", ".wnry"],
    "affectedFileCount": 480,
    "description": "EDR Alert: Mass encryption & VSS shadow copy deletion detected"
  }' | jq .
echo -e "${RED}✓ Scenario 3 Processed! Process terminated & Host Isolated.${NC}"
echo ""
sleep 2

# Summary Status
echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}               CURRENT MINI-SOAR METRICS & INCIDENTS                 ${NC}"
echo -e "${CYAN}======================================================================${NC}"
echo -e "${YELLOW}Dashboard Summary Metrics:${NC}"
curl -s -H "X-SOAR-API-KEY: $API_KEY" "$BASE_URL/api/v1/dashboard/summary" | jq .
echo ""

echo -e "${YELLOW}Blocked IPs List (Firewall Action):${NC}"
curl -s -H "X-SOAR-API-KEY: $API_KEY" "$BASE_URL/api/v1/actions/blocked-ips" | jq .
echo ""

echo -e "${YELLOW}Ransomware Isolation History:${NC}"
curl -s -H "X-SOAR-API-KEY: $API_KEY" "$BASE_URL/api/v1/actions/ransomware-incidents" | jq .
echo ""

echo -e "${GREEN}Demo Execution Complete! View Web Dashboard at http://localhost:8080${NC}"
