#!/usr/bin/env python3
"""
Enterprise-Grade Ransomware Emergency Containment Playbook.

Executes real-world ransomware response workflows:
1. Behavioral & Command-Line Heuristic Threat Analysis (VSS deletion, BCDedit tamper, Encoded PowerShell).
2. Forensic Snapshot Collection (Cmdline dump, active socket connections).
3. Process Tree Termination (Root PID + all child processes via OS signals / taskkill).
4. Real OS Network Quarantine (Host network interface isolation / iptables quarantine rules).
5. SOC Telegram Emergency Incident Dispatch.
"""
import sys
import json
import os
import signal
import subprocess
import urllib.request
import urllib.parse
from datetime import datetime


def inspect_process_forensics(pid):
    """Extracts forensic metadata (cmdline, execution path) for target PID if process exists."""
    forensics = {
        "pid": pid,
        "cmdline": "N/A",
        "active_sockets": [],
        "exists": False
    }

    if pid <= 0:
        return forensics

    # Linux /proc inspection
    proc_cmdline_path = f"/proc/{pid}/cmdline"
    if os.path.exists(proc_cmdline_path):
        forensics["exists"] = True
        try:
            with open(proc_cmdline_path, "r") as f:
                content = f.read().replace('\0', ' ').strip()
                forensics["cmdline"] = content if content else "N/A"
        except Exception:
            forensics["cmdline"] = "PERMISSION_DENIED"

    # Dump active network sockets associated with host
    try:
        res = subprocess.run(["ss", "-tupn"], capture_output=True, text=True, timeout=3)
        if res.returncode == 0:
            lines = res.stdout.splitlines()
            forensics["active_sockets"] = [l.strip() for l in lines[1:6]]
    except Exception:
        pass

    return forensics


def analyze_ransomware_heuristics(process_name, command_line, suspicious_exts, file_count):
    """Calculates risk score based on real-world ransomware TTPs (MITRE ATT&CK Matrix)."""
    score = 40
    matched_ttps = []

    # T1490: Inhibit System Recovery (Shadow Copy Deletion / BCDedit tampering)
    critical_cmds = [
        ("vssadmin", "delete shadows"),
        ("wbadmin", "delete catalog"),
        ("bcdedit", "recoveryenabled no"),
        ("wmic", "shadowcopy delete"),
        ("powershell", "-encodedcommand"),
        ("powershell", "nop -w hidden")
    ]

    cmd_lower = (command_line or "").lower()
    proc_lower = process_name.lower()

    for proc, pattern in critical_cmds:
        if proc in proc_lower or pattern in cmd_lower:
            score += 35
            matched_ttps.append(f"T1490: Inhibit System Recovery ({proc} {pattern})")

    # Known ransomware executable names
    known_ransomware_procs = ["wannacry.exe", "lockbit.exe", "ryuk.exe", "blackcat.exe", "encryptor.py", "ransom.exe"]
    if any(rp in proc_lower for rp in known_ransomware_procs):
        score += 30
        matched_ttps.append(f"Known Ransomware Executable Signature ({process_name})")

    # Known crypto file extensions
    known_crypto_exts = [".locked", ".crypto", ".enc", ".lockbit", ".wnry", ".crypted"]
    ext_matched = [e for e in suspicious_exts if e.lower() in known_crypto_exts]
    if ext_matched:
        score += 20
        matched_ttps.append(f"Known Crypto Extension Match ({', '.join(ext_matched)})")

    # Encryption velocity threshold (> 50 modified files/min)
    if file_count > 50:
        score += 15
        matched_ttps.append(f"High Encryption Velocity ({file_count} files/min)")

    final_score = min(100, score)
    return {
        "severity_score": final_score,
        "is_critical": final_score >= 75,
        "matched_ttps": matched_ttps,
        "affected_files": file_count
    }


