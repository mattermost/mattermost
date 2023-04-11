/* The sessions in the DB dup expired at March 31, 2023. We update those values to
   one hour (3600000 ms) from now so that the server does not remove the rows,
   since the script keeps them intact */
UPDATE Sessions SET ExpiresAt = ROUND(UNIX_TIMESTAMP(NOW(3))*1000) + 3600000;
