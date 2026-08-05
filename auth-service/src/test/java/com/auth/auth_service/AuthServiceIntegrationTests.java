package com.auth.auth_service;

import com.auth.auth_service.dto.LoginRequest;
import com.auth.auth_service.dto.RefreshRequest;
import com.auth.auth_service.dto.RegisterRequest;
import com.auth.auth_service.repository.RefreshTokenRepository;
import com.auth.auth_service.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class AuthServiceIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void shouldRegisterUserSuccessfully() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("testuser");
        request.setEmail("testuser@example.com");
        request.setPassword("password123");
        request.setRole("USER");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("USER Registered Successfully")));
    }

    @Test
    void shouldFailRegisterWhenUsernameExists() throws Exception {
        RegisterRequest request1 = new RegisterRequest();
        request1.setUsername("testuser");
        request1.setEmail("testuser@example.com");
        request1.setPassword("password123");
        request1.setRole("USER");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request1)))
                .andExpect(status().isOk());

        RegisterRequest request2 = new RegisterRequest();
        request2.setUsername("testuser");
        request2.setEmail("testuser2@example.com");
        request2.setPassword("password123");
        request2.setRole("USER");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request2)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message").value("Username is already taken"));
    }

    @Test
    void shouldFailRegisterWhenEmailExists() throws Exception {
        RegisterRequest request1 = new RegisterRequest();
        request1.setUsername("testuser1");
        request1.setEmail("testuser@example.com");
        request1.setPassword("password123");
        request1.setRole("USER");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request1)))
                .andExpect(status().isOk());

        RegisterRequest request2 = new RegisterRequest();
        request2.setUsername("testuser2");
        request2.setEmail("testuser@example.com");
        request2.setPassword("password123");
        request2.setRole("USER");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request2)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message").value("Email is already registered"));
    }

    @Test
    void shouldLoginSuccessfullyAndAccessProtectedEndpoints() throws Exception {
        // 1. Register Admin User
        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setUsername("adminuser");
        registerRequest.setEmail("adminuser@example.com");
        registerRequest.setPassword("adminpassword");
        registerRequest.setRole("ADMIN");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isOk());

        // 2. Login
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("adminuser");
        loginRequest.setPassword("adminpassword");

        MvcResult loginResult = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andExpect(jsonPath("$.refreshToken", notNullValue()))
                .andReturn();

        String responseBody = loginResult.getResponse().getContentAsString();
        String accessToken = objectMapper.readTree(responseBody).get("accessToken").asText();
        String refreshToken = objectMapper.readTree(responseBody).get("refreshToken").asText();

        // 3. Access Protected ADMIN Hello Endpoint (Expect success)
        mockMvc.perform(get("/test/get/hello")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(content().string("JWT Authentication Successful"));

        // 4. Refresh Token
        RefreshRequest refreshRequest = new RefreshRequest();
        refreshRequest.setRefreshToken(refreshToken);

        MvcResult refreshResult = mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(refreshRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andExpect(jsonPath("$.refreshToken", notNullValue()))
                .andReturn();

        String refreshResponseBody = refreshResult.getResponse().getContentAsString();
        String newAccessToken = objectMapper.readTree(refreshResponseBody).get("accessToken").asText();

        // 5. Access Protected Hello Endpoint with new Access Token
        mockMvc.perform(get("/test/get/hello")
                        .header("Authorization", "Bearer " + newAccessToken))
                .andExpect(status().isOk())
                .andExpect(content().string("JWT Authentication Successful"));
    }

    @Test
    void shouldDenyAccessToUserRoleForAdminEndpoint() throws Exception {
        // 1. Register Standard User
        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setUsername("regularuser");
        registerRequest.setEmail("user@example.com");
        registerRequest.setPassword("password123");
        registerRequest.setRole("USER");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isOk());

        // 2. Login
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("regularuser");
        loginRequest.setPassword("password123");

        MvcResult loginResult = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andReturn();

        String accessToken = objectMapper.readTree(loginResult.getResponse().getContentAsString()).get("accessToken").asText();

        // 3. Access ADMIN Protected Endpoint (Expect 403 Forbidden because user has ROLE_USER, not ROLE_ADMIN)
        mockMvc.perform(get("/test/get/hello")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldGenerateResetTokenSuccessfully() throws Exception {
        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setUsername("resetuser1");
        registerRequest.setEmail("resetuser1@example.com");
        registerRequest.setPassword("password123");
        registerRequest.setRole("USER");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isOk());

        com.auth.auth_service.dto.ForgotPasswordRequest forgotRequest = new com.auth.auth_service.dto.ForgotPasswordRequest();
        forgotRequest.setEmail("resetuser1@example.com");

        mockMvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(forgotRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", notNullValue()))
                .andExpect(jsonPath("$.message", containsString("Reset token generated successfully")));
    }

    @Test
    void shouldFailForgotPasswordWhenEmailNotFound() throws Exception {
        com.auth.auth_service.dto.ForgotPasswordRequest forgotRequest = new com.auth.auth_service.dto.ForgotPasswordRequest();
        forgotRequest.setEmail("nonexistent@example.com");

        mockMvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(forgotRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("No account found with this email address"));
    }

    @Test
    void shouldResetPasswordSuccessfully() throws Exception {
        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setUsername("resetuser2");
        registerRequest.setEmail("resetuser2@example.com");
        registerRequest.setPassword("password123");
        registerRequest.setRole("USER");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isOk());

        com.auth.auth_service.dto.ForgotPasswordRequest forgotRequest = new com.auth.auth_service.dto.ForgotPasswordRequest();
        forgotRequest.setEmail("resetuser2@example.com");

        MvcResult forgotResult = mockMvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(forgotRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readTree(forgotResult.getResponse().getContentAsString()).get("token").asText();

        com.auth.auth_service.dto.ResetPasswordRequest resetRequest = new com.auth.auth_service.dto.ResetPasswordRequest();
        resetRequest.setToken(token);
        resetRequest.setNewPassword("newpassword456");
        resetRequest.setConfirmPassword("newpassword456");

        mockMvc.perform(post("/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password has been reset successfully"));

        // Verify login works with new password
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("resetuser2");
        loginRequest.setPassword("newpassword456");

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()));
    }

    @Test
    void shouldFailResetPasswordWhenPasswordsMismatch() throws Exception {
        com.auth.auth_service.dto.ResetPasswordRequest resetRequest = new com.auth.auth_service.dto.ResetPasswordRequest();
        resetRequest.setToken("some-token");
        resetRequest.setNewPassword("newpassword456");
        resetRequest.setConfirmPassword("differentPassword");

        mockMvc.perform(post("/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Passwords do not match"));
    }

    @Test
    void shouldFailResetPasswordWhenTokenInvalid() throws Exception {
        com.auth.auth_service.dto.ResetPasswordRequest resetRequest = new com.auth.auth_service.dto.ResetPasswordRequest();
        resetRequest.setToken("invalid-or-expired-token");
        resetRequest.setNewPassword("newpassword456");
        resetRequest.setConfirmPassword("newpassword456");

        mockMvc.perform(post("/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Invalid or expired password reset token"));
    }

    @Test
    void shouldFailResetPasswordWhenOldPasswordReused() throws Exception {
        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setUsername("resetuser3");
        registerRequest.setEmail("resetuser3@example.com");
        registerRequest.setPassword("password123");
        registerRequest.setRole("USER");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isOk());

        com.auth.auth_service.dto.ForgotPasswordRequest forgotRequest = new com.auth.auth_service.dto.ForgotPasswordRequest();
        forgotRequest.setEmail("resetuser3@example.com");

        MvcResult forgotResult = mockMvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(forgotRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readTree(forgotResult.getResponse().getContentAsString()).get("token").asText();

        com.auth.auth_service.dto.ResetPasswordRequest resetRequest = new com.auth.auth_service.dto.ResetPasswordRequest();
        resetRequest.setToken(token);
        resetRequest.setNewPassword("password123"); // Reusing current password
        resetRequest.setConfirmPassword("password123");

        mockMvc.perform(post("/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("New password cannot be the same as the current password"));
    }
}
