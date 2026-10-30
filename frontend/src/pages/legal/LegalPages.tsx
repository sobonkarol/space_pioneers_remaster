import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { firstAsset } from '../../lib/assets';
import { useSession } from '../../state/session';
import { useWikiConfig } from '../wiki/WikiFrame';

/**
 * Regulamin i polityka prywatnosci. Przy zmianie tresci podnies PlayerService.TERMS_VERSION w backendzie
 * i LEGAL_DATE ponizej - gracze zaakceptuja nowa wersje przy nastepnym wejsciu do gry.
 */
export const TERMS_PATH = '/regulamin';
export const PRIVACY_PATH = '/prywatnosc';
const LEGAL_DATE = '1 listopada 2026';

interface Legal {
  operator?: string | null;
  address?: string | null;
  email?: string | null;
}

function Missing({ what }: { what: string }) {
  return <span className="legal-missing">[{what} - administrator jeszcze nie uzupełnił]</span>;
}

function useLegal(): Legal {
  const cfg = useWikiConfig() as unknown as { legal?: Legal } | null;
  return cfg?.legal ?? {};
}

function Operator({ legal }: { legal: Legal }) {
  return (
    <>
      {legal.operator ?? <Missing what="imię i nazwisko lub nazwa firmy" />},{' '}
      {legal.address ?? <Missing what="adres" />}, e-mail:{' '}
      {legal.email ? <a href={`mailto:${legal.email}`}>{legal.email}</a> : <Missing what="adres e-mail" />}
    </>
  );
}

function Mail({ legal }: { legal: Legal }) {
  return legal.email ? <a href={`mailto:${legal.email}`}>{legal.email}</a> : <Missing what="adres e-mail" />;
}

function LegalFrame({ title, children }: { title: string; children: ReactNode }) {
  const { profile } = useSession();
  const logo = firstAsset(['logo']);
  useEffect(() => {
    document.title = `${title} – Space Pioneers Remaster`;
    window.scrollTo(0, 0);
  }, [title]);
  return (
    <div className="board-page legal-page">
      <header className="board-header">
        <Link to="/" className="board-logo">
          {logo ? <img src={logo} alt="Space Pioneers Remaster" /> : <b>Space Pioneers Remaster</b>}
        </Link>
        <div className="board-user">
          <Link to={TERMS_PATH}>Regulamin</Link> · <Link to={PRIVACY_PATH}>Polityka prywatności</Link> ·{' '}
          {profile ? <a href="/overview">Wróć do gry</a> : <a href="/">Strona główna</a>}
        </div>
      </header>
      <article className="legal-doc">
        <h1>{title}</h1>
        <p className="legal-date">Obowiązuje od {LEGAL_DATE}</p>
        {children}
      </article>
    </div>
  );
}

