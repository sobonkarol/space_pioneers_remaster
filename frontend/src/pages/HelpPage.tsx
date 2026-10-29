import { Panel } from '../components/common';
import { t } from '../i18n';
import { useSession } from '../state/session';

/** Krotka pomoc dla graczy - zasady wynikajace z implementacji silnika. */
export function HelpPage() {
  const { config } = useSession();
  const u = config?.universe;
  return (
    <div className="help-page">
      <Panel title={t('help.title')}>
        <h3>Pierwsze kroki</h3>
        <p>
          Rozbuduj kopalnię metalu, kopalnię kryształu i elektrownię słoneczną. Kopalnie potrzebują energii - gdy jej brakuje,
          wydobycie spada proporcjonalnie. Po zapełnieniu magazynu wydobycie danego surowca zatrzymuje się.
        </p>
        <h3>Budowa i badania</h3>
        <p>
          Kolejka budowy mieści 5 pozycji; koszt pobierany jest przy dodaniu, a anulowanie zwraca go w całości. Badania prowadzi się
          jedno naraz w laboratorium wybranej planety. Laboratorium nie może być rozbudowywane w trakcie badań, a stocznia - w trakcie produkcji.
        </p>
        <h3>Floty</h3>
        <p>
          Liczba jednoczesnych flot = 1 + poziom technologii komputerowej. Paliwem jest tryt. Misje: atak, transport, stacjonowanie,
          szpiegostwo (tylko sondy), kolonizacja (statek kolonizacyjny, limit planet zależy od astrofizyki) i recykling pól zniszczeń.
          Flotę w drodze do celu można zawrócić.
        </p>
        <h3>Walka</h3>
        <p>
          Walka trwa maksymalnie {u?.maxCombatRounds ?? 6} rund. Zniszczone statki tworzą pole zniszczeń ({Math.round((u?.debrisRatio ?? 0.3) * 100)}% metalu i
          kryształu), ok. {Math.round((u?.defenseRebuildRate ?? 0.7) * 100)}% zniszczonej obrony zostaje odbudowane. Zwycięzca może zrabować do{' '}
          {Math.round((u?.lootRatio ?? 0.5) * 100)}% surowców planety.
        </p>
        <h3>Ochrona</h3>
        <p>
          Gracze poniżej {u?.newbieProtectionPoints ?? 5000} punktów są chronieni przed atakami graczy mających ponad {u?.newbieRatio ?? 5}× więcej punktów.
          Gracze nieaktywni od 7 dni nie są chronieni. Tryb urlopowy chroni przed atakami, ale wstrzymuje produkcję.
        </p>
        <h3>Sojusze</h3>
        <p>
          Członkowie tego samego sojuszu oraz sojuszy związanych aktywnym paktem nie mogą się atakować. Wypowiedzenie wojny jest natychmiastowe.
          Sojusz ma wewnętrzne forum - założyciel i oficerowie mogą przypinać, zamykać i usuwać wątki.
        </p>
        <h3>Szybkie działa</h3>
        <p>
          Niektóre jednostki po trafieniu w określony typ celu strzelają ponownie (np. każdy statek ma 5 strzałów przeciw sondom i satelitom).
          Symulator walki w menu pozwala sprawdzić wynik bitwy przed atakiem; z raportu szpiegowskiego otworzysz go przyciskiem „Symuluj atak”.
        </p>
        <h3>Księżyce</h3>
        <p>
          Duże pole zniszczeń po walce daje szansę na powstanie księżyca: 1% za każde 100 000 surowców, najwyżej 20%. Księżyc nie produkuje surowców
          i ma 1 pole - baza księżycowa dodaje 3 pola za poziom. Falanga czujnikowa (zasięg: poziom² − 1 układów, skan kosztuje 5000 trytu) pokazuje
          floty przy obcych planetach, a teleporter natychmiast przerzuca statki między Twoimi księżycami (potem musi się naładować).
        </p>
        <h3>Rakiety</h3>
        <p>
          Silos rakietowy mieści 10 miejsc na poziom (rakieta przechwytująca 1, międzyplanetarna 2). Rakiety międzyplanetarne mają zasięg
          5 × napęd impulsowy − 1 układów i niszczą obronę celu; rakiety przechwytujące obrońcy zestrzeliwują je jedna na jedną.
        </p>
        <h3>Atak i obrona sojusznicza</h3>
        <p>
          Lecący atak możesz zamienić w atak sojuszniczy i zaprosić sojuszników lub znajomych - do 8 flot doleci jednocześnie (dołączenie może
          opóźnić przylot najwyżej o 30%). Misja „Obrona” wysyła flotę na planetę sojusznika lub znajomego na 1-32 godziny; stacjonująca flota
          walczy po stronie obrońcy.
        </p>
        <h3>Ekspedycje</h3>
        <p>
          Ekspedycje lecą na pozycję {(u?.positions ?? 15) + 1} układu i trwają 1-8 godzin. Możesz wysłać ich równocześnie tyle, ile wynosi
          pierwiastek z poziomu astrofizyki. Wynik: surowce, statki, nic, piraci, opóźnienie, wcześniejszy powrót, rzadko utrata floty.
        </p>
        <h3>Konto</h3>
        <p>
          Potwierdź adres e-mail linkiem z wiadomości - posłuży do odzyskania hasła. Usunięcie konta następuje po 7 dniach i można je anulować.
          Wiadomości poza archiwum są usuwane: przeczytane po 7 dniach, nieprzeczytane po 30. Zasady łamane przez graczy kończą się blokadą
          widoczną na pręgierzu.
        </p>
      </Panel>
    </div>
  );
}
