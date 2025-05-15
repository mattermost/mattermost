CREATE OR REPLACE PROCEDURE create_attribute_view()
LANGUAGE plpgsql
AS $$
BEGIN
    EXECUTE '
    CREATE MATERIALIZED VIEW IF NOT EXISTS AttributeView AS
	SELECT
        pv.GroupID,
        pv.TargetID,
        pv.TargetType,
        jsonb_object_agg(
            pf.Name,
            CASE
                WHEN pf.Type = ''select'' THEN (
                    SELECT to_jsonb(options.name)
                    FROM jsonb_to_recordset(pf.Attrs->''options'') AS options(id text, name text)
                    WHERE options.id = pv.Value #>> ''{}''
                    LIMIT 1
                )
                WHEN pf.Type = ''multiselect'' THEN (
                    SELECT jsonb_agg(option_names.name)
                    FROM jsonb_array_elements_text(pv.Value) AS option_id
                    JOIN jsonb_to_recordset(pf.Attrs->''options'') AS option_names(id text, name text)
                    ON option_id = option_names.id
                )
                ELSE pv.Value
            END
        ) AS Attributes    FROM PropertyValues pv
    LEFT JOIN PropertyFields pf ON pf.ID = pv.FieldID
    WHERE pv.DeleteAt = 0 OR pv.DeleteAt IS NULL
    GROUP BY pv.GroupID, pv.TargetID, pv.TargetType
        ';
END;
$$;

call create_attribute_view();
DROP PROCEDURE create_attribute_view();
