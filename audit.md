# Ohio Golf Club: component and pattern audit

Source: the rendered public site at https://www.ohiogolfclubindoor.com, captured 10 Oct 2026 at 390, 768 and 1440 px. Everything below is inferred from the rendered output. Treat it as a hypothesis to check against the theme code.

Pages captured: `/`, `/team`, `/events`, `/contact-us`, `/fall-league`, `/carls-place`. `/privacy` and `/terms` returned 404, so the plain text layout could not be checked. The site has no robots.txt (it returns 404), so standard pacing was used.

**Stack, as seen from outside:** Next.js (App Router) with Tailwind CSS. The utility classes are visible in the markup (for example `py-16 md:py-24`, `rounded-2xl`, `bg-[#222]`, `text-[#011E41]`). One theme variable is defined, `--color-primary: #ae1b22`. Fonts are self-hosted through `next/font`: Montserrat for headings and Inter for body text.

Screenshot references point to `screenshots/components/` (crops), `screenshots/<page>-<width>.png` (full pages) and `screenshots/states/` (hover and focus).

---

## Components

### 1. Header and navigation
- **Screenshots:** `components/header-desktop.jpg`, `components/mobile-home.jpg`, `components/mobile-menu.jpg`
- **Pages:** all
- **Observed:**
  - A floating white pill: fixed position, 16px from the top, max-width 576px, radius 16px, and a `shadow-sm`.
  - Contents: the logo on the left, then the phone number `(330) 958-0052` in navy `#011e41` (16px, bold), then a hamburger button.
  - **Desktop uses the hamburger too.** No page shows an inline nav bar.
  - The phone number is hidden below 768px and moves into the menu.
- **Menu (390 capture):** a white panel with the links Fall League, Lessons & Fittings, Memberships, Events, Bay Rentals, Member Login, Customer Login, the phone number, and a red "Contact" button.
- **States:**
  - Phone link hover goes from navy to red `#ae1b22`.
  - The hamburger focus shows a 2px outline offset by 2px, but its outline color is transparent, so no focus ring is actually visible.
- **Not confirmed:**
  - Desktop menu layout (it was only opened at 390).
  - Where the "Customer Login" and "Member Login" links go (not followed, by design).

### 2. Announcement badge and hero
- **Screenshots:** `components/hero-home.jpg`, `components/events-hero.jpg`, `components/contact-hero.jpg`, `components/league-hero.jpg`, `components/carls-hero.jpg`
- **Pages:** all except team
- **Badge (eyebrow pill):** red `#ae1b22` fill, white text, Inter 12px/700, uppercase, padding 8px 16px, fully rounded, 32px tall.
  - Seen as "Fall League • Registration Open", "Events", "Get in Touch" and "Registration Open • 80 Team Spots".
  - The home and fall-league badges also have a pulsing dot (`animate-ping`).
- **Hero variants:**
  - **A, centered text on black (home):** Montserrat heading at 72px desktop and 36px mobile, a red underline bar under the second line, an Inter 18px paragraph, and a primary plus outline button pair.
  - **B, full-bleed photo with a dark overlay, centered (events, contact, carls-place):** heading 60 to 72px, white text, one primary button.
  - **C, full-bleed photo, left aligned (fall-league):** a 104px uppercase heading ("FALL LEAGUE"), a left-to-right black gradient over the photo, and a closing tagline with letter spacing.
- **Not confirmed:** whether the hero is one component with variants or separate per-page markup.

### 3. Buttons
- **Screenshots:** `states/cta-primary-*.png`, `states/cta-outline-*.png`, `states/button-0*-*.png`
- **Pages:** all
- **Variants:**

| Variant | Size | Padding | Height | Radius | Where |
|---|---|---|---|---|---|
| Primary filled | Inter 16px/500 | 12px 24px | 48px | 8px | Most CTAs (home sections, Get a Quote, Send Message) |
| Primary filled, large | Inter 18px/500 | 16px 32px | 56px | 8px | Contact Us Today, Plan Your Event (bottom of events page), fall-league Register and Lock In |
| Primary filled, wide | Inter 16px/500 | 12px 32px | 48px | 8px | Login to Member Portal only |
| Outline (on dark) | Inter 16px/500 | 12px 24px | 48px | 8px | How It Works, 1px white border |
| Text link CTA | Inter 14px, underlined | none | n/a | none | "Book a Bay · Book a Lesson" under the home league card |

