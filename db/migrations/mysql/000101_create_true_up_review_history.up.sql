CREATE TABLE IF NOT EXISTS TrueUpReviewHistory (
	DueDate bigint(20),
	Completed boolean,
    PRIMARY KEY (duedate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
