# AnkiToon Design Brief

**Status:** Approved
**Created:** 2026-01-13
**Based on:** Ideation session responses

---

## Executive Summary

AnkiToon's visual identity balances **professional learning tool** with
**playful webtoon content**. The design is clearly Korean-inspired,
featuring a subtle tiger mascot, duotone icons, cloud motif patterns,
and manhwa-style illustrations at key moments.

---

## Core Identity

### Brand Personality

| Attribute | Expression |
|-----------|------------|
| **Serious** | Clean layouts, professional typography, focused study UX |
| **Playful** | Manhwa effects, cute tiger mascot, celebration moments |
| **Korean** | Cloud patterns, hangeul touches, traditional color nods |
| **Modern** | Duotone icons, flat design base, responsive animations |

### Voice & Tone

- **Encouraging** without being patronizing
- **Celebrates progress** without over-gamifying
- **Culturally aware** without being stereotypical
- **Fun** without undermining learning credibility

---

## Color System

### Primary Palette

| Color | Hex | OKLCH | Usage |
|-------|-----|-------|-------|
| Navy | `#1a1a2e` | `oklch(0.205 0.03 262.5)` | Primary, backgrounds, text |
| Electric Blue | `#4a90d9` | `oklch(0.607 0.18 206.8)` | Accent, highlights, CTAs |
| White | `#ffffff` | `oklch(1 0 0)` | Backgrounds, cards |
| Light Gray | `#f5f5f5` | `oklch(0.97 0.005 260)` | Card backgrounds |

### Semantic Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Red | `#dc2626` | Errors, "Again" rating |
| Orange | `#f97316` | Warnings, "Hard" rating |
| Green | `#22c55e` | Success, "Easy" rating |
| Gold | `#fbbf24` | Achievements, celebrations |

### Duotone Icon Colors

- **Primary shape:** Navy (`#1a1a2e`)
- **Accent/depth:** Electric Blue (`#4a90d9`)
- **Contextual accents:** Gold for achievements, green for success states

### Dark Mode

Same personality, inverted colors:
- Background: Navy
- Text: White
- Cards: Slightly lighter navy (`#252542`)
- Accents: Electric Blue (unchanged)

---

## Typography

### Current Fonts (to be enhanced)

- **Body:** Geist Sans
- **Mono:** Geist Mono

### Recommended Enhancement

- **Display:** Plus Jakarta Sans, Manrope, or Outfit (decision pending)
- **Korean:** Noto Sans KR or Pretendard (decision pending)

### Usage Guidelines

- Korean vocabulary terms should be visually prominent
- Use font weight variation for hierarchy (not just size)
- Maintain readability at all sizes (min 14px for body)

---

## Iconography

### Style: Duotone

Icons use two colors to create depth and visual interest:

```
┌─────────────┐
│   ████      │  ← Navy primary shape
│  █░░░░█     │
│  █░░░░█     │  ← Blue accent/highlight
│   ████      │
└─────────────┘
```

### Characteristics

- **Stroke weight:** 2px consistent
- **Corners:** Rounded (2-4px radius)
- **Size:** 24x24 base, scales to 16px and 32px
- **Style:** Modern with Korean-inspired shapes where appropriate

### Icon Set Needed

| Icon | Korean Twist |
|------|--------------|
| Home | Hanok roof silhouette |
| Browse | Open manhwa book |
| Study | Flashcard with hangul hint |
| Library | Vertical book spines |
| Profile | Person with subtle hanbok collar |
| Search | Magnifying glass with hangul |
| Progress | Circular progress with cloud accent |
| Achievement | Star with traditional pattern |
| Check | Checkmark in speech bubble |
| Error | Warning in manhwa style |

---

## Mascot: Tiger (호랑이)

### Character Overview

The AnkiToon tiger is a **cute, determined learner** who accompanies
users on their Korean learning journey. Inspired by traditional Korean
tiger imagery but rendered in modern manhwa style.

### Visual Characteristics

- **Style:** Manhwa/webtoon art with clean linework
- **Proportions:** Chibi/cute (large head, small body)
- **Colors:** Orange/amber fur, navy stripes, blue accents
- **Expressions:** Emotive, clear at small sizes

### Personality Traits

- Determined (mirrors learning persistence)
- Encouraging (celebrates user progress)
- Slightly mischievous (playful moments)
- Knowledgeable (appears wise when teaching)

### Appearances

| Context | Tiger State | Emotion |
|---------|-------------|---------|
| Empty library | Reading a manhwa | Curious, inviting |
| No search results | Looking around confused | Puzzled, helpful |
| All reviews done | Jumping with joy | Celebratory |
| Achievement unlocked | Holding trophy/star | Proud |
| Error/offline | Bowing apologetically | Sorry, encouraging |
| Loading | Walking/studying | Focused |
| First-time welcome | Waving hello | Friendly, excited |

### Design Notes

- Tiger should work at small sizes (32px for badges)
- Expressions must be readable without color (for accessibility)
- Include cloud motif in some appearances (traditional pairing)
- Name TBD (consider Korean name like 또리, 호돌이, etc.)

---

## Patterns & Decorative Elements

### Primary Pattern: Cloud Motif (구름문)

Traditional Korean cloud pattern, simplified for modern use:

```
   ～～～
  ～    ～
 ～      ～～
  ～～～～
```

### Usage

- **Card backgrounds:** Very subtle (3-5% opacity)
- **Section dividers:** Stylized cloud line
- **Achievement badges:** Cloud frame around icon
- **Loading states:** Animated floating clouds

### Additional Elements

