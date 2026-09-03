package com.soar.minisoar.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String QUEUE_NAME = "soar.alert.queue";
    public static final String EXCHANGE_NAME = "soar.alert.exchange";
    public static final String ROUTING_KEY = "soar.alert.routingKey";

    @Bean
    public Queue alertQueue() {
        return QueueBuilder.durable(QUEUE_NAME)
                .withArgument("x-dead-letter-exchange", "soar.alert.dlx")
                .build();
    }

    @Bean
    public DirectExchange alertExchange() {
        return new DirectExchange(EXCHANGE_NAME);
    }

    @Bean
    public Binding alertBinding(Queue alertQueue, DirectExchange alertExchange) {
        return BindingBuilder.bind(alertQueue).to(alertExchange).with(ROUTING_KEY);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
