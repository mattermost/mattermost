-- Strip the auto_add metadata and drop the carrier rules the up migration
-- added. Active was never modified, so the previous release picks auto-adding
-- back up from it as soon as it starts. Any change an administrator made to
-- auto_add after the upgrade is lost, since Active is the only place the old
-- release can read the setting from.
UPDATE AccessControlPolicies p
SET Data = jsonb_set(
        p.Data,
        '{rules}',
        COALESCE((
            SELECT jsonb_agg(stripped.rule ORDER BY stripped.idx)
            FROM (
                SELECT
                    r.idx AS idx,
                    CASE
                        WHEN (r.rule #- '{metadata,auto_add}') -> 'metadata' = '{}'::jsonb
                            THEN (r.rule #- '{metadata,auto_add}') - 'metadata'
                        ELSE r.rule #- '{metadata,auto_add}'
                    END AS rule
                FROM jsonb_array_elements(p.Data -> 'rules') WITH ORDINALITY AS r(rule, idx)
            ) AS stripped
            -- Drop rules left with nothing but a membership action and no
            -- expression: those are carriers, not policy content.
            WHERE NOT (
                COALESCE(stripped.rule ->> 'name', '') = ''
                AND COALESCE(stripped.rule ->> 'expression', '') = ''
                AND stripped.rule -> 'actions' = '["membership"]'::jsonb
                AND stripped.rule -> 'metadata' IS NULL
            )
        ), '[]'::jsonb),
        true
    )
WHERE jsonb_typeof(p.Data -> 'rules') = 'array'
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p.Data -> 'rules') AS rule
      WHERE rule -> 'metadata' -> 'auto_add' IS NOT NULL
         OR (
             -- Also clear carriers whose mode was cleared after the
             -- upgrade: the previous release rejects an expression-less rule
             -- when a policy is saved.
             COALESCE(rule ->> 'name', '') = ''
             AND COALESCE(rule ->> 'expression', '') = ''
             AND rule -> 'actions' = '["membership"]'::jsonb
         )
  );
