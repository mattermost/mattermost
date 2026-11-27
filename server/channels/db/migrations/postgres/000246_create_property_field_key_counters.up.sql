-- One row per key field, holding the last number handed out. Numbers are never
-- reused, so nothing decrements it and the row outlives a deleted field.
CREATE TABLE IF NOT EXISTS PropertyFieldKeyCounters (
	FieldID varchar(26) PRIMARY KEY,
	LastValue bigint NOT NULL
);
