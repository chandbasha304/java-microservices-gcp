package com.order.service;

import com.order.entity.OrderItem;
import com.order.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    @Autowired
    private OrderRepository orderRepository;

    @Value("${notification.service.url:http://notification-service:8083}")
    private String notificationServiceUrl;

    /**
     * Creates an order with ACID Transactional guarantee (@Transactional).
     * If database persistence fails or validation throws an exception, 
     * the transaction will be completely rolled back in PostgreSQL/MySQL.
     */
    @Transactional(rollbackFor = Exception.class)
    public OrderItem createOrder(OrderItem item) {
        if (item.getPrice() == null || item.getPrice().doubleValue() <= 0) {
            throw new IllegalArgumentException("Invalid order price. Transaction aborted and rolled back.");
        }

        log.info("Persisting order for product: {} into database...", item.getProductName());
        OrderItem savedItem = orderRepository.save(item);

        // Dynamic, Non-blocking Inter-Service Call via WebClient
        dispatchNotification(savedItem);

        return savedItem;
    }

    private void dispatchNotification(OrderItem order) {
        try {
            WebClient webClient = WebClient.builder()
                    .baseUrl(notificationServiceUrl)
                    .build();

            webClient.post()
                    .uri("/api/notifications/email")
                    .bodyValue(Map.of(
                            "toEmail", "bashasoft304@gmail.com",
                            "subject", "Order Confirmation #" + order.getId(),
                            "body", "Your order for '" + order.getProductName() + "' ($" + order.getPrice() + ") was placed successfully."
                    ))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .doOnSuccess(resp -> log.info("Notification dispatched for Order #{}", order.getId()))
                    .doOnError(err -> log.warn("Notification service call failed: {}", err.getMessage()))
                    .subscribe();
        } catch (Exception ex) {
            log.error("Failed to invoke notification service: {}", ex.getMessage());
        }
    }
}
