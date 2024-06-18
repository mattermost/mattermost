CREATE PROCEDURE RemoveUuploadFilePermission()
BEGIN
    updateRoles: LOOP
        -- update affected rows
        UPDATE Roles 
            SET Permissions = REGEXP_REPLACE(Permissions, 'manage_team[[:space:]|?]', '')
            WHERE Permissions like '%manage_team%'
                AND Permissions not like '%sysconsole_write_user_management_teams%'
                AND (Permissions like '%sysconsole_write_user_management_chanels%'
                OR Permissions like '%sysconsole_write_user_management_groups%')
            LIMIT 100;

          -- check if the loop has completed    
          IF  ROW_COUNT() < 100 THEN
              LEAVE updateRoles;
          END IF;    
    END LOOP updateRoles;
END;

CALL RemoveUuploadFilePermission();
DROP PROCEDURE IF EXISTS RemoveUuploadFilePermission;