- **States observed:**
  - **Primary hover** inverts: white background, red text, red 1px border.
  - **Outline hover:** text and border turn red.
  - **Focus-visible:** a 2px ring in `#ae1b22`, built from Tailwind `ring-2` as a box-shadow.
  - **Transition:** 150ms on color properties, Tailwind's default ease.
- **Inconsistencies:**
  - "Contact Us Today" (the CTA banner) showed no hover change, and its focus ring is white instead of red.
  - Arrow glyphs ("→") are typed into the label text instead of being an icon slot.
- **Not confirmed:** disabled and pressed states (none were present). The Send Message button's hover could not be checked without interacting with the form.

### 4. Image link tiles (home)
- **Screenshot:** `components/image-tiles.jpg`
- **Pages:** home (Schedule Private Lessons, Book a Private Hitting Bay, Become A Member), and home Events & Bar (`components/events-bar.jpg`)
- **Observed:** a photo with a black overlay at 50% opacity and a centered Montserrat 36px label with a text shadow, radius 16px.
  - Hover: the image scales to 105% over 500ms and the overlay lightens to 30%.
  - Events & Bar uses the same pattern at two-up.

### 5. Feature and offering cards
- **Screenshots:** `components/offering-cards.jpg`, `components/why-choose-cards.jpg`, `components/event-cards.jpg`
- **Pages:** home (Private Hitting Bays, Trackman Simulators, Short Game Area), carls-place (Why Choose Us), events (five event types)
- **Observed:**
  - **Home and Carl's Place:** `#222222` surface, radius 12px, padding 32px, centered text, Montserrat 20px title, Inter 16px body, `shadow-md`. Hover raises it to `shadow-lg`.
  - **Events:** the same `#222222` surface but radius 16px, a 1px `white/10` border, left-aligned text, an outline icon above the title, and a lighter body color (`#d1d5db`).
- **Inconsistency:** these are two cards that look alike but differ in radius, border, alignment and text color.

### 6. Membership tier cards and member rates
- **Screenshots:** `components/membership-tiers.jpg`, `components/member-rates.jpg`, `states/card-tier-classic-*.png`
- **Pages:** home
- **Tier cards:**
  - White surface on the `#121212` section, radius 16px, `shadow-xl`, 4 across on desktop.
  - Montserrat title, a price in Montserrat 30px plus a "/Month" suffix, and a check list with red check icons.
  - The "Most Popular" (Classic) card adds a 2px red ring and a red pill tag.
  - Hover turns the border red.
- **Member rates:**
  - A white panel, radius 16px, max-width 672px.
  - Two-column label and price rows with `#e5e7eb` dividers, prices in red at Inter 18px/700.
- **Inconsistency:** the subtitle "Individual Member Only" appears on two cards but not the others, so the cards have uneven heights.

### 7. Lesson and fitting profile block
- **Screenshot:** `components/lessons-fitting.jpg`
- **Pages:** home
- **Observed:**
  - A two-column row: text on the left, a radius 16px photo on the right, on a `#121212` section.
  - Montserrat 36px heading, Inter 16px paragraph, a check list (red checks), and one primary button.
  - Bay Rentals (`components/bay-rentals.jpg`) is the same layout mirrored (image left), on black.

### 8. Reviews and testimonials
- **Screenshots:** `components/reviews.jpg`, `components/testimonials.jpg`
- **Home reviews:**
  - Black cards on a `#121212` section, radius 12px, 350px fixed width (`w-[350px]`).
  - Montserrat name, five yellow `#eab308` stars, Inter 16px text truncated with an ellipsis, and a date.
  - Layout is 3 then 2, centered.
