package com.soar.minisoar.service;

import com.jcraft.jsch.ChannelExec;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Native Java Service Module for Remote SSH Command Execution.
 * Supports JSch Java SSH Client with OpenSSH CLI process fallback.
 */
@Slf4j
@Service
public class RemoteSshExecutionService {

    @Data
    @Builder
    public static class SshExecutionResult {
        private boolean success;
        private String mode;
        private String stdout;
        private String stderr;
        private int exitCode;
        private String detail;
    }

    public SshExecutionResult executeRemoteCommand(String host, String username, String command,
                                                   String keyFilename, String password, int port, int timeoutSeconds) {
        if (host == null || host.trim().isEmpty() ||
                "vps.example.com".equalsIgnoreCase(host) ||
                "localhost".equalsIgnoreCase(host) ||
                "127.0.0.1".equals(host) ||
                "0.0.0.0".equals(host)) {
            return SshExecutionResult.builder()
                    .success(false)
                    .mode("SKIPPED")
                    .exitCode(-1)
                    .stderr("Invalid or placeholder remote host")
                    .detail("[REMOTE SSH SKIPPED] Host '" + host + "' is local or placeholder. Configure live REMOTE_VPS_HOST in System Settings.")
                    .build();
        }

        String user = (username != null && !username.trim().isEmpty()) ? username : "root";
        int sshPort = port > 0 ? port : 22;
        int timeout = timeoutSeconds > 0 ? timeoutSeconds : 10;

        // 1. Try JSch Java Native Library
        try {
            JSch jsch = new JSch();
            if (keyFilename != null && new File(keyFilename).exists()) {
                jsch.addIdentity(keyFilename);
            }

            Session session = jsch.getSession(user, host, sshPort);
            if (password != null && !password.trim().isEmpty()) {
                session.setPassword(password);
            }

            java.util.Properties config = new java.util.Properties();
            config.put("StrictHostKeyChecking", "no");
            session.setConfig(config);
            session.setTimeout(timeout * 1000);
            session.connect();

            ChannelExec channelExec = (ChannelExec) session.openChannel("exec");
            channelExec.setCommand(command);

            InputStream in = channelExec.getInputStream();
            InputStream err = channelExec.getErrStream();

            channelExec.connect();

            StringBuilder stdoutBuf = new StringBuilder();
            StringBuilder stderrBuf = new StringBuilder();

            byte[] tmp = new byte[1024];
            while (true) {
                while (in.available() > 0) {
                    int i = in.read(tmp, 0, 1024);
                    if (i < 0) break;
                    stdoutBuf.append(new String(tmp, 0, i, StandardCharsets.UTF_8));
                }
                while (err.available() > 0) {
                    int i = err.read(tmp, 0, 1024);
                    if (i < 0) break;
                    stderrBuf.append(new String(tmp, 0, i, StandardCharsets.UTF_8));
                }
                if (channelExec.isClosed()) {
                    if (in.available() > 0 || err.available() > 0) continue;
                    break;
                }
                try {
                    Thread.sleep(100);
                } catch (Exception ignored) {
                }
            }

            int exitCode = channelExec.getExitStatus();
            channelExec.disconnect();
            session.disconnect();

            boolean success = (exitCode == 0);
            String stdOutStr = stdoutBuf.toString().trim();
            String stdErrStr = stderrBuf.toString().trim();

            log.info("JSch SSH execution on host {} completed with exit code {}", host, exitCode);

            return SshExecutionResult.builder()
                    .success(success)
                    .mode("JAVA_JSCH_SSH")
                    .stdout(stdOutStr)
                    .stderr(stdErrStr)
                    .exitCode(exitCode)
                    .detail("[JAVA JSCH SSH] Executed on '" + host + "' (Exit Code " + exitCode + "): " +
                            (stdOutStr.isEmpty() ? stdErrStr : stdOutStr))
                    .build();

        } catch (Exception ex) {
            log.warn("JSch SSH failed for host {}: {}. Falling back to OpenSSH ProcessBuilder...", host, ex.getMessage());
        }

        // 2. OpenSSH Native Fallback via ProcessBuilder
        try {
            List<String> sshCmd = new ArrayList<>();
            sshCmd.add("ssh");
            sshCmd.add("-o");
            sshCmd.add("StrictHostKeyChecking=no");
            sshCmd.add("-o");
            sshCmd.add("UserKnownHostsFile=/dev/null");
            sshCmd.add("-o");
            sshCmd.add("ConnectTimeout=" + timeout);
            sshCmd.add("-p");
            sshCmd.add(String.valueOf(sshPort));

            if (keyFilename != null && new File(keyFilename).exists()) {
                sshCmd.add("-i");
                sshCmd.add(keyFilename);
            }

            sshCmd.add(user + "@" + host);
            sshCmd.add(command);

            ProcessBuilder pb = new ProcessBuilder(sshCmd);
            pb.redirectErrorStream(false);
            Process process = pb.start();

            StringBuilder stdoutBuf = new StringBuilder();
            StringBuilder stderrBuf = new StringBuilder();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    stdoutBuf.append(line).append("\n");
                }
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    stderrBuf.append(line).append("\n");
                }
            }

            boolean finished = process.waitFor(timeout + 2, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return SshExecutionResult.builder()
                        .success(false)
                        .mode("OPENSSH_CLI_TIMEOUT")
                        .exitCode(-1)
                        .stderr("SSH execution timed out")
                        .detail("[OPENSSH CLI TIMEOUT] Connection to host '" + host + "' timed out.")
                        .build();
            }

            int exitCode = process.exitValue();
            boolean success = (exitCode == 0);
            String stdOutStr = stdoutBuf.toString().trim();
            String stdErrStr = stderrBuf.toString().trim();

            return SshExecutionResult.builder()
                    .success(success)
                    .mode("JAVA_OPENSSH_CLI")
                    .stdout(stdOutStr)
                    .stderr(stdErrStr)
                    .exitCode(exitCode)
                    .detail("[JAVA OPENSSH CLI] Executed on '" + user + "@" + host + "' (Exit Code " + exitCode + "): " +
                            (stdOutStr.isEmpty() ? stdErrStr : stdOutStr))
                    .build();

        } catch (Exception ex) {
            log.error("Failed to execute remote SSH command via ProcessBuilder", ex);
            return SshExecutionResult.builder()
                    .success(false)
                    .mode("OPENSSH_FAILED")
                    .exitCode(-1)
                    .stderr(ex.getMessage())
                    .detail("[REMOTE SSH ERROR] Failed to connect to host '" + host + "': " + ex.getMessage())
                    .build();
        }
    }
}
