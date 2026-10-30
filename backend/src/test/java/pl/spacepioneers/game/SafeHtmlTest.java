package pl.spacepioneers.game;

import org.junit.Test;
import pl.spacepioneers.game.text.SafeHtml;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class SafeHtmlTest {

    @Test
    public void keepsClassicFormatting() {
        String html = "<center><font color=\"#ff9900\" size=\"5\"><b>[TAG] Sojusz</b></font></center>"
                + "<table border=\"1\" cellpadding=\"4\" bgcolor=\"#102030\"><tr><td style=\"color: red; text-align: center\">Lider</td></tr></table>"
                + "<img src=\"https://example.com/banner.gif\" width=\"400\" alt=\"baner\">"
                + "<a href=\"https://forum.example.com\">forum</a><marquee>Witajcie!</marquee>";
        String out = SafeHtml.clean(html);
        assertTrue(out, out.contains("<center>") && out.contains("color=\"#ff9900\"") && out.contains("<b>"));
        assertTrue(out, out.contains("<table") && out.contains("bgcolor=\"#102030\"") && out.contains("color: red"));
        assertTrue(out, out.contains("src=\"https://example.com/banner.gif\"") && out.contains("width=\"400\""));
        assertTrue(out, out.contains("rel=\"nofollow noopener noreferrer\"") && out.contains("target=\"_blank\""));
        assertTrue(out, out.contains("<marquee>"));
    }

    @Test
    public void removesEverythingDangerous() {
        String out = SafeHtml.clean("<script>alert(1)</script><img src=x onerror=alert(1)>"
                + "<img src=\"http://insecure.example/a.png\"><a href=\"javascript:alert(1)\">x</a>"
                + "<iframe src=\"https://evil\"></iframe><form action=\"/api/auth/login\"><input name=p></form>"
                + "<div onclick=\"steal()\" style=\"position: fixed; top: 0; background: url(https://evil/x.png); color: blue\">y</div>"
                + "<p style=\"width: expression(alert(1))\">z</p><svg onload=alert(1)></svg>");
        for (String bad : new String[]{"<script", "onerror", "alert", "http://insecure", "javascript:", "<iframe", "<form",
                "<input", "onclick", "position", "url(", "expression", "<svg", "onload"}) {
            assertFalse(bad + " w " + out, out.toLowerCase().contains(bad));
        }
        assertTrue("bezpieczna czesc stylu zostaje: " + out, out.contains("color: blue"));
    }

    @Test
    public void plainTextKeepsLines() {
        assertEquals("Linia 1<br>Linia &lt;2&gt;", SafeHtml.clean("Linia 1\nLinia <2>"));
        assertEquals("", SafeHtml.clean("   "));
    }
}
