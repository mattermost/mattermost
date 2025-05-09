CREATE MATERIALIZED VIEW IF NOT EXISTS AttributeView AS
  SELECT
	pv.GroupID,
	pv.TargetID,
	pv.TargetType,
	jsonb_object_agg(pf.Name, pv.Value) AS Attributes
  FROM PropertyValues pv
  LEFT JOIN PropertyFields pf ON pf.ID = pv.FieldID
  GROUP BY pv.GroupID, pv.TargetID, pv.TargetType;
