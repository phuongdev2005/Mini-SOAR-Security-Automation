# Stage 1: Build Java Application using Maven
FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder
WORKDIR /app
COPY backend/pom.xml .
COPY backend/src ./src
RUN mvn clean package -DskipTests

# Stage 2: Runtime Environment with Java 21 + System Utilities (Native Java SOAR Engine)
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Install networking/process management utilities and OpenSSH client for SOAR containment
RUN apt-get update && \
    apt-get install -y --no-install-recommends iptables procps iproute2 net-tools openssh-client ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy packaged Spring Boot JAR from builder
COPY --from=builder /app/target/mini-soar-security-automation-1.0.0.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
