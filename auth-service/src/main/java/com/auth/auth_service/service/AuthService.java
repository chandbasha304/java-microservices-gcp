package com.auth.auth_service.service;

import com.auth.auth_service.dto.AuthResponse;
import com.auth.auth_service.dto.LoginRequest;
import com.auth.auth_service.dto.RefreshRequest;
import com.auth.auth_service.dto.RegisterRequest;
import com.auth.auth_service.dto.ForgotPasswordRequest;
import com.auth.auth_service.dto.ResetPasswordRequest;
import java.util.UUID;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import com.auth.auth_service.entity.RefreshToken;
import com.auth.auth_service.entity.Role;
import com.auth.auth_service.entity.User;
import com.auth.auth_service.exception.InvalidRoleException;
import com.auth.auth_service.exception.UserAlreadyExistsException;
import com.auth.auth_service.repository.UserRepository;
import com.auth.auth_service.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;

    public String register(RegisterRequest request){
        if (request.getUsername() == null || request.getUsername().isBlank()) {
            throw new IllegalArgumentException("Username cannot be empty");
        }
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new IllegalArgumentException("Email cannot be empty");
        }
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new UserAlreadyExistsException("Username is already taken");
        }
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new UserAlreadyExistsException("Email is already registered");
        }

        Role role;
        try {
            role = Role.valueOf(request.getRole().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new InvalidRoleException("Invalid role: " + request.getRole());
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setRole(role);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        
        userRepository.save(user);
        return " " + role + " Registered Successfully";
    }
//    public AuthResponse login(LoginRequest loginRequest){
//        System.out.println("Line 41: "+loginRequest.toString());
//        Authentication authentication = authenticationManager.authenticate(
//                UsernamePasswordAuthenticationToken.unauthenticated(
//                        loginRequest.getUsername(),
//                        loginRequest.getPassword()
//                )
//        );
//        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
//        String token = jwtService.generateToken(userDetails);
//        System.out.println("line 50: "+token);
//        return AuthResponse.builder()
//                .accessToken(token)
//                .refreshToken(refreshTokenService.createRefreshToken(new User()).getToken())
//                .build();
//    }
public AuthResponse login(LoginRequest request) {

    Authentication authentication =
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getUsername(),
                            request.getPassword()
                    ));

    UserDetails userDetails =
            (UserDetails) authentication.getPrincipal();

    String accessToken =
            jwtService.generateToken(userDetails);

    User user = userRepository
            .findByUsername(request.getUsername())
            .orElseThrow();

    RefreshToken refreshToken =
            refreshTokenService.createRefreshToken(user);

    return AuthResponse.builder()
            .accessToken(accessToken)
            .refreshToken(refreshToken.getToken())
            .build();
}
    public AuthResponse refresh(RefreshRequest request) {

        RefreshToken refreshToken =
                refreshTokenService.findByToken(
                        request.getRefreshToken());

        refreshTokenService.verifyExpiration(refreshToken);

        User user = refreshToken.getUser();

        UserDetails userDetails =
                new CustomUserDetails(user);

        String accessToken =
                jwtService.generateToken(userDetails);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken.getToken())
                .build();
    }

    public void logout(String refreshTokenValue) {
        if (refreshTokenValue == null || refreshTokenValue.isBlank()) {
            return;
        }
        try {
            RefreshToken token = refreshTokenService.findByToken(refreshTokenValue);
            refreshTokenService.deleteByUser(token.getUser());
        } catch (Exception e) {
            // Ignore if token is already deleted or not found
        }
    }

    public String forgotPassword(ForgotPasswordRequest request) {
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new IllegalArgumentException("Email cannot be empty");
        }
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("No account found with this email address"));

        String token = UUID.randomUUID().toString();
        user.setResetToken(token);
        user.setResetTokenExpiry(Instant.now().plus(10, ChronoUnit.MINUTES));
        userRepository.save(user);

        System.out.println("Generated Reset Token for user " + user.getUsername() + ": " + token);
        return token;
    }

    public void resetPassword(ResetPasswordRequest request) {
        if (request.getToken() == null || request.getToken().isBlank()) {
            throw new IllegalArgumentException("Reset token cannot be empty");
        }
        if (request.getNewPassword() == null || request.getNewPassword().isBlank()) {
            throw new IllegalArgumentException("New password cannot be empty");
        }
        if (request.getNewPassword().length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters long");
        }
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new IllegalArgumentException("Passwords do not match");
        }

        User user = userRepository.findByResetToken(request.getToken())
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired password reset token"));

        if (user.getResetTokenExpiry().isBefore(Instant.now())) {
            throw new IllegalArgumentException("Password reset token has expired");
        }

        // Validate that new password is not the same as the current password
        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new IllegalArgumentException("New password cannot be the same as the current password");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        userRepository.save(user);
    }
}
