# Token Radar — pre-token protocols ranked by implied value

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Xyzvixx/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Xyzvixx/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a sealed DefiLlama snapshot (2026-11-14, 758
protocols), finds the protocols that record no token and are not a wrapped,
staked or bridged product of one that trades, ranks them by an implied value
derived from the snapshot's own figures, and shows a web dashboard with the
board, a detail view for every protocol, and the steps to farm each one.

## The model (radar-2)

- **Universe:** every protocol whose record shows no token (`mcap_usd`,
  `gecko_id` and `symbol` all null) and which is not a wrapped, staked,
  bridged or exchange product — the watchlist's own exclusion rule, applied
  to every row, not just the watchlist. That leaves 198 protocols
  (40 on the watchlist + 158 below its floor). Live-token protocols are kept
  apart and shown with the market's own value, never ranked.
- **Comparable multiple:** for each category, the median `mcap_usd / tvl_usd`
  of the live-token protocols in that same category (computed at runtime from
  the snapshot; global median when fewer than 3 comparables), clamped to
  0.05–1.00.
- **Implied value:** `TVL × comparable × (1 + clamp(7d change, −60, 120)/100 × 0.5)
  × (0.6 + min(age, 1095)/1095 × 0.4)`. Age unknown → 365 days.
- **Farm plans:** six steps per protocol, derived from its category, chains,
  TVL and age, each stating what it costs and how long it takes.

"Records no token" is what the snapshot says — never a claim that a protocol
has no token. The implied value is this entry's own claim, never make.fun's.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22.18+ required, standard library only. The run writes
`out/board.json`, `out/dashboard/` (the static page, data embedded, no
network) and `out/dossier.json`. Screenshots live in `screenshots/`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ridho-suryo-nugroho&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
