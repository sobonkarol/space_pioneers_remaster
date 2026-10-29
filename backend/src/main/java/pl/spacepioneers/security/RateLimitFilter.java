package pl.spacepioneers.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limity zapytan API (wiadro zetonow). Zapytania zalogowane licza sie na sesje (token), anonimowe na adres IP.
 * Logowanie, rejestracja i reset hasla maja osobny, ostrzejszy limit na adres IP. Przekroczenie: HTTP 429.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_KEYS = 200_000;

    public record Limits(boolean enabled, int authPerMinute, int apiPerMinute, int apiBurst) {
    }

    private static final class Bucket {
        private final double capacity;
        private final double perNano;
        private double tokens;
        private long last;

        Bucket(double capacity, double perMinute, long now) {
            this.capacity = capacity;
            this.perNano = perMinute / 60e9;
            this.tokens = capacity;
            this.last = now;
        }

        synchronized boolean take(long now) {
            tokens = Math.min(capacity, tokens + (now - last) * perNano);
            last = now;
            if (tokens >= 1) {
                tokens -= 1;
                return true;
            }
            return false;
        }

        synchronized boolean idle(long now) {
            return tokens + (now - last) * perNano >= capacity;
        }
    }

    private final Limits limits;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public RateLimitFilter(Limits limits) {
        this.limits = limits;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !limits.enabled() || !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long now = System.nanoTime();
        String ip = request.getRemoteAddr();
        boolean auth = "POST".equals(request.getMethod()) && request.getRequestURI().startsWith("/api/auth/")
                && !request.getRequestURI().equals("/api/auth/logout");
        Bucket bucket;
        if (auth) {
            bucket = bucket("auth:" + ip, limits.authPerMinute(), limits.authPerMinute(), now);
        } else {
            String token = TokenAuthenticationFilter.bearer(request);
            String key = token != null ? "s:" + SessionService.hash(token) : "ip:" + ip;
            bucket = bucket(key, limits.apiBurst(), limits.apiPerMinute(), now);
        }
        if (!bucket.take(now)) {
            response.setStatus(429);
            response.setHeader("Retry-After", "5");
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"code\":\"rate_limited\",\"message\":\"Zbyt wiele zapytań. Zwolnij na chwilę.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private Bucket bucket(String key, int capacity, int perMinute, long now) {
        if (buckets.size() > MAX_KEYS) cleanup(now);
        return buckets.computeIfAbsent(key, k -> new Bucket(capacity, perMinute, now));
    }

    /** Usuwa pelne (nieuzywane) wiadra, aby mapa nie rosla bez konca. */
    public void cleanup(long now) {
        buckets.values().removeIf(b -> b.idle(now));
    }

    public void cleanup() {
        cleanup(System.nanoTime());
    }
}
