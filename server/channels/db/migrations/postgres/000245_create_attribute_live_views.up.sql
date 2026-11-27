-- Plain views over PropertyValues, read for one subject at a time, and the
-- attribute materialized views rebuilt on top of them.
--
-- Access checks read one user's or one channel's attributes. From the
-- materialized views that read was only as fresh as the last refresh, and the
-- refresh ran inline on request paths and on the websocket hub. A live view
-- filtered on TargetID and GroupID is a lookup on
-- idx_propertyvalues_targetid_groupid, so single-subject reads use these and
-- need no refresh.
--
-- The materialized views stay for the bulk readers (SearchUsers and the
-- members-to-remove queries), where recomputing every subject per query would
-- cost about as much as a refresh. They are now SELECT * FROM the live views,
-- so the two can't drift: the attribute projection is defined once, here.
-- Any later change to it edits UserAttributeLiveView and
-- ChannelAttributeLiveView, and then rebuilds the materialized views.
--
-- The bodies are 000223's, verbatim. The legacy AttributeView (000242) keeps
-- its own copy and is left alone.
--
-- Both materialized views are dropped and rebuilt (populated) inside this
-- migration's transaction, so a reader waits for the rebuild rather than
-- finding a view missing.

DROP MATERIALIZED VIEW IF EXISTS UserAttributeView;
DROP MATERIALIZED VIEW IF EXISTS ChannelAttributeView;

CREATE OR REPLACE VIEW UserAttributeLiveView AS
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
            -- The identifiers the object holds, keeping only options that still
            -- exist. Scoped to the field's effective option set -- its own
            -- options plus those of the field it links to -- because a field
            -- that links to a template holds none of the options it serves.
            -- COALESCE, because an aggregate over no rows is NULL, and a JSON
            -- null here would be a third case for every rule to handle: an
            -- object that holds only deleted options holds nothing, so it
            -- projects an empty array.
            WHEN pf.Type = 'graph' AND jsonb_typeof(pv.Value) = 'array' THEN COALESCE((
                SELECT jsonb_agg(po.ID)
                FROM jsonb_array_elements_text(pv.Value) AS option_id
                JOIN PropertyOptions po
                  ON po.ID = option_id
                 AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
                 AND po.DeleteAt = 0
            ), '[]'::jsonb)
            -- A graph value that is not an array names no options. Projecting it
            -- as it is would hand a rule a value to compare instead of a set to
            -- intersect, so it projects as holding nothing.
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

CREATE OR REPLACE VIEW ChannelAttributeLiveView AS
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
            -- As in UserAttributeView above: the identifiers the object holds,
            -- live options only, always an array.
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
  AND pf.ObjectType = 'channel'
GROUP BY pv.GroupID, pv.TargetID, pv.TargetType;

CREATE MATERIALIZED VIEW IF NOT EXISTS UserAttributeView AS
SELECT * FROM UserAttributeLiveView;

CREATE MATERIALIZED VIEW IF NOT EXISTS ChannelAttributeView AS
SELECT * FROM ChannelAttributeLiveView;
