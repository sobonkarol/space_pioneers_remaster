package pl.spacepioneers.game.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;

/** Pole zniszczen na danej pozycji (tylko metal i krysztal). */
public record DebrisField(Coordinates coordinates, Resources resources) {

    @JsonIgnore
    public boolean isEmpty() {
        return resources.metal() < 1 && resources.crystal() < 1;
    }
}
