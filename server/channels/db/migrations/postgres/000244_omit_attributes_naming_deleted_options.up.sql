-- An attribute whose value names an option that is not live -- soft-deleted, or
-- outside the field's effective option set -- is left out of both attribute
-- views: the key is missing.
--
-- 000223 projected such a value as whatever was left of it: JSON null for a
-- select or rank, the live options only for a multiselect (null once none is
-- left), the live identifiers only for a graph ([] once none is left). Access
-- rules compare all of those as ordinary values, so deleting an option could
-- flip a user from denied to admitted under a negated rule: `null != "secret"`
-- is true, and so is `!hasAnyOf(["secret"])` once "secret" is dropped from
-- ["secret", "eng"]. A missing attribute is an error to the decision lane and
-- NULL to the SQL lanes, which only the other side of && or || can absorb, so
-- a deleted option can never be the reason for a grant, under any negation.
--
-- The cost, accepted with that decision: a multiselect or graph value that lost
-- one option loses the whole attribute, the options it still holds included,
-- until the value is rewritten.
--
-- A value that names no option at all -- an empty string, an empty array, a
-- graph value that is not an array -- projects as before. There is no deleted
-- option in it to grant through.
--
-- The values to leave out are found in one set-based pass ahead of the
-- projection: every option reference a value holds, anti-joined to the live
-- options of its field. A correlated lookup per value in the WHERE clause gives
-- the same rows but doubled the refresh time at 100k users, and a refresh holds
-- an exclusive lock that searches wait on. This pass adds about 2% to it.
--
-- A reference that does not resolve marks its value stale, and so does one that
-- is not a string: anything unexpected about a reference leaves the attribute
-- out rather than projecting it. A subject whose only attributes are left out
-- has no row at all, which every reader already treats as a subject holding
-- nothing.
--
-- The projection itself is 000223's, unchanged.

DROP MATERIALIZED VIEW IF EXISTS UserAttributeView;
DROP MATERIALIZED VIEW IF EXISTS ChannelAttributeView;

CREATE MATERIALIZED VIEW IF NOT EXISTS UserAttributeView AS
WITH live_options AS (
    SELECT pf.ID AS FieldID, po.ID AS OptionID
    FROM PropertyFields pf
    JOIN PropertyOptions po
      ON po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
     AND po.DeleteAt = 0
    WHERE pf.Type IN ('select', 'multiselect', 'rank', 'graph')
      AND pf.ObjectType = 'user'
      AND pf.DeleteAt = 0
),
-- A select or rank value is one option identifier; a multiselect or graph
-- value is an array of them.
held_options AS (
    SELECT pv.ID AS ValueID, pv.FieldID, held.OptionID
    FROM PropertyValues pv
    JOIN PropertyFields pf ON pf.ID = pv.FieldID
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(pv.Value) = 'array' THEN pv.Value ELSE jsonb_build_array(pv.Value) END
    ) AS held(OptionID)
    WHERE pv.DeleteAt = 0
      AND pf.DeleteAt = 0
      AND pf.ObjectType = 'user'
      AND ((pf.Type IN ('select', 'rank') AND jsonb_typeof(pv.Value) = 'string' AND pv.Value #>> '{}' <> '')
        OR (pf.Type IN ('multiselect', 'graph') AND jsonb_typeof(pv.Value) = 'array'))
),
stale_values AS (
    SELECT h.ValueID
    FROM held_options h
    LEFT JOIN live_options l ON l.FieldID = h.FieldID AND l.OptionID = h.OptionID #>> '{}'
    WHERE l.OptionID IS NULL OR jsonb_typeof(h.OptionID) <> 'string'
)
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
  AND NOT EXISTS (SELECT 1 FROM stale_values s WHERE s.ValueID = pv.ID)
GROUP BY pv.GroupID, pv.TargetID, pv.TargetType;

CREATE MATERIALIZED VIEW IF NOT EXISTS ChannelAttributeView AS
WITH live_options AS (
    SELECT pf.ID AS FieldID, po.ID AS OptionID
    FROM PropertyFields pf
    JOIN PropertyOptions po
      ON po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
     AND po.DeleteAt = 0
    WHERE pf.Type IN ('select', 'multiselect', 'rank', 'graph')
      AND pf.ObjectType = 'channel'
      AND pf.DeleteAt = 0
),
-- A select or rank value is one option identifier; a multiselect or graph
-- value is an array of them.
held_options AS (
    SELECT pv.ID AS ValueID, pv.FieldID, held.OptionID
    FROM PropertyValues pv
    JOIN PropertyFields pf ON pf.ID = pv.FieldID
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(pv.Value) = 'array' THEN pv.Value ELSE jsonb_build_array(pv.Value) END
    ) AS held(OptionID)
    WHERE pv.DeleteAt = 0
      AND pf.DeleteAt = 0
      AND pf.ObjectType = 'channel'
      AND ((pf.Type IN ('select', 'rank') AND jsonb_typeof(pv.Value) = 'string' AND pv.Value #>> '{}' <> '')
        OR (pf.Type IN ('multiselect', 'graph') AND jsonb_typeof(pv.Value) = 'array'))
),
stale_values AS (
    SELECT h.ValueID
    FROM held_options h
    LEFT JOIN live_options l ON l.FieldID = h.FieldID AND l.OptionID = h.OptionID #>> '{}'
    WHERE l.OptionID IS NULL OR jsonb_typeof(h.OptionID) <> 'string'
)
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
  AND NOT EXISTS (SELECT 1 FROM stale_values s WHERE s.ValueID = pv.ID)
GROUP BY pv.GroupID, pv.TargetID, pv.TargetType;
