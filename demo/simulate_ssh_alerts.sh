#!/usr/bin/env bash
# ==============================================================================
# Script: simulate_ssh_alerts.sh
# Mục đích: Giả lập bắn Webhook alerts từ nhiều IP khác nhau vào Mini-SOAR
# ==============================================================================

WEBHOOK_URL="${1:-http://localhost:8080/api/v1/alerts/ssh}"
DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIO_DIR="$DEMO_DIR/ssh_scenarios"

echo "---------------------------------------------------------------"
echo "Mini-SOAR Alert Simulator: Bắn các trường hợp IP khác nhau"
echo "Target Webhook: $WEBHOOK_URL"
echo "Scenario Folder: $SCENARIO_DIR"
echo "---------------------------------------------------------------"

send_alert() {
  local file_name="$1"
  local description="$2"
  local file_path="$SCENARIO_DIR/$file_name"

  if [ -f "$file_path" ]; then
    echo -e "\n[+] Gửi: $description ($file_name)"
    curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -H "X-SOAR-API-KEY: soar-secret-demo-token" \
      -d @"$file_path"
    echo ""
  else
    echo "[-] Không tìm thấy file: $file_path"
  fi
}

# 1. IP Độc hại Quốc tế (Tor / Botnet)
send_alert "alert_ssh_malicious_ru.json" "IP Độc hại cao (Tor/Botnet - 185.220.101.5)"

# 2. IP Việt Nam (Viettel Domestic ISP)
send_alert "alert_ssh_vietnam.json" "IP trong nước (Viettel ISP - 116.108.12.98)"

# 3. IP Private Subnet (Lateral Movement)
send_alert "alert_ssh_internal_lan.json" "IP Private Subnet LAN (192.168.1.105)"

# 4. IP Cloud Datacenter Scanner (AWS)
send_alert "alert_ssh_cloud_scanner.json" "IP Cloud Scanner (AWS - 54.214.24.120)"

echo -e "\n==============================================================="
echo "Đã gửi xong 4 alerts! Bạn có thể kiểm tra danh sách execution trên SOAR."
echo "==============================================================="
