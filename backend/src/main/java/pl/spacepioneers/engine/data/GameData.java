package pl.spacepioneers.engine.data;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Katalog definicji gry wczytany z plikow JSON (resources/gamedata). */
public final class GameData {

    private final Map<String, BuildingDef> buildings;
    private final Map<String, ResearchDef> research;
    private final Map<String, UnitDef> units;

    public GameData(List<BuildingDef> buildings, List<ResearchDef> research, List<UnitDef> units) {
        this.buildings = index(buildings, BuildingDef::key);
        this.research = index(research, ResearchDef::key);
        this.units = index(units, UnitDef::key);
        validate();
    }

    public static GameData loadDefault() {
        return load("/gamedata/buildings.json", "/gamedata/research.json", "/gamedata/units.json");
    }

    public static GameData load(String buildingsPath, String researchPath, String unitsPath) {
        ObjectMapper mapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        List<BuildingDef> b = readList(mapper, buildingsPath, "buildings", BuildingDef.class);
        List<ResearchDef> r = readList(mapper, researchPath, "research", ResearchDef.class);
        List<UnitDef> u = readList(mapper, unitsPath, "units", UnitDef.class);
        return new GameData(b, r, u);
    }

    private static <T> List<T> readList(ObjectMapper mapper, String path, String field, Class<T> type) {
        try (InputStream in = GameData.class.getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("Brak pliku danych gry: " + path);
            }
            JsonNode root = mapper.readTree(in);
            List<T> out = new ArrayList<>();
            for (JsonNode node : root.get(field)) {
                out.add(mapper.treeToValue(node, type));
            }
            return out;
        } catch (IOException e) {
            throw new UncheckedIOException("Nie mozna wczytac " + path, e);
        }
    }

    private static <T> Map<String, T> index(List<T> items, java.util.function.Function<T, String> key) {
        Map<String, T> map = new LinkedHashMap<>();
        for (T item : items) {
            String k = key.apply(item);
            if (map.put(k, item) != null) {
                throw new IllegalStateException("Zduplikowany klucz w danych gry: " + k);
            }
        }
        return java.util.Collections.unmodifiableMap(map);
    }

    /** Sprawdza spojnosc: wszystkie wymagania wskazuja istniejace klucze. */
    private void validate() {
        List<String> errors = new ArrayList<>();
        java.util.function.BiConsumer<String, Requirements> check = (owner, req) -> {
            req.buildings().keySet().forEach(k -> {
                if (!buildings.containsKey(k)) errors.add(owner + " wymaga nieznanego budynku " + k);
            });
            req.research().keySet().forEach(k -> {
                if (!research.containsKey(k)) errors.add(owner + " wymaga nieznanego badania " + k);
            });
        };
        buildings.values().forEach(b -> check.accept(b.key(), b.requirements()));
        research.values().forEach(r -> check.accept(r.key(), r.requirements()));
        units.values().forEach(u -> {
            check.accept(u.key(), u.requirements());
            if (u.drive() != null && !research.containsKey(u.drive())) {
                errors.add(u.key() + " ma nieznany naped " + u.drive());
            }
            u.rapidFire().keySet().forEach(k -> {
                if (!units.containsKey(k)) errors.add(u.key() + " ma szybki ogien przeciw nieznanej jednostce " + k);
            });
        });
        if (!errors.isEmpty()) {
            throw new IllegalStateException("Niespojne dane gry: " + errors);
        }
    }

    public Collection<BuildingDef> buildings() {
        return buildings.values();
    }

    public Collection<ResearchDef> research() {
        return research.values();
    }

    public Collection<UnitDef> units() {
        return units.values();
    }

    public List<UnitDef> ships() {
        return units.values().stream().filter(UnitDef::isShip).toList();
    }

    public List<UnitDef> defenses() {
        return units.values().stream().filter(UnitDef::isDefense).toList();
    }

    public List<UnitDef> missiles() {
        return units.values().stream().filter(UnitDef::isMissile).toList();
    }

    public BuildingDef building(String key) {
        return findBuilding(key).orElseThrow(() -> new IllegalArgumentException("Nieznany budynek: " + key));
    }

    public ResearchDef researchDef(String key) {
        return findResearch(key).orElseThrow(() -> new IllegalArgumentException("Nieznane badanie: " + key));
    }

    public UnitDef unit(String key) {
        return findUnit(key).orElseThrow(() -> new IllegalArgumentException("Nieznana jednostka: " + key));
    }

    public Optional<BuildingDef> findBuilding(String key) {
        return Optional.ofNullable(buildings.get(key));
    }

    public Optional<ResearchDef> findResearch(String key) {
        return Optional.ofNullable(research.get(key));
    }

    public Optional<UnitDef> findUnit(String key) {
        return Optional.ofNullable(units.get(key));
    }
}
