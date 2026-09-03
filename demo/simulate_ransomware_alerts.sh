#!/usr/bin/env bash
# ==============================================================================
# Script: simulate_ransomware_alerts.sh
# Mục đích: Giả lập bắn EDR Webhook alerts cho các chủng Ransomware khác nhau
# ==============================================================================

WEBHOOK_URL="${1:-http://localhost:8080/api/v1/alerts/ransomware}"
DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIO_DIR="$DEMO_DIR/ransomware_scenarios"

echo "---------------------------------------------------------------"
echo "Mini-SOAR Ransomware Alert Simulator"
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

# 1. LockBit 3.0 (vssadmin Delete Shadows)
send_alert "alert_ransomware_vssadmin_lockbit.json" "LockBit 3.0: Vssadmin Shadow Deletion"

# 2. BlackCat / ALPHV (WMIC Shadowcopy Delete)
send_alert "alert_ransomware_wmic_alphv.json" "BlackCat/ALPHV: WMIC Shadowcopy Deletion"

# 3. Encoded PowerShell Dropper từ Outlook
send_alert "alert_ransomware_powershell_dropper.json" "Phishing Dropper: Encoded PowerShell"

# 4. WannaCry Artifact (bcdedit recoveryenabled No)
send_alert "alert_ransomware_bcdedit_wannacry.json" "WannaCry: BCDEDIT Disable Recovery"

echo -e "\n==============================================================="
echo "Đã gửi xong 4 EDR alerts! Kiểm tra containment action trên SOAR."
echo "==============================================================="
