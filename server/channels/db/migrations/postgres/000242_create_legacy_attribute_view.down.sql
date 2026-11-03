-- Put back the AttributeView that 000216 keeps, rather than dropping it: before
-- this migration the view still has its pre-upgrade definition (the 000200
-- one, user-scoped with the rank branch, resolving options from the
-- Attrs->'options' blob), and servers from before 000216 still read it.
-- A database migrated by v12.0.0, whose 000216 dropped the view, gains one
-- here; nothing upgraded reads it, and 000216's down migration keeps it.
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
