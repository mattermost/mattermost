-- Give graph-typed property values a projection of their own in both attribute
-- views.
--
-- The views flatten every property value into one JSON object per object, keyed
-- by field name, and that object is what an access-control rule reads. Each
-- option-bearing type resolves its value to something a rule can use: select
-- yields the option's name, multiselect an array of names, rank a name and a
-- rank. A graph value had no branch and fell through to the catch-all, which
-- projects the stored value as it is -- an array of the option identifiers the
-- object holds. That is the right shape, for two reasons the catch-all neither
-- states nor preserves:
--
--   * Identifiers rather than names, because a rule over a hierarchy is
--     compiled against the identifiers of the options at or above the ones it
--     names, and identifiers survive an option being renamed.
--   * The held options only, with no ancestors mixed in, because that
--     at-or-above set is computed when the rule is compiled. The view never has
--     to walk PropertyOptionEdges.
--
-- Stating the branch also stops the next type added to property_field_type from
-- inheriting graph's meaning by accident, and lets the branch do two things the
-- catch-all cannot: drop the identifiers of options that have since been
-- deleted, as select, multiselect, and rank all do, and always project an array,
-- so a rule can apply an array operator to it without testing its type first.
--
-- Every other type's projection is byte-identical to 000217's.

DROP MATERIALIZED VIEW IF EXISTS UserAttributeView;
DROP MATERIALIZED VIEW IF EXISTS ChannelAttributeView;

CREATE MATERIALIZED VIEW IF NOT EXISTS UserAttributeView AS
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

CREATE MATERIALIZED VIEW IF NOT EXISTS ChannelAttributeView AS
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