- **Carl's Place testimonials:** a different component. `#222222` cards, italic quote, and the attribution in red with a leading hyphen.
- **Not confirmed:**
  - The review source. The text looks like Google reviews loaded at runtime, since the cards appeared only after scrolling.
  - Whether the truncation is a character limit or line clamping.
  - Carl's Place testimonial names (Jordan Flynn, Alex Bennett, Taylor Reeves) read like placeholder copy. Worth confirming with the client.

### 9. Event and bar blocks
- **Screenshots:** `components/events-bar.jpg`, `components/event-cards.jpg`
- **Pages:** home (two image tiles plus a "Learn More" button), events (icon cards, see 5)

### 10. Team member card
- **Screenshot:** `components/team-card.jpg`
- **Pages:** team
- **Observed:** a square photo with radius 16px and a bottom-up black gradient scrim, then the name (Montserrat 20px), role (Inter 16px bold), email (14px) and bio (14px). Three across on desktop.

### 11. Fall league modules
- **Screenshots:** `components/league-card.jpg`, `components/league-hero.jpg`, `components/season-timeline.jpg`, `components/how-it-works.jpg`, `components/league-cta.jpg`
- **Pages:** home (league card), fall-league
- **Observed:**
  - This is the most bespoke area of the site and the main gradient user.
  - **Pieces:**
    - a stat strip with four cells and 1px dividers
    - a season timeline of colored week cards (charcoal, navy, dark red, solid red)
    - numbered "How It Works" panels with navy gradient fills and red "01" to "07" eyebrows in `#e0474f`
    - a bracket diagram
    - a points table
  - Custom sizes like `rounded-[10px]` and `mt-[18px]` show up only here.
- **Note:** this page looks like a one-off campaign page. Decide whether its parts become shared components or stay page-specific.

### 12. Contact and address block, footer
- **Screenshots:** `components/contact-block.jpg`, `components/footer.jpg`
- **Contact:** a two-column layout.
  - **Left:** heading, intro, then Visit, Call and Email groups. Each group has a red uppercase 12px label, white text, and a red "Get directions" link.
  - **Right:** the form card (see 13).
- **Footer:**
  - `#0a0a0a` surface, four columns: Ohio Golf Club with the address, Quick Links, More Info, Follow Us.
  - Column titles are Montserrat 18px in red. Links are Inter 14px white and turn red on hover.
  - A 1px `white/10` divider sits above the copyright line.
  - The address appears twice (here and on contact) with different line breaks.

### 13. Forms
- **Screenshot:** `components/contact-block.jpg`
- **Pages:** contact-us
- **Observed:**
  - White card, radius 16px.
  - Labels: Inter 16px, `#374151`.
  - Inputs: 50px tall, 1px `#d1d5db` border, radius 4px, 12px horizontal padding.
  - Two checkbox cards (Lessons, Fittings) with a 1px border, radius 8px, a title and a helper line.
  - A textarea, and a right-aligned primary button.
- **Not confirmed** (the form was not touched, per scope): focus styling, validation and error states, the success message, and required-field markers.
- **Inconsistency:** the input radius (4px) differs from the button radius (8px) and the checkbox card radius (8px).

---

## Repeated page patterns

1. **Section rhythm:**
   - Sections use `py-16 md:py-24`: 64px vertical padding on mobile, 96px from 768px up.
   - Section backgrounds alternate black `#000000` and near-black `#121212`.
2. **Container:**
   - `container mx-auto` with a max-width of 1440px.
   - Side padding: 16px, 24px from 640px up, 32px from 1024px up.
   - Text blocks inside are limited to 672px or 768px.
