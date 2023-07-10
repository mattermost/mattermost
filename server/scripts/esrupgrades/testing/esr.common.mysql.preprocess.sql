/* The sessions in the DB dump may have expired before the CI tests run, making
   the server remove the rows and generating a spurious diff that we want to avoid.
   In order to do so, we mark all sessions' ExpiresAt value to 0, so they never expire. */
UPDATE Sessions SET ExpiresAt = 0;

/* The dump may not contain a system-bot user, in which case the server will create
   one if it's not shutdown before a job requests it. This situation creates a flaky
   tests in which, in rare ocassions, the system-bot is indeed created, generating a
   spurious diff. We avoid this by making sure that there is a system-bot user and
   corresponding bot */
DELIMITER //
CREATE PROCEDURE AddSystemBotIfNeeded ()
BEGIN
	DECLARE CreateSystemBot BOOLEAN;
	SELECT COUNT(*) = 0 FROM Users WHERE Username = 'system-bot' INTO CreateSystemBot;
	IF CreateSystemBot THEN
		/* These values are retrieved from a real system-bot created by a server */
		INSERT INTO `Bots` VALUES ('nc7y5x1i8jgr9btabqo5m3579c','','phxrtijfrtfg7k4bwj9nophqyc',0,1681308600015,1681308600015,0);
		INSERT INTO `Users` VALUES ('nc7y5x1i8jgr9btabqo5m3579c',1681308600014,1681308600014,0,'system-bot','',NULL,'','system-bot@localhost',0,'','System','','','system_user',0,'{}','{\"push\": \"mention\", \"email\": \"true\", \"channel\": \"true\", \"desktop\": \"mention\", \"comments\": \"never\", \"first_name\": \"false\", \"push_status\": \"away\", \"mention_keys\": \"\", \"push_threads\": \"all\", \"desktop_sound\": \"true\", \"email_threads\": \"all\", \"desktop_threads\": \"all\"}',1681308600014,0,0,'en','{\"manualTimezone\": \"\", \"automaticTimezone\": \"\", \"useAutomaticTimezone\": \"true\"}',0,'',NULL);
	END IF;
END//
DELIMITER ;
CALL AddSystemBotIfNeeded();