export function TermsPage() {
  const legal = useLegal();
  return (
    <LegalFrame title="Regulamin">
      <h2>§ 1. Postanowienia ogólne</h2>
      <ol>
        <li>
          Regulamin określa zasady korzystania z gry przeglądarkowej <b>Space Pioneers Remaster</b> dostępnej pod adresem{' '}
          {window.location.host} (dalej: <i>Gra</i>).
        </li>
        <li>Grę prowadzi: <Operator legal={legal} /> (dalej: <i>Administrator</i>).</li>
        <li>
          Gra jest bezpłatna i niekomercyjna. Nie zawiera płatności, reklam ani przedmiotów premium. Jest niezależnym projektem
          inspirowanym klasyczną grą Space Pioneers i nie jest powiązana z jej twórcami ani wydawcami.
        </li>
        <li>Do korzystania z Gry wystarczy aktualna przeglądarka internetowa z włączoną obsługą JavaScript.</li>
        <li>
          Założenie konta oznacza zawarcie z Administratorem umowy o świadczenie usługi drogą elektroniczną na czas nieokreślony,
          na warunkach tego Regulaminu. Gracz może ją w każdej chwili rozwiązać, usuwając konto.
        </li>
      </ol>

      <h2>§ 2. Konto</h2>
      <ol>
        <li>
          Konto może założyć osoba, która ukończyła 16 lat. Osoba młodsza może grać za zgodą rodzica lub opiekuna prawnego.
        </li>
        <li>Każda osoba może mieć w jednym uniwersum tylko jedno konto.</li>
        <li>
          Nazwa gracza nie może być obraźliwa, wulgarna, podszywać się pod inne osoby (w tym Administratora) ani naruszać praw
          osób trzecich.
        </li>
        <li>
          Gracz odpowiada za poufność swojego hasła. Nie wolno udostępniać konta innym osobom ani grać na cudzym koncie.
        </li>
        <li>
          Gracz może w ustawieniach zmienić adres e-mail i hasło, pobrać kopię swoich danych oraz zlecić usunięcie konta. Konto jest
          usuwane po 7 dniach od zlecenia; do tego czasu usunięcie można anulować.
        </li>
      </ol>

      <h2>§ 3. Zasady gry</h2>
      <p>Zabronione jest w szczególności:</p>
      <ol>
        <li>posiadanie więcej niż jednego konta (multikonta) oraz przekazywanie surowców lub flot między kontami tej samej osoby;</li>
        <li>
          jednostronne przekazywanie surowców innemu graczowi bez uczciwej wymiany (tzw. pushing), zwłaszcza od słabszego do
          silniejszego gracza;
        </li>
        <li>używanie botów, skryptów i programów, które grają za gracza albo automatyzują rozgrywkę;</li>
        <li>
          celowe wykorzystywanie błędów Gry. Znaleziony błąd należy zgłosić na <a href="/forum-gry/BUGS">forum</a> lub e-mailem;
        </li>
        <li>
          ingerowanie w działanie serwera, w tym próby przełamania zabezpieczeń i przeciążania serwera nadmierną liczbą zapytań;
        </li>
        <li>
          zamieszczanie w nazwach, wiadomościach, opisach sojuszy i na forach treści bezprawnych, obraźliwych, wulgarnych,
          dyskryminujących, reklamowych lub spamu oraz nękanie innych graczy;
        </li>
        <li>udostępnianie cudzych danych osobowych.</li>
      </ol>
      <p>Atakowanie, szpiegowanie, rabowanie i niszczenie flot innych graczy zgodnie z mechaniką Gry jest częścią rozgrywki i nie narusza Regulaminu.</p>

      <h2>§ 4. Naruszenia i blokady</h2>
      <ol>
        <li>
          Za naruszenie Regulaminu Administrator może: usunąć treść, zmienić nazwę gracza, cofnąć korzyści uzyskane niezgodnie z
          zasadami, zablokować konto na czas określony (od 1 godziny do 365 dni) lub na stałe, a w razie rażących lub powtarzających
          się naruszeń usunąć konto.
        </li>
        <li>
          Zablokowane konto jest w trybie urlopowym i nie można się na nie zalogować. Nazwa gracza, okres i powód blokady są
          widoczne publicznie na <Link to="/pillory">pręgierzu</Link>.
        </li>
        <li>
          Od blokady można się odwołać e-mailem (<Mail legal={legal} />) w ciągu 14 dni. Administrator rozpatruje odwołanie w
          ciągu 14 dni.
        </li>
      </ol>

      <h2>§ 5. Treści graczy</h2>
      <ol>
        <li>
          Za treści zamieszczane w Grze (wiadomości, opisy, wpisy na forach, notatki) odpowiada ich autor. Gracz udziela
          Administratorowi nieodpłatnej, niewyłącznej zgody na ich przechowywanie i wyświetlanie w Grze w zakresie potrzebnym do jej
          działania.
        </li>
        <li>
          Administrator może usunąć treść naruszającą prawo lub Regulamin, w szczególności po otrzymaniu zgłoszenia. Treść
          bezprawną można zgłosić na adres <Mail legal={legal} />.
        </li>
        <li>Wiadomości prywatne nie są przeglądane przez Administratora, chyba że zostaną mu zgłoszone jako naruszenie.</li>
      </ol>

      <h2>§ 6. Działanie Gry</h2>
      <ol>
        <li>
          Gra jest stale rozwijana. Administrator może zmieniać zasady rozgrywki, balans, wygląd i funkcje Gry, a także
          przeprowadzić reset uniwersum, o czym uprzedzi graczy z wyprzedzeniem w ogłoszeniu w Grze.
        </li>
        <li>
          Administrator dba o ciągłość działania Gry i codzienne kopie zapasowe, ale nie gwarantuje nieprzerwanej dostępności.
          Przerwy techniczne mogą się zdarzyć. W razie awarii stan Gry może zostać odtworzony z ostatniej kopii zapasowej.
        </li>
        <li>
          Oprócz ludzi w Grze występują gracze sterowani przez komputer. Grają według tych samych zasad co ludzie (te same
          koszty, czasy i ochrona nowych graczy), nie mają żadnych ułatwień i nie są osobno oznaczeni.
        </li>
        <li>
          Konto, surowce, statki i inne elementy Gry nie mają wartości pieniężnej i nie podlegają wymianie na pieniądze ani
          odszkodowaniu.
        </li>
      </ol>

      <h2>§ 7. Reklamacje</h2>
      <ol>
        <li>
          Reklamacje dotyczące działania Gry można zgłaszać e-mailem na adres <Mail legal={legal} /> lub na forum w dziale
          „Zgłoszenia błędów”. Zgłoszenie powinno zawierać nazwę gracza i opis problemu.
        </li>
        <li>Administrator odpowiada na reklamację w ciągu 14 dni.</li>
      </ol>

      <h2>§ 8. Zmiany Regulaminu i postanowienia końcowe</h2>
      <ol>
        <li>
          Administrator może zmienić Regulamin z ważnych przyczyn (np. zmiana prawa, nowe funkcje Gry). O zmianie gracze dowiedzą
          się przy najbliższym wejściu do Gry. Zmieniony Regulamin obowiązuje gracza po jego akceptacji. Gracz, który go nie
          akceptuje, może usunąć konto.
        </li>
        <li>
          Zasady przetwarzania danych osobowych opisuje <Link to={PRIVACY_PATH}>Polityka prywatności</Link>.
        </li>
        <li>
          W sprawach nieuregulowanych stosuje się prawo polskie. Regulamin nie ogranicza praw przysługujących konsumentom na
          podstawie bezwzględnie obowiązujących przepisów.
        </li>
      </ol>
    </LegalFrame>
  );
}

