CREATE TABLE IF NOT EXISTS trueupreviewhistory (
	duedate VARCHAR(10),
	completed boolean,
    PRIMARY KEY (duedate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
