package pl.spacepioneers.game.model;

import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/** Flota w locie. */
public class Fleet {

    public enum Mission { ATTACK, TRANSPORT, DEPLOY, COLONIZE, RECYCLE, ESPIONAGE }

    public enum Status { OUTBOUND, RETURNING }

    private long id;
    private long ownerId;
    private long originPlanetId;
    private Coordinates origin;
    private Coordinates target;
    private Long targetPlanetId;
    private Long targetOwnerId;
    private Mission mission;
    private Status status = Status.OUTBOUND;
    private Map<String, Long> ships = new HashMap<>();
    private Resources cargo = Resources.ZERO;
    private int speedPercent;
    private long fuel;
    private Instant departAt;
    private Instant arriveAt;
    private Instant returnAt;

    /** Najblizszy moment, w ktorym flota wymaga obslugi. */
    public Instant nextEventAt() {
        return status == Status.OUTBOUND ? arriveAt : returnAt;
    }

    public long totalShips() {
        return ships.values().stream().mapToLong(Long::longValue).sum();
    }

    public long getId() { return id; }
    public void setId(long id) { this.id = id; }
    public long getOwnerId() { return ownerId; }
    public void setOwnerId(long ownerId) { this.ownerId = ownerId; }
    public long getOriginPlanetId() { return originPlanetId; }
    public void setOriginPlanetId(long originPlanetId) { this.originPlanetId = originPlanetId; }
    public Coordinates getOrigin() { return origin; }
    public void setOrigin(Coordinates origin) { this.origin = origin; }
    public Coordinates getTarget() { return target; }
    public void setTarget(Coordinates target) { this.target = target; }
    public Long getTargetPlanetId() { return targetPlanetId; }
    public void setTargetPlanetId(Long targetPlanetId) { this.targetPlanetId = targetPlanetId; }
    public Long getTargetOwnerId() { return targetOwnerId; }
    public void setTargetOwnerId(Long targetOwnerId) { this.targetOwnerId = targetOwnerId; }
    public Mission getMission() { return mission; }
    public void setMission(Mission mission) { this.mission = mission; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public Map<String, Long> getShips() { return ships; }
    public void setShips(Map<String, Long> ships) { this.ships = new HashMap<>(ships); }
    public Resources getCargo() { return cargo; }
    public void setCargo(Resources cargo) { this.cargo = cargo; }
    public int getSpeedPercent() { return speedPercent; }
    public void setSpeedPercent(int speedPercent) { this.speedPercent = speedPercent; }
    public long getFuel() { return fuel; }
    public void setFuel(long fuel) { this.fuel = fuel; }
    public Instant getDepartAt() { return departAt; }
    public void setDepartAt(Instant departAt) { this.departAt = departAt; }
    public Instant getArriveAt() { return arriveAt; }
    public void setArriveAt(Instant arriveAt) { this.arriveAt = arriveAt; }
    public Instant getReturnAt() { return returnAt; }
    public void setReturnAt(Instant returnAt) { this.returnAt = returnAt; }
}
