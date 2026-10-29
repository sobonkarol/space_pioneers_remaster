package pl.spacepioneers.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/** Uwierzytelnianie naglowkiem {@code Authorization: Bearer <token>}. */
public class TokenAuthenticationFilter extends OncePerRequestFilter {

    private final SessionService sessions;

    public TokenAuthenticationFilter(SessionService sessions) {
        this.sessions = sessions;
    }

    public static String bearer(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return header.substring(7).trim();
        }
        return null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = bearer(request);
        if (token != null) {
            sessions.resolve(token).ifPresent(playerId -> {
                var auth = new UsernamePasswordAuthenticationToken(new PlayerPrincipal(playerId), null,
                        List.of(new SimpleGrantedAuthority("ROLE_PLAYER")));
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        }
        chain.doFilter(request, response);
    }
}
