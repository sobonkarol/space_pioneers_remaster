import DOMPurify from 'dompurify';

/**
 * Opis sojuszu w HTML (jak w klasycznych grach). Serwer zapisuje go juz oczyszczonego biala lista (SafeHtml),
 * a przegladarka czysci go drugi raz - na wypadek bledu po stronie serwera i dla podgladu w edytorze.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    if (node.hasAttribute('href') && !/^https?:\/\//i.test(node.getAttribute('href') ?? '')) node.removeAttribute('href');
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'nofollow noopener noreferrer');
  }
  if (node.tagName === 'IMG' && !(node.getAttribute('src') ?? '').toLowerCase().startsWith('https://')) {
    node.remove();
  }
  const style = node.getAttribute?.('style');
  if (style && /url\s*\(|expression|position|javascript|@import|\\/i.test(style)) node.removeAttribute('style');
});

const CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'u', 's', 'strike', 'strong', 'em', 'br', 'p', 'div', 'span', 'center', 'font', 'small', 'big', 'tt',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
    'caption', 'col', 'colgroup', 'hr', 'img', 'a', 'blockquote', 'pre', 'code', 'sub', 'sup', 'marquee', 'q', 'cite'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'width', 'height', 'border', 'align', 'valign', 'style', 'color', 'size', 'face',
    'bgcolor', 'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'direction', 'scrollamount', 'behavior', 'target', 'rel'],
  // adresy (href, src) sprawdza hook powyzej; tu nie ustawiamy ALLOWED_URI_REGEXP, bo DOMPurify stosuje go
  // do wartosci wszystkich atrybutow (wycinalby kolory i rozmiary)
};

export function sanitizeAllianceHtml(html: string): string {
  return DOMPurify.sanitize(html, CONFIG) as unknown as string;
}

export function AllianceHtml({ html }: { html: string }) {
  if (!html) return null;
  return <div className="alliance-description" dangerouslySetInnerHTML={{ __html: sanitizeAllianceHtml(html) }} />;
}

/** Przykladowy opis do wstawienia w edytorze. */
export const ALLIANCE_HTML_EXAMPLE = `<center>
<font size="6" color="#f0b050"><b>[TAG] Nazwa sojuszu</b></font><br>
<font color="#8fc8ff"><i>Razem przez galaktykę od 2026</i></font>
</center>
<hr>
<table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%">
<tr bgcolor="#203858"><th>Funkcja</th><th>Gracz</th></tr>
<tr><td>Założyciel</td><td>Twój nick</td></tr>
<tr><td>Oficerowie</td><td>...</td></tr>
</table>
<p><b>Zasady:</b></p>
<ul>
<li>Pomagamy nowym - pytaj śmiało</li>
<li>Bez ataków na sojuszników z paktów</li>
</ul>
<marquee scrollamount="4"><font color="#ffd060">Rekrutacja otwarta!</font></marquee>`;