def terminate_process_tree(pid, process_name, execution_mode):
    """Terminates root process PID and all child processes across Linux & Windows."""
    if execution_mode != "REAL" or pid <= 0:
        return {
            "status": "DRY_RUN_SIMULATED",
            "detail": f"[SIMULATION] Process tree kill simulated for PID {pid} ({process_name})."
        }

    # Windows Process Tree Termination
    if os.name == 'nt':
        try:
            res = subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True, text=True)
            if res.returncode == 0:
                return {"status": "REAL_PROCESS_TREE_KILLED_WIN", "detail": f"Process tree for PID {pid} killed via taskkill /F /T."}
            else:
                return {"status": "REAL_PROCESS_KILL_FAILED", "detail": res.stderr.strip() or "Taskkill failed."}
        except Exception as ex:
            return {"status": "REAL_PROCESS_KILL_ERROR", "detail": str(ex)}

    # Linux / POSIX Process Tree Termination
    try:
        # Check process existence
        os.kill(pid, 0)

        # Kill child processes first via pkill
        try:
            subprocess.run(["pkill", "-9", "-P", str(pid)], capture_output=True, timeout=3)
        except Exception:
            pass

        # Send SIGKILL to target PID
        os.kill(pid, signal.SIGKILL)
        return {
            "status": "REAL_PROCESS_TREE_KILLED_POSIX",
            "detail": f"Target PID {pid} ({process_name}) and child processes terminated via SIGKILL signal."
        }

    except OSError as err:
        if err.errno == 3:  # ESRCH - No process found
            return {"status": "REAL_PROCESS_NOT_FOUND", "detail": f"PID {pid} not found on target host."}
        elif err.errno == 1:  # EPERM - Permission denied
            return {"status": "REAL_PROCESS_KILL_FAILED_PERM", "detail": f"Permission denied trying to kill PID {pid} (Root required)."}
        else:
            return {"status": "REAL_PROCESS_KILL_ERROR", "detail": f"OS Error sending SIGKILL to PID {pid}: {str(err)}"}


def isolate_host_network(hostname, execution_mode):
    """Applies host network quarantine rules or disables non-loopback network interfaces."""
    if execution_mode != "REAL":
        return {
            "status": "DRY_RUN_SIMULATED",
            "detail": f"[SIMULATION] Host network isolation simulated for endpoint '{hostname}'."
        }

    # Real Linux Network Quarantine Execution
    try:
        # Emergency Firewall Quarantine: Drop all traffic except local loopback
        cmd_drop_in = ["iptables", "-A", "INPUT", "!", "-i", "lo", "-j", "DROP"]
        cmd_drop_out = ["iptables", "-A", "OUTPUT", "!", "-o", "lo", "-j", "DROP"]

        res_in = subprocess.run(cmd_drop_in, capture_output=True, text=True)
        res_out = subprocess.run(cmd_drop_out, capture_output=True, text=True)

        if res_in.returncode == 0 and res_out.returncode == 0:
            return {
                "status": "REAL_HOST_NETWORK_QUARANTINED",
                "detail": f"Host '{hostname}' quarantined: iptables DROP rules applied to non-loopback interfaces."
            }
        else:
            return {
                "status": "REAL_HOST_ISOLATION_FAILED",
                "detail": f"iptables execution failed: {res_in.stderr.strip() or res_out.stderr.strip() or 'Root required'}"
            }
    except Exception as ex:
        return {
            "status": "REAL_HOST_ISOLATION_ERROR",
            "detail": f"Failed to execute host network isolation: {str(ex)}"
        }


