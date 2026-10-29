import { useState } from 'react';
import { api } from '../api/client';
import type { MarketOffer, ResourceKey } from '../api/types';
import { ErrorBox, InfoBox, Loading, Panel, SuccessBox, useAction, useLoad } from '../components/common';
import { t } from '../i18n';
import { fmt, parseAmount } from '../lib/format';
import { useGame } from '../state/game';
import { useSession } from '../state/session';

const VALUE: Record<ResourceKey, number> = { metal: 1 / 3, crystal: 1 / 2, tritium: 1 };
const KEYS: ResourceKey[] = ['metal', 'crystal', 'tritium'];

export function MarketPage() {
  const { planetId, profile } = useSession();
  const { refresh } = useGame();
  const pid = planetId ?? profile?.homePlanetId;
  const offer = useLoad(() => api.get<MarketOffer>(`/market/${pid}`), [pid]);
  const action = useAction();
  const [from, setFrom] = useState<ResourceKey>('metal');
  const [to, setTo] = useState<ResourceKey>('crystal');
  const [amount, setAmount] = useState('');

  if (offer.loading && !offer.data) return <Loading />;
  const o = offer.data;
  const n = parseAmount(amount);
  const preview = o && from !== to ? Math.floor(((n * VALUE[from]) / VALUE[to]) * (1 - o.fee)) : 0;

  const exchange = async () => {
    const ok = await action.run(
      () => api.post(`/market/${pid}`, { from: from.toUpperCase(), to: to.toUpperCase(), amount: n }),
      t('market.done', { paid: `${fmt(n)} ${t(`res.${from}`)}`, received: `${fmt(preview)} ${t(`res.${to}`)}` }),
    );
    if (ok) {
      setAmount('');
      await refresh();
    }
  };

  return (
    <div className="market-page">
      <ErrorBox error={offer.error ?? action.error} />
      <SuccessBox message={action.message} />
      <Panel title={t('market.title')}>
        {!o?.available ? (
          <InfoBox>{t('market.unavailable')}</InfoBox>
        ) : (
          <>
            <p>
              {t('market.rates')} · {t('market.fee', { fee: (o.fee * 100).toFixed(1) })}
            </p>
            <div className="inline-form">
              <label>
                {t('market.give')}
                <select value={from} onChange={(e) => setFrom(e.target.value as ResourceKey)}>
                  {KEYS.map((k) => (
                    <option key={k} value={k}>
                      {t(`res.${k}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('common.count')}
                <input className="amount-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
              <label>
                {t('market.get')}
                <select value={to} onChange={(e) => setTo(e.target.value as ResourceKey)}>
                  {KEYS.map((k) => (
                    <option key={k} value={k}>
                      {t(`res.${k}`)}
                    </option>
                  ))}
                </select>
              </label>
              <span className="market-preview">= {fmt(preview)}</span>
              <button type="button" className="btn primary" disabled={action.busy || n <= 0 || from === to} onClick={exchange}>
                {t('market.exchange')}
              </button>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
