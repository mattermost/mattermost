CREATE TABLE IF NOT EXISTS ScheduledPosts (
	id VARCHAR(26) PRIMARY KEY,
	createat bigint(20),
	updateat bigint(20),
	userid VARCHAR(26) NOT NULL,
	channelid VARCHAR(26) NOT NULL,
	rootid VARCHAR(26),
	message text,
	props text,
	fileids text,
	priority text,
	scheduledat bigint(20) NOT NULL,
	processedat bigint(20),
	errorcode VARCHAR(200)
);
