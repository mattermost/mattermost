ALTER TABLE IR_Incident ADD COLUMN IF NOT EXISTS ActiveStageTitle TEXT DEFAULT '';

CREATE OR REPLACE function json_array_length_safe(p_json text)
RETURNS integer
LANGUAGE plpgsql
AS
'
BEGIN
  RETURN json_array_length(p_json::json);
EXCEPTION
  WHEN OTHERS THEN
     RETURN -1;
END;
'
IMMUTABLE;

UPDATE ir_incident 
SET activestagetitle = checklistsjson::json->(activestage::INTEGER)->>'title'
WHERE json_array_length_safe(checklistsjson::text) > activestage
AND activestage >= 0;

DROP FUNCTION IF EXISTS json_array_length_safe;