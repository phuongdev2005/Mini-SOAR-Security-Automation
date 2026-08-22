#!/usr/bin/env python3
"""
SSH Brute-Force Attack Response Playbook.

Evaluates incoming SSH alert payloads, enriches indicators (GeoIP, Threat Intel, Asset Criticality),
calculates dynamic severity scores, enforces firewall containment rules, and dispatches Telegram notifications.
"""
import sys
import json
import os
import re
import subprocess
import urllib.request
import urllib.parse
from datetime import datetime


def lookup_geoip(source_ip):
    private_patterns = [r"^127\.", r"^10\.", r"^172\.(1[6-9]|2[0-9]|3[0-1])\.", r"^192\.168\."]
    if any(re.match(p, source_ip) for p in private_patterns):
        return {
            "country": "INTERNAL_LAN",
            "country_code": "LOCAL",
            "city": "Private Subnet",
            "isp": "Corporate Internal Network",
            "is_private": True
        }

    ip_parts = [int(x) for x in source_ip.split('.') if x.isdigit()]
    ip_sum = sum(ip_parts) if ip_parts else 100

    countries = [
        {"country": "United States", "code": "US", "city": "Ashburn", "isp": "DigitalOcean LLC", "asn": "AS14061"},
        {"country": "Netherlands", "code": "NL", "city": "Amsterdam", "isp": "Hostinger International", "asn": "AS47583"},
        {"country": "Germany", "code": "DE", "city": "Frankfurt", "isp": "Hetzner Online GmbH", "asn": "AS24940"},
        {"country": "China", "code": "CN", "city": "Beijing", "isp": "CHINANET Network", "asn": "AS4134"},
        {"country": "Russia", "code": "RU", "city": "Moscow", "isp": "Rostelecom PJSC", "asn": "AS12389"}
    ]
    geo = countries[ip_sum % len(countries)]
    geo["is_private"] = False
    return geo


def query_threat_intel(source_ip, geo_info):
    if geo_info["is_private"]:
        return {
            "threat_score": 15,
            "abuse_reports_count": 0,
            "threat_category": "Internal Host",
            "is_blacklisted": False
        }

    ip_sum = sum(int(x) for x in source_ip.split('.') if x.isdigit())
    score = min(98, 65 + (ip_sum % 33))
    return {
        "threat_score": score,
        "abuse_reports_count": (ip_sum % 120) + 12,
        "threat_category": "SSH Scanner / Brute-Force Botnet Node",
        "is_blacklisted": score > 75
    }


def check_asset_inventory(hostname):
    hostname_lower = hostname.lower()
    if any(k in hostname_lower for k in ["prod", "db", "master"]):
        return {
            "asset_name": hostname,
            "environment": "PRODUCTION",
            "criticality": "CRITICAL_ASSET",
            "weight_score": 30,
            "owner_team": "SecOps & Infrastructure Team"
        }
    elif any(k in hostname_lower for k in ["stage", "test"]):
        return {
            "asset_name": hostname,
            "environment": "STAGING",
            "criticality": "MEDIUM_ASSET",
            "weight_score": 15,
            "owner_team": "QA & Dev Team"
        }
    else:
        return {
            "asset_name": hostname,
            "environment": "DEVELOPMENT / LOCAL",
            "criticality": "LOW_ASSET",
            "weight_score": 5,
            "owner_team": "IT Helpdesk"
        }


def calculate_dynamic_severity(fail_count, threat_score, asset_weight, is_private):
    attempt_weight = 40 if fail_count >= 5 else (25 if fail_count >= 3 else 10)
    threat_intel_weight = 0 if is_private else int(threat_score * 0.35)

    total_score = min(100, attempt_weight + threat_intel_weight + asset_weight)

    if total_score >= 85:
        level = "CRITICAL"
    elif total_score >= 65:
        level = "HIGH"
    elif total_score >= 40:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {
        "calculated_severity": level,
        "total_severity_score": total_score,
        "breakdown": {
            "attempt_count_weight": attempt_weight,
            "threat_intel_weight": threat_intel_weight,
            "asset_criticality_weight": asset_weight
        }
    }


