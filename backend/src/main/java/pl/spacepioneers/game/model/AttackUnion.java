package pl.spacepioneers.game.model;

import pl.spacepioneers.engine.common.Coordinates;

import java.time.Instant;
import java.util.Set;

/**
 * Atak sojuszniczy (zwiazek flot): kilka flot roznych graczy przylatuje razem i walczy wspolnie.
 *
 * @param invited gracze zaproszeni przez zalozyciela (oprocz niego)
 */
public record AttackUnion(long id, long ownerId, String name, Coordinates target, boolean targetMoon,
                          Instant arriveAt, Set<Long> invited, Instant createdAt) {

    public static final int MAX_FLEETS = 8;
    /** Dolaczajaca flota moze opoznic atak najwyzej o 30% pozostalego czasu lotu. */
    public static final double MAX_DELAY_RATIO = 0.3;

    public AttackUnion withArriveAt(Instant at) {
        return new AttackUnion(id, ownerId, name, target, targetMoon, at, invited, createdAt);
    }

    public AttackUnion withInvited(Set<Long> newInvited) {
        return new AttackUnion(id, ownerId, name, target, targetMoon, arriveAt, Set.copyOf(newInvited), createdAt);
    }

    public boolean mayJoin(long playerId) {
        return playerId == ownerId || invited.contains(playerId);
    }
}
