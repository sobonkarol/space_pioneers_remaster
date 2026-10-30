package pl.spacepioneers.game.bot;

import java.util.List;
import java.util.Random;
import java.util.function.Predicate;

/**
 * Nicki botow w stylu graczy gier przegladarkowych: polskie i angielskie slowa, przydomki, liczby.
 * Bez slow zdradzajacych bota ("bot", "AI") i bez podszywania sie pod administracje.
 */
public final class BotNames {

    private static final List<String> FIRST = List.of(
            "Kosmo", "Stalowy", "Czarny", "Szary", "Zimny", "Mroczny", "Cichy", "Dziki", "Stary", "Mlody",
            "Wielki", "Szybki", "Zloty", "Krwawy", "Senny", "Lodowy", "Ognisty", "Gwiezdny", "Polny", "Nocny",
            "Dark", "Iron", "Star", "Void", "Nova", "Red", "Silent", "Cosmic", "Lone", "Grim",
            "Mega", "Ultra", "Hyper", "Turbo", "Neo", "Astro", "Cyber", "Solar", "Lunar", "Atomic");
    private static final List<String> SECOND = List.of(
            "Wilk", "Kruk", "Sokol", "Lis", "Niedzwiedz", "Rycerz", "Pirat", "Admiral", "Kapitan", "Lowca",
            "Pionier", "Wedrowiec", "Kowal", "Gornik", "Kupiec", "Zbieracz", "Smok", "Tygrys", "Orzel", "Jastrzab",
            "Hunter", "Raider", "Wolf", "Falcon", "Rider", "Ranger", "Pilot", "Knight", "Viper", "Cobra",
            "Titan", "Orion", "Vega", "Sirius", "Comet", "Nebula", "Pulsar", "Quasar", "Rocket", "Phoenix");
    private static final List<String> SINGLE = List.of(
            "Zbyszek", "Mietek", "Heniek", "Grzesiu", "Tomek", "Kuba", "Bartek", "Wojtas", "Marcinek", "Pawlo",
            "Kasia", "Ola", "Magda", "Gosia", "Ania", "Asia", "Ewka", "Dominika", "Natalka", "Iza",
            "Mariusz", "Rafal", "Seba", "Darek", "Krzychu", "Adi", "Piotrek", "Lukasz", "Mati", "Szymek",
            "Andromeda", "Kassiopeja", "Perseusz", "Antares", "Betelgeza", "Kepler", "Gagarin", "Laika", "Halley", "Hubble");
    private static final List<String> ENDINGS = List.of("", "", "", "PL", "X", "_pl", "77", "007", "666", "99",
            "2005", "1987", "1990", "92", "85", "x", "_", "Pro", "Max", "3000");

    private BotNames() {
    }

    /** Losowy, wolny nick (sprawdzany predykatem). */
    public static String generate(Random r, Predicate<String> taken) {
        for (int attempt = 0; attempt < 200; attempt++) {
            String name = switch (r.nextInt(6)) {
                case 0, 1 -> pick(r, FIRST) + pick(r, SECOND);
                case 2 -> pick(r, FIRST) + "_" + pick(r, SECOND);
                case 3 -> pick(r, SINGLE) + (10 + r.nextInt(90));
                case 4 -> pick(r, SECOND).toLowerCase() + (r.nextBoolean() ? "." : "_") + pick(r, SINGLE).toLowerCase();
                default -> pick(r, SINGLE) + pick(r, ENDINGS);
            };
            if (r.nextInt(5) == 0) name = name + pick(r, ENDINGS);
            if (name.length() > 20) name = name.substring(0, 20);
            if (name.length() >= 3 && !taken.test(name)) return name;
        }
        return "Gracz" + (100000 + r.nextInt(900000));
    }

    private static String pick(Random r, List<String> list) {
        return list.get(r.nextInt(list.size()));
    }
}
