package com.order.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @GetMapping
    public Map<String, Object> getOrders() {
        return Map.of(
            "service", "order-service",
            "virtualThread", Thread.currentThread().isVirtual(),
            "threadName", Thread.currentThread().toString(),
            "orders", List.of(
                Map.of("id", 101, "item", "Laptop", "amount", 1200.00),
                Map.of("id", 102, "item", "Wireless Mouse", "amount", 25.50)
            )
        );
    }
}
