-- Auto-adding members used to be driven by AccessControlPolicies.Active. That
-- setting now lives as an auto_add mode on the policy's membership rule, so
-- back it fill from Active here: Active only ever meant on or off, which maps
-- onto the "always" mode. Active is deliberately left untouched: it is
-- reserved for a different purpose, and leaving it means a rollback to the
-- previous release resumes with the behaviour it had before the upgrade.
--
-- Both statements are idempotent, and the second depends on the first having
-- already run: once a policy holds a membership rule it is skipped there.

-- Stamp the mode on the first membership rule, the one the model's
-- MembershipRule() accessor resolves to. v0.3+ membership rules carry the
-- membership action and no name; legacy v0.1/v0.2 policies used the wildcard.
WITH membership_rule AS (
    SELECT DISTINCT ON (p.ID)
        p.ID AS policy_id,
        r.idx - 1 AS pos,
        r.rule AS rule
    FROM AccessControlPolicies p
    CROSS JOIN LATERAL jsonb_array_elements(p.Data -> 'rules') WITH ORDINALITY AS r(rule, idx)
    WHERE p.Active
      AND jsonb_typeof(p.Data -> 'rules') = 'array'
      AND COALESCE(r.rule ->> 'name', '') = ''
      AND (r.rule -> 'actions' @> '"membership"'::jsonb OR r.rule -> 'actions' @> '"*"'::jsonb)
    ORDER BY p.ID, r.idx
)
UPDATE AccessControlPolicies p
SET Data = jsonb_set(
        p.Data,
        ARRAY['rules', m.pos::text, 'metadata'],
        COALESCE(m.rule -> 'metadata', '{}'::jsonb) || '{"auto_add": "always"}'::jsonb,
        true
    )
FROM membership_rule m
WHERE p.ID = m.policy_id
  -- Skip rules that already carry the mode so a re-run after a rollback does
  -- not overwrite a setting an administrator has since changed.
  AND m.rule -> 'metadata' -> 'auto_add' IS NULL
  AND (m.rule -> 'metadata' IS NULL OR jsonb_typeof(m.rule -> 'metadata') = 'object');

-- Policies that only import a parent have no rules of their own, so give them
-- an expression-less carrier rule to hold the mode. The carrier contributes
-- nothing to evaluation because the engine skips empty expressions.
UPDATE AccessControlPolicies p
SET Data = jsonb_set(
        COALESCE(p.Data, '{}'::jsonb),
        '{rules}',
        CASE WHEN jsonb_typeof(p.Data -> 'rules') = 'array' THEN p.Data -> 'rules' ELSE '[]'::jsonb END
            || '[{"actions": ["membership"], "expression": "", "metadata": {"auto_add": "always"}}]'::jsonb,
        true
    )
WHERE p.Active
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(p.Data -> 'rules') = 'array' THEN p.Data -> 'rules' ELSE '[]'::jsonb END
      ) AS rule
      WHERE COALESCE(rule ->> 'name', '') = ''
        AND (rule -> 'actions' @> '"membership"'::jsonb OR rule -> 'actions' @> '"*"'::jsonb)
  );
