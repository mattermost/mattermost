CREATE TABLE IF NOT EXISTS TrueUpReviewHistory (
	DueDate VARCHAR(10),
	Completed boolean,
    PRIMARY KEY (duedate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
