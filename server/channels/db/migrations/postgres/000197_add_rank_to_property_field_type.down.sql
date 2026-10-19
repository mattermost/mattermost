-- Postgres cannot remove a value from an existing enum in place, so rebuild
-- the type without 'rank'. Any rows still holding 'rank' (e.g. fields created
-- via the property API after this migration ran) are coerced to 'select'
-- first so the recreated enum can accept them; 'select' has the same storage
-- shape (single option ID).
--
-- The AttributeView materialized view reads PropertyFields.Type, so Postgres
-- refuses to rebuild the enum on that column while the view exists ("cannot
-- alter type of a column used by a view or rule"). Drop the view before the
-- ALTER and recreate it afterwards. At this point in the down sequence 000198's
-- down has already restored the no-rank view definition, so we recreate that
-- same definition (kept in sync with 000177 / 000198 down).

UPDATE PropertyFields SET Type = 'select' WHERE Type = 'rank';

DROP MATERIALIZED VIEW IF EXISTS AttributeView;

ALTER TYPE property_field_type RENAME TO property_field_type_old;

CREATE TYPE property_field_type AS ENUM (
    'text',
    'select',
    'multiselect',
    'date',
    'user',
    'multiuser'
);

ALTER TABLE PropertyFields
    ALTER COLUMN Type TYPE property_field_type USING Type::text::property_field_type;

DROP TYPE property_field_type_old;

-- Recreate the no-rank AttributeView (matches 000177 / 000198 down).
CREATE MATERIALIZED VIEW IF NOT EXISTS AttributeView AS
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
            ELSE pv.Value
        END
    ) AS Attributes
FROM PropertyValues pv
LEFT JOIN PropertyFields pf ON pf.ID = pv.FieldID
WHERE (pv.DeleteAt = 0 OR pv.DeleteAt IS NULL)
  AND (pf.DeleteAt = 0 OR pf.DeleteAt IS NULL)
  AND pf.ObjectType = 'user'
GROUP BY pv.GroupID, pv.TargetID, pv.TargetType;
