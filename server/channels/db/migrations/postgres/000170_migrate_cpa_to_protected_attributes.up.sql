-- Update all fields belonging to the CPA group before renaming it.
-- Row-level locks only; bounded by the per-group field limit (~200 max).
-- PermissionValues is 'sysadmin' for admin-managed fields, 'member' for all
-- others so that regular users can write their own profile values through the
-- generic property API.
UPDATE PropertyFields
SET ObjectType        = 'user',
    TargetType        = 'system',
    PermissionField   = 'sysadmin',
    PermissionValues  = (CASE
                            WHEN Attrs->>'managed' = 'admin' THEN 'sysadmin'
                            ELSE 'member'
                        END)::permission_level,
    PermissionOptions = 'sysadmin'
WHERE GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'custom_profile_attributes');

-- Rename the group. Single-row update, non-blocking.
UPDATE PropertyGroups
SET Name = 'protected_attributes'
WHERE Name = 'custom_profile_attributes';

-- Recreate the materialized view with an ObjectType = 'user' filter so it
-- only materializes user-scoped attributes. Same drop+create pattern as
-- migration 000137.
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
WHERE (pv.DeleteAt = 0 OR pv.DeleteAt IS NULL)
  AND (pf.DeleteAt = 0 OR pf.DeleteAt IS NULL)
  AND pf.ObjectType = 'user'
GROUP BY pv.GroupID, pv.TargetID, pv.TargetType;
