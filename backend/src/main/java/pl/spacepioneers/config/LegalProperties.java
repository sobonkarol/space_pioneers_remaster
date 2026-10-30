package pl.spacepioneers.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Dane administratora serwisu do regulaminu i polityki prywatnosci (prefiks spacepioneers.legal).
 * Ustawiane w .env na serwerze (LEGAL_OPERATOR, LEGAL_ADDRESS, LEGAL_EMAIL), nie w repozytorium.
 */
@ConfigurationProperties(prefix = "spacepioneers.legal")
public record LegalProperties(String operator, String address, String email) {
}
