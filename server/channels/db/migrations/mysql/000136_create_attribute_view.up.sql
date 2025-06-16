CREATE OR REPLACE VIEW AttributeView AS
  SELECT
       pv.GroupID,
       pv.TargetID,
       pv.TargetType,
       JSON_OBJECTAGG(pf.Name, pv.Value)
  AS Attributes
  FROM PropertyValues pv
  LEFT JOIN PropertyFields pf ON pf.ID = pv.FieldID
  GROUP BY GroupID, TargetID, TargetType;
  