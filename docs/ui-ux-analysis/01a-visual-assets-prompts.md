# Visual Assets Prompt Guide

**Companion to:** [01-visual-distinctiveness.md](./01-visual-distinctiveness.md)
**Purpose:** Ready-to-use prompts for generating visual assets
**Last Updated:** 2026-01-13

---

## Table of Contents

1. [Ideation Prompts](#ideation-prompts) - Brainstorming visual direction
2. [Nanabanana Pro Prompts](#nanabanana-pro-prompts) - Image generation
3. [LLM SVG Prompts](#llm-svg-prompts) - Code-based vector graphics
4. [Asset Checklist](#asset-checklist) - Track what's needed

---

## Finalized Direction (Use These First)

Based on the ideation session (2026-01-13), AnkiToon's visual direction is:

| Decision | Choice |
|----------|--------|
| Tone | Serious-yet-playful balance |
| Cultural | Clearly Korean-inspired |
| Mascot | Cute tiger (호랑이), subtle |
| Icons | Duotone (Navy + Electric Blue) |
| Korean elements | Cloud motifs + Hangeul + Manhwa |
| Comic effects | Key moments only |
| Illustrations | Manhwa-style with linework |
| Pattern | Cloud motif (구름문) |

**See full design brief:** [01b-design-brief.md](./01b-design-brief.md)

---

## Tiger Mascot Prompts (Ready to Use)

These prompts are specifically tailored to the approved direction.

### Nanabanana Pro: Tiger Character Sheet

```
Character design sheet for Korean language learning app mascot.
Cute chibi tiger (호랑이) in manhwa/webtoon art style.

Character traits:
- Large expressive eyes
- Round face, small body (chibi proportions)
- Orange/amber fur with navy blue stripes
- Subtle Korean element: small cloud pattern on forehead or
  traditional collar detail
- Clean linework, flat colors with minimal shading

Show on sheet:
- Front view (default pose, friendly)
- Side view (walking)
- Back view (with fluffy tail)
- Size comparison (shown next to 24px icon scale)

Style: Modern manhwa, clean lines, cute but not childish
Colors: Orange fur, navy stripes, electric blue (#4a90d9) accents
Background: Transparent or light gray
```

### Nanabanana Pro: Tiger Expressions

```
Expression sheet for cute tiger mascot, manhwa/webtoon style.
Same character from character sheet, showing 6 emotions:

1. HAPPY/DEFAULT - Friendly smile, eyes open, welcoming
2. STUDYING/FOCUSED - Determined look, slight frown of concentration
3. CONFUSED/THINKING - Head tilted, question mark nearby, puzzled
4. CELEBRATING - Jumping with joy, arms up, sparkles around
5. APOLOGETIC/SORRY - Bowing slightly, sweat drop, embarrassed
6. ENCOURAGING - Thumbs up or paw up, supportive smile, "you can do it"

Arrange in 2x3 grid. Each expression should be readable at 64px.
Style: Consistent with character sheet, clean manhwa linework
Include subtle Korean cloud motif (구름) floating near celebrating pose
```

### Nanabanana Pro: Tiger in Empty States

**Empty Library:**
```
Illustration for empty library state in Korean learning app.
Cute tiger mascot sitting among empty bookshelves, holding one
manhwa/comic book and looking hopeful. Speech bubble with "Let's
find something to study!" or Korean text "공부하자!"

Style: Manhwa illustration with clean linework
Colors: Navy (#1a1a2e), electric blue (#4a90d9), orange tiger
Include: Subtle cloud pattern on floor or floating
Size: Square composition, works at 200x200px
Mood: Inviting, encouraging, not sad
```

**No Search Results:**
```
Illustration for "no search results" state.
Cute tiger mascot looking through large magnifying glass,
confused expression, Korean-style question marks (?) floating
around. Empty space inside magnifying glass.

Style: Manhwa illustration with clean linework
Colors: Navy, electric blue, orange tiger
Include: Small cloud motifs as decorative elements
Size: Square composition, 200x200px
Mood: Puzzled but helpful, not frustrated
```

**All Reviews Complete:**
```
Illustration for "all reviews done" celebration state.
Cute tiger mascot jumping with joy, confetti and stars around,
traditional Korean clouds (구름문) in background. Small trophy
or star held in paw. Speech bubble: "잘했어!" (Great job!)

Style: Manhwa illustration, dynamic pose, action lines
Colors: Navy, electric blue, orange tiger, gold accents
Include: Manhwa-style speed lines and sparkles
Size: Square composition, 200x200px
Mood: Celebratory, rewarding, energetic
```

**Error/Offline State:**
```
Illustration for error or offline state.
Cute tiger mascot bowing apologetically (Korean-style bow),
small sweat drop, broken wifi symbol or cloud with X nearby.
Speech bubble: "Sorry! Try again?"

Style: Manhwa illustration, gentle not dramatic
Colors: Navy, electric blue, orange tiger (muted slightly)
Include: Disconnected cloud motif
Size: Square composition, 200x200px
Mood: Apologetic but encouraging, not alarming
```

**Welcome/First-time User:**
```
Illustration for first-time user welcome screen.
Cute tiger mascot waving enthusiastically (or Korean bow greeting),
surrounded by floating Korean characters (한글) and small comic
panels. Welcoming, excited expression.

Style: Manhwa illustration, friendly and inviting
Colors: Navy, electric blue, orange tiger, warm accents
Include: Traditional Korean clouds, floating hangul letters
Size: Landscape composition, works as hero banner
Mood: Exciting, welcoming, beginning of adventure
```

### LLM SVG: Tiger Icon (Small)

```
Create an SVG icon (24x24) of a cute tiger face for use as
a small mascot indicator or badge.

Requirements:
- Simple, recognizable at 16px
- Round face shape
- Two pointed ears
- Simple eyes (dots or small curves)
- Small nose, whisker marks
- Navy stripes on orange (use currentColor for flexibility)
- Stroke-based, 2px weight
- viewBox="0 0 24 24"

The icon should match the style of duotone icons - navy primary
shape with electric blue accent on ears or stripes.
```

### LLM SVG: Cloud Motif Pattern

```
Create an SVG pattern tile of Korean traditional cloud motif (구름문)
for use as subtle card backgrounds.

Requirements:
- Tile size: 40x40 viewBox
- Single cloud shape, flowing organic curves
- Stroke only, no fill (stroke-width: 1)
- Use currentColor for theming
- Very simple, 1-2 cloud swirls
- Should tile seamlessly (pattern repeats)
- Include <pattern> element definition

The pattern will be used at 3-5% opacity as background texture,
so it should be subtle and not distracting.
```

---

## Ideation Prompts

Use these with Claude or another LLM to brainstorm visual directions before
generating assets.

### Visual Direction Exploration

```
I'm designing the visual identity for AnkiToon, a Korean language learning
app that teaches vocabulary through webtoons (Korean digital comics).

Current state:
- Navy (#1a1a2e) + Electric Blue (#4a90d9) color palette
- Clean, functional UI using shadcn/ui components
- Geist font family
- Generic Lucide icons

Target audience:
- Korean language learners (beginner to intermediate)
- Webtoon/manhwa enthusiasts
- Ages 18-35, tech-savvy

I want to explore visual directions. For each of these styles, describe:
1. Key visual characteristics
2. Color palette adjustments
3. Typography recommendations
4. Icon style
5. Example UI elements (cards, buttons, empty states)

Styles to explore:
A) Webtoon-native (speech bubbles, panel borders, comic aesthetic)
B) Editorial/Magazine (clean, sophisticated, reading-focused)
C) Playful/Kawaii (cute, rounded, pastel accents)
D) Neo-brutalist (bold, raw, unconventional)
E) Retro-futuristic (synthwave, neon, nostalgic-modern)

Which style best fits a serious learning app with playful content?
```

### Icon Set Conceptualization

```
I need to design a custom icon set for AnkiToon (Korean learning app).

Context:
- Icons will replace generic Lucide icons
- Should feel cohesive with webtoon/Korean aesthetic
- Used for: navigation, actions, status indicators
- Must work at 24px and 16px sizes

Icons needed:
1. Home/Dashboard
2. Browse/Explore (series library)
3. Study/Flashcard
4. Library (user's decks)
5. Profile/Settings
6. Search
7. Progress/Stats
8. Achievement/Star
9. Book/Chapter
10. Vocabulary/Word
11. Check/Complete
12. Error/Warning
13. Add/Plus
14. Menu/Hamburger

For each icon, suggest:
- Visual metaphor (what object/concept to represent)
- Korean/webtoon-inspired twist (how to make it distinctive)
- Outline vs filled recommendation

Also suggest 2-3 "signature" icons that could become brand identifiers.
```

### Empty State Concepts

```
Design concepts for empty state illustrations in AnkiToon.

Scenarios needing illustrations:
1. Empty library (user hasn't added any series yet)
2. No search results
3. All reviews complete (nothing to study)
4. Offline/Connection error
5. First-time user welcome

For each scenario:
- Describe the scene/composition
- Suggest a character or mascot appearance
- Recommend colors (using navy/blue palette)
- Write the accompanying message text
- Suggest a call-to-action button

Style constraints:
- Should feel encouraging, not sad
- Korean/webtoon aesthetic
- Simple enough to render as SVG or flat illustration
- Works in both light and dark mode
```

### Mascot Character Development

```
Help me develop a mascot character for AnkiToon.

Brand context:
- Korean language learning through webtoons
- Serious about learning outcomes
- Playful about the content (comics)
- Target: young adults learning Korean

Mascot requirements:
- Memorable and distinctive
- Can express multiple emotions (happy, studying, confused, celebrating)
- Simple enough for icons and small sizes
- Works as avatar, empty state character, loading animation

Explore these mascot concepts:
A) Animal (suggest which animal and why)
B) Object-character (book, flashcard, speech bubble with face)
C) Stylized human (chibi/simplified person)
D) Abstract shape with personality

For the top recommendation:
- Describe appearance in detail
- Suggest 5 emotional expressions
- Explain how it connects to Korean/webtoon theme
- Describe how it would appear in: icon, empty state, loading, celebration
```

---

## Nanabanana Pro Prompts

Copy-paste ready prompts for image generation. Adjust style descriptors
based on chosen visual direction.

### Custom Icon Set

**Base Style Prompt (prepend to all icon prompts):**
```
Flat vector icon, consistent 2px stroke weight, rounded corners,
Korean webtoon inspired, minimal detail, works at small sizes,
navy blue (#1a1a2e) on transparent background
```

**Individual Icons:**

```
[BASE STYLE] Home icon, traditional Korean house (hanok) roof silhouette,
simple geometric shape, single color
```

```
[BASE STYLE] Book/chapter icon, open manhwa/comic book with visible panels,
slightly tilted, speech bubble detail
```

```
[BASE STYLE] Flashcard icon, two stacked cards with Korean character
hint (ㅎ or 한), flip arrow indicator
```

```
[BASE STYLE] Study/learn icon, brain or head silhouette with Korean
character floating nearby, knowledge absorption concept
```

```
[BASE STYLE] Achievement/star icon, star shape with subtle Korean
pattern fill or hanbok-inspired decoration
```

```
[BASE STYLE] Search icon, magnifying glass with Korean character (글)
visible through lens
```

```
[BASE STYLE] Progress/stats icon, circular progress indicator with
ascending steps, growth visualization
```

```
[BASE STYLE] Library icon, vertical book spines like manhwa volumes,
rainbow of spine colors, organized collection
```

**Icon Set (Batch Generation):**
```
Flat vector icon set for Korean language learning app, 12 icons in
consistent style: home, search, book, flashcard, star, profile,
settings, library, progress chart, checkmark, plus, menu.
Korean webtoon aesthetic, 2px consistent stroke, rounded corners,
navy blue monochrome, transparent background, arranged in 4x3 grid
```

### Empty State Illustrations

**Empty Library:**
```
Cute illustration for empty state, character sitting with empty
bookshelf behind them, looking hopeful and inviting, holding a
single manhwa/comic book, speech bubble saying "Let's start!",
soft pastel colors with navy and blue accents, flat vector style,
webtoon/manhwa art influence, friendly and encouraging mood,
transparent or light background
```

**No Search Results:**
```
Cute illustration for "no results found" state, small character
with magnifying glass looking confused, empty speech bubbles
floating around, question marks in Korean style (물음표),
soft expression not sad, flat vector style, navy and blue
color palette, webtoon aesthetic, minimal background
```

**All Reviews Complete:**
```
Celebration illustration for "all done" state, happy character
with confetti and stars, Korean text elements (잘했어 or 완료),
achievement feeling, bright and rewarding, flat vector style,
webtoon/manhwa influence, could include small trophy or medal,
navy blue with gold/yellow celebration accents
```

**Offline/Error:**
```
Gentle error state illustration, character looking at disconnected
wifi symbol or broken chain, not distressing just informative,
thought bubble with loading dots, soft colors, flat vector style,
Korean aesthetic touches, encouraging "try again" mood
```

**Welcome/Onboarding:**
```
Welcome illustration for first-time users, friendly character
waving or bowing (Korean greeting), surrounded by floating Korean
characters (한글) and small comic panels, inviting and exciting,
flat vector style, webtoon aesthetic, navy and electric blue
palette with warm accents
```

### Mascot Character

**Character Design:**
```
Mascot character design for Korean learning app, cute [ANIMAL/OBJECT]
character, simple flat vector style, can show emotions, wearing
small traditional Korean element (hanbok collar or traditional hat),
holding tiny flashcard or book, friendly approachable expression,
navy blue as primary color with electric blue accents, works at
small icon sizes, clean lines suitable for animation
```

**Character Expressions (generate separately):**
```
[MASCOT NAME] character expression sheet, 6 emotions in grid:
happy/default, studying/focused, confused/thinking, celebrating/excited,
tired/sleepy, encouraging/cheering. Consistent style, flat vector,
simple shapes, clear readable emotions at small sizes
```

**Character in Context:**
```
[MASCOT NAME] character studying scene, sitting at desk with
stack of manhwa books, flashcards spread out, small thought
bubble with Korean character, cozy study atmosphere, flat
vector illustration, navy and blue palette, suitable for
app loading screen or about page
```

### Decorative Elements

**Speech Bubble Patterns:**
```
Set of 6 speech bubble shapes, Korean manhwa/webtoon style,
variety of shapes (round, spiky, thought cloud, shout, whisper,
narrative box), flat vector, thick black outline 3px, white fill,
clean simple shapes, arranged in 2x3 grid
```

**Korean Pattern Elements:**
```
Traditional Korean decorative pattern elements, simplified modern
interpretation, includes: cloud motif (구름문), geometric lattice,
wave pattern, corner decoration. Flat vector, single color navy
blue, suitable for subtle background texture or border decoration,
tileable/repeatable
```

**Card Textures:**
```
Subtle texture pattern for card backgrounds, very light almost
invisible, Korean traditional paper (한지) texture feeling,
organic fiber pattern, seamless tile, works on both light and
dark backgrounds, PNG with transparency
```

### App Store / Marketing

**Feature Graphic:**
```
App feature graphic for Korean learning app AnkiToon, showing
flashcard with Korean character (한) flipping, surrounded by
manhwa-style effects (action lines, sparkles), mascot character
celebrating in corner, text space for app name, vibrant but
professional, flat vector style with depth, 1024x500 aspect ratio
```

**Icon Variations:**
```
App icon design for AnkiToon, square with rounded corners,
features: Korean character element + flashcard/book motif,
navy blue background, electric blue accent, simple recognizable
at small sizes, flat vector style, no text just symbol,
generate 3 variations to choose from
```

---

## LLM SVG Prompts

Use these prompts with Claude or GPT-4 to generate SVG code directly.
SVGs are resolution-independent and can be easily customized in code.

### Base Instructions (Include with All SVG Requests)

```
Generate clean, optimized SVG code. Requirements:
- Use viewBox="0 0 24 24" for icons (standard size)
- Use viewBox="0 0 200 200" for illustrations
- Prefer <path> over <rect>, <circle> when possible
- Use currentColor for fills to inherit text color
- No inline styles, use attributes
- Include aria-label for accessibility
- Minimize path complexity (fewer points)
- Round coordinates to 1 decimal place
- No embedded fonts or images
```

### Icon SVGs

**Flashcard Icon:**
```
Create an SVG icon (24x24) of a flashcard/study card.
- Two stacked rectangles with rounded corners (rx="2")
- Top card slightly offset to show depth
- Front card has a subtle "ㅎ" Korean character hint
- Use stroke="currentColor" stroke-width="2" fill="none"
- Clean minimal style matching Lucide icons
```

**Book/Manhwa Icon:**
```
Create an SVG icon (24x24) of an open comic book/manhwa.
- Open book viewed from slight angle
- Visible panel divisions on pages (2-3 panels)
- Small speech bubble detail on one panel
- Use stroke="currentColor" stroke-width="2" fill="none"
- Simple enough to be recognizable at 16px
```

**Progress Circle Icon:**
```
Create an SVG icon (24x24) of a circular progress indicator.
- Circle outline as track
- Arc showing ~70% progress
- Small checkmark or star at the progress point
- Use stroke="currentColor" stroke-width="2"
- Progress arc could use stroke-dasharray for animation
```

**Korean-Style Star:**
```
Create an SVG icon (24x24) of a decorative star.
- 5-pointed star shape
- Subtle Korean traditional pattern inside (optional inner lines)
- Slightly rounded points for friendly feel
- Use stroke="currentColor" stroke-width="2" fill="none"
- Alternative: filled version with fill="currentColor"
```

### Illustration SVGs

**Empty State - No Content:**
```
Create an SVG illustration (200x200) for an empty library state.
- Simple character (circle head, basic body) sitting
- Empty bookshelf behind (3 shelves, simple lines)
- One book being held by character
- Minimal detail, flat style
- Use these colors:
  - Primary: #1a1a2e (navy)
  - Accent: #4a90d9 (blue)
  - Background elements: #e5e5e5 (light gray)
- Friendly, inviting composition
```

**Empty State - Search No Results:**
```
Create an SVG illustration (200x200) for "no search results".
- Magnifying glass as central element (large)
- Small confused face/character peeking from behind
- Question mark floating nearby
- Empty/blank area inside magnifying glass
- Use colors: navy #1a1a2e, blue #4a90d9, gray #9ca3af
- Simple flat vector style
```

**Celebration - All Complete:**
```
Create an SVG illustration (200x200) for "all reviews complete".
- Central trophy or star shape
- Confetti elements around (simple rectangles, circles)
- Small character celebrating (arms up)
- Radiating lines suggesting achievement
- Use colors: navy #1a1a2e, blue #4a90d9, gold #fbbf24
- Joyful energetic composition
```

### Animated SVG Elements

**Loading Spinner:**
```
Create an SVG loading spinner (24x24) with CSS animation.
- Circular design
- Partial arc that rotates
- Include <style> block with @keyframes spin animation
- Use stroke="currentColor" for theming
- Smooth 1s infinite linear rotation
- Based on Lucide Loader2 style
```

**Flip Card Animation:**
```
Create an SVG (48x48) showing a flashcard with flip animation.
- Two sides of card (front Korean character, back English)
- Use CSS transform: rotateY for flip effect
- Include hover trigger or class-based trigger
- Preserve-3d perspective for 3D effect
- Duration: 0.6s ease-in-out
```

**Confetti Burst:**
```
Create an SVG (100x100) of confetti particles with animation.
- 10-15 small rectangles and circles
- Various colors: blue, gold, pink, green
- CSS animation: particles fly outward and fall
- Starts from center, expands outward
- Include opacity fade at end
- Total duration: 2s, plays once
```

### Component SVGs

**Speech Bubble Component:**
```
Create an SVG speech bubble that can contain dynamic text.
- Classic comic speech bubble shape
- Pointer/tail on bottom-left
- Use <foreignObject> to allow HTML text inside
- Stroke: 2px black, fill: white
- Sized to grow with content (use % or em units)
- Include drop shadow filter (subtle)
```

**Card Background Pattern:**
```
Create a subtle SVG pattern for card backgrounds.
- Korean-inspired geometric pattern
- Very low opacity (0.03-0.05) so it's barely visible
- Seamless/tileable using <pattern> element
- Works on both light and dark backgrounds
- Pattern size: 20x20 units, repeating
```

**Progress Bar with Korean Flair:**
```
Create an SVG progress bar component (200x20).
- Track: rounded rectangle, light gray
- Fill: gradient from navy to electric blue
- Korean cloud motif (구름) as decorative ends
- Percentage text positioned at fill end
- Accepts width as parameter for dynamic fill
```

---

## Asset Checklist

Track which assets have been created.

**Direction:** Tiger mascot, duotone icons, cloud patterns, manhwa style

### Tiger Mascot (호랑이)
- [ ] Character sheet (front, side, back views)
- [ ] Expression sheet (6 emotions: happy, studying, confused, celebrating, sorry, encouraging)
- [ ] Tiger icon (24x24 for badges/small use)
- [ ] Tiger in context: empty library
- [ ] Tiger in context: no search results
- [ ] Tiger in context: all reviews complete
- [ ] Tiger in context: error/offline
- [ ] Tiger in context: welcome screen
- [ ] Tiger name decided (호돌이? 또리? custom?)

### Duotone Icons (24x24, Navy + Blue)
- [ ] Home (hanok roof style)
- [ ] Browse/Explore (open manhwa)
- [ ] Study/Flashcard (cards with hangul)
- [ ] Library (book spines)
- [ ] Profile (person with Korean touch)
- [ ] Settings
- [ ] Search (magnifying glass with hangul)
- [ ] Progress/Stats (circular with cloud)
- [ ] Achievement/Star (traditional pattern)
- [ ] Book/Chapter
- [ ] Vocabulary/Word
- [ ] Check/Complete
- [ ] Error/Warning
- [ ] Add/Plus
- [ ] Menu/Hamburger

### Korean Patterns & Elements
- [ ] Cloud motif (구름문) SVG pattern tile
- [ ] Cloud motif CSS implementation
- [ ] Speech bubble variants (normal, excited, thought)
- [ ] Action lines (radial, speed lines)
- [ ] Sparkle/celebration effects
- [ ] Panel border styles (optional)

### Manhwa Effects (Key Moments)
- [ ] Session complete celebration frame
- [ ] Card flip speed lines
- [ ] Achievement unlock burst
- [ ] Confetti animation elements

### App Store Assets
- [ ] App icon (tiger + book motif)
- [ ] Feature graphic with tiger
- [ ] Screenshots with device frames

---

## Tips for Best Results

### Nanabanana Pro Tips
1. **Be specific about style**: "flat vector" vs "3D rendered" vs "hand-drawn"
2. **Include color codes**: "#1a1a2e navy blue" is clearer than "dark blue"
3. **Specify size/aspect**: "1024x1024 square" or "16:9 landscape"
4. **Request variations**: "generate 3 variations" gives options
5. **Iterate**: Use "keep the style but change X" for refinement

### LLM SVG Tips
1. **Request optimization**: Ask for "minimal paths" and "rounded coordinates"
2. **Test at target size**: SVGs may look different at 16px vs 64px
3. **Use currentColor**: Makes icons themeable with CSS
4. **Validate output**: Paste into [SVGOMG](https://jakearchibald.github.io/svgomg/) to optimize
5. **Add accessibility**: Request aria-label and role="img"

### Color Reference
```css
/* Brand Colors */
--navy: #1a1a2e        /* oklch(0.205 0.03 262.5) */
--electric-blue: #4a90d9  /* oklch(0.607 0.18 206.8) */
--white: #ffffff
--light-gray: #f5f5f5
--medium-gray: #9ca3af

/* Accent Colors */
--red: #dc2626         /* For errors, "Again" rating */
--orange: #f97316      /* For warnings, "Hard" rating */
--green: #22c55e       /* For success, "Easy" rating */
--gold: #fbbf24        /* For achievements, celebrations */
```

---

## Next Steps

1. **Choose visual direction** using ideation prompts
2. **Generate icon set** with Nanabanana Pro
3. **Create empty states** (most visible impact)
4. **Develop mascot** if desired
5. **Hand off to Claude Code** for integration

Once assets are generated, they can be:
- Saved to `public/images/` or `public/icons/`
- Converted to React components if SVG
- Referenced in components via imports
- Added to the design system documentation
