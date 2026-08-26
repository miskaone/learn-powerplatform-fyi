# Deployment contract

Mastery Gate has one production deployment path: a push to `main` in
`miskaone/learn-powerplatform-fyi` triggers the Git-connected Cloudflare Pages project
`learn-powerplatform-fyi`. Do not add a GitHub Actions deployment workflow.

## Cloudflare Pages settings

- Production branch: `main`
- Build command: `bun run build`
- Build output directory: `apps/web/out`
- Root directory: `/`
- Preview deployments: all non-production branches
- Custom domain: `learn.powerplatform.fyi`
- Pages hostname: `learn-powerplatform-fyi.pages.dev`

The root build script performs `bun install --frozen-lockfile` before building the web
workspace. The Pages production and preview environments set
`SKIP_DEPENDENCY_INSTALL=1` so Cloudflare does not auto-run `npm install` against Bun's
`workspace:*` dependencies.

## Account-specific deployment scars

1. Attaching a Pages custom domain through the API does not create its DNS record. Create
   the proxied `learn` CNAME to `learn-powerplatform-fyi.pages.dev` as a separate,
   explicit operation.
2. The Cloudflare Workers & Pages GitHub App is scoped per repository. API error
   `8000012` for an existing repository means the app installation must be granted access
   to `miskaone/learn-powerplatform-fyi` in GitHub Settings → Applications → Installed
   GitHub Apps.
3. Creating a Git-connected Pages project does not build commits that already exist.
   Create the project before the push intended to trigger the first production build.
