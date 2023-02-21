package debugbar

import (
	"os"

	"github.com/mattermost/mattermost-server/v6/model"
)

type DebugBar struct {
	publish func(*model.WebSocketEvent)
	enabled bool
}

func New(publish func(*model.WebSocketEvent)) *DebugBar {
	return &DebugBar{
		publish: publish,
		enabled: os.Getenv("MM_ENABLE_DEBUG_BAR") == "true",
	}
}

func (db *DebugBar) IsEnabled() bool {
	return db.enabled
}

func (db *DebugBar) SendLogEvent(logLevel string, logMessage string, fields map[string]string) {
	event := model.NewWebSocketEvent("debug", "", "", "", nil, "")
	event.Add("time", model.GetMillis())
	event.Add("type", "log-line")
	event.Add("level", logLevel)
	event.Add("message", logMessage)
	event.Add("fields", fields)
	db.publish(event)
}

func (db *DebugBar) SendApiCall(endpoint, method, statusCode string, elapsed float64) {
	event := model.NewWebSocketEvent("debug", "", "", "", nil, "")
	event.Add("time", model.GetMillis())
	event.Add("type", "api-call")
	event.Add("endpoint", endpoint)
	event.Add("method", method)
	event.Add("statusCode", statusCode)
	event.Add("duration", elapsed)
	db.publish(event)
}

func (db *DebugBar) SendStoreCall(method string, success bool, elapsed float64, params map[string]any) {
	event := model.NewWebSocketEvent("debug", "", "", "", nil, "")
	event.Add("time", model.GetMillis())
	event.Add("type", "store-call")
	event.Add("method", method)
	event.Add("params", params)
	event.Add("success", success)
	event.Add("duration", elapsed)
	db.publish(event)
}

func (db *DebugBar) SendSqlQuery(query string, elapsed float64, args ...any) {
	event := model.NewWebSocketEvent("debug", "", "", "", nil, "")
	event.Add("time", model.GetMillis())
	event.Add("type", "sql-query")
	event.Add("query", query)
	event.Add("args", args)
	event.Add("duration", elapsed)
	db.publish(event)
}
