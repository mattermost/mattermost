-- Deduplicate parent policy names before adding unique constraint.
-- The oldest policy (by CreateAt) keeps its original name; duplicates get ' (<id>)' appended.
UPDATE AccessControlPolicies AS p
SET Name = LEFT(p.Name, 128 - LENGTH(' (' || p.ID || ')')) || ' (' || p.ID || ')'
FROM (
    SELECT ID, Name, ROW_NUMBER() OVER (PARTITION BY Name ORDER BY CreateAt ASC) AS rn
    FROM AccessControlPolicies
    WHERE Type = 'parent'
) AS dupes
WHERE p.ID = dupes.ID
  AND dupes.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_accesscontrolpolicies_name_type ON AccessControlPolicies (Name, Type) WHERE Type = 'parent';
