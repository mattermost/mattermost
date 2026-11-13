-- Rebuild AttributeView for servers still running a release from before
-- 000216 -- the last ESR, 11.10 -- while they share a database migrated past
-- it: during a rolling upgrade of a cluster, or after the binary is rolled back
-- without the database. Those servers read user attributes from AttributeView
-- and refresh it themselves (REFRESH MATERIALIZED VIEW AttributeView, at most
-- every 30 seconds when an access check needs a subject). Without it every one
-- of those reads fails, and with them file access, policy-gated joins, and the
-- membership sync job.
--
-- 000216 leaves the view in place, but the 000216 shipped in v12.0.0 dropped
-- it, so on a database migrated by that release this brings it back. Where the
-- view was kept it still has its pre-upgrade definition, and it is replaced
-- regardless: the drop and the create share this migration's transaction, so
-- a server reading the view meanwhile waits for the rebuild rather than
-- finding it missing.
--
-- The body is UserAttributeView's, as 000223 left it, under the old name: user
-- attributes only -- which is all AttributeView ever held from 000177 on --
-- with option names resolved from PropertyOptions rather than the
-- Attrs->'options' blob 11.10 would have read. The blob is no longer
-- authoritative: upgraded code neither writes nor reads it, so a view built
-- from it would resolve options as they stood at the upgrade, and would resolve
-- nothing at all for any field upgraded code has written since.
--
-- The one difference is that UserAttributeView's graph branches are left out.
-- 11.10 has no graph type, so no policy it evaluates can reference one, and a
-- graph value falls through to the stored value like any other type 11.10 does
-- not resolve.
--
-- Upgraded code never reads or refreshes this view. It is a compatibility shim
-- for the upgrade window, to be dropped once no supported release reads
-- AttributeView.

DROP MATERIALIZED VIEW IF EXISTS AttributeView;

CREATE MATERIALIZED VIEW AttributeView AS
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
            ELSE pv.Value
        END
    ) AS Attributes
FROM PropertyValues pv
LEFT JOIN PropertyFields pf ON pf.ID = pv.FieldID
WHERE (pv.DeleteAt = 0 OR pv.DeleteAt IS NULL)
  AND (pf.DeleteAt = 0 OR pf.DeleteAt IS NULL)
  AND pf.ObjectType = 'user'
GROUP BY pv.GroupID, pv.TargetID, pv.TargetType;
