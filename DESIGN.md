# Role log

## Intent

A personal workspace for tracking a developer's job search. The application log is the focal point: role first, company second, technologies and dates as supporting context. Personality comes from deliberate typography, the owner's initial, and a restrained forest-green accent.

## Typography

Sora is the display and job-title face; Manrope is the body and control face. Next.js `next/font` supplies self-hosted font files and the `--font-display` / `--font-body` variables in the root layout. Desktop page titles use 36px/600, section titles 16px/600, job titles 14px/600 (15px on mobile). Display tracking is slightly tight; role text uses a 1.55 line height to accommodate long imported titles.

## Colors and token ownership

`src/app/globals.css` is the canonical runtime source; this document records intent and accepted values rather than generating CSS. Components consume the global stylesheet and its custom properties. Keep both sources aligned when changing the visual system.

- Ink `--ink`: #17201b; secondary text `--muted`: #606d65.
- Page `--paper`: #f5f7f4; surface `--surface`: #ffffff; borders `--line`: #dde3de.
- Accent `--green`: #1f6b4f; hover `--green-dark`: #15523c; tint `--green-pale`: #e8f3ed.


## Layout and components

Use a compact header, a maximum content width of 1280px, and a 4px spacing base with optical adjustments for text and badges. Surfaces use soft borders and minimal shadow, with a 14px panel radius and 9px button radius. Avoid decorative gradients on the dashboard.

- Roles are text buttons that open the existing application editor. Keep the complete role title visible and allow wrapping.
- `StatusFilter` remains the existing keyboard-accessible listbox. Status editing stays a native select; its popup is owned by the platform.
- Shared buttons, the application editor, and sign-in screen use the same typography and accent. Global focus outlines remain visible; motion respects reduced-motion preferences.

## Verification

Check desktop at 1440px and 1100px, mobile at 390px and 320px, long imported titles/company names, open filters, pagination, and editor layout. Run TypeScript, the existing test suite, and a production build after implementation.
