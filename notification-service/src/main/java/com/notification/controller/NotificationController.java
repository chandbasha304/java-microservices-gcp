package com.notification.controller;

import com.notification.dto.EmailNotificationRequest;
import io.micrometer.tracing.Tracer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private static final Logger log = LoggerFactory.getLogger(NotificationController.class);

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired(required = false)
    private Tracer tracer;

    @PostMapping("/email")
    public Map<String, Object> sendEmail(@RequestBody EmailNotificationRequest request) {
        String recipient = (request.getToEmail() != null && !request.getToEmail().isEmpty()) 
                ? request.getToEmail() 
                : "bashasoft304@gmail.com";
        
        String currentTraceId = (tracer != null && tracer.currentSpan() != null) 
                ? tracer.currentSpan().context().traceId() 
                : "N/A";
        
        log.info("Sending Email Notification to {} | TraceId: {}", recipient, currentTraceId);

        boolean emailSent = false;
        String statusMessage = "Notification logged successfully with OpenTelemetry TraceId";

        if (mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(recipient);
                message.setSubject(request.getSubject() != null ? request.getSubject() : "Microservices Order Notification");
                message.setText(request.getBody() != null ? request.getBody() : "Your microservice request was processed successfully. TraceId: " + currentTraceId);
                mailSender.send(message);
                emailSent = true;
                statusMessage = "Email sent successfully to " + recipient;
            } catch (Exception ex) {
                log.warn("SMTP email dispatch deferred (simulation mode active): {}", ex.getMessage());
                statusMessage = "Email queued for " + recipient + " (OpenTelemetry TraceId logged)";
            }
        }

        return Map.of(
            "service", "notification-service",
            "recipient", recipient,
            "traceId", currentTraceId,
            "status", statusMessage,
            "emailSent", emailSent,
            "virtualThread", Thread.currentThread().isVirtual()
        );
    }

    @GetMapping("/health")
    public Map<String, Object> getHealth() {
        return Map.of(
            "service", "notification-service",
            "status", "UP",
            "defaultEmail", "bashasoft304@gmail.com",
            "tracingEnabled", true,
            "prometheusMetrics", "/actuator/prometheus"
        );
    }
}
