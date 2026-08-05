package com.auth.auth_service.service;

import com.auth.auth_service.entity.RefreshToken;
import com.auth.auth_service.entity.User;
import com.auth.auth_service.exception.TokenExpiredException;
import com.auth.auth_service.exception.TokenNotFoundException;
import com.auth.auth_service.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;

    public RefreshToken createRefreshToken(User user){
        System.out.println("inside createRefreshToken of Refreshtockenservice "+ user.getId()+" "+user.getRole());
        
        RefreshToken refreshToken = refreshTokenRepository.findByUser(user)
                .orElse(new RefreshToken());
                
        refreshToken.setToken(UUID.randomUUID().toString());
        refreshToken.setUser(user);
        refreshToken.setExpiryDate(Instant.now().plus(7, ChronoUnit.DAYS));

        return refreshTokenRepository.save(refreshToken);
    }
    
    public RefreshToken verifyExpiration(
            RefreshToken token){

        if(token.getExpiryDate().isBefore(Instant.now())){

            refreshTokenRepository.delete(token);

            throw new TokenExpiredException(
                    "Refresh Token Expired");
        }

        return token;
    }
    
    public RefreshToken findByToken(String token){
       return refreshTokenRepository.findByToken(token)
               .orElseThrow(
                       ()-> new TokenNotFoundException("Token Not Found")
                       );
    }
    
    public void deleteByUser(User user) {
        refreshTokenRepository.deleteByUser(user);
    }

}
