package pl.spacepioneers.game.text;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.safety.Cleaner;
import org.jsoup.safety.Safelist;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * HTML od graczy (opisy sojuszy) w stylu klasycznych gier: formatowanie, kolory, tabele, obrazki, linki.
 * Biala lista znacznikow i atrybutow; skrypty, ramki, formularze i zdarzenia (onclick...) sa usuwane.
 * Style CSS: tylko bezpieczne wlasciwosci, bez url(), position, expression itp. (podszywanie sie pod gre).
 */
public final class SafeHtml {

    private static final Set<String> CSS_PROPERTIES = Set.of(
            "color", "background-color", "text-align", "font-size", "font-weight", "font-style", "font-family",
            "text-decoration", "text-transform", "letter-spacing", "line-height", "vertical-align",
            "border", "border-color", "border-width", "border-style", "border-radius", "border-collapse",
            "padding", "margin", "width", "max-width", "height", "white-space");
    /** Wartosci CSS: kolory, liczby z jednostkami, slowa kluczowe; bez nawiasow poza rgb()/rgba(). */
    private static final Pattern CSS_VALUE = Pattern.compile(
            "^(?:[#a-zA-Z0-9.,%\\s'\"-]|rgba?\\(\\s*[0-9.,\\s%]+\\))+$");
    private static final Pattern DANGEROUS = Pattern.compile("(?i)(url|expression|javascript|behavior|@import|\\\\)");
    private static final Pattern SIZE = Pattern.compile("^\\d{1,4}%?$");
    /** Czy tekst zawiera jakikolwiek znacznik HTML (inaczej traktujemy go jak zwykly tekst). */
    private static final Pattern TAG = Pattern.compile("<\\s*/?\\s*[a-zA-Z!]");

    private static final Safelist SAFELIST = Safelist.relaxed()
            .addTags("font", "center", "span", "div", "hr", "small", "big", "marquee", "s", "strike", "tt")
            .addAttributes("font", "color", "size", "face")
            .addAttributes(":all", "style", "align", "title")
            .addAttributes("table", "border", "cellpadding", "cellspacing", "width", "bgcolor")
            .addAttributes("td", "bgcolor", "valign", "width", "colspan", "rowspan")
            .addAttributes("th", "bgcolor", "valign", "width", "colspan", "rowspan")
            .addAttributes("tr", "bgcolor", "valign")
            .addAttributes("img", "width", "height", "border")
            .addAttributes("marquee", "direction", "scrollamount", "behavior")
            .addAttributes("a", "target")
            .removeProtocols("img", "src", "http")
            .addProtocols("a", "href", "http", "https")
            .addEnforcedAttribute("a", "rel", "nofollow noopener noreferrer")
            .addEnforcedAttribute("a", "target", "_blank")
            .preserveRelativeLinks(false);

    private SafeHtml() {
    }

    /** Czysci HTML; zwykly tekst bez znacznikow zamienia na HTML z zachowaniem nowych linii. */
    public static String clean(String input) {
        if (input == null || input.isBlank()) return "";
        String html = TAG.matcher(input).find() ? input : escape(input).replace("\n", "<br>");
        Document dirty = Jsoup.parseBodyFragment(html);
        Document clean = new Cleaner(SAFELIST).clean(dirty);
        for (Element el : clean.body().getAllElements()) {
            if (el.hasAttr("style")) {
                String style = cleanStyle(el.attr("style"));
                if (style.isEmpty()) el.removeAttr("style");
                else el.attr("style", style);
            }
            for (String attr : new String[]{"width", "height", "border", "cellpadding", "cellspacing", "size", "scrollamount"}) {
                if (el.hasAttr(attr) && !SIZE.matcher(el.attr(attr).trim()).matches()) el.removeAttr(attr);
            }
            if (el.tagName().equals("img") && !el.attr("src").toLowerCase(Locale.ROOT).startsWith("https://")) el.remove();
        }
        clean.outputSettings().prettyPrint(false);
        return clean.body().html();
    }

    static String cleanStyle(String style) {
        StringBuilder out = new StringBuilder();
        for (String decl : style.split(";")) {
            int colon = decl.indexOf(':');
            if (colon <= 0) continue;
            String prop = decl.substring(0, colon).trim().toLowerCase(Locale.ROOT);
            String value = decl.substring(colon + 1).trim();
            if (!CSS_PROPERTIES.contains(prop) || value.isEmpty() || value.length() > 100) continue;
            if (DANGEROUS.matcher(value).find() || !CSS_VALUE.matcher(value).matches()) continue;
            if (out.length() > 0) out.append("; ");
            out.append(prop).append(": ").append(value);
        }
        return out.toString();
    }

    private static String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
