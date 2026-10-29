import { useState } from 'react';
import { firstAsset, itemAssetKey, planetAssetKey, type AssetKind } from '../lib/assets';
import { nameOf, t } from '../i18n';

const KIND_COLORS: Record<AssetKind, [string, string]> = {
  building: ['#3b2a16', '#8a5a22'],
  research: ['#12283d', '#2f6e9e'],
  ship: ['#1d1d2e', '#565a85'],
  defense: ['#2a1515', '#7a3232'],
  planet: ['#14202c', '#3b6d8c'],
  resource: ['#202020', '#666666'],
  layout: ['#101418', '#2a3440'],
};

const PLANET_COLORS: Record<string, [string, string]> = {
  hot: ['#ffb36b', '#8a2a0a'],
  dry: ['#e3c48a', '#7a5226'],
  normal: ['#8fd18a', '#245a8a'],
  water: ['#7fc3ff', '#123f7a'],
  ice: ['#e8f4ff', '#5d7d99'],
};

function initials(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

interface ItemImageProps {
  kind: AssetKind;
  itemKey: string;
  size?: number;
  className?: string;
}

/** Grafika obiektu (budynek, badanie, statek, obrona) - oryginal z manifestu albo oznaczona zaslepka. */
export function ItemImage({ kind, itemKey, size = 120, className }: ItemImageProps) {
  const [failed, setFailed] = useState(false);
  const url = failed ? null : firstAsset([itemAssetKey(kind, itemKey)]);
  const label = nameOf(itemKey);
  if (url) {
    return (
      <img
        src={url}
        alt={label}
        width={size}
        height={size}
        className={`item-image ${className ?? ''}`}
        onError={() => setFailed(true)}
      />
    );
  }
  const [c1, c2] = KIND_COLORS[kind];
  return (
    <div
      className={`item-image placeholder ${className ?? ''}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${c2}, ${c1})` }}
      title={t('assets.placeholder')}
      role="img"
      aria-label={label}
    >
      <span className="placeholder-initials" style={{ fontSize: Math.round(size / 3.2) }}>
        {initials(label)}
      </span>
      <span className="placeholder-tag">placeholder</span>
    </div>
  );
}

interface PlanetImageProps {
  planetType?: string;
  variant: number;
  size?: number;
  name?: string;
}

export function PlanetImage({ planetType, variant, size = 200, name }: PlanetImageProps) {
  const [failed, setFailed] = useState(false);
  const url = failed ? null : firstAsset(planetAssetKey(planetType, variant));
  if (url) {
    return <img src={url} alt={name ?? ''} width={size} height={size} className="planet-image" onError={() => setFailed(true)} />;
  }
  const [light, dark] = PLANET_COLORS[planetType ?? 'normal'] ?? PLANET_COLORS.normal;
  const angle = (variant * 37) % 360;
  return (
    <div className="planet-image placeholder-planet" style={{ width: size, height: size }} title={t('assets.placeholder')}>
      <div
        className="planet-sphere"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${light}, ${dark} 70%, #000 100%)`,
          filter: `hue-rotate(${(variant % 5) * 8}deg)`,
          transform: `rotate(${angle}deg)`,
        }}
      />
    </div>
  );
}