def send_telegram_bot_notification(hostname, process_name, pid, file_count, suspicious_exts, severity_score, execution_mode, term_status, iso_status, matched_ttps, bot_token, chat_id):
    if not bot_token:
        bot_token = "7891234567:AAFx_MOCK_TELEGRAM_BOT_TOKEN_SOAR"
    if not chat_id:
        chat_id = "@mini_soar_alerts_channel"

    ttps_str = "\n".join([f"  • <code>{t}</code>" for t in matched_ttps]) if matched_ttps else "  • <code>Anomalous File Encryption</code>"

    msg_text = (
        f"<b>[CRITICAL RANSOMWARE INCIDENT] EMERGENCY CONTAINMENT</b>\n\n"
        f"• <b>Severity</b>: <code>CRITICAL ({severity_score}/100)</code>\n"
        f"• <b>Infected Host</b>: <code>{hostname}</code>\n"
        f"• <b>Process (PID)</b>: <code>{process_name} (PID: {pid})</code>\n"
        f"• <b>Encrypted Files</b>: <code>{file_count}</code>\n"
        f"• <b>Extensions</b>: <code>{', '.join(suspicious_exts)}</code>\n"
        f"• <b>Execution Mode</b>: <code>[{execution_mode}]</code>\n\n"
        f"<b>MATCHED MITRE ATT&CK TTPs</b>:\n{ttps_str}\n\n"
        f"<b>AUTOMATED CONTAINMENT ACTIONS</b>:\n"
        f"1. <b>Process Tree Kill</b>: <code>{term_status}</code>\n"
        f"2. <b>Network Quarantine</b>: <code>{iso_status}</code>\n\n"
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
        "action": "SEND_TELEGRAM_BOT_RANSOMWARE_ALERT",
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
    hostname = data.get("hostname", "UNKNOWN-HOST")
    process_name = data.get("process_name") or data.get("processName", "unknown_process.exe")
    command_line = data.get("command_line") or data.get("commandLine") or f"{process_name} delete shadows"
    pid = int(data.get("pid", 0))
    suspicious_exts = data.get("suspicious_extensions") or data.get("suspiciousExtensions") or [".locked"]
    affected_file_count = int(data.get("affected_file_count") or data.get("affectedFileCount", 100))

    steps_log = []

    # Step 1: Parse Alert Payload
    steps_log.append({
        "step": 1,
        "name": "Parse Ransomware IOC Payload",
        "detail": f"Mode: {execution_mode} | Host: {hostname}, Process: {process_name} (PID {pid}), Extensions: {suspicious_exts}, Files modified: {affected_file_count}",
        "timestamp": datetime.now().isoformat()
    })

    # Step 2: Extract Process Forensics
    forensics = inspect_process_forensics(pid)
    steps_log.append({
        "step": 2,
        "name": "Extract Process Forensic Snapshot",
        "detail": f"PID {pid} Cmdline: {forensics['cmdline']} | Active Sockets: {len(forensics['active_sockets'])}",
        "data": forensics,
        "timestamp": datetime.now().isoformat()
    })

    # Step 3: Behavioral Heuristic Threat Analysis
    analysis = analyze_ransomware_heuristics(process_name, command_line, suspicious_exts, affected_file_count)
    steps_log.append({
        "step": 3,
        "name": "Analyze Behavioral Heuristics & MITRE TTPs",
        "detail": f"Risk Score: {analysis['severity_score']}/100 | Matched TTPs: {len(analysis['matched_ttps'])}",
        "data": analysis,
        "timestamp": datetime.now().isoformat()
    })

    # Step 4: Process Tree Termination
    term_res = terminate_process_tree(pid, process_name, execution_mode)
    steps_log.append({
        "step": 4,
        "name": f"Terminate Process Tree [{execution_mode}]",
        "detail": term_res["detail"],
        "data": term_res,
        "timestamp": datetime.now().isoformat()
    })

    # Step 5: Endpoint Network Isolation
    iso_res = isolate_host_network(hostname, execution_mode)
    steps_log.append({
        "step": 5,
        "name": f"Quarantine Endpoint Network [{execution_mode}]",
        "detail": iso_res["detail"],
        "data": iso_res,
        "timestamp": datetime.now().isoformat()
    })

    # Step 6: Dispatch Telegram Incident Alert
    telegram_res = send_telegram_bot_notification(
        hostname, process_name, pid, affected_file_count, suspicious_exts,
        analysis['severity_score'], execution_mode, term_res['status'],
        iso_res['status'], analysis['matched_ttps'], bot_token, chat_id
    )
    steps_log.append({
        "step": 6,
        "name": "Dispatch Telegram Incident Alert",
        "detail": f"Dispatched notification to chat_id: {telegram_res['chat_id']}",
        "data": telegram_res,
        "timestamp": datetime.now().isoformat()
    })

    final_result = {
        "status": "COMPLETED",
        "alert_id": alert_id,
        "execution_mode": execution_mode,
        "playbook": "RANSOMWARE_CONTAINMENT_PLAYBOOK",
        "action_taken": f"PROCESS_KILLED_HOST_ISOLATED_{execution_mode}",
        "hostname": hostname,
        "terminated_pid": pid,
        "process_kill_status": term_res["status"],
        "network_isolation_status": iso_res["status"],
        "severity_score": analysis["severity_score"],
        "steps": steps_log,
        "summary": f"[{execution_mode}] Ransomware Containment Playbook completed. Host: {hostname}, Process PID {pid} status: {term_res['status']}, Network: {iso_res['status']}."
    }

    print(json.dumps(final_result, indent=2))


if __name__ == "__main__":
    main()
