UPDATE Roles 
    SET Permissions = REPLACE(Permissions, 'upload_file', '')
    WHERE Permissions like '%upload_file%' and Permissions not REGEXP 'create_post[[:space:]|?]';
