package com.order.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    @GetMapping("/ai-recommendation")
    public Map<String, Object> getAiRecommendation(@RequestParam(defaultValue = "Suggest matching tech accessories for a Laptop and Wireless Mouse") String prompt) {
        return Map.of(
            "prompt", prompt,
            "aiResponse", "Smart AI Recommendation: Consider adding an Ergonomic Keyboard, USB-C Docking Station, and Noise-Canceling Headphones.",
            "model", "Spring AI Microservices Engine",
            "virtualThread", Thread.currentThread().isVirtual()
        );
    }
}
