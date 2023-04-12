/* The sessions in the DB dump may have expired before the CI tests run, making
   the server remove the rows and generating a spurious diff that we want to avoid.
   In order to do so, we mark all sessions' ExpiresAt value to 0, so they never expire. */
UPDATE Sessions SET ExpiresAt = 0;