3. **Section intro:** a centered Montserrat heading (36 to 48px) plus an Inter 18px paragraph in white or white/70, then the content, then one centered primary button. Seen in Follow Us, Explore, Membership Benefits, Events & Bar, What Our Members Say and Why Choose Us.
4. **Alternating image and text rows:** Lessons & Fittings (text left) and Bay Rentals (image left) on home, and Transform Your Home on carls-place. Each row has a heading, a paragraph, an optional check list and one button.
5. **Hero, then badge, heading, paragraph and CTA:** every hero starts with a red pill eyebrow (except team and carls-place) and ends with a single primary button. Only home pairs it with a secondary outline button.
6. **Photo with overlay:** a black overlay or gradient scrim behind white text. Used for heroes, image tiles, team photos and the CTA banner.
7. **Closing CTA banner:** a full-bleed photo, a centered heading and one large primary button, before the footer (home "Experience Ohio's Finest", fall-league "Save Your Team a Spot").
8. **CTA pairing:**
   - Almost every section has exactly one primary button.
   - The only primary plus outline pair is the home hero.
   - The secondary path is otherwise a text link ("Book a Bay · Book a Lesson").
9. **Fade-in on scroll:** content blocks use `fade-in-element` with `delay-sm` and `delay-md` (opacity and transform, 600ms ease-out).

---

## Inconsistencies, ranked by impact on shared components

1. **Hard-coded colors bypass the theme.**
   - Only `--color-primary` is a variable.
   - Navy `#011e41`, `#0a2a52`, `#222`, `#121212`, `#0a0a0a`, `#e0474f` and the yellow star color are written as arbitrary Tailwind values (`text-[#011E41]`, `bg-[#222]`) or as gray defaults.
   - This blocks tokenizing until each value is mapped to a named color.
2. **Five near-black surfaces:** `#000000`, `#0a0a0a`, `#121212`, `#1a1a1a` and `#222222`. A suggested consolidation is page (`#000`), raised section (`#121212`) and card (`#222222`), with the footer's `#0a0a0a` folded into the page color.
3. **Four button sizes that look alike:** 48px (24px padding), 48px (32px padding, Member Portal only), 56px large, plus the outline variant. On top of that, one CTA has no hover state and a different focus ring. Suggested: three variants (primary, outline, text) in two sizes (md 48, lg 56).
4. **Two card families that look alike:** offering cards (radius 12px, no border, centered) and event cards (radius 16px, white/10 border, left aligned). Review cards add a third surface (black, 12px) and testimonials a fourth (`#222`, 12px). This could be one Card with surface, align and border options.
5. **Corner radii:** 4, 8, 10, 12, 16 and 28px, plus fully rounded pills. Suggested: sm 4 (inputs), md 8 (buttons and controls), lg 12, xl 16 (cards, media, header). The 10px and 28px values are fall-league one-offs.
6. **Off-scale type sizes:** 10, 11, 13, 15, 22, 26, 40 and 104px sit outside Tailwind's scale (20 distinct sizes in total). Letter spacing has 28 distinct values, mostly from `tracking-[...]` on the fall-league page.
7. **Headings skip levels:**
   - The home page goes h1 to h3 (the section titles "Follow Us", "Explore Ohio Golf Club" and others are h3 while some subsections are h2).
   - Team and events go h1 straight to h3.
   - This affects SEO, which is in scope, and the heading component API.
8. **Two reds:** brand `#ae1b22`, and `#e0474f` used only for fall-league eyebrow numbers. Plus alpha versions of the brand red at 20%, 25%, 60% and 70%.
9. **Gradients:**
   - **Decorative:** 9 distinct gradient values. 5 are decorative, on the home league card and the fall-league panels. Flattening those 5 takes care of most of the "cleaner, flatter" goal.
   - **Functional:** the other 4 are image scrims (team, carls-place, fall-league hero) and are worth keeping as one overlay token.
10. **Uppercase:** used 145 times, mainly in badges, eyebrows, labels and the fall-league headings. That's a brand choice, recorded here, not a defect, but it should be a text style rather than ad hoc `uppercase` classes.

---

## Could not capture or confirm

- `/privacy` and `/terms` (404 on the live site).
- Form focus, error and success states (the form was not used).
- Hover on the review cards and the desktop menu panel. Their selectors did not match in the second hover pass.
- Disabled button states (none present).
- Any values set by JavaScript after interaction (carousel timing on carls-place, menu open animation).
- Instagram feed: the "Follow Us" section on home leaves a large empty area at all widths. Likely an embed that did not render in a headless browser. Check in a real browser.
- The source of the review data (looks dynamic).
