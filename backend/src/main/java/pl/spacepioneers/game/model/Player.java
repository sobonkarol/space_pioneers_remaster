package pl.spacepioneers.game.model;

import pl.spacepioneers.engine.common.Branch;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/** Konto gracza w galaktyce. */
public class Player {

    public enum AllianceRank { FOUNDER, OFFICER, MEMBER }

    private long id;
    private String username;
    private String email;
    private String passwordHash;
    private Instant createdAt;
    private Instant lastActivity;
    private Branch branch = Branch.NONE;
    private Map<String, Integer> research = new HashMap<>();
    private ResearchJob researchJob;
    private Long allianceId;
    private AllianceRank allianceRank;
    private Instant vacationUntil;
    private boolean admin;
    private long homePlanetId;
    private String language = "pl";
    private Score score = Score.ZERO;
    private int rank;
    private boolean emailVerified;
    private Instant bannedUntil;
    private String banReason;
    /** Urlop wymuszony blokada - zdejmowany razem z blokada. */
    private boolean banVacation;
    private Instant deletionAt;
    /** Wersja zaakceptowanego regulaminu i polityki prywatnosci (0 = brak zgody). */
    private int termsVersion;
    private Instant termsAcceptedAt;
    /** Ostatni przeczytany wpis w kazdym watku forum sojuszu (do oznaczania nowych wpisow). */
    private Map<Long, Long> forumRead = new HashMap<>();
    /** Ostatni przeczytany wpis w watkach publicznego forum gry. */
    private Map<Long, Long> boardRead = new HashMap<>();
    /** Chwila ostatniego wpisu na publicznym forum (ochrona przed zalewaniem). */
    private Instant lastBoardPostAt;

    public Player() {
    }

    public Player(long id, String username, String email, String passwordHash, Instant createdAt) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.createdAt = createdAt;
        this.lastActivity = createdAt;
    }

    public int researchLevel(String key) {
        return research.getOrDefault(key, 0);
    }

    /**
     * Tryb urlopowy: aktywny, dopoki gracz go nie wylaczy; {@code vacationUntil} to najwczesniejszy
     * moment, w ktorym wolno go wylaczyc.
     */
    public boolean inVacation() {
        return vacationUntil != null;
    }

    /** Blokada konta aktywna w chwili {@code now}. */
    public boolean banned(Instant now) {
        return bannedUntil != null && bannedUntil.isAfter(now);
    }

    /** "i" - nieaktywny 7 dni, "I" - 28 dni. */
    public String inactivity(Instant now) {
        long days = java.time.Duration.between(lastActivity, now).toDays();
        if (days >= 28) return "I";
        if (days >= 7) return "i";
        return null;
    }

    public long getId() { return id; }
    public void setId(long id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getLastActivity() { return lastActivity; }
    public void setLastActivity(Instant lastActivity) { this.lastActivity = lastActivity; }
    public Branch getBranch() { return branch; }
    public void setBranch(Branch branch) { this.branch = branch; }
    public Map<String, Integer> getResearch() { return research; }
    public void setResearch(Map<String, Integer> research) { this.research = new HashMap<>(research); }
    public ResearchJob getResearchJob() { return researchJob; }
    public void setResearchJob(ResearchJob researchJob) { this.researchJob = researchJob; }
    public Long getAllianceId() { return allianceId; }
    public void setAllianceId(Long allianceId) { this.allianceId = allianceId; }
    public AllianceRank getAllianceRank() { return allianceRank; }
    public void setAllianceRank(AllianceRank allianceRank) { this.allianceRank = allianceRank; }
    public Instant getVacationUntil() { return vacationUntil; }
    public void setVacationUntil(Instant vacationUntil) { this.vacationUntil = vacationUntil; }
    public boolean isAdmin() { return admin; }
    public void setAdmin(boolean admin) { this.admin = admin; }
    public long getHomePlanetId() { return homePlanetId; }
    public void setHomePlanetId(long homePlanetId) { this.homePlanetId = homePlanetId; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public Score getScore() { return score; }
    public void setScore(Score score) { this.score = score; }
    public int getRank() { return rank; }
    public void setRank(int rank) { this.rank = rank; }
    public int getTermsVersion() { return termsVersion; }
    public void setTermsVersion(int termsVersion) { this.termsVersion = termsVersion; }
    public Instant getTermsAcceptedAt() { return termsAcceptedAt; }
    public void setTermsAcceptedAt(Instant termsAcceptedAt) { this.termsAcceptedAt = termsAcceptedAt; }
    public boolean isEmailVerified() { return emailVerified; }
    public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }
    public Instant getBannedUntil() { return bannedUntil; }
    public void setBannedUntil(Instant bannedUntil) { this.bannedUntil = bannedUntil; }
    public String getBanReason() { return banReason; }
    public void setBanReason(String banReason) { this.banReason = banReason; }
    public boolean isBanVacation() { return banVacation; }
    public void setBanVacation(boolean banVacation) { this.banVacation = banVacation; }
    public Instant getDeletionAt() { return deletionAt; }
    public void setDeletionAt(Instant deletionAt) { this.deletionAt = deletionAt; }
    public Map<Long, Long> getForumRead() { return forumRead; }
    public void setForumRead(Map<Long, Long> forumRead) { this.forumRead = forumRead == null ? new HashMap<>() : new HashMap<>(forumRead); }
    public Map<Long, Long> getBoardRead() { return boardRead; }
    public void setBoardRead(Map<Long, Long> boardRead) { this.boardRead = boardRead == null ? new HashMap<>() : new HashMap<>(boardRead); }
    public Instant getLastBoardPostAt() { return lastBoardPostAt; }
    public void setLastBoardPostAt(Instant lastBoardPostAt) { this.lastBoardPostAt = lastBoardPostAt; }
}
