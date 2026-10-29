package pl.spacepioneers.game.model;

import pl.spacepioneers.engine.common.Resources;

import java.time.Instant;

/** Trwajace badanie gracza (jedno naraz). */
public record ResearchJob(String research, int level, long planetId, Resources cost, Instant start, Instant end) {
}
