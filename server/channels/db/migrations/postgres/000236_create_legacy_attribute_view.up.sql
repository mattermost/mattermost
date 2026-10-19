-- Bring back AttributeView for servers still running a release from before
-- 000216 -- the last ESR, 11.10 -- while they share a database migrated past
-- it: during a rolling upgrade of a cluster, or after the binary is rolled back
-- without the database. Those servers read user attributes from AttributeView
-- and refresh it themselves (REFRESH MATERIALIZED VIEW AttributeView, at most
-- every 30 seconds when an access check needs a subject). Without it every one
-- of those reads fails, and with them file access, policy-gated joins, and the
-- membership sync job.
--
-- The body is UserAttributeView's, as 000223 left it, under the old name: user
-- attributes only -- which is all AttributeView ever held from 000177 on --
-- with option names resolved from PropertyOptions rather than the
-- Attrs->'options' blob 11.10 would have read. The blob is no longer
-- authoritative: upgraded code neither writes nor reads it, so a view built
-- from it would resolve options as they stood at the upgrade, and would resolve
-- nothing at all for any field upgraded code has written since.
--
-- Upgraded code never reads or refreshes this view. It is a compatibility shim
-- for the upgrade window, to be dropped -- together with the trigger 000237
-- adds -- once no supported release reads AttributeView.

CREATE MATERIALIZED VIEW IF NOT EXISTS AttributeView AS
SELECT
    pv.GroupID,
    pv.TargetID,
    pv.TargetType,
    jsonb_object_agg(
        pf.Name,
        CASE
            WHEN pf.Type = 'select' THEN (
                SELECT to_jsonb(po.Name)
                FROM PropertyOptions po
                WHERE po.ID = pv.Value #>> '{}'
                  AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
                  AND po.DeleteAt = 0
                LIMIT 1
            )
            WHEN pf.Type = 'multiselect' AND jsonb_typeof(pv.Value) = 'array' THEN (
                SELECT jsonb_agg(po.Name)
                FROM jsonb_array_elements_text(pv.Value) AS option_id
                JOIN PropertyOptions po
                  ON po.ID = option_id
                 AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
                 AND po.DeleteAt = 0
            )
            WHEN pf.Type = 'rank' THEN (
                SELECT jsonb_build_object(
                    'name', po.Name,
                    'rank', po.Rank
                )
                FROM PropertyOptions po
                WHERE po.ID = pv.Value #>> '{}'
                  AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
                  AND po.DeleteAt = 0
                LIMIT 1
            )
            -- 11.10 has no graph type, so nothing it evaluates reads these. The
            -- branches are kept anyway so the two views agree on every row.
            WHEN pf.Type = 'graph' AND jsonb_typeof(pv.Value) = 'array' THEN COALESCE((
                SELECT jsonb_agg(po.ID)
                FROM jsonb_array_elements_text(pv.Value) AS option_id
                JOIN PropertyOptions po
                  ON po.ID = option_id
                 AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
                 AND po.DeleteAt = 0
            ), '[]'::jsonb)
            WHEN pf.Type = 'graph' THEN '[]'::jsonb
            ELSE pv.Value
        END
    ) AS Attributes
FROM PropertyValues pv
LEFT JOIN PropertyFields pf ON pf.ID = pv.FieldID
WHERE (pv.DeleteAt = 0 OR pv.DeleteAt IS NULL)
  AND (pf.DeleteAt = 0 OR pf.DeleteAt IS NULL)
  AND pf.ObjectType = 'user'
GROUP BY pv.GroupID, pv.TargetID, pv.TargetType;
