package pl.spacepioneers.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public RateLimitFilter rateLimitFilter(
            @Value("${spacepioneers.rate-limit.enabled:true}") boolean enabled,
            @Value("${spacepioneers.rate-limit.auth-per-minute:20}") int authPerMinute,
            @Value("${spacepioneers.rate-limit.api-per-minute:600}") int apiPerMinute,
            @Value("${spacepioneers.rate-limit.api-burst:120}") int apiBurst) {
        return new RateLimitFilter(new RateLimitFilter.Limits(enabled, authPerMinute, apiPerMinute, apiBurst));
    }

    /** Filtr limitow dziala w lancuchu Spring Security, nie jako osobny filtr serwletow. */
    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitRegistration(RateLimitFilter filter) {
        FilterRegistrationBean<RateLimitFilter> r = new FilterRegistrationBean<>(filter);
        r.setEnabled(false);
        return r;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, SessionService sessions, RateLimitFilter rateLimit)
            throws Exception {
        http
                // API jest bezstanowe (token w naglowku), wiec CSRF nie ma zastosowania
                .csrf(c -> c.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(b -> b.disable())
                .formLogin(f -> f.disable())
                .logout(l -> l.disable())
                .headers(h -> h
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
                                        + "script-src 'self'; connect-src 'self'; frame-ancestors 'none'"))
                        .frameOptions(f -> f.deny()))
                .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/api/auth/register", "/api/auth/login", "/api/auth/verify",
                                "/api/auth/forgot-password", "/api/auth/reset-password", "/api/config",
                                "/api/stats", "/api/pillory", "/api/dev/outbox", "/actuator/health").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .addFilterBefore(rateLimit, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(new TokenAuthenticationFilter(sessions), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
