---
name: membership-permission-policy-testing
description: End-to-end testing workflow for Membership Policies and Permission Policies in Mattermost local dev. Use when asked to validate ABAC policy behavior, mixed public/private policy semantics, user-attribute policy matching, policy enforcement outcomes, or permission-policy assignment/removal effects.
allowed-tools: Shell, ReadFile, rg, Subagent(computerUse), RecordScreen
---

# Membership/Permission Policy Testing Playbook

Use this skill whenever asked to test:
- Membership Policies (`System Attributes > Membership Policies`)
- Permission Policies (`System Attributes > Permission Policies`)
- ABAC user-attribute based assignment/enforcement behavior

## Preconditions

1. Server must be running in enterprise-ready mode.
2. Webapp must be running and reachable.
3. `mmctl` must be available from `server/bin/mmctl`.
4. For local API calls, local mode socket should exist (`/var/tmp/mattermost_local.socket`).

Quick checks:

```bash
curl -s http://localhost:8065/api/v4/config/client | rg 'BuildEnterpriseReady|BuildHashEnterprise'
./server/bin/mmctl version
```

## Standard Test Data Setup (CLI)

Always create deterministic fixtures so test outcomes are inspectable.

### 1) Team + users

```bash
./server/bin/mmctl team create --name policy-team --display-name "Policy Team" --local

./server/bin/mmctl user create --email user-1@example.com --username user-1 --password "Sys@dmin-sample1" --email-verified --local
./server/bin/mmctl user create --email user-2@example.com --username user-2 --password "Sys@dmin-sample1" --email-verified --local
./server/bin/mmctl user create --email user-3@example.com --username user-3 --password "Sys@dmin-sample1" --email-verified --local

./server/bin/mmctl team users add policy-team user-1 user-2 user-3 --local
./server/bin/mmctl team users add policy-team admin --local
```

### 2) Channels (non-default, non-DM, non-GM)

```bash
./server/bin/mmctl channel create --team policy-team --name policy-public-a --display-name "Policy Public A" --local
./server/bin/mmctl channel create --team policy-team --name policy-private-a --display-name "Policy Private A" --private --local
./server/bin/mmctl channel create --team policy-team --name policy-public-b --display-name "Policy Public B" --local
```

### 3) Baseline memberships for clear enforcement diffs

```bash
./server/bin/mmctl channel users add policy-team:policy-public-a user-1 user-2 user-3 --local
./server/bin/mmctl channel users add policy-team:policy-public-b user-1 user-2 user-3 --local
./server/bin/mmctl channel users add policy-team:policy-private-a user-1 user-2 user-3 --local
```

## System Console Manual Steps (GUI)

Use `computerUse` for GUI actions.

### 1) Enable ABAC

Go to:
- `System Console > System Attributes > Attribute-Based Access`
- Enable ABAC / attribute-based controls
- Save

### 2) Create user attributes

Go to:
- `System Console > System Attributes > User Attributes`

Create at least 3 attributes:
- `department`
- `region`
- `level`

Mark each as NOT user-editable (admin managed).

### 3) Assign user attribute values

Go to:
- `System Console > User Management > Users`
- For each user edit profile/attributes and save:
  - `user-1`: `department=engineering`, `region=us`, `level=l1`
  - `user-2`: `department=sales`, `region=eu`, `level=l2`
  - `user-3`: `department=engineering`, `region=eu`, `level=l3`

Wait up to 30 seconds after saves if attribute propagation is delayed.

### 4) Create membership policy

Go to:
- `System Console > System Attributes > Membership Policies`

Create policy:
- Name: `Engineering Policy`
- Expression: `user.attributes.department == "engineering"`
- Assign channels:
  - `policy-private-a` (private)
  - `policy-public-a` (public)

Expected UI validation:
- Mixed-channel warning banner appears.
- Text includes "recommended and will be auto-added when auto-add is enabled".

Save and run enforcement/sync if prompted.

## CLI/API Validation of Outcomes

After enforcement, verify channel memberships via local API:

```bash
TEAM_ID=$(./server/bin/mmctl team list --local --json | jq -r '.[] | select(.name=="policy-team") | .id')
PUB_ID=rcprf1ntdir3dfjm9h79b7fi3o
PRIV_ID=7hduw8itb3rp3qs11e5uzw6g3h

echo 'public members usernames:'
curl -s --unix-socket /var/tmp/mattermost_local.socket "http://localhost/api/v4/channels/$PUB_ID/members?per_page=200" | jq -r '.[].user_id' | while read -r uid; do
  curl -s --unix-socket /var/tmp/mattermost_local.socket "http://localhost/api/v4/users/$uid" | jq -r '.username'
done | sort -u

echo 'private members usernames:'
curl -s --unix-socket /var/tmp/mattermost_local.socket "http://localhost/api/v4/channels/$PRIV_ID/members?per_page=200" | jq -r '.[].user_id' | while read -r uid; do
  curl -s --unix-socket /var/tmp/mattermost_local.socket "http://localhost/api/v4/users/$uid" | jq -r '.username'
done | sort -u
```

Expected for engineering policy:
- Private channel should keep only matching users (`user-1`, `user-3`).
- Public channel remains open; members may still include non-matching users depending on auto-add and existing membership semantics.

## Evidence Requirements

Always capture:
- Video recording of key GUI flow (ABAC enablement, attributes, policy save/apply).
- Screenshots for:
  - Attributes configured as non-user-editable
  - Policy expression
  - Mixed-channel warning
  - Enforcement success state
- Terminal evidence for post-enforcement membership checks.

## Notes for Permission Policies

When testing Permission Policies, reuse the same fixture process:
- Create deterministic teams/channels/users first.
- Assign policy to non-default channels.
- Validate add/remove and enforcement effects with API checks, not only UI.
- Include before/after snapshots of memberships or permissions.
