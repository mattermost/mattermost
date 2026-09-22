-- Put the options of option-bearing property fields back inside
-- PropertyFields.Attrs->'options' and drop PropertyOptions and
-- PropertyOptionEdges.
--
-- Each field gets its effective option set written into its own blob -- its own
-- rows plus those of its link source -- which restores the state the blob was
-- in before the move, where a linked field held a copy of its template's
-- options under the same option IDs.
--
-- The merge below is the inverse of the column promotion the up migration
-- applies: the leftover keys in Attrs, then id and name from their columns, then
-- color and rank only where the column has a value, so an option that never
-- carried a color does not gain one.
--
-- The blob is cleared first because the rehydrate only writes fields that have
-- a live option row. A field whose options were all soft-deleted after the
-- upgrade joins nothing in "effective" below and would otherwise keep
-- whatever the blob last held, resurrecting an option that access-control
-- policies had stopped matching. Scoped the same way the up migration's
-- backfill selects its rows, so a field of a type that never carries options,
-- or one that was never backfilled, is left untouched.
--
-- Both statements run only while the up migration's completion sentinel is
-- present, so a second down -- which would find no PropertyOptions left to
-- rehydrate from -- is a no-op rather than an error. Both stay inside the
-- guard together: clearing the blob without rehydrating it would leave every
-- option-bearing field optionless.
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM Systems WHERE Name = 'PropertyOptionsBackfillComplete') > 0 THEN
UPDATE PropertyFields
   SET Attrs = Attrs - 'options'
 WHERE Type IN ('select', 'multiselect', 'rank', 'graph')
   AND jsonb_typeof(Attrs->'options') = 'array';

WITH hydrated AS (
    SELECT
        po.FieldID AS fieldid,
        po.SortOrder AS sortorder,
        po.CreateAt AS createat,
        po.ID AS optionid,
        CASE WHEN jsonb_typeof(po.Attrs) = 'object' THEN po.Attrs ELSE '{}'::jsonb END
            || jsonb_build_object('id', po.ID)
            || CASE WHEN po.Name IS NOT NULL THEN jsonb_build_object('name', po.Name) ELSE '{}'::jsonb END
            || CASE WHEN po.Color IS NOT NULL THEN jsonb_build_object('color', po.Color) ELSE '{}'::jsonb END
            || CASE WHEN po.Rank IS NOT NULL THEN jsonb_build_object('rank', po.Rank) ELSE '{}'::jsonb END
            AS opt
    FROM PropertyOptions po
    WHERE po.DeleteAt = 0
),
effective AS (
    SELECT
        pf.ID AS fieldid,
        jsonb_agg(h.opt ORDER BY h.sortorder, h.createat, h.optionid) AS options
    FROM PropertyFields pf
    JOIN hydrated h ON h.fieldid IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
    GROUP BY pf.ID
)
-- A field that only ever links to a template can hold a JSON null for Attrs --
-- it owns nothing, so nothing was ever written -- and jsonb_set cannot set a
-- path in a scalar.
UPDATE PropertyFields pf
   SET Attrs = jsonb_set(CASE WHEN jsonb_typeof(pf.Attrs) = 'object' THEN pf.Attrs ELSE '{}'::jsonb END, '{options}', e.options, true)
  FROM effective e
 WHERE pf.ID = e.fieldid;
    END IF;
END
$$;

-- Restore the 000216 view bodies verbatim: option names come back out of the
-- blob, and the effective-set scoping is unnecessary again because a linked
-- field's blob carries its own copy of the options.
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
                SELECT to_jsonb(options.name)
                FROM jsonb_to_recordset(pf.Attrs->'options') AS options(id text, name text)
                WHERE options.id = pv.Value #>> '{}'
                LIMIT 1
            )
            WHEN pf.Type = 'multiselect' AND jsonb_typeof(pv.Value) = 'array' THEN (
                SELECT jsonb_agg(option_names.name)
                FROM jsonb_array_elements_text(pv.Value) AS option_id
                JOIN jsonb_to_recordset(pf.Attrs->'options') AS option_names(id text, name text)
                ON option_id = option_names.id
            )
            WHEN pf.Type = 'rank' THEN (
                SELECT jsonb_build_object(
                    'name', options.name,
                    'rank', options.rank
                )
                FROM jsonb_to_recordset(pf.Attrs->'options')
                     AS options(id text, name text, rank int)
                WHERE options.id = pv.Value #>> '{}'
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

CREATE MATERIALIZED VIEW IF NOT EXISTS ChannelAttributeView AS
SELECT
    pv.GroupID,
    pv.TargetID,
    pv.TargetType,
    jsonb_object_agg(
        pf.Name,
        CASE
            WHEN pf.Type = 'select' THEN (
                SELECT to_jsonb(options.name)
                FROM jsonb_to_recordset(pf.Attrs->'options') AS options(id text, name text)
                WHERE options.id = pv.Value #>> '{}'
                LIMIT 1
            )
            WHEN pf.Type = 'multiselect' AND jsonb_typeof(pv.Value) = 'array' THEN (
                SELECT jsonb_agg(option_names.name)
                FROM jsonb_array_elements_text(pv.Value) AS option_id
                JOIN jsonb_to_recordset(pf.Attrs->'options') AS option_names(id text, name text)
                ON option_id = option_names.id
            )
            WHEN pf.Type = 'rank' THEN (
                SELECT jsonb_build_object(
                    'name', options.name,
                    'rank', options.rank
                )
                FROM jsonb_to_recordset(pf.Attrs->'options')
                     AS options(id text, name text, rank int)
                WHERE options.id = pv.Value #>> '{}'
                LIMIT 1
            )
            ELSE pv.Value
        END
    ) AS Attributes
FROM PropertyValues pv
LEFT JOIN PropertyFields pf ON pf.ID = pv.FieldID
WHERE (pv.DeleteAt = 0 OR pv.DeleteAt IS NULL)
  AND (pf.DeleteAt = 0 OR pf.DeleteAt IS NULL)
  AND pf.ObjectType = 'channel'
GROUP BY pv.GroupID, pv.TargetID, pv.TargetType;

DROP TABLE IF EXISTS PropertyOptions;
DROP TABLE IF EXISTS PropertyOptionEdges;

-- Delete the sentinel last, so an up after this down backfills again.
DELETE FROM Systems WHERE Name = 'PropertyOptionsBackfillComplete';
