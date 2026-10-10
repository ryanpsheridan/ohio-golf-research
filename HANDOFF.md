# Handoff

**Scope (agreed):** search and metadata fixes; five new pages (Lessons, Club Fitting, Memberships, Bay Rentals, Leagues); a league signup page; shared components and tokens first. No visual redesign this phase.

**Captured:** 10 Oct 2026, from the public site at 390, 768 and 1440 px. Pages: `/`, `/team`, `/events`, `/contact-us`, `/fall-league`, `/carls-place`. `/privacy` and `/terms` returned 404. Outputs are in `raw/`, `screenshots/` and `tokens/`, with `audit.md` and `style-guide.html` built on top of them.

**Known**
- The site is Next.js and Tailwind. Fonts are Montserrat (headings) and Inter (body), served through `next/font`.
- One theme variable: `--color-primary: #ae1b22`. Most sizes, grays and shadows are Tailwind defaults.
- Section rhythm is `py-16 md:py-24`. The container is 1440px max with 16, 24 and 32px side padding.
- Buttons, cards, the hero and the footer patterns are documented in `audit.md`, with their hover states.

**Unverified**
- Where navy `#011e41`, charcoal `#222222`, `#121212`, `#0a0a0a` and `#e0474f` are defined (they look like inline values).
- Whether the heroes, cards and buttons are shared components or repeated markup.
- Form focus, error and success states; disabled buttons; the desktop menu panel.
- Review data source; Instagram embed; the Carl's Place testimonials.
- Privacy and terms pages.

**Suggested first prompt for the next session (run inside the client repo):**

> Read `audit.md`, `tokens/tokens.json`, `tokens/report.json` and `HANDOFF.md` from the ogc research repo. Then inspect this codebase: `tailwind.config`, global CSS, `next/font` setup, and the components behind the header, hero, buttons, cards, membership tiers, reviews, contact form and footer. For every token and component in the audit, report whether it matches the code, differs (show both values and the file and line), or is missing. Flag every mismatch and every inline value (`[#...]`, `[..px]`) that should become a token. Do not change any code yet. Finish with a corrected token list and a proposed shared component set, then update the style guide from the verified values.
