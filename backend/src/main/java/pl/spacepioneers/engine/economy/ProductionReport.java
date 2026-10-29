package pl.spacepioneers.engine.economy;

import pl.spacepioneers.engine.common.Resources;

import java.util.Map;

/**
 * Wynik obliczenia produkcji planety (na godzine).
 *
 * @param perHour          produkcja netto na godzine (po uwzglednieniu energii i zuzycia trytu)
 * @param energyProduced   energia wytworzona
 * @param energyUsed       energia zuzyta przez kopalnie
 * @param efficiency       wspolczynnik produkcji kopalni (0..1) wynikajacy z bilansu energii
 * @param perSource        produkcja poszczegolnych zrodel (budynki, "base")
 * @param energyPerSource  energia na zrodlo (dodatnia = produkcja, ujemna = zuzycie)
 */
public record ProductionReport(
        Resources perHour,
        double energyProduced,
        double energyUsed,
        double efficiency,
        Map<String, Resources> perSource,
        Map<String, Double> energyPerSource
) {
    public double energyBalance() {
        return energyProduced - energyUsed;
    }
}
