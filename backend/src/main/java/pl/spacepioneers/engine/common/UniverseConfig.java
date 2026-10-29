package pl.spacepioneers.engine.common;

/**
 * Parametry galaktyki (serwera). Oryginal mial galaktyki normalne i "speed".
 *
 * @param galaxies           liczba galaktyk w uniwersum
 * @param systems            liczba systemow w galaktyce
 * @param positions          liczba pozycji w systemie
 * @param economySpeed       mnoznik produkcji i czasu budowy
 * @param researchSpeed      mnoznik czasu badan
 * @param fleetSpeed         mnoznik predkosci flot
 * @param debrisRatio        jaka czesc metalu i krysztalu zniszczonych statkow trafia do pola zniszczen
 * @param defenseRebuildRate prawdopodobienstwo odbudowy zniszczonej obrony po walce
 * @param lootRatio          maksymalna czesc zasobow planety mozliwa do zrabowania
 * @param maxCombatRounds    liczba rund walki
 * @param newbieProtectionPoints ponizej tej liczby punktow gracz jest chroniony
 * @param newbieRatio        gracz chroniony, gdy ma mniej niz 1/ratio punktow atakujacego (i odwrotnie)
 */
public record UniverseConfig(
        int galaxies,
        int systems,
        int positions,
        double economySpeed,
        double researchSpeed,
        double fleetSpeed,
        double debrisRatio,
        double defenseRebuildRate,
        double lootRatio,
        int maxCombatRounds,
        long newbieProtectionPoints,
        double newbieRatio
) {
    public static UniverseConfig defaults() {
        return new UniverseConfig(5, 200, 15, 1.0, 1.0, 1.0, 0.3, 0.7, 0.5, 6, 5000, 5.0);
    }

    public UniverseConfig withSpeed(double speed) {
        return new UniverseConfig(galaxies, systems, positions, speed, speed, speed, debrisRatio,
                defenseRebuildRate, lootRatio, maxCombatRounds, newbieProtectionPoints, newbieRatio);
    }
}
