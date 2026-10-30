package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.common.Resources;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Modele widokow zwracane przez serwisy (serializowane bezposrednio do JSON przez API). */
public final class Views {

    private Views() {
    }

    public record PlanetRef(long id, String name, String coordinates, String planetType, int imageVariant, boolean homeworld,
                            boolean moon) {
    }

    public record ResourceState(Resources amount, Resources perHour, Resources capacity,
                                double energyProduced, double energyUsed, double efficiency) {
    }

    public record BuildQueueItem(long id, String building, int level, boolean demolish, Resources cost,
                                 Instant start, Instant end) {
    }

    public record ShipyardItem(long id, String unit, long count, long done, long secondsPerUnit,
                               Instant currentUnitStart, Instant finishAt) {
    }

    public record ResearchInProgress(String research, int level, long planetId, Instant start, Instant end) {
    }

    public record FleetMovement(long id, String mission, String status, boolean own, String ownerName,
                                String origin, String target, boolean targetMoon, Long unionId,
                                Instant departAt, Instant arriveAt, Instant holdUntil, Instant returnAt,
                                Map<String, Long> ships, Resources cargo) {
        /** Najblizszy moment zdarzenia (do sortowania i odliczania). */
        public Instant nextAt() {
            return switch (status) {
                case "OUTBOUND" -> arriveAt;
                case "HOLDING" -> holdUntil;
                default -> returnAt;
            };
        }
    }

    public record Overview(
            Instant serverTime,
            long playerId,
            String playerName,
            PlanetRef planet,
            List<PlanetRef> planets,
            int fieldsUsed,
            int fieldsMax,
            int temperatureMin,
            int temperatureMax,
            ResourceState resources,
            List<BuildQueueItem> buildQueue,
            List<ShipyardItem> shipyardQueue,
            ResearchInProgress research,
            List<FleetMovement> fleets,
            double points,
            int rank,
            int playerCount,
            int unreadMessages,
            String branch,
            boolean canChooseBranch,
            boolean vacation,
            int forumUnread,
            List<PlanetActivity> otherPlanets,
            String researchPlanetName
    ) {
    }

    /** Co dzieje sie na innej planecie gracza: budowa i stocznia (puste, gdy nic). */
    public record PlanetActivity(PlanetRef planet, List<BuildQueueItem> buildQueue, List<ShipyardItem> shipyardQueue) {
    }

    /**
     * Opcja rozbudowy (budynek, badanie) lub budowy jednostek.
     *
     * @param missing  niespelnione wymagania w formacie "building:klucz:poziom" / "research:klucz:poziom"
     * @param blocker  powod blokady (kod) albo null
     */
    public record UpgradeOption(String key, String category, int level, int nextLevel, Resources cost,
                                long seconds, List<String> missing, String blocker, boolean affordable,
                                String branch, Double energyDelta) {
    }

    public record UnitOption(String key, String type, long available, Resources cost, long secondsPerUnit,
                             List<String> missing, String blocker, long maxBuildable, double attack,
                             double shield, double hull, long cargo, long speed, String branch) {
    }

    public record ProductionLine(String source, int level, Integer percent, Resources perHour, Double energy) {
    }

    public record ResourcesView(PlanetRef planet, Resources amount, Resources capacity, Resources perHour,
                                double energyProduced, double energyUsed, double efficiency,
                                List<ProductionLine> lines) {
    }

    public record EmpirePlanet(PlanetRef planet, int fieldsUsed, int fieldsMax, Resources resources,
                               Resources perHour, double energyBalance, Map<String, Integer> buildings,
                               Map<String, Long> units) {
    }

    public record GalaxyRow(int position, Long planetId, String planetName, String planetType, int imageVariant,
                            Long ownerId, String ownerName, Integer ownerRank, Long allianceId, String allianceTag,
                            List<String> flags, Resources debris, boolean own, Long moonId, String moonName,
                            int moonImageVariant) {
    }

    public record GalaxyView(int galaxy, int system, int galaxies, int systems, List<GalaxyRow> rows) {
    }

    public record RankingRow(int rank, long id, String name, String allianceTag, Long allianceId, double points,
                             Integer members) {
    }

    public record RankingPage(String type, String category, int page, int pageSize, int total, List<RankingRow> rows) {
    }
}
