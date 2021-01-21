package push

import (
	"fmt"
	"github.com/splitio/go-toolkit/v3/common"
)

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

func (i *IncomingEvent) String() string {
	return fmt.Sprintf(`Incoming event [id="%s", ts=%d, enc="%s", data="%s", name="%s", client="%s", `+
		`event="%s", channel="%s", code=%d, status=%d]`,
		common.StringFromRef(i.id),
		common.Int64FromRef(i.timestamp),
		common.StringFromRef(i.encoding),
		common.StringFromRef(i.data),
		common.StringFromRef(i.name),
		common.StringFromRef(i.clientID),
		i.event,
		common.StringFromRef(i.channel),
		common.IntFromRef(i.code),
		common.IntFromRef(i.statusCode))
}

// Metrics dto
type Metrics struct {
	Publishers int `json:"publishers"`
}

// Occupancy dto
type Occupancy struct {
	Data Metrics `json:"metrics"`
}
