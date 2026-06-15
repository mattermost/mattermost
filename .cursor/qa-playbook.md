# AMQA QA Playbook

Agent and human reference for Agentic QA execution. Imported by `.cursor/cursor.md`.

## Sev-1 smoke paths (15 minutes)

Always run on RC or when release confidence report requests gap-fill:

1. Admin login at `/login`
2. Post a message in Town Square
3. Create a public channel and post
4. Open System Console → User Management (admin only)
5. Logout

## Environment tiers

| Tier | Docker services | Use when |
|------|-----------------|----------|
| 0 | postgres, redis | Default PR verification |
| 1 | + inbucket | Email-invite flows |
| 2 | + LDAP, ES, MinIO | ABAC, search, compliance |

## Seed data (mmctl)

```bash
cd server
./bin/mmctl --local user create --email amqa@example.com --username amqaadmin --password Password123! --system-admin --email-verified --disable-welcome-email
./bin/mmctl --local team create --name amqateam --display-name "AMQA Team" --email amqa@example.com
```

## Evidence standards

- Filename: `AMQA-{pr}-{scenario}-{step}.png`
- Include URL bar, user role, and timestamp in screenshot
- Upload to S3 when credentials available; link in PR comment

## CodeRabbit execution protocol

1. Read `## Change Impact` and **QA Recommendation** from PR body
2. Execute each scenario in QA Recommendation (do not rewrite the plan)
3. For 🔴 Critical inline CodeRabbit comments, reproduce before marking pass
4. Write results to `qa-result.json` format (see `.github/amqa/schemas/qa-result.v1.schema.json`)
5. On 🟢 Low with "no manual QA required" — do not run; confirm skip only

## Defect filing

Create GitHub issue with label `agentic-qa`, include: PR link, repro steps, screenshot, build SHA.
