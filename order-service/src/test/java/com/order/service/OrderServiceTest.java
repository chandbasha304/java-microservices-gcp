package com.order.service;

import com.order.entity.OrderItem;
import com.order.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @InjectMocks
    private OrderService orderService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(orderService, "notificationServiceUrl", "http://localhost:8083");
    }

    @Test
    @DisplayName("POSITIVE CASE: Valid Order Creation & Persistence Commit")
    void testCreateOrder_Success_PositiveCase() {
        // Given
        OrderItem inputItem = new OrderItem(null, "Gaming Monitor", new BigDecimal("350.00"));
        OrderItem savedItem = new OrderItem(1L, "Gaming Monitor", new BigDecimal("350.00"));
        when(orderRepository.save(any(OrderItem.class))).thenReturn(savedItem);

        // When
        OrderItem result = orderService.createOrder(inputItem);

        // Then
        assertNotNull(result);
        assertEquals(1L, result.getId());
        assertEquals("Gaming Monitor", result.getProductName());
        verify(orderRepository, times(1)).save(any(OrderItem.class));
    }

    @Test
    @DisplayName("NEGATIVE CASE: Invalid Price (Zero or Negative) Triggers Transaction Rollback")
    void testCreateOrder_InvalidPrice_NegativeCase_Rollback() {
        // Given
        OrderItem invalidItem = new OrderItem(null, "Faulty Item", new BigDecimal("-10.00"));

        // When & Then
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> orderService.createOrder(invalidItem)
        );

        assertTrue(exception.getMessage().contains("Invalid order price"));
        verify(orderRepository, never()).save(any(OrderItem.class));
    }
}
