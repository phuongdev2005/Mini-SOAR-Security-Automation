# 🛡️ Mini SOAR Security Automation - Backend REST API Specification

> **Tài liệu đặc tả toàn bộ hệ thống REST API của Backend Spring Boot.**  
> Phiên bản Backend: `1.0.0` | Base URL: `http://localhost:8080` | Môi trường: Java 21 / Spring Boot 3.2.5

---

## 📑 Mục lục (Table of Contents)

1. [Tổng quan hệ thống (Overview)](#1-tổng-quan-hệ-thống)
2. [Cơ chế xác thực & Phân quyền (Authentication)](#2-cơ-chế-xác-thực--phân-quyền)
3. [Module 1: Alert Ingestion API (`/api/v1/alerts`)](#3-module-1-alert-ingestion-api)
4. [Module 2: Dashboard & Thống kê (`/api/v1/dashboard`)](#4-module-2-dashboard--thống-kê)
5. [Module 3: Hành động Bảo mật Tự động (`/api/v1/actions`)](#5-module-3-hành-động-bảo-mật-tự-động)
6. [Module 4: Lịch sử Thực thi Playbook (`/api/v1/executions`)](#6-module-4-lịch-sử-thực-thi-playbook)
7. [Module 5: Cấu hình Hệ thống (`/api/v1/configs`)](#7-module-5-cấu-hình-hệ-thống)
8. [Module 6: Quản lý Người dùng & Phiên (`/api/v1/auth`)](#8-module-6-quản-lý-người-dùng--phiên)
9. [Module 7: Visual Workflow & App Integration (Shuffle Engine)](#9-module-7-visual-workflow--app-integration)
10. [Mã trạng thái HTTP & Xử lý Lỗi (Error Handling)](#10-mã-trạng-thái-http--xử-lý-lỗi)

---

## 1. Tổng quan hệ thống

Hệ thống **Mini-SOAR (Security Orchestration, Automation, and Response)** cung cấp các API phục vụ tiếp nhận cảnh báo (SIEM/Wazuh/Suricata/EDR), phân tích độ nguy hại (Threat Intelligence - AbuseIPDB), thực thi cô lập tự động (Firewall iptables, Remote SSH JSch/OpenSSH, Kill Process) và thông báo sự cố (Telegram Bot).

* **Định dạng dữ liệu:** `application/json`
* **Múi giờ chuẩn:** `ISO-8601 (UTC / Local DateTime)`
* **CORS:** Cho phép `http://localhost:3000` (Frontend Vite/React) và `http://localhost:8080`
* **Queue Engine:** Tích hợp RabbitMQ (`mini_soar_exchange` -> `mini_soar_queue`) kết hợp ThreadPoolTaskExecutor nội bộ.

---

## 2. Cơ chế xác thực & Phân quyền

Hệ thống hỗ trợ cơ chế xác thực kép linh hoạt:

1. **Header Authorization:**
   ```http
   Authorization: Bearer <session_token>
   ```
2. **Custom Session Header:**
   ```http
   X-SOAR-SESSION-TOKEN: <session_token>
   ```
3. **Cookie HTTP:** `session_token` hoặc `soar_token` được tự động gán khi đăng nhập thành công.

---

## 3. Module 1: Alert Ingestion API

Base Path: `/api/v1/alerts`

### 3.1. Tiếp nhận Cảnh báo SSH Brute-Force
* **Endpoint:** `POST /api/v1/alerts/ssh`
* **Mô tả:** Tiếp nhận cảnh báo tấn công dò mật khẩu SSH từ Wazuh/Suricata/Auth.log, lưu vào DB và đẩy vào hàng đợi tự động phân tích.
* **Request Headers:** `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "source_ip": "198.51.100.25",
    "hostname": "srv-production-01",
    "username": "root",
    "failed_attempts": 15,
    "description": "Multiple failed SSH logins detected from external IP"
  }
  ```
  *(Hỗ trợ các alias: `sourceIp`, `src_ip`, `attacker_ip`, `failedAttempts`, `attempt_count`)*
* **Response:** `201 Created`
  ```json
  {
    "id": 101,
    "alertType": "SSH_BRUTEFORCE",
    "severity": "HIGH",
    "sourceIp": "198.51.100.25",
    "hostname": "srv-production-01",
    "description": "Multiple failed SSH logins detected from external IP",
    "rawPayload": "{\"source_ip\":\"198.51.100.25\",...}",
    "status": "NEW",
    "createdAt": "2026-09-04T21:00:00",
    "updatedAt": "2026-09-04T21:00:00"
  }
  ```

### 3.2. Tiếp nhận Cảnh báo Ransomware
* **Endpoint:** `POST /api/v1/alerts/ransomware`
* **Mô tả:** Tiếp nhận cảnh báo tiến trình mã hóa dữ liệu độc hại từ EDR/Sysmon.
* **Request Body:**
  ```json
  {
    "hostname": "srv-finance-01",
    "host_ip": "192.168.1.50",
    "process_name": "lockbit3.exe",
    "pid": 4589,
    "command_line": "vssadmin delete shadows /all /quiet",
    "suspicious_extensions": [".lockbit", ".crypto"],
    "affected_file_count": 150,
    "description": "Suspicious encryption and shadow copy removal"
  }
  ```
* **Response:** `201 Created` (Schema tương tự AlertResponseDTO, `severity: CRITICAL`).

### 3.3. Lấy Danh sách Tất cả Cảnh báo
* **Endpoint:** `GET /api/v1/alerts`
* **Response:** `200 OK` (Mảng danh sách các cảnh báo sắp xếp theo ID giảm dần).

### 3.4. Lấy Chi tiết Cảnh báo theo ID
* **Endpoint:** `GET /api/v1/alerts/{id}`
* **Path Variable:** `id` (Long) - ID của cảnh báo.
* **Response:** `200 OK` (Chi tiết cảnh báo) hoặc `404 Not Found`.

---

## 4. Module 2: Dashboard & Thống kê

Base Path: `/api/v1/dashboard`

### 4.1. Lấy Số liệu Tổng quan (Summary Metrics)
* **Endpoint:** `GET /api/v1/dashboard/summary`
* **Mô tả:** Cung cấp thông số thời gian thực cho trang Dashboard chính: tổng cảnh báo, phân loại cảnh báo, số IP đã chặn, số luồng xử lý và hàng đợi queue.
* **Response:** `200 OK`
  ```json
  {
    "totalAlerts": 42,
    "sshAlerts": 28,
    "ransomwareAlerts": 14,
    "resolvedAlerts": 39,
    "totalExecutions": 42,
    "completedExecutions": 41,
    "totalBlockedIps": 18,
    "totalRansomwareIncidents": 12,
    "pendingQueueTasks": 0,
    "activeWorkerThreads": 2
  }
  ```

---

## 5. Module 3: Hành động Bảo mật Tự động

Base Path: `/api/v1/actions`

### 5.1. Tra cứu Uy tín IP (Threat Intelligence - AbuseIPDB)
* **Endpoint:** `GET /api/v1/actions/check-ip`
* **Query Parameters:**
  * `ip` *(String, bắt buộc)*: Địa chỉ IP cần tra cứu.
  * `apiKey` *(String, tuỳ chọn)*: Khóa API AbuseIPDB ghi đè cấu hình hệ thống.
  * `maxAgeDays` *(int, mặc định `90`)*: Giới hạn ngày báo cáo.
  * `demoMode` *(boolean, mặc định `false`)*: Chạy giả lập không cần gọi internet.
* **Response:** `200 OK`
  ```json
  {
    "status": "SUCCESS",
    "status_code": 200,
    "threat_score": 100,
    "total_reports": 248,
    "is_malicious": true,
    "threat_category": "SSH Brute-Force",
    "country_code": "CN",
    "isp": "CHINANET Network",
    "queried_ip": "118.25.6.8",
    "is_real_api": true,
    "provider": "AbuseIPDB API v2 (REAL_LOOKUP)"
  }
  ```

### 5.2. Danh sách IP đang bị Chặn Firewall
* **Endpoint:** `GET /api/v1/actions/blocked-ips`
* **Response:** `200 OK` (Danh sách các IP đang có cờ `isActive = true`).

### 5.3. Thêm IP vào danh sách Chặn thủ công
* **Endpoint:** `POST /api/v1/actions/blocked-ips`
* **Request Body:**
  ```json
  {
    "ip_address": "203.0.113.195",
    "reason": "Manual block via SOAR UI",
    "threat_score": 85
  }
  ```
* **Response:** `200 OK`

### 5.4. Gỡ bỏ Chặn IP (Unblock)
* **Endpoint:** `DELETE /api/v1/actions/blocked-ips/{id}`
* **Path Variable:** `id` (Long) - ID bản ghi Blocked IP.
* **Response:** `200 OK`
  ```json
  {
    "status": "SUCCESS",
    "message": "Unblocked IP successfully",
    "id": 12
  }
  ```

### 5.5. Lịch sử Cô lập Ransomware (Incidents)
* **Endpoint:** `GET /api/v1/actions/ransomware-incidents`
* **Response:** `200 OK` (Danh sách các sự cố diệt tiến trình mã độc và cô lập mạng host).

### 5.6. Thực thi Lệnh SSH Từ xa (Remote VPS Execution)
* **Endpoint:** `POST /api/v1/actions/remote-ssh/execute`
* **Mô tả:** Sử dụng JSch Java Client (hoặc Fallback OpenSSH) để chạy lệnh ứng phó trên Server Linux mục tiêu.
* **Request Body:**
  ```json
  {
    "host": "192.168.1.100",
    "username": "root",
    "command": "iptables -I INPUT 1 -s 198.51.100.25 -j DROP",
    "port": 22,
    "timeout_seconds": 10
  }
  ```
* **Response:** `200 OK`
  ```json
  {
    "success": true,
    "mode": "JAVA_JSCH_SSH",
    "exit_code": 0,
    "stdout": "RULE_PRESENT",
    "stderr": "",
    "detail": "[JAVA JSCH SSH] Executed on '192.168.1.100' (Exit Code 0)"
  }
  ```

### 5.7. Gửi Cảnh báo Telegram Bot
* **Endpoint:** `POST /api/v1/actions/send-telegram`
* **Request Body:**
  ```json
  {
    "message": "<b>[ALERT]</b> Detected Malicious Activity on Host <code>srv-01</code>",
    "chat_id": "@mini_soar_alerts"
  }
  ```
* **Response:** `200 OK`

---

## 6. Module 4: Lịch sử Thực thi Playbook

Base Path: `/api/v1/executions`

### 6.1. Lấy Toàn bộ Lịch sử Thực thi
* **Endpoint:** `GET /api/v1/executions`
* **Response:** `200 OK` (Danh sách các lượt chạy playbook theo thứ tự mới nhất).

### 6.2. Lấy Chi tiết Lượt Chạy Playbook
* **Endpoint:** `GET /api/v1/executions/{id}`
* **Response:** `200 OK`
  ```json
  {
    "id": 55,
    "alertId": 101,
    "playbookName": "ssh_playbook.py",
    "status": "COMPLETED",
    "executionTimeMs": 340,
    "resultSummary": "Native SOAR: Threat Score 85/100 (HIGH). IP 198.51.100.25 Blocked in Firewall & Telegram Alert Dispatched.",
    "executionLog": "{\"steps\":[...], \"status\":\"COMPLETED\"}",
    "startedAt": "2026-09-04T21:00:01",
    "completedAt": "2026-09-04T21:00:01.340"
  }
  ```

### 6.3. Lấy Lịch sử Thực thi theo Cảnh báo (Alert ID)
* **Endpoint:** `GET /api/v1/executions/alert/{alertId}`
* **Response:** `200 OK`

---

## 7. Module 5: Cấu hình Hệ thống

Base Path: `/api/v1/configs`

### 7.1. Lấy Danh sách Cấu hình
* **Endpoint:** `GET /api/v1/configs`
* **Response:** `200 OK`
  ```json
  [
    {
      "configKey": "SOAR_EXECUTION_MODE",
      "configValue": "SIMULATION",
      "description": "REAL_EXECUTION hoặc SIMULATION"
    },
    {
      "configKey": "ABUSEIPDB_API_KEY",
      "configValue": "******",
      "description": "Khóa API AbuseIPDB v2"
    },
    {
      "configKey": "TELEGRAM_BOT_TOKEN",
      "configValue": "******",
      "description": "Token Bot Telegram"
    },
    {
      "configKey": "REMOTE_VPS_HOST",
      "configValue": "192.168.1.100",
      "description": "Địa chỉ máy chủ VPS ứng phó từ xa"
    }
  ]
  ```

### 7.2. Cập nhật Cấu hình Hệ thống
* **Endpoint:** `POST /api/v1/configs`
* **Request Body:**
  ```json
  {
    "SOAR_EXECUTION_MODE": "REAL_EXECUTION",
    "ABUSEIPDB_API_KEY": "your_api_key_here",
    "TELEGRAM_CHAT_ID": "-1001234567890"
  }
  ```
* **Response:** `200 OK` (Danh sách cấu hình sau khi cập nhật).

---

## 8. Module 6: Quản lý Người dùng & Phiên

Base Path: `/api/v1/auth`

### 8.1. Đăng nhập Hệ thống
* **Endpoint:** `POST /api/v1/auth/login` (hoặc `POST /login`)
* **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "Password@123"
  }
  ```
* **Response:** `200 OK`
  ```json
  {
    "token": "soar_sec_token_9a1f...",
    "username": "admin",
    "fullName": "Security Administrator",
    "role": "ROLE_ADMIN"
  }
  ```
  *(Kèm theo Cookies: `session_token`, `soar_token`, `soar_user` với max-age 24h)*

### 8.2. Đăng xuất
* **Endpoint:** `POST /api/v1/auth/logout`
* **Response:** `200 OK` (Xóa bỏ toàn bộ cookie phiên đăng nhập).

### 8.3. Lấy Thông tin Người dùng hiện tại
* **Endpoint:** `GET /api/v1/auth/me` (hoặc `GET /me`, `GET /getinfo`)
* **Headers:** `Authorization: Bearer <token>` hoặc Cookie
* **Response:** `200 OK`
  ```json
  {
    "username": "admin",
    "fullName": "Security Administrator",
    "role": "ROLE_ADMIN"
  }
  ```

---

## 9. Module 7: Visual Workflow & App Integration

*Các API tương thích chuẩn giao tiếp SOAR Workflow Builder (Shuffle Graph Engine)*

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/workflows` | Lấy danh sách toàn bộ workflow graph |
| `GET` | `/workflows/{id}` | Lấy chi tiết DAG của 1 workflow (ví dụ `wf-ssh-01`, `wf-ransomware-01`) |
| `POST` | `/workflows` | Tạo mới một workflow visual |
| `PUT` | `/workflows/{id}` | Cập nhật cấu trúc nodes và edges của workflow |
| `POST` | `/workflows/{id}/execute` | Kích hoạt chạy workflow DAG trực tiếp |
| `POST` | `/workflows/{id}/activate` | Chuyển trạng thái workflow sang `RUNNING` |
| `POST` | `/workflows/{id}/deactivate` | Tạm dừng workflow (`PAUSED`) |
| `GET` | `/workflows/{id}/executions` | Lịch sử các lần kích hoạt của workflow |
| `GET` | `/apps` | Danh sách SOAR Apps tích hợp sẵn (AbuseIPDB, iptables, Telegram, SSH, Mail) |
| `POST` | `/apps` | Đăng ký App/Connector tuỳ biến mới qua OpenAPI Spec |
| `GET` | `/apps/{id}/config` | Lấy cấu hình tham số của App |
| `GET` | `/triggers` | Danh sách Trigger tiếp nhận sự kiện (Webhook, Polling) |
| `GET` | `/health/stats` | Thống kê sức khỏe tài nguyên SOAR Engine |

---

## 10. Mã trạng thái HTTP & Xử lý Lỗi

| Mã lỗi | Ý nghĩa | Mô tả |
|---|---|---|
| `200 OK` | Thành công | Thao tác truy vấn hoặc thực thi hoàn tất |
| `201 Created` | Tạo mới thành công | Cảnh báo hoặc đối tượng đã được lưu vào CSDL |
| `400 Bad Request` | Dữ liệu không hợp lệ | Thiếu trường bắt buộc (ví dụ: `source_ip` hoặc `hostname`) |
| `401 Unauthorized` | Chưa xác thực | Phiên hết hạn hoặc chưa cấu hình API Key dịch vụ ngoài |
| `404 Not Found` | Không tìm thấy | ID cảnh báo, workflow hoặc bản ghi không tồn tại |
| `500 Internal Server Error` | Lỗi máy chủ | Lỗi ngoại lệ trong quá trình xử lý backend |

### Cấu trúc thông điệp lỗi chuẩn (JSON Error Response):
```json
{
  "error": "BAD_REQUEST",
  "message": "sourceIp is required",
  "status_code": 400,
  "timestamp": "2026-09-04T22:00:00"
}
```

---
*Tài liệu được cập nhật tự động đồng bộ với Backend Mini-SOAR.*
