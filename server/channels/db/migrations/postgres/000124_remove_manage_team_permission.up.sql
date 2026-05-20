DO $$
<<remove_manage_team_permission>>
DECLARE
  rows_updated integer;
BEGIN
  LOOP
    WITH table_holder AS (
      SELECT id FROM roles
        WHERE Permissions ~ 'manage_team($|\s)'
            AND Permissions !~~ '%sysconsole_write_user_management_teams%'
            AND (Permissions ~~ '%sysconsole_write_user_management_channels%'
            OR Permissions ~~ '%sysconsole_write_user_management_groups%')
        ORDER BY id ASC limit 100
    )

    UPDATE Roles r set permissions = REGEXP_REPLACE(permissions, 'manage_team($|\s)', '') 
        WHERE r.id in (SELECT id FROM table_holder);
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated < 100;
  END LOOP;
END remove_manage_team_permission $$;