| Element | Usage |
|---------|-------|
| Speech bubbles | Tooltips, notifications, mascot dialogue |
| Action lines | Card flip, achievement unlock |
| Sparkles/stars | Celebrations, highlights |
| Panel borders | Optional card styling, manhwa feel |

---

## Manhwa Effects

### When to Use

Comic/manhwa effects appear at **key moments** only (not throughout UI):

| Moment | Effect |
|--------|--------|
| Session complete | Confetti + radial action lines |
| Card flip reveal | Speed lines behind card |
| Achievement unlocked | Sparkle burst + speech bubble |
| Streak milestone | Celebratory frame + stars |
| Perfect review | Small star burst |

### When NOT to Use

- Regular navigation
- Form interactions
- Error states (keep calm, not dramatic)
- Loading states (subtle only)

### Effect Library Needed

1. **Radial action lines** - Emanating from center
2. **Speed lines** - Horizontal, showing movement
3. **Sparkle burst** - Stars/diamonds appearing
4. **Confetti** - Colorful celebration
5. **Speech bubble variants** - Excited, normal, thought

---

## Illustration Style

### Manhwa Art Style

Empty states and feature illustrations use manhwa-style art:

- **Linework:** Clean, confident strokes
- **Shading:** Minimal, flat color areas
- **Expressions:** Exaggerated, clear emotions
- **Composition:** Dynamic angles, not static

### Color Application

- Navy and blue as primary illustration colors
- Gold/warm accents for positive states
- Keep consistent with brand palette
- Dark mode: Same illustrations, adjusted colors

### Required Illustrations

| Scene | Description |
|-------|-------------|
| Empty library | Tiger surrounded by empty shelves, hopeful |
| No results | Tiger with magnifying glass, question marks |
| All done | Tiger celebrating with confetti |
| Error | Tiger bowing, speech bubble with apology |
| Welcome | Tiger waving, Korean text floating around |
| Studying | Tiger at desk with flashcards (loading) |

---

## Component Styling

### Cards

- **Background:** White/light (light mode), dark navy (dark mode)
- **Border:** 1px subtle, slightly rounded (8-12px)
- **Shadow:** Soft, increases on hover
- **Pattern:** Optional subtle cloud texture

### Buttons

- **Primary:** Navy background, white text
- **Secondary:** Blue background, white text
- **Outline:** Border only, navy/blue text
- **Size:** Minimum 44px height (touch target)

### Speech Bubbles (New Component)

- **Border:** 2-3px navy stroke
- **Fill:** White
- **Tail:** Bottom-left or contextual
- **Usage:** Tooltips, mascot dialogue, highlights

---

## Animation Guidelines

### Principles

1. **Purposeful:** Animation communicates state change
2. **Quick:** 200-400ms for most transitions
3. **Smooth:** 60fps, no jank
4. **Respectful:** Reduced motion preference supported

### Key Animations

| Element | Animation | Duration |
|---------|-----------|----------|
| Card flip | 3D rotateY | 600ms |
| Button press | Scale down + spring back | 200ms |
| Confetti | Burst + fall | 2000ms |
| Page enter | Fade + slide up | 300ms |
| Skeleton shimmer | Gradient sweep | 1500ms loop |

### Celebration Sequence (Session Complete)

```
1. Screen dims slightly (100ms)
2. Confetti bursts from center (0-500ms)
3. Stats counter animates up (200-800ms)
4. Tiger appears celebrating (400-1000ms)
5. "Great job!" speech bubble (800-1200ms)
```

---

## Implementation Priority

### Phase 1: Foundation (Claude Code)
- [ ] Duotone icon system (generate SVGs)
- [ ] Cloud pattern CSS/SVG
- [ ] Speech bubble component
- [ ] Animation enhancements (already done: 03, 04, 05)

### Phase 2: Assets (Nanabanana Pro)
- [ ] Tiger mascot character sheet
- [ ] Tiger expression variations (6 emotions)
- [ ] Empty state illustrations (5 scenes)
- [ ] Achievement badge frames

### Phase 3: Integration (Claude Code)
- [ ] Replace Lucide icons with custom set
- [ ] Add tiger to empty states
- [ ] Implement manhwa effects
- [ ] Pattern integration

---

## Asset Specifications

### Icons
- **Format:** SVG
- **Size:** 24x24 viewBox
- **Colors:** currentColor + accent class

### Illustrations
- **Format:** SVG preferred, PNG fallback
- **Size:** 200x200 or responsive
- **Style:** Manhwa linework, flat colors

### Mascot
- **Format:** SVG for small, PNG for detailed
- **Sizes:** 32px (badge), 64px (small), 200px (illustration)
- **Expressions:** 6 minimum (happy, studying, confused, celebrating, sorry, encouraging)

### Patterns
- **Format:** SVG pattern or CSS
- **Opacity:** 3-5% for backgrounds
- **Tile size:** 20x20 to 40x40 px

---

## References & Inspiration

### Korean Design
- Traditional dancheong (단청) color palette
- Hanok architecture patterns
- Joseon-era tiger paintings

### Manhwa/Webtoon
- Naver Webtoon UI
- Korean webcomic art styles
- Speech bubble conventions

### Modern Apps
- Duolingo (gamification, mascot usage)
- Notion (clean, flexible components)
- Linear (professional yet warm)

---

## Appendix: Prompt Templates

See [01a-visual-assets-prompts.md](./01a-visual-assets-prompts.md) for
ready-to-use prompts for:
- Nanabanana Pro image generation
- LLM SVG code generation
- Ideation and brainstorming

---

**Document Owner:** Design System
**Last Updated:** 2026-01-13
**Status:** Ready for asset generation
