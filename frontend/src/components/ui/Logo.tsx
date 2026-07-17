import type { SVGProps } from "react";

/** Custom ShipStake mark: a chunky cargo ship stacked with containers —
 *  you ship, or the cargo (your stake) goes overboard. Drawn with flat
 *  fills so it stays crisp at header sizes, inherits currentColor. */
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      {/* hull */}
      <path d="M1 15.5h22l-4.5 6h-13z" fill="currentColor" />
      {/* container row */}
      <rect x="4" y="9.5" width="7" height="4.5" fill="currentColor" />
      <rect x="13" y="9.5" width="7" height="4.5" fill="currentColor" />
      {/* top container — the stake riding on top */}
      <rect x="8.5" y="3.5" width="7" height="4.5" fill="currentColor" opacity="0.45" />
    </svg>
  );
}
