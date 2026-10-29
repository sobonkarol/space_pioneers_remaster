package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.data.ResearchDef;
import pl.spacepioneers.engine.economy.RequirementChecker;
import pl.spacepioneers.engine.economy.TechLevels;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.BuildOrder;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.ResearchJob;

import java.util.ArrayList;
import java.util.List;

/** Badania: jedno naraz na gracza, prowadzone w laboratorium wybranej planety. */
public final class ResearchService extends ServiceBase {

    public static final String LAB = "research_lab";

    public ResearchService(GameContext ctx, World world) {
        super(ctx, world);
    }

    public List<Views.UpgradeOption> list(long playerId, long planetId) {
        return tx(now -> {
            Player player = ctx.requirePlayer(playerId);
            Planet planet = ownPlanet(playerId, planetId, now);
            TechLevels tech = new TechLevels(player.getResearch());
            int lab = planet.level(LAB);
            List<Views.UpgradeOption> out = new ArrayList<>();
            for (ResearchDef def : ctx.data().research()) {
                int level = player.researchLevel(def.key());
                int next = level + 1;
                Resources cost = next <= def.maxLevelOrDefault() ? def.costForLevel(next) : Resources.ZERO;
                long seconds = ctx.timing().researchSeconds(cost, lab);
                List<String> missing = RequirementChecker.missing(def.requirements(), planet.snapshot(), tech);
                String blocker = blocker(player, planet, def, next);
                out.add(new Views.UpgradeOption(def.key(), "research", level, next, cost, seconds, missing, blocker,
                        planet.getResources().covers(cost), def.branch().name(), null));
            }
            return out;
        });
    }

    private String blocker(Player player, Planet planet, ResearchDef def, int next) {
        if (!RequirementChecker.branchAllows(def.branch(), player.getBranch())) return "branch_locked";
        if (next > def.maxLevelOrDefault()) return "max_level";
        if (planet.level(LAB) < 1) return "no_lab";
        if (player.getResearchJob() != null) return "research_running";
        BuildOrder active = planet.activeBuild();
        if (active != null && LAB.equals(active.building())) return "lab_upgrading";
        return null;
    }

    public Views.ResearchInProgress start(long playerId, long planetId, String key) {
        return tx(now -> {
            Player player = ctx.requirePlayer(playerId);
            requireActive(player);
            Planet planet = ownPlanet(playerId, planetId, now);
            ResearchDef def = ctx.data().findResearch(key).orElseThrow(() -> GameException.notFound("badanie " + key));
            int next = player.researchLevel(key) + 1;
            String blocker = blocker(player, planet, def, next);
            if (blocker != null) {
                String msg = "no_lab".equals(blocker) ? "Na tej planecie nie ma laboratorium badawczego."
                        : PlanetService.blockerMessage(blocker);
                throw new GameException(blocker, msg);
            }
            List<String> missing = RequirementChecker.missing(def.requirements(), planet.snapshot(),
                    new TechLevels(player.getResearch()));
            if (!missing.isEmpty()) {
                throw new GameException("requirements", "Niespełnione wymagania: " + String.join(", ", missing));
            }
            Resources cost = def.costForLevel(next);
            pay(planet, cost);
            long seconds = ctx.timing().researchSeconds(cost, planet.level(LAB));
            ResearchJob job = new ResearchJob(key, next, planet.getId(), cost, now, now.plusSeconds(seconds));
            player.setResearchJob(job);
            ctx.store().save(planet);
            ctx.store().save(player);
            return new Views.ResearchInProgress(key, next, planet.getId(), job.start(), job.end());
        });
    }

    public void cancel(long playerId) {
        txRun(now -> {
            Player player = ctx.requirePlayer(playerId);
            ResearchJob job = player.getResearchJob();
            if (job == null) {
                throw new GameException("no_research", "Nie trwa żadne badanie.");
            }
            ctx.store().planet(job.planetId()).ifPresent(p -> {
                world.advance(p, player, now);
                p.setResources(p.getResources().plus(job.cost()));
                ctx.store().save(p);
            });
            player.setResearchJob(null);
            ctx.store().save(player);
        });
    }
}
