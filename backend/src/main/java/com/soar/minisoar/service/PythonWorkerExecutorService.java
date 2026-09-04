package com.soar.minisoar.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@Deprecated
public class PythonWorkerExecutorService {

    @Value("${soar.python.workers-path:python_workers}")
    private String pythonWorkersPath;

    @Value("${soar.python.executable:python3}")
    private String pythonExecutable;

    public String executePlaybook(String playbookFileName, String jsonPayload) throws Exception {
        File scriptFile = new File(pythonWorkersPath, playbookFileName);
        if (!scriptFile.exists()) {
            // Fallback 1: try relative to user.dir
            File relScriptFile = new File(System.getProperty("user.dir"), pythonWorkersPath + File.separator + playbookFileName);
            // Fallback 2: try backend/ relative to user.dir
            File backendRelScriptFile = new File(System.getProperty("user.dir"), "backend" + File.separator + pythonWorkersPath + File.separator + playbookFileName);
            if (relScriptFile.exists()) {
                scriptFile = relScriptFile;
            } else if (backendRelScriptFile.exists()) {
                scriptFile = backendRelScriptFile;
            } else {
                throw new IllegalArgumentException("Python playbook script not found: " + scriptFile.getAbsolutePath());
            }
        }

        List<String> command = new ArrayList<>();
        command.add(pythonExecutable);
        command.add(scriptFile.getAbsolutePath());
        command.add(jsonPayload);

        log.info("Executing Python Playbook command: {} {} '[payload]'", pythonExecutable, scriptFile.getName());

        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.redirectErrorStream(true);

        long startTime = System.currentTimeMillis();
        Process process = processBuilder.start();

        StringBuilder outputBuffer = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                outputBuffer.append(line).append("\n");
            }
        }

        int exitCode = process.waitFor();
        long duration = System.currentTimeMillis() - startTime;

        log.info("Python script completed in {}ms with exit code {}", duration, exitCode);

        if (exitCode != 0) {
            log.error("Python script execution failed. Output: {}", outputBuffer);
            throw new RuntimeException("Python execution failed (exit code " + exitCode + "): " + outputBuffer);
        }

        return outputBuffer.toString().trim();
    }
}
