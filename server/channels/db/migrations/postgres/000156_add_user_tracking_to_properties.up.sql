ALTER TABLE PropertyFields
ADD COLUMN IF NOT EXISTS CreatedBy varchar(26),
ADD COLUMN IF NOT EXISTS UpdatedBy varchar(26);

ALTER TABLE PropertyValues
ADD COLUMN IF NOT EXISTS CreatedBy varchar(26),
ADD COLUMN IF NOT EXISTS UpdatedBy varchar(26);
