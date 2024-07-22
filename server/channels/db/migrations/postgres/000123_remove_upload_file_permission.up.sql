DO $$
<<remove_upload_file_permission>>
DECLARE
  rows_updated integer;
BEGIN
  LOOP
    WITH table_holder AS (
      SELECT id FROM roles
          WHERE permissions ~~ '%upload_file%' AND permissions !~ 'create_post($|\s)'
          ORDER BY id ASC limit 100
    )

    UPDATE Roles r set permissions = REGEXP_REPLACE(permissions, 'upload_file($|\s)', '') 
        WHERE r.id in (SELECT id FROM table_holder);
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated < 100;
  END LOOP;
END remove_upload_file_permission $$;
