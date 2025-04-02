CREATE OR REPLACE VIEW PropertyView AS
  SELECT
	pv.GroupID,
	pv.TargetID,
	jsonb_object_agg(pf.Name, pv.Value) AS Properties
  FROM PropertyValues pv
  LEFT JOIN PropertyFields pf ON pf.ID = pv.FieldID
  GROUP BY pv.GroupID, pv.TargetID;
