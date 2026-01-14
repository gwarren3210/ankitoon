# UI/UX Analysis #2: Typography Enhancement

**Severity:** HIGH
**Impact:** High - Typography significantly affects readability, brand identity, and learning effectiveness
**Affected Files:**
- `src/app/layout.tsx` (font imports)
- `src/app/globals.css` (global styles)
- `src/components/study/flashcard.tsx` (Korean term display)
- `src/components/chapter/vocabularyList.tsx` (vocabulary tables)
**Estimated Effort:** ~4 hours

---

## Problem Description

AnkiToon currently uses a **generic, undifferentiated typography system** that fails to support the unique needs of a Korean language learning application. The current implementation lacks visual hierarchy, Korean-optimized fonts, and distinctive typographic character.

### Current Implementation

```typescript
// src/app/layout.tsx (lines 22-30)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})
```

```css
/* src/app/globals.css (lines 9-10) */
--font-sans: var(--font-geist-sans);
--font-mono: var(--font-geist-mono);
```

### What's Wrong

1. **Single Font Family for All Text**
   - Geist Sans used everywhere (headings, body, UI, Korean terms)
   - No display font for headlines and hero sections
   - No typographic hierarchy beyond font-size and weight

2. **No Korean Font Optimization**
   - Geist only includes Latin subset
   - Korean characters fallback to system fonts (inconsistent)
   - No consideration for Hangul readability at various sizes
   - Korean terms may render differently across devices/browsers

3. **Limited Font Weight Usage**
   - Current weights: 400 (normal), 500 (medium), 600 (semibold)
   - Missing: 300 (light), 700 (bold), 800 (extrabold)
   - Variable font potential unused

4. **Default Tailwind Type Scale**
   - No custom scale optimized for language learning content
   - Large Korean characters need different sizing ratios
   - No consideration for reading comfort during study sessions

5. **No Decorative Typography**
   - Plain, utilitarian appearance
   - Lacks personality and brand distinction
   - Flashcards feel generic rather than engaging

---

## Why Typography Matters for Language Learning Apps

### Context: Learning Experience Impact

Typography directly affects **learning outcomes** in language learning applications:

```
User studies Korean vocabulary
  → Sees Korean term on flashcard
    → Typography affects recognition speed
      → Clear, consistent fonts improve retention
        → Users learn faster and return more often
```

### Specific Typography Concerns

#### 1. Korean Character Legibility
Korean characters (Hangul) have unique structural requirements:
- Complex syllable blocks (e.g., 한, 국, 어)
- Subtle stroke variations distinguish meanings
- Poor font rendering causes confusion between similar characters

**Example:** The characters 강 (river/strong) and 장 (long/field) differ by one stroke. Poor typography can make these indistinguishable.

#### 2. Flashcard Effectiveness
During study sessions, users need to:
- Quickly recognize Korean terms (font clarity critical)
- Read English definitions without strain
- Process text in split-second recognition tasks

#### 3. Brand Identity
- Generic fonts = generic app perception
- Distinctive typography creates memorable brand identity
- Professional typography signals quality and trustworthiness

#### 4. Reading Fatigue
- Users spend 15-30+ minutes per study session
- Poor typography accelerates eye strain
- Optimized fonts extend comfortable study duration

---

## Implementation Requirements

### Tool Breakdown

| Tool | Percentage | Tasks |
|------|:----------:|-------|
| **Claude Code** | 90% | Font imports, CSS properties, component updates |
| **Nanabanana Pro** | — | Not needed |
| **Human Decision** | 10% | Font selection |

### Claude Code Tasks (Automatable)

Once fonts are selected, ALL implementation is automatable:
- Install fonts in Next.js (`next/font/google`)
- Create CSS custom properties for type scale
- Update Tailwind configuration
- Update component typography classes
- Add Korean font fallback stack
- Create typography utility classes
- Test across all pages

### Human Decisions Required

**Two quick decisions needed:**

#### 1. Display Font for Headings

| Option | Character | Best For |
|--------|-----------|----------|
| **Plus Jakarta Sans** | Geometric, modern, tech | Clean professional feel |
| **Manrope** | Rounded, friendly, warm | Approachable learning app |
| **Outfit** | Clean, versatile, neutral | Balanced flexibility |

#### 2. Korean Font

| Option | Character | Best For |
|--------|-----------|----------|
| **Noto Sans KR** | Google standard, widely supported | Reliability, performance |
| **Pretendard** | Korean-designed, premium feel | Design quality, native feel |

### Implementation Order

