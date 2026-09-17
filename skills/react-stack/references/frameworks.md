# Framework Rules Reference

Task skills read only the section for the detected framework.

## Next.js — App Router

- File conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` (must be `'use client'`), `not-found.tsx`, `route.ts`.
- Server Components by default. Use a Client Component only if it needs hooks (`useState`/`useEffect`…), event handlers, browser APIs, or a Context Provider.
- Put `'use client'` boundaries at the **leaves** of the tree. Never turn a whole page into a client component for one button.
- Props passed from Server to Client must be serializable (watch out for functions, class instances, Dates).
- Protect server-only code with `import 'server-only'`. Never put secrets in `NEXT_PUBLIC_` variables.
- Mutations via Server Actions (`'use server'`) + `revalidatePath`/`revalidateTag`.
- Caching defaults differ between Next.js major versions — check the version and verify with docs (e.g. Context7).
- Use `next/image`, `next/font`, `next/link`.

## Next.js — Pages Router

- File-based routing in `pages/`, plus `_app.tsx`, `_document.tsx`.
- Data: `getServerSideProps`, `getStaticProps`, `getStaticPaths`. APIs in `pages/api/*`.
- Don't suggest App Router-only features (Server Components, Server Actions).

## Vite SPA

- Entry `index.html` → `src/main.tsx`. Env vars via `import.meta.env.VITE_*`.
- Code splitting: route-level `React.lazy` + `Suspense`.
- Tests usually run on Vitest (jsdom/happy-dom). Check the `test` block in `vite.config` or `vitest.config`.

## Create React App

- Deprecated tooling. Before adding CRA-specific config (eject, etc.), consider proposing a migration to Vite.
- Env vars `process.env.REACT_APP_*`, tests on Jest.

## Remix / React Router v7 (framework mode)

- Route modules: `loader`, `action`, default component, `ErrorBoundary`, `meta`.
- Read with `useLoaderData`, mutate with `<Form method="post">` + `action`. Minimize client-side fetch state.
- React Router v7 is Remix's successor — match import paths (`react-router` vs `@remix-run/*`) to the project.

## TanStack Start / Router

- File-based, type-safe routes: `createFileRoute`, `loader`, validated search params.

## React Native / Expo

- No DOM tags, CSS files, or `className` (unless NativeWind).
- Use `FlatList`/`FlashList` for lists; avoid `ScrollView` + `map` for large data.
- Accessibility: `accessible`, `accessibilityLabel`, `accessibilityRole`, `accessibilityState`.
- With Expo Router, routes live in `app/`.

## Gatsby / Astro

- Gatsby: GraphQL data layer; check `gatsby-node`.
- Astro: React components are islands. Decide whether a hydration directive (`client:load`, `client:visible`, …) is needed.
