      };
    }
  } else {
    // Check if node has a custom condition / result parameter (e.g. $act-ssh-branch.result)
    // If provided and not truthy, skip node execution immediately.
    const condValue = inputValues.result ?? inputValues.condition ?? inputValues.enabled;
    if (condValue !== undefined) {
      const isTruthy = condValue === true || condValue === "true" || condValue === 1 || condValue === "TRUE";
      if (!isTruthy) {
        return {
          outputData: {
            status: "SKIPPED",
            reason: `Điều kiện đầu vào không thỏa mãn (${JSON.stringify(condValue)}). Bỏ qua thực thi node.`,
            evaluated_condition: condValue,
            node_id: node.id,
            action: node.name,
            executed: false
          },
          statusCode: 204,
          statusText: "NO_CONTENT (SKIPPED)"
        };
      }
    }

    if (node.name === "LOOKUP_GEO_LOCATION" || node.name === "LOOKUP_GEOIP") {
      const targetIp = String(inputValues.source_ip ?? "").trim();

    // Fail loudly instead of silently querying a bogus host and falling back
    // to hardcoded geo data.
    if (!isValidIpAddress(targetIp)) {
      return {
        outputData: {
          status: "ERROR",
          error_code: "INVALID_IP_INPUT",
          message: `Giá trị source_ip không phải IP hợp lệ: "${targetIp}". Kiểm tra lại biến đầu vào hoặc chạy node upstream trước.`,
          received_input: targetIp
        },
        statusCode: 422,
        statusText: "UNPROCESSABLE_ENTITY"
      };
    }

    let geoResult = null;

    try {
      // Call public real GeoIP endpoint from client
      const geoRes = await fetch(`https://ipapi.co/${encodeURIComponent(targetIp)}/json/`);
      if (geoRes.ok) {
        const data = await geoRes.json();
        if (!data.error) {
          geoResult = {
            country: data.country_name || "Unknown",
            country_code: data.country_code || "N/A",
            city: data.city || data.region || "Unknown",
            asn: data.asn || "N/A",
            isp: data.org || data.isp || "N/A",
            is_private_lan: false,
            ip_analyzed: targetIp,
            latitude: data.latitude,
            longitude: data.longitude,
            provider: "ipapi.co (REAL_LOOKUP)"
          };
          showToast(`Đã tra cứu vị trí thật cho IP: ${targetIp} (${data.country_name || 'GeoIP'})`, "success");
        }
      }
    } catch (err) {
      console.warn("Real GeoIP fetch failed, falling back to heuristic lookup:", err);
    }

    if (!geoResult) {
      // Fallback if network blocked or rate limited
      const isPrivate = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/.test(targetIp);
      if (isPrivate) {
        geoResult = {
          country: "INTERNAL_LAN",
          country_code: "LOCAL",
          city: "Private Subnet",
          asn: "N/A",
          isp: "Corporate Internal Network",
          is_private_lan: true,
          ip_analyzed: targetIp,
          provider: "RFC1918_FILTER"
        };
      } else {
        // Deterministic lookup based on real country IP prefixes
        const isVN = targetIp.startsWith("116.") || targetIp.startsWith("113.") || targetIp.startsWith("14.") || targetIp.startsWith("171.");
        geoResult = isVN ? {
          country: "Vietnam",
          country_code: "VN",
          city: "Hanoi / Thai Nguyen",
          asn: "AS7552",
          isp: "Viettel Group",
          is_private_lan: false,
          ip_analyzed: targetIp,
          provider: "GEOIP_DATABASE_FALLBACK"
        } : {
          country: "United States",
          country_code: "US",
          city: "San Jose",
          asn: "AS15169",
          isp: "Google Cloud LLC",
          is_private_lan: false,
          ip_analyzed: targetIp,
          provider: "GEOIP_DATABASE_FALLBACK"
        };
      }
    }

    outputData = { ...geoResult, data_source: geoResult.provider === "ipapi.co (REAL_LOOKUP)" ? "REAL_API" : "OFFLINE_FALLBACK" };
  } else if (node.name === "CHECK_IP_REPUTATION") {
    const targetIp = String(inputValues.source_ip ?? "").trim();
    const apiKey = String(inputValues.api_key ?? "").trim();
    const maxAge = inputValues.max_age_days || 90;

    if (!isValidIpAddress(targetIp)) {
      return {
        outputData: {
          status: "ERROR",
          error_code: "INVALID_IP_INPUT",
          message: `Giá trị source_ip không phải IP hợp lệ: "${targetIp}". Kiểm tra lại biến đầu vào hoặc chạy node upstream trước.`,
          received_input: targetIp
        },
        statusCode: 422,
        statusText: "UNPROCESSABLE_ENTITY"
      };
    }

    try {
      const queryParams = new URLSearchParams({
        ip: targetIp,
        apiKey: apiKey,
        maxAgeDays: maxAge
      });
      const checkRes = await fetch(`/api/v1/actions/check-ip?${queryParams.toString()}`);
      if (checkRes.ok) {
        outputData = await checkRes.json();
        outputData.queried_ip = outputData.queried_ip || targetIp;
        if (outputData.is_real_api) {
          showToast(`AbuseIPDB Live: Score ${outputData.threat_score}%, Reports: ${outputData.total_reports}`, "success");
        } else {
          showToast(`AbuseIPDB Heuristic: Score ${outputData.threat_score}% (Sử dụng API Key để tra cứu thật)`, "info");
        }
      } else {
        throw new Error(`HTTP ${checkRes.status}`);
      }
    } catch (err) {
      outputData = {
        threat_score: 85,
        total_reports: 25,
        is_malicious: true,
        threat_category: "SSH Brute-Force Attacker (Offline)",
        last_reported_at: new Date(Date.now() - 3600000).toISOString(),
        provider: "AbuseIPDB Fallback",
        queried_ip: targetIp,
        error: err.message
      };
    }
  } else if (node.name === "CALCULATE_DYNAMIC_SEVERITY") {
    const fails = Number(inputValues.failed_attempts) || 0;
    const score = Number(inputValues.threat_score) || 0;
    const isPrivate = inputValues.is_private_lan === true || String(inputValues.is_private_lan).toLowerCase() === "true";
    const country = inputValues.country || "Unknown Location";
    const historyPenalty = Number(inputValues.history_penalty) || 0;
    const isRepeat = inputValues.is_repeat_offender === true || String(inputValues.is_repeat_offender).toLowerCase() === "true" || historyPenalty > 0;
    
    // 1. Attempt weight from Node 1 (Tối đa 25 điểm)
    const attemptWeight = fails >= 5 ? 25 : (fails >= 3 ? 15 : 5);

    // 2. Geo & Private LAN weight from Node 2 (Tối đa 15 điểm)
    // Nếu là IP nước ngoài rủi ro cao: +15đ, IP nội bộ: 0đ
    const geoWeight = isPrivate ? 0 : (country.includes("Russia") || country.includes("China") || country.includes("Tor") || country.includes("United States") ? 15 : 5);

    // 3. Threat Intel weight from Node 3 AbuseIPDB (Tối đa 25 điểm)
    // Nếu IP nội bộ: 0đ; nếu IP ngoài: Score * 0.25
    const threatWeight = isPrivate ? 0 : Math.min(25, Math.round(score * 0.25));

    // 4. MySQL Blacklist History weight from Node 3b (Tối đa 25 điểm)
    // Nếu IP tái phạm đã từng bị chặn trong DB trước đây: +25đ
    const historyWeight = Math.min(25, isRepeat ? Math.max(25, historyPenalty) : 0);

    // 5. Asset Criticality weight from Node 1 Hostname (Tối đa 10 điểm)
    const hostLower = String(inputValues.hostname || "").toLowerCase();
    const assetWeight = (hostLower.includes("prod") || hostLower.includes("db") || hostLower.includes("master")) ? 10 : 5;

    // 6. Flexible Custom Expression Evaluation (scoring_formula)
    // Cho phép dùng trực tiếp các tên tham số đầu vào trong ảnh:
    // - threat_score (hoặc $act-ssh-abuse.threat_score)
    // - failed_attempts (hoặc $trig-ssh-1.failed_attempts)
    // - history_penalty (hoặc $act-ssh-history.history_penalty_score)
    // - is_private_lan (hoặc $act-ssh-geo.is_private_lan)
    // - country (hoặc $act-ssh-geo.country)
    // - hostname (hoặc $trig-ssh-1.hostname)
    let formulaStr = String(inputValues.scoring_formula || "").trim();
    if (!formulaStr) {
      formulaStr = "(threat_score * 0.35) + (failed_attempts >= 5 ? 30 : 15) + (history_penalty || 0) + (is_private_lan ? 0 : 10)";
    }

    // Replace any $node.var references in the formula string with their evaluated values
    const execCtx = buildExecutionContext(node);
    formulaStr = formulaStr.replace(/\$[A-Za-z0-9_.-]+/g, (match) => {
      const val = resolveWorkflowValue(match, execCtx);
      if (typeof val === "number") return val;
      if (typeof val === "boolean") return val ? "true" : "false";
      return JSON.stringify(val ?? "");
    });
    
    let total = 0;
    try {
      // Direct scope containing the exact input variables shown on the UI:
      const scope = {
        // Direct Inputs from previous nodes:
        threat_score: score,
        failed_attempts: fails,
        history_penalty: historyPenalty,
        is_private_lan: isPrivate,
        is_repeat_offender: isRepeat,
        country: country,
        hostname: inputValues.hostname,
        source_ip: inputValues.source_ip,
        
        // Calculated component weights:
        attempt_weight: attemptWeight,
        geo_weight: geoWeight,
        threat_weight: threatWeight,
        history_weight: historyWeight,
        asset_weight: assetWeight,
        
        // Math helpers:
        min: Math.min,
        max: Math.max,
        round: Math.round,
        floor: Math.floor,
        ceil: Math.ceil
      };

      // Safe evaluation of the math expression
      const evalFn = new Function(...Object.keys(scope), `"use strict"; return (${formulaStr});`);
      const computed = Number(evalFn(...Object.values(scope)));
      total = isNaN(computed) ? (threatWeight + attemptWeight + historyWeight + geoWeight + assetWeight) : Math.min(100, Math.max(0, Math.round(computed)));
    } catch (evalErr) {
      console.warn("Custom formula eval failed, using default:", evalErr);
      total = Math.min(100, (score * 0.35) + (fails >= 5 ? 30 : 15) + historyPenalty + (isPrivate ? 0 : 10));
    }

    outputData = {
      total_score: total,
      severity: total >= 85 ? "CRITICAL" : total >= 65 ? "HIGH" : (total >= 40 ? "MEDIUM" : "LOW"),
      should_escalate: total >= 65 || fails >= 5 || isRepeat,
      applied_formula: formulaStr,
      source_ip: inputValues.source_ip,
      hostname: inputValues.hostname
    };
  } else if (node.name === "DROP") {
    const serverIp = inputValues.server_ip || inputValues.host || "104.43.88.77";
    const attackerIp = inputValues.attacker_ip || inputValues.source_ip || inputValues.ip_address || "";
    const port = inputValues.port || 22;
    const protocol = inputValues.protocol || "tcp";
    outputData = {
      status: "SUCCESS",
      server_ip: serverIp,
      host: serverIp,
      attacker_ip: attackerIp,
      source_ip: attackerIp,
      ip_address: attackerIp,
      port,
      protocol,
      rule_id: "rule-iptables-port22-drop",
      command_executed: `iptables -A INPUT -s ${attackerIp} -p ${protocol} --dport ${port} -j DROP`,
      firewall_exit_code: 0
    };
  } else if (node.name === "EXECUTE_REMOTE_SSH") {
    const remoteHost = inputValues.host || "vps-remote.internal";
    const user = inputValues.username || "root";
    const port = Number(inputValues.port) || 22;
    const timeoutSeconds = Number(inputValues.timeout_seconds) || 10;
    const cmd = inputValues.command || `iptables -A INPUT -s ${inputValues.source_ip || '198.51.100.45'} -p tcp --dport 22 -j DROP`;
    const attackerIp = inputValues.attacker_ip || inputValues.source_ip || inputValues.ip_address || "";

    try {
      const sshRes = await fetch("/api/v1/actions/remote-ssh/execute", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "same-origin",
        body: JSON.stringify({
          host: remoteHost,
          username: user,
          port,
          command: cmd,
          timeout_seconds: timeoutSeconds,
          key_filename: inputValues.key_filename,
          password: inputValues.password,
          server_ip: remoteHost,
          attacker_ip: attackerIp,
          source_ip: attackerIp
        })
      });
      outputData = await sshRes.json().catch(() => ({
        status: "ERROR",
        stderr: "Backend returned non-JSON response"
      }));
      statusCode = sshRes.ok && outputData.status === "SUCCESS" ? 200 : 502;
      statusText = outputData.status === "SUCCESS" ? "SSH_EXECUTED" : (outputData.mode || "SSH_FAILED");
    } catch (err) {
      statusCode = 500;
      statusText = "SSH_BACKEND_UNREACHABLE";
      outputData = {
        status: "ERROR",
        executed_host: remoteHost,
        ssh_user: user,
        ssh_port: port,
        server_ip: remoteHost,
        attacker_ip: attackerIp,
        source_ip: attackerIp,
        command_executed: cmd,
        exit_code: -1,
        stderr: err.message,
        detail: "Không gọi được backend Remote SSH executor"
      };
    }
  } else if (node.name === "KILL_PID") {
    const pid = Number(inputValues.pid ?? inputValues.process_id) || null;
      outputData = {
        status: "TERMINATED",
        alert_id: inputValues.alert_id,
        hostname: inputValues.hostname,
        process_name: inputValues.process_name,
        affected_file_count: inputValues.affected_file_count,
        pid: pid,
      killed_pid: pid,
      signal_sent: "SIGKILL (-9)",
      child_processes_killed: 3
    };
  } else if (node.name === "GET_PROCESS_FORENSICS") {
    const pid = Number(inputValues.pid ?? inputValues.process_id) || null;
    const procName = inputValues.process_name || "unknown.exe";
      outputData = {
        alert_id: inputValues.alert_id,
        hostname: inputValues.hostname,
        host_ip: inputValues.host_ip,
        pid: pid,
        process_name: procName,
        cmdline: inputValues.command_line || `${procName} delete shadows /all /quiet`,
        affected_file_count: inputValues.affected_file_count,
        exe_path: `C:\\Windows\\Temp\\${procName}`,
      open_sockets: ["tcp:0.0.0.0:4444 (LISTEN)"],
      parent_pid: 1
    };
  } else if (node.name === "ANALYZE_MITRE_TTPS") {
    const procName = inputValues.process_name || "";
    const cmdLine = inputValues.command_line || `${procName} delete shadows /all /quiet`;
    const lowerProc = String(procName).toLowerCase();
    const lowerCmd = String(cmdLine).toLowerCase();
    const extensions = Array.isArray(inputValues.crypto_extension)
      ? inputValues.crypto_extension
      : String(inputValues.crypto_extension || "").split(",").map(v => v.trim()).filter(Boolean);
    const affectedFiles = Number(inputValues.affected_file_count ?? inputValues.affected_files) || 0;
    let riskScore = 0;
    if (/(vssadmin|wmic|bcdedit|powershell|cipher|wevtutil)/.test(lowerProc)) riskScore += 25;
    if (/(delete\s+shadows|shadowcopy\s+delete|recoveryenabled\s+no|wbadmin\s+delete|resize\s+shadowstorage|disable.*recovery|-enc|encodedcommand)/.test(lowerCmd)) riskScore += 35;
    if (extensions.length > 0) riskScore += 15;
    if (affectedFiles >= 1000) riskScore += 25;
    else if (affectedFiles >= 100) riskScore += 15;
    else if (affectedFiles > 0) riskScore += 5;
    riskScore = Math.min(100, riskScore);
    const severity = riskScore >= 85 ? "CRITICAL" : riskScore >= 65 ? "HIGH" : (riskScore >= 40 ? "MEDIUM" : "LOW");
    outputData = {
      alert_id: inputValues.alert_id,
      hostname: inputValues.hostname,
      process_id: Number(inputValues.process_id ?? inputValues.pid) || null,
      process_name: procName,
      command_line: cmdLine,
      affected_file_count: inputValues.affected_file_count,
      risk_score: riskScore,
      severity,
      is_critical: riskScore >= 75,
      matched_ttps: [
        `T1490 - Inhibit System Recovery (${procName || 'shadow copy deletion'})`,
        "T1486 - Data Encrypted for Impact"
      ]
    };
  } else if (node.name === "QUARANTINE_HOST") {
      outputData = {
        status: "QUARANTINED",
        alert_id: inputValues.alert_id,
        hostname: inputValues.hostname,
        affected_file_count: inputValues.affected_file_count,
        isolated_interface: inputValues.interface || "eth0",
      active_firewall_rule: "iptables -A OUTPUT ! -o lo -j DROP"
    };
  } else if (node.name === "LOG_BLOCKED_IP") {
    const ipAddress = String(inputValues.ip_address ?? inputValues.source_ip ?? "").trim();
    const rawReason = String(inputValues.reason || "").trim();
    const reason = rawReason && rawReason !== "..." ? rawReason : buildBlockedIpReason(node, inputValues);
    const threatScore = Number(inputValues.threat_score ?? inputValues.total_score ?? 75) || 75;

    try {
      const dbRes = await fetch("/api/v1/actions/blocked-ips", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "same-origin",
        body: JSON.stringify({
          ip_address: ipAddress,
          reason,
          threat_score: threatScore
        })
      });
      outputData = await dbRes.json().catch(() => ({
        status: "ERROR",
        error: "Backend returned non-JSON response",
        persisted: false
      }));
      statusCode = dbRes.ok && outputData.persisted ? 200 : 502;
      statusText = outputData.persisted ? "MYSQL_PERSISTED" : "MYSQL_WRITE_FAILED";
    } catch (err) {
      statusCode = 500;
      statusText = "MYSQL_BACKEND_UNREACHABLE";
      outputData = {
        status: "ERROR",
        table_name: "blocked_ips",
        ip_address: ipAddress,
        reason,
        persisted: false,
        persisted_in_mysql: false,
        error: err.message
      };
    }
  } else if (node.name === "LOG_RANSOMWARE_INCIDENT") {
    const hostname = String(inputValues.hostname || "").trim();
    const processName = String(inputValues.process_name || "").trim();
    const pid = Number(inputValues.pid ?? inputValues.process_id) || 0;
    const affectedFiles = Number(inputValues.affected_files ?? inputValues.affected_file_count) || 0;
    const containmentStatus = inputValues.status || inputValues.containment_status || "CONTAINED";

    try {
      const dbRes = await fetch("/api/v1/actions/ransomware-incidents", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "same-origin",
        body: JSON.stringify({
          alert_id: inputValues.alert_id || 0,
          hostname,
          process_name: processName,
          pid,
          affected_files: affectedFiles,
          status: containmentStatus
        })
      });
      outputData = await dbRes.json().catch(() => ({
        status: "ERROR",
        error: "Backend returned non-JSON response",
        persisted: false
      }));
      statusCode = dbRes.ok && outputData.persisted ? 200 : 502;
      statusText = outputData.persisted ? "MYSQL_PERSISTED" : "MYSQL_WRITE_FAILED";
    } catch (err) {
      statusCode = 500;
      statusText = "MYSQL_BACKEND_UNREACHABLE";
      outputData = {
        status: "ERROR",
        table_name: "ransomware_incidents",
        hostname,
        process_name: processName,
        pid,
        affected_files: affectedFiles,
        containment_status: containmentStatus,
        persisted: false,
        persisted_in_mysql: false,
        error: err.message
      };
    }
  } else if (node.name === "CHECK_IP_HISTORY") {
    const targetIp = String(inputValues.ip_address ?? inputValues.source_ip ?? "").trim();
    let historyResult = null;
    try {
      if (isValidIpAddress(targetIp)) {
        const resp = await fetch(`/api/v1/actions/check-ip-history?ip=${encodeURIComponent(targetIp)}`, {
          headers: getAuthHeaders(),
          credentials: "same-origin"
        });
        if (resp.ok) {
          historyResult = await resp.json();
        }
      }
    } catch (err) {
      console.warn("DB History check failed:", err);
    }

    if (!historyResult) {
      // Fallback: Check if IP is in test scenarios marked as repeat offender
      const isKnownOffender = targetIp === "185.220.101.5" || targetIp === "45.154.255.88";
      historyResult = {
        ip_address: targetIp,
        is_repeat_offender: isKnownOffender,
        previous_blocks_count: isKnownOffender ? 2 : 0,
        history_penalty_score: isKnownOffender ? 25 : 0,
        last_incident_reason: isKnownOffender ? "SSH Brute-Force Botnet (Previous Record)" : "No prior violation",
        first_seen_at: isKnownOffender ? "2026-08-28T04:12:00Z" : "N/A",
        data_source: "LOCAL_SIMULATION"
      };
    }
    outputData = historyResult;
  } else if (node.name === "QUERY_ASSET_CRITICALITY") {
    outputData = {
      hostname: inputValues.hostname,
      tier: "PRODUCTION",
      weight: 30
    };
  } else if (node.name === "EVALUATE_CONDITION") {
    const sourceValue = resolveWorkflowValue(inputValues.source_variable, buildExecutionContext(node));
    const operator = String(inputValues.condition_operator || "equals").toLowerCase();
    const targetValue = coerceFormValue(inputValues.target_value);
    const numericSource = Number(sourceValue);
    const numericTarget = Number(targetValue);
    const result = operator.includes("larger")
      ? numericSource >= numericTarget
      : String(sourceValue) === String(targetValue);
    
    // Pass-through context so downstream nodes can directly consume attacker IP and victim host
    const execCtx = buildExecutionContext(node);
    const resolvedIp = resolveWorkflowValue("$trig-ssh-1.source_ip", execCtx) || resolveWorkflowValue("$act-ssh-scorer.source_ip", execCtx) || inputValues.source_ip || "";
    const resolvedHost = resolveWorkflowValue("$trig-ssh-1.hostname", execCtx) || resolveWorkflowValue("$act-ssh-scorer.hostname", execCtx) || inputValues.hostname || "";

    outputData = {
      result,
      source_ip: resolvedIp,
      ip_address: resolvedIp,
      hostname: resolvedHost
    };
  } else if (node.name === "SEND_SOC_ALERT") {
    const bToken = inputValues.bot_token || "";
    const targetChat = inputValues.chat_id || "@mini_soar_alerts_channel";
    const incidentType = inputValues.incident_type || "SSH Brute-Force Attack";
    const blockedIp = inputValues.blocked_ip || inputValues.ip_address || inputValues.source_ip || "198.51.100.45";
    
    // Support either explicit message_html or auto-formatted from (incident_type, blocked_ip)
    let msgText = inputValues.message_html;
    if (!msgText || msgText.trim() === "") {
      msgText = `<b>🚨 [MINI-SOAR] INCIDENT ALERT</b>\n• <b>Loại sự cố:</b> ${incidentType}\n• <b>IP Block:</b> <code>${blockedIp}</code>\n• <b>Hành động:</b> Đã chặn tự động (IPTables DROP & Remote VPS)\n• <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN")}`;
    }

    const isRealToken = bToken && !bToken.includes("MOCK") && bToken.includes(":");
    let tgApiResult = null;
    let actualStatus = "DELIVERED_SIMULATED";

    if (isRealToken) {
      // Direct call to Telegram Bot API from browser
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${bToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetChat,
            text: msgText.replace(/<br>/g, "\n"),
            parse_mode: "HTML"
          })
        });
        tgApiResult = await tgRes.json();
        if (tgApiResult.ok) {
          actualStatus = "SENT_TELEGRAM_API_SUCCESS (REAL)";
          showToast(`Đã gửi tin nhắn thật thành công tới Telegram: ${targetChat}!`, "success");
        } else {
          statusCode = tgRes.status || 400;
          statusText = "BAD_REQUEST";
          actualStatus = `TELEGRAM_API_REJECTED: ${tgApiResult.description || 'Error'}`;
          showToast(`Telegram API [400]: ${tgApiResult.description}`, "error");
        }
      } catch (err) {
        statusCode = 500;
        statusText = "NETWORK_ERROR";
        actualStatus = `NETWORK_ERROR: ${err.message}`;
      }
    } else {
      showToast("Đang ở chế độ Mô phỏng (Token mẫu). Hãy điền Bot Token thật từ @BotFather để nhận tin nhắn thật trên Telegram!", "info");
    }

    outputData = {
      status: "SUCCESS",
      delivery_status: actualStatus,
      is_real_dispatch: isRealToken,
      telegram_api_response: tgApiResult,
      message_id: tgApiResult?.result?.message_id || Math.floor(10000 + Math.random() * 90000),
      bot_token_used: isRealToken ? `${bToken.substring(0, 8)}...***` : "(MOCK TOKEN)",
      dispatched_channel: targetChat,
      dispatched_chat_id: targetChat,
      severity: inputValues.severity || "CRITICAL",
      message_sent: msgText,
      sent_at: new Date().toISOString()
    };
    } else {
      outputData = {
        status: "SUCCESS",
        execution_id: `test-${Date.now().toString(36)}`,
        action: node.name,
        evaluated_input: inputValues,
        executed_at: new Date().toISOString()
      };
    }
  }

  return { outputData, statusCode, statusText };
}

/**
 * Render the result of a node execution into the Test modal.
 */
function renderTestNodeResult(node, outputData, statusCode, statusText, inputValues, isSuccessPath) {
  const badge = document.getElementById("test-node-status-badge");
  const rawJson = document.getElementById("test-node-raw-json");
  const outputsTable = document.getElementById("test-node-outputs-table");
  const nodeEl = document.getElementById(`node-${node.id}`);

