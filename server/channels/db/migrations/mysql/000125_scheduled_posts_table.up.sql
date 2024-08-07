CREATE TABLE IF NOT EXISTS scheduledposts (
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
	processedaty bigint(20),
	errorcode VARCHAR(200)
);
