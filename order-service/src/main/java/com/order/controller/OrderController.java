package com.order.controller;

import com.order.entity.OrderItem;
import com.order.repository.OrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @Autowired
    private com.order.service.OrderService orderService;

    @GetMapping
    public Map<String, Object> getOrders() {
        List<OrderItem> orders = orderRepository.findAll();
        if (orders.isEmpty()) {
            // Seed initial records if empty
            orderRepository.save(new OrderItem(null, "Enterprise Laptop", new BigDecimal("1200.00")));
            orderRepository.save(new OrderItem(null, "Wireless Mouse", new BigDecimal("25.50")));
            orders = orderRepository.findAll();
        }
        return Map.of(
            "service", "order-service",
            "database", "Spring Data JPA MySQL / Cloud SQL",
            "virtualThread", Thread.currentThread().isVirtual(),
            "threadName", Thread.currentThread().toString(),
            "orders", orders
        );
    }

    @PostMapping
    public OrderItem createOrder(@RequestBody OrderItem item) {
        return orderService.createOrder(item);
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