export function PrivacyPage() {
  const legal = useLegal();
  return (
    <LegalFrame title="Polityka prywatności">
      <p>
        Ta polityka wyjaśnia, jakie dane osobowe przetwarzamy w grze Space Pioneers Remaster, po co i jakie masz prawa. Zbieramy
        tylko to, co jest potrzebne do działania gry.
      </p>

      <h2>1. Administrator danych</h2>
      <p>
        Administratorem danych jest: <Operator legal={legal} />. We wszystkich sprawach dotyczących danych osobowych pisz na{' '}
        <Mail legal={legal} />.
      </p>

      <h2>2. Jakie dane przetwarzamy</h2>
      <table className="board-table legal-table">
        <thead>
          <tr>
            <th>Dane</th>
            <th>Skąd</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>nazwa gracza, adres e-mail, hasło (przechowujemy wyłącznie jego zabezpieczony skrót BCrypt, nie samo hasło)</td>
            <td>podajesz przy rejestracji</td>
          </tr>
          <tr>
            <td>
              dane rozgrywki: planety, budynki, badania, floty, punkty, sojusz, znajomi, specjalizacja, raporty i historia działań w grze
            </td>
            <td>powstają podczas gry</td>
          </tr>
          <tr>
            <td>treści: wiadomości do innych graczy, wpisy na forum sojuszu i forum gry, notatki, opis sojuszu</td>
            <td>wpisujesz sam</td>
          </tr>
          <tr>
            <td>
              dane techniczne: data rejestracji i ostatniej aktywności, data akceptacji regulaminu, skróty tokenów sesji i linków z
              e-maili, licznik nieudanych logowań (przypisany do loginu)
            </td>
            <td>zapisuje serwer</td>
          </tr>
          <tr>
            <td>informacje o blokadzie: okres, powód, kto ją nałożył</td>
            <td>Administrator, w razie naruszenia Regulaminu</td>
          </tr>
        </tbody>
      </table>
      <p>
        Adres IP jest używany na bieżąco tylko do ochrony przed nadużyciami (limity liczby zapytań) i nie jest zapisywany w bazie
        danych gry. Nie zbieramy imienia, nazwiska, numeru telefonu, płatności ani danych o lokalizacji.
      </p>

      <h2>3. Cele i podstawy prawne</h2>
      <ul>
        <li>
          <b>Prowadzenie konta i gry</b> (rozgrywka, ranking, komunikacja między graczami, e-maile z linkiem potwierdzającym adres i
          resetem hasła): wykonanie umowy, czyli art. 6 ust. 1 lit. b RODO.
        </li>
        <li>
          <b>Bezpieczeństwo i uczciwa gra</b> (ochrona przed włamaniami i nadużyciami, wykrywanie multikont, blokady, pręgierz,
          kopie zapasowe, obsługa zgłoszeń i odwołań): prawnie uzasadniony interes Administratora, czyli art. 6 ust. 1 lit. f RODO.
        </li>
        <li>
          <b>Ustalenie i obrona roszczeń</b>, jeśli zajdzie taka potrzeba: art. 6 ust. 1 lit. f RODO.
        </li>
      </ul>
      <p>
        Nie wysyłamy reklam ani newsletterów. Ogłoszenia o grze trafiają do skrzynki wiadomości w grze. Nie profilujemy graczy i
        nie podejmujemy wobec nich decyzji wyłącznie automatycznie w rozumieniu art. 22 RODO (ranking i walka to mechanika gry).
      </p>

      <h2>4. Kto widzi Twoje dane</h2>
      <ul>
        <li>
          <b>Inni gracze</b> widzą Twoją nazwę gracza, planety i ich współrzędne, punkty i miejsce w rankingu, sojusz, status
          aktywności oraz treści, które publikujesz (wiadomości do nich, wpisy na forach). Adresu e-mail nie widzi nikt poza
          Administratorem.
        </li>
        <li>
          <b>Wszyscy odwiedzający</b> widzą publiczne forum gry oraz pręgierz (nazwa zablokowanego gracza, okres i powód blokady).
        </li>
        <li>
          <b>Dostawcy usług</b>, którzy przetwarzają dane na zlecenie Administratora: OVHcloud (serwer gry, poczta e-mail,
          przechowywanie kopii zapasowych).
        </li>
        <li>Organy publiczne, jeśli zażądają tego na podstawie przepisów prawa.</li>
      </ul>
      <p>
        Opisy sojuszy mogą zawierać obrazki wstawione przez graczy z innych serwerów. Przeglądarka pobiera je bezpośrednio
        z tych serwerów, które widzą wtedy Twój adres IP, tak jak przy każdej stronie z obrazkami z zewnątrz.
      </p>

      <h2>5. Przekazywanie danych poza EOG</h2>
      <p>
        Serwer gry znajduje się w centrum danych OVHcloud w Kanadzie. Komisja Europejska uznała, że Kanada zapewnia odpowiedni
        stopień ochrony danych osobowych (decyzja 2002/2/WE), więc dane są tam chronione na poziomie porównywalnym z Unią
        Europejską. Kopie zapasowe przechowujemy w centrach danych OVHcloud w Kanadzie lub w Unii Europejskiej.
      </p>

      <h2>6. Jak długo przechowujemy dane</h2>
      <ul>
        <li>Dane konta i rozgrywki przechowujemy do usunięcia konta (usunięcie następuje 7 dni po zleceniu).</li>
        <li>
          Wiadomości w grze są usuwane automatycznie: przeczytane po 7 dniach, nieprzeczytane po 30 dniach. Archiwum wiadomości
          usuwasz sam albo znika razem z kontem.
        </li>
        <li>
          Wpisy na publicznym forum gry i forum sojuszu oraz wpisy na pręgierzu pozostają po usunięciu konta, podpisane nazwą
          gracza. Na Twoją prośbę usuniemy je lub zanonimizujemy, chyba że wpis na pręgierzu jest potrzebny do ochrony przed
          ponownym naruszeniem.
        </li>
        <li>Kopie zapasowe bazy są nadpisywane po upływie do 120 dni. Do tego czasu mogą zawierać dane usuniętego konta.</li>
      </ul>

      <h2>7. Twoje prawa</h2>
      <p>Masz prawo do:</p>
      <ul>
        <li>
          <b>dostępu do danych i ich przenoszenia</b>: w ustawieniach gry przycisk <i>Pobierz moje dane</i> zapisuje plik JSON z
          danymi konta, planet, wiadomości, notatek i znajomych;
        </li>
        <li><b>sprostowania</b>: adres e-mail zmienisz w ustawieniach, nazwę gracza na prośbę wysłaną e-mailem;</li>
        <li><b>usunięcia danych</b>: usuń konto w ustawieniach albo napisz do nas;</li>
        <li><b>ograniczenia przetwarzania</b> i <b>sprzeciwu</b> wobec przetwarzania opartego na prawnie uzasadnionym interesie;</li>
        <li>
          <b>skargi do organu nadzorczego</b>: Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl).
        </li>
      </ul>
      <p>
        Wnioski wysyłaj na <Mail legal={legal} />. Odpowiadamy bez zbędnej zwłoki, najpóźniej w ciągu miesiąca.
      </p>

      <h2>8. Czy musisz podać dane</h2>
      <p>
        Podanie nazwy gracza, adresu e-mail i hasła jest dobrowolne, ale bez nich nie da się założyć konta. Adres e-mail służy
        do potwierdzenia konta, odzyskania hasła i kontaktu w sprawach konta.
      </p>

      <h2>9. Ciasteczka i pamięć przeglądarki</h2>
      <p>
        Gra nie używa ciasteczek, narzędzi analitycznych, reklam ani wtyczek serwisów społecznościowych. W pamięci przeglądarki
        (localStorage) zapisujemy tylko token sesji (żeby nie logować Cię przy każdym wejściu), ostatnio wybraną planetę i język
        interfejsu. Są one niezbędne do działania gry. Token sesji znika po wylogowaniu, a całość po wyczyszczeniu danych
        przeglądarki.
      </p>

      <h2>10. Bezpieczeństwo</h2>
      <p>
        Połączenie z grą jest szyfrowane (HTTPS). Hasła przechowujemy jako skróty BCrypt, a tokeny sesji i linków z e-maili jako
        skróty SHA-256. Liczba prób logowania jest ograniczona. Dostęp do serwera i bazy danych ma tylko Administrator.
      </p>

      <h2>11. Zmiany polityki</h2>
      <p>
        O zmianach tej polityki poinformujemy przy najbliższym wejściu do gry. Aktualna wersja jest zawsze dostępna pod adresem{' '}
        <Link to={PRIVACY_PATH}>{window.location.host}{PRIVACY_PATH}</Link>.
      </p>
    </LegalFrame>
  );
}
