package com.order.controller;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final ChatClient chatClient;

    public OrderController(@Autowired(required = false) ChatClient.Builder chatClientBuilder) {
        ChatClient client = null;
        if (chatClientBuilder != null) {
            try {
                client = chatClientBuilder.build();
            } catch (Exception e) {
                client = null;
            }
        }
        this.chatClient = client;
    }

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
        if (chatClient == null) {
            return Map.of(
                "status", "Spring AI Disabled",
                "message", "GEMINI_API_KEY environment variable not set or invalid."
            );
        }
        try {
            String aiResponse = chatClient.prompt().user(prompt).call().content();
            return Map.of(
                "prompt", prompt,
                "aiResponse", aiResponse,
                "model", "Google Gemini 1.5 Flash",
                "virtualThread", Thread.currentThread().isVirtual()
            );
        } catch (Exception ex) {
            return Map.of(
                "status", "Spring AI Error",
                "message", ex.getMessage()
            );
        }
    }
}
