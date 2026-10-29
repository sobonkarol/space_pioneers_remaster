package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.common.ResourceType;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.economy.Market;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;

/** Rynek handlarza: wymiana surowcow po stalych kursach z prowizja. */
public final class MarketService extends ServiceBase {

    public MarketService(GameContext ctx, World world) {
        super(ctx, world);
    }

    public record Offer(boolean available, double fee, int tradeCenterLevel) {
    }

    public record ExchangeResult(ResourceType from, ResourceType to, long paid, long received, Resources resources) {
    }

    public Offer offer(long playerId, long planetId) {
        return tx(now -> {
            Player p = ctx.requirePlayer(playerId);
            int level = maxTradeCenter(playerId);
            return new Offer(Market.available(p.getBranch(), level), Market.fee(level), level);
        });
    }

    public ExchangeResult exchange(long playerId, long planetId, ResourceType from, ResourceType to, long amount) {
        return tx(now -> {
            Player p = ctx.requirePlayer(playerId);
            requireActive(p);
            int level = maxTradeCenter(playerId);
            if (!Market.available(p.getBranch(), level)) {
                throw new GameException("market_unavailable", "Rynek wymaga specjalizacji handlarza i Centrum handlowego.");
            }
            if (from == null || to == null || from == to) {
                throw new GameException("invalid_exchange", "Wybierz dwa różne surowce.");
            }
            if (amount <= 0) {
                throw new GameException("invalid_amount", "Ilość musi być dodatnia.");
            }
            Planet planet = ownPlanet(playerId, planetId, now);
            if (planet.getResources().get(from) < amount) {
                throw new GameException("not_enough_resources", "Za mało surowców.");
            }
            long received = Market.exchange(from, to, amount, level);
            Resources r = planet.getResources();
            r = r.with(from, r.get(from) - amount).with(to, r.get(to) + received);
            planet.setResources(r);
            ctx.store().save(planet);
            return new ExchangeResult(from, to, amount, received, r.floor());
        });
    }

    private int maxTradeCenter(long playerId) {
        return ctx.store().planetsOf(playerId).stream().mapToInt(x -> x.level(Market.TRADE_CENTER)).max().orElse(0);
    }
}
