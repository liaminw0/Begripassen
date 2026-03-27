# Custom CMS Setup

This repo now includes a custom `/admin/` app backed by Cloudflare Pages Functions.

## What it edits

- `content/_index.md`
- `content/events/*.md`
- `content/blogs/*.md`
- uploaded images in `static/images/uploads/`

## Required Cloudflare bindings

Add these in the Cloudflare Pages project settings before using `/admin/`:

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH`
- `GITHUB_TOKEN`
- `CMS_PASSWORD`
- `CMS_SESSION_SECRET`

Optional:

- `GITHUB_COMMITTER_NAME`
- `GITHUB_COMMITTER_EMAIL`

## Recommended values

- `GITHUB_BRANCH`: `main`
- `GITHUB_TOKEN`: GitHub token with repo contents write access
- `CMS_PASSWORD`: shared team password for the BEGR!P editors
- `CMS_SESSION_SECRET`: long random string used to sign the login cookie

## How it works

1. Editors open `/admin/`.
2. They log in with `CMS_PASSWORD`.
3. The Cloudflare Function signs an HttpOnly session cookie.
4. CMS API routes read and write markdown files through the GitHub Contents API using `GITHUB_TOKEN`.
5. A new git commit triggers a fresh Pages deployment.

## Notes

- The CMS is password-protected, but it is still a shared-password workflow. If the team later needs per-user accounts, replace the login step with Cloudflare Access or GitHub OAuth.
- Uploaded images are committed into the repo, not stored in a separate media bucket.
