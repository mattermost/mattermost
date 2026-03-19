UPDATE AccessControlPolicies AS p
SET Name = LEFT(p.Name, 128 - LENGTH(' (' || p.ID || ')')) || ' (' || p.ID || ')'
FROM (
    SELECT ID, Name, ROW_NUMBER() OVER (PARTITION BY Name ORDER BY CreateAt ASC) AS rn
    FROM AccessControlPolicies
    WHERE Type = 'parent'
) AS dupes
WHERE p.ID = dupes.ID
  AND dupes.rn > 1;
