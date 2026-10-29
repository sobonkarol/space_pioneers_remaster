package pl.spacepioneers.game.service;

/** Punkt wejscia do logiki gry - sklada wszystkie serwisy na wspolnym kontekscie. */
public final class Game {

    private final GameContext ctx;
    private final World world;
    private final PlanetService planets;
    private final ResearchService research;
    private final ShipyardService shipyard;
    private final FleetService fleets;
    private final PlayerService players;
    private final GalaxyService galaxy;
    private final MessageService messages;
    private final AllianceService alliances;
    private final RankingService ranking;
    private final MarketService market;
    private final BuddyService buddies;

    public Game(GameContext ctx) {
        this.ctx = ctx;
        this.world = new World(ctx);
        Mailer mailer = new Mailer(ctx);
        new MissionProcessor(ctx, world, mailer);
        this.planets = new PlanetService(ctx, world);
        this.research = new ResearchService(ctx, world);
        this.shipyard = new ShipyardService(ctx, world);
        this.fleets = new FleetService(ctx, world);
        this.players = new PlayerService(ctx, world, mailer);
        this.galaxy = new GalaxyService(ctx, world);
        this.messages = new MessageService(ctx, world, mailer);
        this.alliances = new AllianceService(ctx, world, mailer);
        this.ranking = new RankingService(ctx, world);
        this.market = new MarketService(ctx, world);
        this.buddies = new BuddyService(ctx, world, mailer);
    }

    /** Obsluguje zalegle zdarzenia (wywolywane cyklicznie przez harmonogram). */
    public void tick() {
        ctx.store().inTransaction(() -> world.catchUp(ctx.now()));
    }

    public GameContext context() { return ctx; }
    public PlanetService planets() { return planets; }
    public ResearchService research() { return research; }
    public ShipyardService shipyard() { return shipyard; }
    public FleetService fleets() { return fleets; }
    public PlayerService players() { return players; }
    public GalaxyService galaxy() { return galaxy; }
    public MessageService messages() { return messages; }
    public AllianceService alliances() { return alliances; }
    public RankingService ranking() { return ranking; }
    public MarketService market() { return market; }
    public BuddyService buddies() { return buddies; }
}