```
1. Human picks display font (5 min decision)
2. Human picks Korean font (5 min decision)
3. Claude Code implements everything (~4 hours):
   - Font imports in layout.tsx
   - CSS custom properties in globals.css
   - Tailwind config updates
   - Component updates
   - Testing and verification
```

### Fully Automatable After Decisions

This issue is **90% automatable**. The only blocker is font selection.
Once you decide, provide the choices and implementation can begin immediately.

**Example decision format:**
```
Display font: Manrope
Korean font: Pretendard
```

---

## Current Typography Audit

### Font Usage Analysis

| Component | Current Font | Weight | Size | Issues |
|-----------|--------------|--------|------|--------|
| Flashcard Korean term | Geist Sans | 700 | text-3xl | No Korean optimization |
| Flashcard definition | Geist Sans | 500 | text-xl | Generic appearance |
| Page headings | Geist Sans | 600 | text-xl/2xl | No display font |
| Body text | Geist Sans | 400 | text-sm/base | Acceptable |
| Vocabulary table terms | Geist Sans | 600 | text-base | Korean fallback |
| Navigation | Geist Sans | 500 | text-sm | Acceptable |

### Tailwind Classes in Use

```typescript
// flashcard.tsx
<div className="text-3xl font-bold text-primary">
  {card.vocabulary.term}  // Korean text
</div>

<div className="text-xl font-medium text-foreground">
  {card.vocabulary.definition}  // English text
</div>

// seriesHeader.tsx
<CardTitle className="text-xl sm:text-2xl mb-2">
  {series.name}
</CardTitle>

<CardDescription className="text-sm sm:text-base mb-2">
  {series.korean_name}  // Korean text
</CardDescription>

// vocabularyList.tsx
<div className="font-semibold">{vocab.term}</div>  // Korean text
```

---

## Recommended Solutions

### Solution 1: Implement Display Font for Headings

**Font Recommendations** (Space Grotesk alternatives):

| Font | Characteristics | Use Case |
|------|-----------------|----------|
| **Plus Jakarta Sans** | Geometric, friendly, excellent weight range | Headlines, buttons, brand text |
| **Manrope** | Modern, highly legible, variable font | Headlines, UI elements |
| **Outfit** | Clean, geometric, good for tech products | Headlines, navigation |

**Recommendation:** Plus Jakarta Sans for its warmth and excellent variable font support.

### Solution 2: Add Korean-Optimized Font Stack

**Korean Font Recommendations:**

| Font | Characteristics | Availability |
|------|-----------------|--------------|
| **Pretendard** | Modern, clean, designed for UI | Google Fonts, CDN |
| **Noto Sans KR** | Universal Korean support, good legibility | Google Fonts (free) |
| **Spoqa Han Sans Neo** | Clean, modern, popular in Korean tech | CDN |

**Recommendation:** Noto Sans KR for broad compatibility, with Pretendard as a premium option.

### Solution 3: Create Custom Typographic Scale

```css
/* Proposed type scale optimized for language learning */
--font-size-xs: 0.75rem;      /* 12px - captions, metadata */
--font-size-sm: 0.875rem;     /* 14px - secondary text */
--font-size-base: 1rem;       /* 16px - body text */
--font-size-lg: 1.125rem;     /* 18px - emphasized body */
--font-size-xl: 1.25rem;      /* 20px - card titles */
--font-size-2xl: 1.5rem;      /* 24px - section headings */
--font-size-3xl: 1.875rem;    /* 30px - page headings */
--font-size-4xl: 2.25rem;     /* 36px - hero text */
--font-size-5xl: 3rem;        /* 48px - flashcard Korean terms */
--font-size-6xl: 3.75rem;     /* 60px - large display */
```

### Solution 4: Implement Full Variable Font Weight Range

```css
/* Weight scale for variable fonts */
--font-weight-light: 300;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
--font-weight-extrabold: 800;
```

---

## Implementation Steps

### Step 1: Add Font Imports (30 minutes)

Update `src/app/layout.tsx`:

```typescript
import { Geist, Geist_Mono } from "next/font/google"
import { Plus_Jakarta_Sans, Noto_Sans_KR } from "next/font/google"

// Display font for headings
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
})

// Korean font
const notoSansKR = Noto_Sans_KR({
  variable: "--font-korean",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: true,
})

// Keep Geist for body text
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Update body className
<body
  className={`
    ${geistSans.variable}
    ${geistMono.variable}
    ${plusJakartaSans.variable}
    ${notoSansKR.variable}
    antialiased h-full flex flex-col
  `}
>
```

### Step 2: Update CSS Custom Properties (20 minutes)

Update `src/app/globals.css`:

