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
        </p>
      </Panel>
    </div>
  );
}
