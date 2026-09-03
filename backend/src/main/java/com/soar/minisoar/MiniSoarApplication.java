package com.soar.minisoar;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MiniSoarApplication {

    public static void main(String[] args) {
        SpringApplication.run(MiniSoarApplication.class, args);
    }
}
