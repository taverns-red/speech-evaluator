# Design System — taverns-red

> Living document — update when design tokens or components change.

## Philosophy

**taverns-red** blends London Underground industrial typography with Canadian warmth. The result is dark, warm, and precise — like a well-lit speakeasy.

| Principle | Application |
|-----------|-------------|
| **Dark by default** | Deep purple-blacks (`#0C0A0F`) with warm accents |
| **Red as identity** | `--red-primary` (#C13B3B) is the brand — use sparingly for emphasis |
| **Canadian warmth** | Maple and amber accents (`--maple`, `--amber`) soften the dark palette |
| **Industrial type** | Outfit (body) + SF Mono (code) — clean, readable, modern |

---

## Design Tokens

### Core Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--red-primary` | `#C13B3B` | Brand accent, active tabs, section borders |
| `--red-dark` | `#8B1A1A` | Hover/pressed states on red elements |
| `--red-deep` | `#5C1111` | Deep backgrounds, header gradient |
| `--red-glow` | `#E8524250` | Subtle glow effects (40% opacity) |

### Canadian Warmth

| Token | Value | Usage |
|-------|-------|-------|
| `--maple` | `#D4873F` | Secondary accents, warnings |
| `--maple-light` | `#E8A55C` | Lighter accent variant |
| `--amber` | `#F5C36A` | Highlights, warnings, stars |
| `--cream` | `#FFF8ED` | Light text on dark, hover highlights |

### Backgrounds (Dark Theme)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#0C0A0F` | Page background |
| `--bg-secondary` | `#14111A` | Secondary sections |
| `--bg-card` | `#1A1722` | Card/panel backgrounds |
| `--bg-card-hover` | `#221E2D` | Card hover state |
| `--bg-input` | `#110E16` | Form input backgrounds |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Subtle dividers |
| `--border-accent` | `rgba(193,59,59,0.3)` | Red-accented borders |

### Light Theme Overrides

Set via `[data-theme="light"]`:

| Token | Dark | Light |
|-------|------|-------|
| `--bg-primary` | `#0C0A0F` | `#F8F6F3` |
| `--bg-card` | `#1A1722` | `#FFFFFF` |
| `--text-primary` | `#F0ECF5` | `#1A1722` |
| `--text-secondary` | `#9B95A5` | `#5A5465` |
| `--border-subtle` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.08)` |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#F0ECF5` | Body text, headings |
| `--text-secondary` | `#9B95A5` | Subtext, labels |
| `--text-muted` | `#6B6575` | Hints, timestamps |

### Semantic Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-success` | `#34D399` | Start button, positive indicators |
| `--color-danger` | `#E85252` | Stop/PANIC, errors, destructive actions |
| `--color-warning` | `#F5C36A` | Warnings, in-progress states |
| `--color-info` | `#60A5FA` | Informational badges |
| `--color-recording` | `#E85252` | Recording indicator pulse |
| `--color-processing` | `#34D399` | Processing state |
| `--color-delivering` | `#60A5FA` | Delivering evaluation state |

---

## Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-family` | `'Outfit', system-ui, -apple-system, sans-serif` | All body text |
| `--font-mono` | `'SF Mono', 'Fira Code', monospace` | Code, metrics, timestamps |

### Scale

| Element | Size | Weight |
|---------|------|--------|
| Page title | `1.6rem` | 700 |
| Section header | `0.9rem` | 600, uppercase, tracking |
| Body text | `0.95rem` | 400 |
| Labels | `0.75–0.8rem` | 600, uppercase |
| Muted hints | `0.75rem` | 400 |

---

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `0.25rem` (4px) | Tight gaps, icon padding |
| `--space-sm` | `0.5rem` (8px) | Inner spacing, small gaps |
| `--space-md` | `1rem` (16px) | Standard padding, section gaps |
| `--space-lg` | `1.5rem` (24px) | Section spacing |
| `--space-xl` | `2rem` (32px) | Major section breaks |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `6px` | Small elements, tags |
| `--radius-md` | `12px` | Cards, panels, buttons |
| `--radius-lg` | `20px` | Large panels, modals |
| `--radius-xl` | `28px` | Feature panels |
| `--radius-full` | `9999px` | Pills, circular buttons |

---

## Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | `150ms ease` | Hover states, button feedback |
| `--transition-base` | `250ms ease` | Panel toggles, color transitions |
| `--transition-slow` | `400ms cubic-bezier(0.4,0,0.2,1)` | Layout shifts, slide-ins |

---

## Component Patterns

### Buttons

| Variant | Background | Text | Use Case |
|---------|-----------|------|----------|
| `.btn-success` | `--color-success` | white | Start speech, confirm |
| `.btn-primary` | `--red-primary` | white | Primary actions |
| `.btn-warning` | `--color-warning` | dark | Caution actions |
| `.btn-upload` | `--bg-card` | `--text-secondary` | Upload trigger |
| `.btn-danger` / PANIC | `--color-danger` | white | Destructive/emergency |

All buttons: `min-height: 44px` (touch target), `border-radius: var(--radius-md)`, `font-weight: 600`.

### Cards / Panels

```css
background: var(--bg-card);
border: 1px solid var(--border-subtle);
border-radius: var(--radius-md);
padding: var(--space-md);
```

Hover: `background: var(--bg-card-hover)`.

### Collapsible Sections

Use native `<details>/<summary>` with custom styling:
- Summary shows section title (uppercase, `--text-secondary`) + current value preview
- Content area has `padding: var(--space-md)` and `border-top: 1px solid var(--border-subtle)`

### Empty States

Required elements:
1. **Icon** — emoji or SVG, centered
2. **Title** — `--text-primary`, brief
3. **Hint** — `--text-muted`, actionable ("Record your first speech...")

---

## Responsive Breakpoints

| Breakpoint | Target | Key Changes |
|------------|--------|-------------|
| `≤ 768px` | Tablet | Reduced padding, 44px touch targets, flexible sticky bar |
| `≤ 480px` | Phone | Full-width buttons, stacked header, wrapped mode tabs |

### Mobile Rules
- All buttons ≥ 44px height
- No horizontal scroll at any width
- Header stacks vertically (title above status)
- Mode tabs wrap if needed
- Config sections remain full-width

---

## Usage Rules

1. **Always use tokens** — never hardcode colors, spacing, or radii
2. **Dark theme first** — light overrides via `[data-theme="light"]`
3. **Red sparingly** — only for brand identity, active states, and borders. Not for body text or backgrounds
4. **Warm accents** — maple/amber for secondary emphasis. Blue (`--color-info`) for informational only
5. **Consistent elevation** — cards use `--bg-card` + `--border-subtle`. No box-shadow on cards
