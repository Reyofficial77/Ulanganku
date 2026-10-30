# Ulanganku — Performance & SEO optimization

## Changes

- Split the React entry routes with `React.lazy` + `Suspense`, so the landing page no longer downloads dashboard, editor, exam, and template pages on first load.
- Split dashboard sub-pages into separate chunks.
- Defer the chatbot implementation until the visitor opens it. The visible entry button remains available; the full chatbot bundle is loaded on demand.
- Defer the image-compression helper used by chatbot attachments until an image is actually uploaded.
- Remove the render-blocking Google Fonts CSS `@import`. Manrope now loads asynchronously with `font-display=swap` and preconnect hints, while system fonts render immediately.
- Apply `content-visibility: auto` to below-the-fold landing sections to reduce initial paint work.
- Run the four independent dashboard SQL queries concurrently instead of sequentially, reducing database round trips on dashboard load.
- Add a page description and dynamic canonical URL for indexable pages; dashboard and other private/transactional pages remain `noindex`.
- Add `robots.txt` and a sitemap for the public landing page.

## SEO privacy note

The teacher dashboard intentionally remains `noindex, follow` because it is an authenticated, private application area. Lighthouse may still give the dashboard a lower SEO score because it is not meant to be indexed. Do not remove `noindex` just to make that particular number green; optimize SEO on public pages instead.

## Verification

- TypeScript/TSX syntax transpilation checked across source files.
- Relative imports, JSON configuration, sitemap XML, and ZIP integrity checked.
- A full Vite production build and a new Lighthouse run could not be completed in this environment because npm registry DNS requests failed (`EAI_AGAIN`) during dependency installation. Re-run Lighthouse after deploying to Vercel to measure the actual scores.
