package pl.spacepioneers.game.model;

/** Punkty rankingowe w podziale na kategorie. */
public record Score(double buildings, double research, double fleet, double defense) {

    public static final Score ZERO = new Score(0, 0, 0, 0);

    public double total() {
        return buildings + research + fleet + defense;
    }

    public Score plus(Score o) {
        return new Score(buildings + o.buildings, research + o.research, fleet + o.fleet, defense + o.defense);
    }
}
