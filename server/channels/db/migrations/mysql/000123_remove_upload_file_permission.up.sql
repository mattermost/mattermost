CREATE PROCEDURE RemoveUuploadFilePermission()
BEGIN
    updateRoles: LOOP
        -- update affected rows
        UPDATE Roles 
            SET Permissions = REGEXP_REPLACE(Permissions, 'upload_file([[:space:]]|$)', '')
            WHERE Permissions like '%upload_file%' and Permissions not REGEXP 'create_post([[:space:]]|$)'
            LIMIT 100;

          -- check if the loop has completed    
          IF  ROW_COUNT() < 100 THEN
              LEAVE updateRoles;
          END IF;    
    END LOOP updateRoles;
END;

CALL RemoveUuploadFilePermission();
DROP PROCEDURE IF EXISTS RemoveUuploadFilePermission;
