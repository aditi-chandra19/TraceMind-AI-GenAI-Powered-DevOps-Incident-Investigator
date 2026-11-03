# Project layout

TraceMind is a JavaScript and TypeScript monorepo. The root package contains shared commands; each app owns its runtime dependencies and source code.

```text
apps/
  api/
    src/
      config/       Runtime limits and configuration
      data/         Demo incident fixtures
      middleware/   Express request guards
      models/       MongoDB/Mongoose schemas
      routes/       HTTP endpoint definitions
      scripts/      Local setup and seed commands
      services/     Auth, incident, audit, and log-processing logic
  web/
    src/
      components/   Shared dashboard building blocks
      data/         Frontend demo fixtures
      features/     User-facing areas, grouped by feature
        auth/       Sign-in and registration screens
      App.tsx       App startup, session state, and dashboard composition
      api.ts        Typed browser-to-API client
      styles.css    Global styles and dashboard design tokens

docs/               Setup and architecture notes
```

## Where to make changes

- Add or change HTTP behavior in `apps/api/src/routes`, and keep reusable business rules in `services`.
- Add database collections in `apps/api/src/models`.
- Put reusable React pieces in `apps/web/src/components` and feature-specific screens in `features/<feature>`.
- Keep API requests in `apps/web/src/api.ts`; components should call the typed client instead of constructing fetch requests.
- Keep sample data clearly marked as demo data in the `data` directories.

## Local quality checks

From the repository root:

```sh
npm run format
npm run format:check
npm run typecheck
npm test
npm run build
```
