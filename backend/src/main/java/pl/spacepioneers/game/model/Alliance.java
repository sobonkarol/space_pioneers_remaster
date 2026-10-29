package pl.spacepioneers.game.model;

import java.time.Instant;

public class Alliance {

    private long id;
    private String tag;
    private String name;
    private String description = "";
    private String homepage = "";
    private long founderId;
    private Instant createdAt;
    private boolean openForApplications = true;
    private Score score = Score.ZERO;
    private int rank;

    public Alliance() {
    }

    public Alliance(long id, String tag, String name, long founderId, Instant createdAt) {
        this.id = id;
        this.tag = tag;
        this.name = name;
        this.founderId = founderId;
        this.createdAt = createdAt;
    }

    public long getId() { return id; }
    public void setId(long id) { this.id = id; }
    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getHomepage() { return homepage; }
    public void setHomepage(String homepage) { this.homepage = homepage; }
    public long getFounderId() { return founderId; }
    public void setFounderId(long founderId) { this.founderId = founderId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public boolean isOpenForApplications() { return openForApplications; }
    public void setOpenForApplications(boolean open) { this.openForApplications = open; }
    public Score getScore() { return score; }
    public void setScore(Score score) { this.score = score; }
    public int getRank() { return rank; }
    public void setRank(int rank) { this.rank = rank; }
}
