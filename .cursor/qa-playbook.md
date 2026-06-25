# AMQA QA Playbook

Agent and human reference for Agentic QA execution. Imported by `.cursor/cursor.md` and `AGENTS.md`.

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

## Edition / license matrix

| Edition | License | Notes |
|---------|---------|-------|
| Entry | Auto-applied in dev | Most features; good for default PR QA |
| Enterprise | `MM_LICENSE` secret | Admin console, compliance, ABAC |
| FIPS | FIPS image build | Run on `release-*` RC only |
| Team | Planned | Not in default release pipeline yet |

## Seed data (mmctl)

```bash
cd server
./bin/mmctl --local user create --email amqa@example.com --username amqaadmin --password Password123! --system-admin --email-verified --disable-welcome-email
./bin/mmctl --local user create --email amqamember@example.com --username amqamember --password Password123! --email-verified --disable-welcome-email
./bin/mmctl --local team create --name amqateam --display-name "AMQA Team" --email amqa@example.com
```

## Area owners (escalation)

Use `CODEOWNERS` for the changed path. Tag area owners on Sev-1/2 `agentic-qa` issues.

## Known flaky zones

- First-user signup UI — prefer `mmctl` seeding
- WebSocket reconnect after sleep
- Elasticsearch indexing delay (wait before search assertions)

## Evidence standards

- Filename: `AMQA-{pr}-{scenario}-{step}.png`
- Include URL bar, user role, and timestamp in screenshot
- Redact PII in screenshots; use test accounts only
- Upload to S3 when credentials available; link in PR comment
- Failed steps: actual vs expected in result comment

## CodeRabbit execution protocol

1. Read `## Change Impact` and **QA Recommendation** from PR body
2. Execute each scenario in QA Recommendation (do not rewrite the plan)
3. For 🔴 Critical inline CodeRabbit comments, reproduce before marking pass
4. Time-box exploratory deviation to 15 minutes within Regression Risk areas
5. Write results to `qa-result.json` (see `.github/amqa/schemas/qa-result.v1.schema.json`)
6. On 🟢 Low with "no manual QA required" — do not run; confirm skip only

## Defect filing template

```
Title: [AMQA] <short description>
Labels: agentic-qa
Body:
- PR: #NNN
- SHA: <head sha>
- Scenario ID: QA-NNN-01
- Severity: Sev-1|2|3
- Steps to reproduce:
- Expected:
- Actual:
- Screenshot/logs:
```

## S3 evidence layout

`s3://$AWS_S3_BUCKET_NAME/amqa/pr-{number}/{scenario-id}/`
