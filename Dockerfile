# Stage 1: Build Java Application using Maven
FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Runtime Environment with Java 21 + Python 3 + System Utilities
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Install Python 3 and networking/process management utilities for Playbook Workers
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip iptables procps iproute2 net-tools ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy packaged Spring Boot JAR from builder
COPY --from=builder /app/target/mini-soar-security-automation-1.0.0.jar app.jar

# Copy Python Playbook Workers
COPY python_workers ./python_workers

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
