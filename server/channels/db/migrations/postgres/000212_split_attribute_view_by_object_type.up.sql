-- Split the single AttributeView matview into per-object-type views so ABAC
-- policies can reference resource (channel) attributes independently of user
-- attributes, and so a change to one object type's attributes only forces a
-- refresh of its own view. UserAttributeView keeps the existing user-scoped
-- definition; ChannelAttributeView is the identical shape scoped to channels.
-- The two SELECTs differ only in the pf.ObjectType filter.
DROP MATERIALIZED VIEW IF EXISTS AttributeView;

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
