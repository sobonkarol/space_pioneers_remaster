package pl.spacepioneers.engine.economy;

import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.data.Requirements;

import java.util.ArrayList;
import java.util.List;

/** Sprawdza drzewo technologii. */
public final class RequirementChecker {

    private RequirementChecker() {
    }

    /** Lista niespelnionych wymagan w postaci "klucz:poziom" (pusta = spelnione). */
    public static List<String> missing(Requirements req, PlanetSnapshot planet, TechLevels tech) {
        List<String> out = new ArrayList<>();
        req.buildings().forEach((k, lvl) -> {
            if (planet.level(k) < lvl) out.add("building:" + k + ":" + lvl);
        });
        req.research().forEach((k, lvl) -> {
            if (tech.level(k) < lvl) out.add("research:" + k + ":" + lvl);
        });
        return out;
    }

    public static boolean branchAllows(Branch required, Branch player) {
        return required == null || required == Branch.NONE || required == player;
    }
}
