package push

// IncomingEvent struct to process every kind of notification that comes from streaming
type IncomingEvent struct {
	id         *string
	timestamp  *int64
	encoding   *string
	data       *string
	name       *string
	clientID   *string
	event      string
	channel    *string
	message    *string
	code       *int
	statusCode *int
	href       *string
}

// Metrics dto
type Metrics struct {
	Publishers int `json:"publishers"`
}

// Occupancy dto
type Occupancy struct {
	Data Metrics `json:"metrics"`
}
