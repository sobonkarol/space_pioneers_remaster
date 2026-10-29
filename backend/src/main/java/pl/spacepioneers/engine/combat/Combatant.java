package pl.spacepioneers.engine.combat;

import java.util.Map;

/**
 * Uczestnik walki (flota atakujacego albo planeta/flota obroncy).
 *
 * @param id          identyfikator (np. id gracza lub floty) przenoszony do raportu
 * @param units       liczby jednostek wg klucza
 * @param weapons     poziom technologii uzbrojenia (+10% ataku / poziom)
 * @param shielding   poziom technologii oslon (+10% oslon / poziom)
 * @param armour      poziom technologii pancerza (+10% struktury / poziom)
 * @param attackBonus dodatkowy mnoznik ataku (np. 0.1 dla wojownika)
 */
public record Combatant(long id, Map<String, Long> units, int weapons, int shielding, int armour, double attackBonus) {
    public Combatant {
        units = units == null ? Map.of() : Map.copyOf(units);
    }
}
