# Gracze sterowani przez komputer (boty)

Boty to zwykłe konta graczy, którymi steruje serwer. Grają przez te same serwisy co ludzie: obowiązują je te same
koszty, czasy, pola, ochrona początkujących, dyplomacja i limity flot. Nie mają żadnych ułatwień. Widzą tylko to,
co widziałby gracz: własne planety, widok galaktyki i własne raporty. Nie są oznaczone w grze (regulamin ogólnie
informuje, że gracze komputerowi istnieją). W panelu administratora mają dopisek „(AI)” z charakterem.

## Włączenie

W `.env` na serwerze:
```
BOTS_ENABLED=true
BOTS_TARGET=50        # docelowa liczba botów
BOTS_PER_WEEK=5       # ile nowych botów najwyżej w ciągu 7 dni (rozłożone równo, ok. 1 co półtora dnia)
```
Potem `docker compose up -d`. Boty powstają tylko wtedy, gdy na serwerze jest już co najmniej jeden człowiek
(pierwsze konto zostaje administratorem). Wyłączenie (`BOTS_ENABLED=false`) zatrzymuje ich tury. Konta zostają
i po 7 dniach bez aktywności są oznaczane jako nieaktywne jak każde inne.

## Jak gra bot

Każdy bot ma **charakter**, który ustala początkowe proporcje: górnik (ekonomia), najeźdźca (flota), żółw (obrona),
odkrywca (ekspansja, ekspedycje), zrównoważony. Ma też **rytm dnia**: zapaleńcy zaglądają co 5–25 minut, regularni
co 20–90 minut, niedzielni co 1,5–5 godzin. Każdy bot śpi kilka godzin w nocy (czas polski).

Jedna tura:
1. **Raporty:** szpiegowskie zapisuje w pamięci celów, a z raportów walki uczy się, co się opłaciło.
2. **Obrona:** gdy nadlatuje atak silniejszego gracza, wysyła flotę z surowcami na inną planetę albo na ekspedycję,
   a resztę surowców wydaje na obronę.
3. **Stocznia:** odkłada część zasobów na wojsko według charakteru (sondy, transportowce, okręty, obrona, kolonizator).
4. **Budowa:** kolejkuje budynki tak, żeby wystarczyły do następnej wizyty. Pilnuje energii i magazynów i oszczędza
   tylko na to, co uzbiera w kilka godzin.
5. **Badania:** w pierwszej kolejności te, które odblokowują sondy, transportowce i kolonizację.
6. **Floty:** przegląda okoliczne układy w galaktyce i szpieguje. Atakuje tylko wtedy, gdy symulator walki daje
   wysoką szansę wygranej i łup przewyższa straty. Zbiera pola zniszczeń, kolonizuje, wysyła ekspedycje.
7. **Uczenie:** co 6 godzin ocenia przyrost punktów, łupy i straty dla bieżącego kierunku rozwoju (ekonomia, badania,
   flota, obrona, ekspansja) i wybiera kolejny. Zwykle wybiera najlepszy dotąd, a czasem eksperymentuje (bandyta
   ε-zachłanny). Do tego pamięta:
   - ile sond potrzeba na konkretny cel;
   - które cele okazały się za mocne albo nieopłacalne;
   - kto go atakował (ataki pchają go w stronę obrony).

Boty nie piszą wiadomości, nie zakładają sojuszy i nie handlują na rynku. Odebrane wiadomości kasują.

## Koszt

Tura na PostgreSQL to ok. 0,2–0,3 s. 50 botów w ludzkim rytmie to średnio poniżej jednej tury na minutę.

## Testy

`BotSimulationTest` symuluje 24 boty przez 16 dni w przyspieszonym zegarze i sprawdza:
- zero błędów w turach;
- rozwój (stocznia, badania, flota);
- szpiegowanie, ataki i zmianę kierunku rozwoju;
- tempo zakładania kont (limit tygodniowy, nic na pustym serwerze).

`JdbcBotSimulationTest` sprawdza zapis stanu botów w PostgreSQL.