```css
@theme inline {
  /* Font family definitions */
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-display: var(--font-display);
  --font-korean: var(--font-korean), var(--font-sans), sans-serif;

  /* Type scale */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;
  --text-flashcard: 3rem;
  --text-hero: 3.75rem;

  /* Line heights optimized for each scale */
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;

  /* Letter spacing */
  --tracking-tighter: -0.05em;
  --tracking-tight: -0.025em;
  --tracking-normal: 0em;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.05em;
}
```

### Step 3: Update Tailwind Configuration (15 minutes)

Create or update `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  // ... existing config
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        display: [
          "var(--font-display)",
          "var(--font-geist-sans)",
          "system-ui",
          "sans-serif"
        ],
        korean: [
          "var(--font-korean)",
          "Noto Sans KR",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "sans-serif"
        ],
      },
      fontSize: {
        "flashcard": ["3rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "flashcard-sm": ["2.25rem", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
      },
    },
  },
}

export default config
```

### Step 4: Update Flashcard Component (30 minutes)

Update `src/components/study/flashcard.tsx`:

```typescript
// Front side - Korean term
<div className="space-y-4">
  <div className="font-korean text-flashcard font-bold text-primary
                  tracking-tight leading-tight">
    {card.vocabulary.term}
  </div>
</div>

// Back side - English definition
<div className="space-y-4">
  <div className="font-sans text-xl font-medium text-foreground
                  leading-relaxed">
    {card.vocabulary.definition}
  </div>
  {card.displayExample && (
    <div className="font-korean text-base italic text-muted-foreground
                    leading-relaxed">
      &quot;{card.displayExample}&quot;
    </div>
  )}
</div>
```

### Step 5: Create Typography Utility Classes (15 minutes)

Add to `src/app/globals.css`:

```css
@layer utilities {
  /* Heading styles */
  .heading-display {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .heading-page {
    font-family: var(--font-display);
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  /* Korean text styles */
  .text-korean {
    font-family: var(--font-korean);
    word-break: keep-all;
    overflow-wrap: break-word;
  }

  .text-korean-term {
    font-family: var(--font-korean);
    font-weight: 700;
    letter-spacing: -0.02em;
    word-break: keep-all;
  }

  .text-korean-example {
    font-family: var(--font-korean);
    font-style: italic;
    word-break: keep-all;
  }

  /* Reading-optimized body text */
  .prose-study {
    font-family: var(--font-sans);
    font-size: 1rem;
    line-height: 1.625;
    letter-spacing: 0.01em;
  }
}
```

### Step 6: Update Key Components (60 minutes)

**Update vocabulary tables (`vocabularyList.tsx`):**

```typescript
<td className="p-3">
  <div className="text-korean-term">{vocab.term}</div>
  {(vocab.chapterExample || vocab.example) && (
    <div className="text-korean-example text-sm text-muted-foreground mt-1">
      &quot;{vocab.chapterExample || vocab.example}&quot;
    </div>
  )}
</td>
```

**Update series headers (`seriesHeader.tsx`):**

```typescript
<CardTitle className="heading-display text-xl sm:text-2xl mb-2">
  {series.name}
</CardTitle>

{series.korean_name && (
  <CardDescription className="text-korean text-sm sm:text-base mb-2">
    {series.korean_name}
  </CardDescription>
)}
```

**Update page headings throughout the app:**

```typescript
// Example pattern for all page headings
<h1 className="heading-page text-2xl sm:text-3xl">
  Page Title
</h1>

<h2 className="heading-page text-xl sm:text-2xl">
  Section Title
</h2>
```

---

## Before/After Examples

### Flashcard Korean Term

**Before:**
```html
<div class="text-3xl font-bold text-primary">
  한국어
</div>
```
- Generic Geist font
- System fallback for Korean
- No optimization for recognition

**After:**
```html
<div class="font-korean text-flashcard font-bold text-primary
            tracking-tight leading-tight">
  한국어
</div>
```
- Noto Sans KR optimized for Korean
- Larger size (3rem vs 1.875rem)
- Tighter tracking for better recognition
- Consistent rendering across devices

### Page Headings

**Before:**
```html
<h1 class="text-xl sm:text-2xl mb-2">
  Browse Series
</h1>
```
- Same font as body text
- No visual distinction
- Flat hierarchy

**After:**
```html
<h1 class="heading-display text-2xl sm:text-3xl mb-2">
  Browse Series
</h1>
```
- Plus Jakarta Sans display font
- Heavier weight, tighter tracking
- Clear visual hierarchy
- Brand distinctiveness

### Vocabulary Table

**Before:**
```html
<div class="font-semibold">배우다</div>
<div class="text-sm italic text-muted-foreground">
  "한국어를 배우다"
</div>
```
- Inconsistent Korean rendering
- Generic styling

