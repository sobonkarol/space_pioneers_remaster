package pl.spacepioneers.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Obsluga routingu aplikacji jednostronicowej: zadania GET o sciezki frontendu (bez kropki,
 * poza /api i /actuator) sa przekazywane do index.html, aby odswiezenie np. /galaxy dzialalo.
 */
@Component
public class SpaForwardFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if ("GET".equals(request.getMethod()) && isFrontendRoute(path)) {
            request.getRequestDispatcher("/index.html").forward(request, response);
            return;
        }
        chain.doFilter(request, response);
    }

    static boolean isFrontendRoute(String path) {
        if (path.isEmpty() || "/".equals(path) || "/index.html".equals(path)) return false;
        if (path.startsWith("/api/") || "/api".equals(path) || path.startsWith("/actuator")) return false;
        if (path.startsWith("/assets/")) return false;
        return !path.substring(path.lastIndexOf('/') + 1).contains(".");
    }
}
