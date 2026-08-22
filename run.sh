#!/usr/bin/env bash
set -e

echo "========================================================="
echo "   Mini-SOAR Security Automation Platform Launcher"
echo "========================================================="

# Check Python environment
echo "[1/4] Checking Python 3 environment..."
python3 --version || true

# Check if Full Docker Stack is requested or Docker available
echo "[2/4] Checking Database & Container Services..."
if command -v docker &> /dev/null; then
    echo "Starting MySQL database & RabbitMQ via Docker Compose..."
    docker compose up -d mysql-db rabbitmq || true
    echo "Waiting for MySQL container to become ready..."
    sleep 3
else
    echo "Docker not found. Ensure MySQL is running on localhost:3306 with database 'mini_soar_db'."
fi

# Build Java Application
echo "[3/4] Building Spring Boot Application using Maven..."
mvn clean package -DskipTests

# Start Spring Boot Application
echo "[4/4] Starting Mini-SOAR Application on http://localhost:8080 ..."
echo "Tip: You can also run full stack in Docker using 'docker compose up --build -d'"
java -jar target/mini-soar-security-automation-1.0.0.jar
