# Design

## Visual Theme

Warm editorial. A sunlit page: warm paper whites, amber/ochre as the single committed accent, deep warm ink for text. Light theme only for the homeowner funnel (the scene: a homeowner at their kitchen table in daylight, bill in hand). No gradients-as-decoration, no glassmorphism, no dark hero.

Color strategy: **Committed** — amber/ochre carries the identity (CTAs, highlights, the sun motif), set against quiet warm neutrals.

## Color Palette (OKLCH)

| Role | Value | Notes |
|---|---|---|
| `--background` | `oklch(0.975 0.009 80)` | warm paper, never pure white |
| `--foreground` | `oklch(0.255 0.02 55)` | deep warm ink, never #000 |
| `--card` | `oklch(0.985 0.007 85)` | lifted paper |
| `--primary` | `oklch(0.58 0.125 62)` | deep amber/ochre, CTA |
| `--primary-foreground` | `oklch(0.985 0.012 85)` | cream |
| `--secondary` | `oklch(0.94 0.02 83)` | tinted cream |
| `--muted` | `oklch(0.945 0.015 83)` | |
| `--muted-foreground` | `oklch(0.49 0.028 65)` | warm grey-brown |
| `--accent` | `oklch(0.93 0.045 80)` | pale amber wash |
| `--border` | `oklch(0.89 0.02 78)` | |
| `--ring` | `oklch(0.58 0.125 62)` | amber |
| `--destructive` | `oklch(0.55 0.18 28)` | warm red |

All neutrals are tinted toward the amber hue (h ≈ 55–85, chroma 0.007–0.02). Never `#000` or `#fff`.

## Typography

- **Display (headlines):** Young Serif — warm, chunky old-style serif (single 400 weight; the letterforms carry the weight). Tight tracking (`-0.015em`). Used for h1–h3 and pull-quote numbers. Chosen over Fraunces deliberately: Fraunces is now an AI-default and fails the slop test.
- **Body/UI:** Albert Sans. Weights 400/500/600.
- Scale ratio ≥ 1.25 between steps. Body line length capped at 65–75ch (`max-w-prose` or explicit ch caps).
- Exposed as Tailwind tokens: `font-display` (Fraunces), `font-sans` (Albert Sans).

## Layout & Spacing

- Generous whitespace; section padding varies (don't repeat the same py everywhere).
- Editorial grid: text columns capped, asymmetry welcome, full-bleed moments for the amber accent.
- Cards only where they're truly the right affordance; never nested cards, never side-stripe accent borders.
- Radius: `--radius: 0.5rem` (quietly soft, not pill-everything).

## Motion

- Ease out (quart/expo), 150–400ms. No bounce. Respect `prefers-reduced-motion`.
- Phase 4 adds number/section reveals (framer-motion); keep them subtle and one-directional.

## Components

shadcn/ui (radix base) with the semantic tokens above. Buttons: primary = amber fill with cream text; outline/ghost for secondary actions. Badges for confidence/status hints. Accordion for FAQ.
