# UI Skills — WC4 Elite Force Database

Design reference for the Elite Force Database interface (`index.html`, `docs.html`).
Modeled on research from Eleken (UI patterns for badges/chips/stat cards), the
Accessible Game Design HUD guidelines, and Game UI Database (stats overview patterns).

---

## 1. Core principles

1. **Clarity over decoration.** Every element earns its place. One purpose per element, no orphaned styling.
2. **Hierarchy first.** Section headers > row labels > values. Use weight and size, not color alone.
3. **Consistency beats cleverness.** Same tokens, same component shapes everywhere. Reuse, don't reinvent.
4. **Feedback always.** Hover/active/focus states on everything interactive; status changes are visible.
5. **Accessible by default.** Never rely on color alone; contrast >= 4.5:1 for text; keyboard navigable.

## 2. Design tokens

Source of truth: `:root` in `style.css`.

- Backgrounds: `#ffffff` page, `#e8eef5` panels, `#f0f3f7` subtler fills.
- Text: `#0d1117` primary, `#26313d` (`--ink`) secondary headings, `#3a4252` (`--text-dim`) labels/icons, `#5c6b82` (`--text-faint`) captions (>= 4.5:1 on white).
- Accent: `#2563eb` (action blue). Brand: `#091225`.
- Flags used as semantic bar colors (stat fills only): attack `#a94438`, defense `#2563eb`, movement `#b98a00`, hp `#6c7c33`, range `#9a6fb0`.
- Radii: `3px` everywhere except pill badge `999px`. Sharp — no gradients, no shadows except `--shadow` card.
- Spacing scale: `4, 8, 12, 16, 24, 32, 48`. Panel padding `16px`, section gaps `24px+`.
- Fonts: Oswald (headers, `uppercase`, `letter-spacing`), system sans (body/labels), JetBrains Mono (values/codes).

## 3. Iconography

- **No emoji.** Emoji render inconsistently, clash with the 1.6px line style, and collapse into `***` on some systems.
- Inline SVG only: `viewBox="0 0 24 24"`, `stroke="currentColor"`, `stroke-width="1.6"`, round caps/joins, `fill="none"`, `aria-hidden="true"`.
- **Icons are one neutral tone** (`var(--text-dim)`) — never tinted per stat. Color is reserved for the stat bar fill, which pairs with the icon so meaning never depends on color alone (number symbol + label text also present).
- Display size: `20px` (icon inside a 26px-wide row column). Do not scale past `24px`.
- Meaning must survive at 16px. Test each glyph at small size; drop details that blur.

## 4. Components

### Stat row (dossier)
- Layout: `icon (20px, text-dim) | label (12px, text-dim) | bar | value/cap (JetBrains Mono)`, one line, `14px` separator.
- Bar: `5px` high, `#d1d6de` track always, tinted fill = value/typeMax. Show `value / max` text — never a bare number.
- Values align on the right column so a column of dossiers scans as a table.

### Skill chip
- Static label: rounded background + `1px` border + **3px left accent** in the tier tone.
- Tier colors: bronze `#d8955c`/`#a96f33`, silver `#d3d8dc`/`#a7b0b6`, gold `#f5d63f`/`#d0a020`, platinum `#b7e9f9`/`#5fb9dd`, upcoming `#e4e7ea`/`#9aa3ac` (bg/accent).
- Tier is also communicated by the chip level marker (`Lv 5`) — never color only.

### Badge vs chip vs tag
- **Badge**: small pill, `999px`, status only (gold/platinum = rarity). Never interactive.
- **Chip**: the skill chip above; static, but shaped for potential dismissal/selection.
- **Tag**: plain text label with `#`-style separator for listing (unit types). Not all require a box — whitespace and monospace can carry the distinction.

### Unit type buttons (type selector)
- Buttons, not tags: they must afford clicks (hover raises, active presses, `aria-pressed` state visible).
- Selected: inverse style (brand background, white text); unselected: transparent with `1px` border.

### Empty states
- Always explain the situation and give the next action: "No units yet. Check the Docs → Maintenance section." Never a bare spinner or blank panel.

### Inputs & search
- `1px` border `#c9d1da`, focus ring `2px` `var(--accent)` (`:focus-visible`), mono suggestion text.

## 5. Accessibility rules

- All interactive elements reachable and operable by keyboard with a visible focus ring.
- `prefers-reduced-motion: reduce` → strip animations and transitions.
- no color-only information: pair tint with icon + text (see Stat row).
- `aria-hidden="true"` on decorative icons; real text (labels, numbers, titles) lives in HTML, not SVG or CSS.

## 6. Do / Don't

| Do | Don't |
|---|---|
| Use the spacing scale for every gap | Invent arbitrary padding mid-layout |
| Reuse existing components for new features | Fork a component "just for this" |
| Keep icons neutral, bars semantic | Tint icons per stat or emoji-ize icons |
| Show `value / max` with a bar | Bare numbers or bars without text |
| One accent color for interactivity | Rainbow accents per section |
| Test focus + reduced motion every build | Add motion or hover-only reveals |