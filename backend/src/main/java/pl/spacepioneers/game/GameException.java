package pl.spacepioneers.game;

/**
 * Naruszenie zasad gry zglaszane graczowi. {@code code} jest stabilnym kluczem tlumaczenia po stronie frontendu.
 */
public class GameException extends RuntimeException {

    public enum Kind { RULE, NOT_FOUND, FORBIDDEN, CONFLICT }

    private final String code;
    private final Kind kind;

    public GameException(String code, String message) {
        this(Kind.RULE, code, message);
    }

    public GameException(Kind kind, String code, String message) {
        super(message);
        this.code = code;
        this.kind = kind;
    }

    public static GameException notFound(String what) {
        return new GameException(Kind.NOT_FOUND, "not_found", "Nie znaleziono: " + what);
    }

    public static GameException forbidden(String message) {
        return new GameException(Kind.FORBIDDEN, "forbidden", message);
    }

    public String getCode() {
        return code;
    }

    public Kind getKind() {
        return kind;
    }
}
