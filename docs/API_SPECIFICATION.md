# Đặc tả API & Tích hợp Webhook (API & Ingestion Specification)
## Mini-SOAR Security Automation Platform

---

## 1. Thông tin Chung (General Specs)
- **Base URL**: `http://localhost:8080` (hoặc domain triển khai)
- **Format**: JSON (`Content-Type: application/json`)
- **Authentication**: RESTful Endpoints công khai (Có thể bổ sung API Key / Bearer Token khi đưa vào production).

---

## 2. Ingestion Webhook APIs (Tiếp nhận Cảnh báo)

### 2.1. Webhook Tiếp nhận Cảnh báo SSH Brute-Force
- **Endpoint**: `POST /api/v1/alerts/ssh`
- **Mô tả**: Được gọi bởi SIEM/Syslog Collector khi phát hiện các hành vi đăng nhập SSH thất bại liên tục hoặc truy cập trái phép.

#### Request Body Schema:
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `sourceIp` | String | **Có** | Địa chỉ IP của đối tượng tấn công (IPv4/IPv6). |
| `hostname` | String | **Có** | Tên máy chủ SSH mục tiêu bị tấn công. |
| `username` | String | Không | Tên tài khoản SSH bị nhắm tới (vd: `root`, `admin`). |
| `failedAttempts` | Integer | **Có** | Số lần đăng nhập sai phát hiện trong khoảng thời gian t. |
| `description` | String | Không | Mô tả bổ sung từ hệ thống phát hiện. |

#### Example Request (curl):
```bash
curl -X POST http://localhost:8080/api/v1/alerts/ssh \
  -H "Content-Type: application/json" \
  -d '{
    "sourceIp": "198.51.100.44",
    "hostname": "srv-prod-ssh01",
    "username": "root",
    "failedAttempts": 6,
    "description": "Multiple SSH authentication failures detected from external IP"
  }'
```

#### Example Response (`201 Created`):
```json
{
  "id": 1,
  "alertType": "SSH_BRUTEFORCE",
  "severity": "HIGH",
  "sourceIp": "198.51.100.44",
  "hostname": "srv-prod-ssh01",
  "description": "Multiple SSH authentication failures detected from external IP",
  "rawPayload": "{\"sourceIp\":\"198.51.100.44\",\"hostname\":\"srv-prod-ssh01\",\"username\":\"root\",\"failedAttempts\":6}",
  "status": "RESOLVED",
  "createdAt": "2026-08-22T09:13:02.240",
  "updatedAt": "2026-08-22T09:13:02.240"
}
```

---

### 2.2. Webhook Tiếp nhận Cảnh báo Ransomware
- **Endpoint**: `POST /api/v1/alerts/ransomware`
- **Mô tả**: Được gọi bởi EDR / Endpoint Security Agents khi phát hiện tiến trình nghi vấn xóa VSS shadow copy hoặc mã hóa hàng loạt file.

#### Request Body Schema:
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `hostname` | String | **Có** | Tên máy trạm / máy chủ bị nhiễm mã độc. |
| `processName` | String | **Có** | Tên tiến trình gây hại (vd: `vssadmin.exe`, `wannacry.exe`). |
| `pid` | Integer | **Có** | Process ID của tiến trình độc hại trên OS. |
| `suspiciousExtensions` | Array[String] | Không | Danh sách đuôi file bị đổi (vd: `[".locked", ".crypto"]`). |
| `affectedFileCount` | Integer | Không | Số lượng file đã bị đổi đuôi trong 1 phút. |
| `description` | String | Không | Ghi chú từ EDR Agent. |

#### Example Request (curl):
```bash
curl -X POST http://localhost:8080/api/v1/alerts/ransomware \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "ws-finance-dept04",
    "processName": "wannacry.exe",
    "pid": 5120,
    "suspiciousExtensions": [".locked", ".crypto"],
    "affectedFileCount": 320,
    "description": "Critical Ransomware File Encryption Activity Detected"
  }'
```

---

## 3. Query & Action History APIs (Tra cứu & Báo cáo)

### 3.1. Lấy Danh sách Tất cả Cảnh báo
- **Endpoint**: `GET /api/v1/alerts`
- **Response**: Trả về mảng danh sách sự cố đã tiếp nhận.

### 3.2. Lấy Lịch sử Thực thi Playbook Chi tiết
- **Endpoint**: `GET /api/v1/executions`
- **Endpoint Theo Alert ID**: `GET /api/v1/executions/alert/{alertId}`
- **Response Format**:
```json
[
  {
    "id": 1,
    "alertId": 1,
    "playbookName": "ssh_playbook.py",
    "status": "COMPLETED",
    "executionTimeMs": 45,
    "resultSummary": "SSH Playbook executed successfully for IP 198.51.100.44. Final status: IP Blocked.",
    "executionLog": "{\n  \"status\": \"COMPLETED\",\n  \"steps\": [...]\n}",
    "startedAt": "2026-08-22T09:13:02.256"
  }
]
```

### 3.3. Lấy Danh sách IP đã bị Chặn Firewall
- **Endpoint**: `GET /api/v1/actions/blocked-ips`

### 3.4. Lấy Danh sách Máy chủ đã bị Cô lập do Ransomware
- **Endpoint**: `GET /api/v1/actions/ransomware-incidents`

### 3.5. Lấy Thống kê Dashboard Tổng quan
- **Endpoint**: `GET /api/v1/dashboard/summary`
```json
{
  "totalAlerts": 2,
  "sshAlerts": 1,
  "ransomwareAlerts": 1,
  "resolvedAlerts": 2,
  "totalExecutions": 2,
  "completedExecutions": 2,
  "totalBlockedIps": 1,
  "totalRansomwareIncidents": 1
}
```
