package dynamodb

type ReturnValues string

const (
	NONE        ReturnValues = "NONE"
	ALL_OLD     ReturnValues = "ALL_HOLD"
	UPDATED_OLD ReturnValues = "UPDATED_OLD"
	ALL_NEW     ReturnValues = "ALL_NEW"
	UPDATED_NEW ReturnValues = "UPDATED_NEW"
)
