-- Rename the group back to custom_profile_attributes.
UPDATE PropertyGroups
SET Name = 'custom_profile_attributes'
WHERE Name = 'protected_attributes';

-- Revert field metadata to the pre-migration state.
UPDATE PropertyFields
SET ObjectType        = '',
    TargetType        = '',
    PermissionField   = NULL,
    PermissionValues  = NULL,
    PermissionOptions = NULL
WHERE GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'custom_profile_attributes')
  AND ObjectType = 'user'
  AND TargetType = 'system';

-- Restore the materialized view without the ObjectType filter (000137 version).
DROP MATERIALIZED VIEW IF EXISTS AttributeView;

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
WHERE (pv.DeleteAt = 0 OR pv.DeleteAt IS NULL) AND (pf.DeleteAt = 0 OR pf.DeleteAt IS NULL)
GROUP BY pv.GroupID, pv.TargetID, pv.TargetType;