**After:**
```html
<div class="text-korean-term">배우다</div>
<div class="text-korean-example text-sm text-muted-foreground">
  "한국어를 배우다"
</div>
```
- Consistent Korean font
- Optimized word-break behavior
- Professional appearance

---

## Testing Approach

### Visual Testing

1. **Cross-Browser Korean Rendering**
   - Test in Chrome, Safari, Firefox, Edge
   - Verify Korean characters render identically
   - Check font fallback behavior

2. **Responsive Typography**
   - Test type scale at mobile (375px), tablet (768px), desktop (1280px)
   - Verify flashcard text remains legible at all sizes
   - Check line-height and spacing

3. **Dark Mode Compatibility**
   - Verify font rendering in dark mode
   - Check contrast ratios with new fonts
   - Test anti-aliasing appearance

### Performance Testing

```typescript
// Check font loading performance
describe('Font Loading', () => {
  it('should load fonts within 2 seconds', async () => {
    const startTime = performance.now()
    await document.fonts.ready
    const loadTime = performance.now() - startTime
    expect(loadTime).toBeLessThan(2000)
  })

  it('should have Korean font available', async () => {
    await document.fonts.ready
    const hasKorean = document.fonts.check('16px "Noto Sans KR"')
    expect(hasKorean).toBe(true)
  })
})
```

### Accessibility Testing

- **WCAG 2.1 AA Compliance:**
  - Minimum contrast ratio 4.5:1 for body text
  - Minimum contrast ratio 3:1 for large text (>18px)
  - No text smaller than 14px for extended reading

---

## Performance Considerations

### Font Loading Strategy

```typescript
// next/font handles optimization automatically, but verify:
// 1. Font files are preloaded
// 2. display: 'swap' prevents FOIT (Flash of Invisible Text)
// 3. Subset fonts to reduce file size

const notoSansKR = Noto_Sans_KR({
  variable: "--font-korean",
  subsets: ["latin"],  // Consider adding "korean" if needed
  weight: ["400", "500", "700"],  // Only weights actually used
  display: "swap",
  preload: true,
})
```

### Bundle Size Impact

| Font | Estimated Size | Notes |
|------|----------------|-------|
| Plus Jakarta Sans | ~50KB | Latin only |
| Noto Sans KR | ~1.5MB full, ~200KB subset | Subset to common characters |
| Geist Sans | ~40KB | Already included |

**Optimization:** Use `next/font` automatic subsetting and preloading.

---

## Rollout Strategy

### Phase 1: Font Infrastructure (Day 1)
- Add font imports to layout.tsx
- Create CSS custom properties
- Update Tailwind config
- No visual changes yet

### Phase 2: Flashcard Typography (Day 1-2)
- Update flashcard component
- Test Korean rendering
- Verify study session UX
- This is the highest-impact change

### Phase 3: Global Typography (Day 2-3)
- Update heading styles
- Update vocabulary tables
- Update navigation
- Apply utility classes

### Phase 4: Polish and Testing (Day 3-4)
- Cross-browser testing
- Performance verification
- Accessibility audit
- Documentation update

---

## Success Criteria

- [ ] Korean text renders consistently across Chrome, Safari, Firefox
- [ ] Flashcard Korean terms use Noto Sans KR (or chosen Korean font)
- [ ] Page headings use display font with clear hierarchy
- [ ] Font loading time < 2 seconds on 3G connection
- [ ] No FOIT (Flash of Invisible Text) during font load
- [ ] All text meets WCAG 2.1 AA contrast requirements
- [ ] Type scale provides clear visual hierarchy
- [ ] Study session readability improved (subjective user testing)
- [ ] Bundle size increase < 300KB total

---

## Future Enhancements

1. **Font Weight Animation**
   - Subtle weight shifts on hover/focus
   - Variable font interpolation for smooth transitions

2. **Dynamic Font Sizing**
   - User preference for study font size
   - Adaptive sizing based on term complexity

3. **Custom Korean Display Font**
   - Consider premium fonts like Pretendard for enhanced aesthetics
   - Evaluate font licensing for commercial use

4. **Typography Tokens**
   - Create design system tokens for typography
   - Enable consistent theming across potential brand variants

---

## References

- [Next.js Font Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)
- [Google Fonts - Noto Sans KR](https://fonts.google.com/noto/specimen/Noto+Sans+KR)
- [Google Fonts - Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
- [Web Font Loading Strategies](https://web.dev/font-best-practices/)
- [Korean Typography Best Practices](https://design.google/library/exploring-korean-typography)
- [WCAG 2.1 Text Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
