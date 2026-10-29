package pl.spacepioneers.game.service;

import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Treaty;

/** Relacje miedzy graczami: sojusz, pakty, znajomi. */
final class Diplomacy {

    private Diplomacy() {
    }

    /** Sojusznicy: ten sam sojusz albo para na liscie znajomych. */
    static boolean allied(GameContext ctx, Player a, Player b) {
        if (a.getId() == b.getId()) return true;
        if (a.getAllianceId() != null && a.getAllianceId().equals(b.getAllianceId())) return true;
        return ctx.store().areBuddies(a.getId(), b.getId());
    }

    /** Ataki na czlonkow wlasnego sojuszu i sojuszy zwiazanych aktywnym paktem sa zablokowane. */
    static boolean protectedFromAttack(GameContext ctx, Player attacker, Player defender) {
        Long a = attacker.getAllianceId();
        Long d = defender.getAllianceId();
        if (a == null || d == null) return false;
        if (a.equals(d)) return true;
        for (Treaty t : ctx.store().treaties(a)) {
            if (t.status() == Treaty.Status.ACTIVE && t.type() != Treaty.Type.WAR && t.other(a) == d) {
                return true;
            }
        }
        return false;
    }
}
