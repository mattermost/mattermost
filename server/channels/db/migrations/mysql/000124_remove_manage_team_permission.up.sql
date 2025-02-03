CREATE PROCEDURE RemoveUploadFilePermission()
BEGIN
    updateRoles: LOOP
        -- update affected rows
        UPDATE Roles 
            SET Permissions = REGEXP_REPLACE(Permissions, 'manage_team[[:space:]|?]', '')
            WHERE Permissions REGEXP 'manage_team[[:space:]|?]'
                AND Permissions not like '%sysconsole_write_user_management_teams%'
                AND (Permissions like '%sysconsole_write_user_management_channels%'
                OR Permissions like '%sysconsole_write_user_management_groups%')
            LIMIT 100;

          -- check if the loop has completed    
          IF  ROW_COUNT() < 100 THEN
              LEAVE updateRoles;
          END IF;    
    END LOOP updateRoles;
END;

CALL RemoveUploadFilePermission();
DROP PROCEDURE IF EXISTS RemoveUploadFilePermission;