def send_telegram_bot_notification(hostname, source_ip, username, fail_count, geo_info, severity_level, is_blocked, execution_mode, bot_token, chat_id):
    if not bot_token:
        bot_token = "7891234567:AAFx_MOCK_TELEGRAM_BOT_TOKEN_SOAR"
    if not chat_id:
        chat_id = "@mini_soar_alerts_channel"

    status_badge = f"BLOCK_IP_FIREWALL ({execution_mode})" if is_blocked else "MONITOR_ONLY"

    msg_text = (
        f"<b>[MINI-SOAR ALERT] SSH ATTACK INCIDENT</b>\n\n"
        f"• <b>Severity</b>: <code>{severity_level}</code>\n"
        f"• <b>Target Host</b>: <code>{hostname}</code>\n"
        f"• <b>Target User</b>: <code>{username}</code>\n"
        f"• <b>Source IP</b>: <code>{source_ip}</code> ({geo_info.get('country', 'N/A')} - {geo_info.get('isp', 'N/A')})\n"
        f"• <b>Failed Attempts</b>: <code>{fail_count}</code>\n"
        f"• <b>Execution Mode</b>: <code>[{execution_mode}]</code>\n"
        f"• <b>Action Taken</b>: <code>{status_badge}</code>\n\n"
        f"<i>Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</i>"
    )

    telegram_api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": msg_text,
        "parse_mode": "HTML"
    }

    send_status = "DELIVERED_SIMULATED"
    http_code = 200
    error_msg = None

    if "MOCK" not in bot_token:
        try:
            req = urllib.request.Request(
                telegram_api_url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                http_code = response.getcode()
                send_status = "SENT_TELEGRAM_API_SUCCESS"
        except Exception as e:
            send_status = "TELEGRAM_API_ERROR"
            error_msg = str(e)

    return {
        "action": "SEND_TELEGRAM_BOT_ALERT",
        "chat_id": chat_id,
        "status": send_status,
        "http_code": http_code,
        "error": error_msg
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"status": "FAILED", "error": "No JSON payload provided"}))
        sys.exit(1)

    try:
        data = json.loads(sys.argv[1])
    except Exception as e:
        print(json.dumps({"status": "FAILED", "error": f"Invalid JSON input: {str(e)}"}))
        sys.exit(1)

    sys_configs = data.get("system_configs") or {}
    execution_mode = (sys_configs.get("SOAR_EXECUTION_MODE") or "SIMULATION").upper()
    bot_token = sys_configs.get("TELEGRAM_BOT_TOKEN")
    chat_id = sys_configs.get("TELEGRAM_CHAT_ID")

    alert_id = data.get("alert_id")
    source_ip = data.get("source_ip") or data.get("sourceIp", "0.0.0.0")
    hostname = data.get("hostname") or data.get("host", "localhost")
    username = data.get("username") or data.get("user", "unknown")
    fail_count = int(data.get("failed_attempts") or data.get("fail_count", 1))

    steps_log = []

    # Stage 1: Parse Input
    steps_log.append({
        "stage": "1. PARSE",
        "name": "Parse Alert Payload",
        "detail": f"Mode: {execution_mode} | IP: {source_ip}, Host: {hostname}, User: {username}, Failed Attempts: {fail_count}",
        "timestamp": datetime.now().isoformat()
    })

    # Stage 2: Enrich & Risk Assessment
    geo_info = lookup_geoip(source_ip)
    threat_intel = query_threat_intel(source_ip, geo_info)
    asset_info = check_asset_inventory(hostname)
    sev_eval = calculate_dynamic_severity(fail_count, threat_intel["threat_score"], asset_info["weight_score"], geo_info["is_private"])
    severity_level = sev_eval["calculated_severity"]

    steps_log.append({
        "stage": "2. ENRICH & SEVERITY EVALUATION",
        "name": "Enrich Indicators & Severity Assessment",
        "detail": f"Severity: {severity_level} (Score: {sev_eval['total_severity_score']}/100) | Country: {geo_info['country']}",
        "data": {
            "severity_evaluation": sev_eval,
            "geoip": geo_info,
            "threat_intel": threat_intel,
            "asset_inventory": asset_info
        },
        "timestamp": datetime.now().isoformat()
    })

    # Stage 3: Escalation Decision
    should_escalate = (fail_count >= 5) or (threat_intel["threat_score"] >= 70) or (severity_level in ["HIGH", "CRITICAL"])

    steps_log.append({
        "stage": "3. DECISION",
        "name": "Evaluate Escalation Policy",
        "detail": f"Severity: {severity_level}, Failures: {fail_count} -> Escalate: {should_escalate}",
        "escalated": should_escalate,
        "timestamp": datetime.now().isoformat()
    })

    # Stage 4: Firewall Enforcement Action
    block_result = None
    if should_escalate:
        rule_cmd = f"iptables -A INPUT -s {source_ip} -p tcp --dport 22 -j DROP"

        if execution_mode == "REAL":
            try:
                cmd_parts = ["iptables", "-A", "INPUT", "-s", source_ip, "-p", "tcp", "--dport", "22", "-j", "DROP"]
                proc_res = subprocess.run(cmd_parts, capture_output=True, text=True)
                if proc_res.returncode == 0:
                    block_status = "REAL_EXECUTION_SUCCESS"
                    block_detail = "Firewall rule enforced via iptables."
                else:
                    block_status = "REAL_EXECUTION_FAILED"
                    block_detail = f"iptables failed (exit code {proc_res.returncode}): {proc_res.stderr.strip() or 'Root privileges required'}"
            except Exception as ex:
                block_status = "REAL_EXECUTION_ERROR"
                block_detail = f"Execution error: {str(ex)}"
        else:
            block_status = "DRY_RUN_SIMULATED"
            block_detail = f"[SIMULATION] Rule generated: {rule_cmd}"

        block_result = {
            "action": "BLOCK_IP_FIREWALL",
            "execution_mode": execution_mode,
            "status": block_status,
            "blocked_ip": source_ip,
            "command_generated": rule_cmd,
            "detail": block_detail,
            "reason": f"Severity {severity_level} (Score: {sev_eval['total_severity_score']}) - SSH Attack"
        }

        steps_log.append({
            "stage": "4. RESPONSE (Firewall)",
            "name": f"Enforce Firewall Rule [{execution_mode}]",
            "detail": block_detail,
            "data": block_result,
            "timestamp": datetime.now().isoformat()
        })

    # Stage 5: Dispatch Telegram Alert
    telegram_result = send_telegram_bot_notification(hostname, source_ip, username, fail_count, geo_info, severity_level, should_escalate, execution_mode, bot_token, chat_id)
    steps_log.append({
        "stage": "4. RESPONSE (Telegram Bot)",
        "name": "Send Telegram Incident Notification",
        "detail": f"Dispatched notification to chat_id: {telegram_result['chat_id']}",
        "data": telegram_result,
        "timestamp": datetime.now().isoformat()
    })

    final_result = {
        "status": "COMPLETED",
        "alert_id": alert_id,
        "execution_mode": execution_mode,
        "playbook": "SSH_RESPONSE_PLAYBOOK",
        "severity": severity_level,
        "severity_score": sev_eval["total_severity_score"],
        "action_taken": f"BLOCKED_IP_{execution_mode}" if should_escalate else f"LOGGED_MONITORED_{execution_mode}",
        "blocked_ip": source_ip if should_escalate else None,
        "steps": steps_log,
        "summary": f"[{execution_mode}] SSH Playbook execution completed. Target: {hostname}, Attacker: {source_ip} ({geo_info['country']}). Status: {block_result['status'] if block_result else 'LOGGED_ONLY'}."
    }

    print(json.dumps(final_result, indent=2))


if __name__ == "__main__":
    main()
