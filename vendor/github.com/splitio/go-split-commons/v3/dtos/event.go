package dtos

// EventDTO struct mapping events json
type EventDTO struct {
	Key             string                 `json:"key"`
	TrafficTypeName string                 `json:"trafficTypeName"`
	EventTypeID     string                 `json:"eventTypeId"`
	Value           interface{}            `json:"value"`
	Timestamp       int64                  `json:"timestamp"`
	Properties      map[string]interface{} `json:"properties,omitempty"`
}

// Size returns a relatively accurate estimation of the size of the event
func (e *EventDTO) Size() int {
	size := 1024
	if e.Properties == nil {
		return size
	}

	for key, value := range e.Properties {
		size += len(key)
		switch typedValue := value.(type) {
		case string:
			size += len(typedValue)
		default:
		}
	}
	return size
}

// QueueStoredEventDTO maps the stored JSON object in redis by SDKs
type QueueStoredEventDTO struct {
	Metadata Metadata `json:"m"`
	Event    EventDTO `json:"e"`
}
