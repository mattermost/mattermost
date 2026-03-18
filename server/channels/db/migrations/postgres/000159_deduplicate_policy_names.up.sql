UPDATE AccessControlPolicies AS p
SET Name = p.Name || ' (' || p.ID || ')'
FROM (
    SELECT ID, Name, ROW_NUMBER() OVER (PARTITION BY Name ORDER BY CreateAt ASC) AS rn
    FROM AccessControlPolicies
    WHERE Type = 'parent'
) AS dupes
WHERE p.ID = dupes.ID
  AND dupes.rn > 1;
