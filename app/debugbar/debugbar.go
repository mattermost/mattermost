package debugbar

import (
	"sync"

	"github.com/mattermost/mattermost-server/v6/model"
)

type DebugBar struct {
	userID  string
	publish func(*model.WebSocketEvent)
	mutex   sync.Mutex
}

func (db *DebugBar) SetUserID(userID string) {
	db.mutex.Lock()
	defer db.mutex.Unlock()
	db.userID = userID
}

func (db *DebugBar) SetPublish(publish func(*model.WebSocketEvent)) {
	db.mutex.Lock()
	defer db.mutex.Unlock()
	db.publish = publish
}

func (db *DebugBar) SendLogEvent(logLevel string, logMessage string, fields map[string]string) {
	if db.userID == "" || db.publish == nil {
		return
	}

	event := model.NewWebSocketEvent("debug", "", "", db.userID, nil, "")
	event.Add("time", model.GetMillis())
	event.Add("type", "log-line")
	event.Add("level", logLevel)
	event.Add("message", logMessage)
	event.Add("fields", fields)
	db.publish(event)
}

func (db *DebugBar) SendApiCall(endpoint, method, statusCode string, elapsed float64) {
	if db.userID == "" || db.publish == nil {
		return
	}

	event := model.NewWebSocketEvent("debug", "", "", db.userID, nil, "")
	event.Add("time", model.GetMillis())
	event.Add("type", "api-call")
	event.Add("endpoint", endpoint)
	event.Add("method", method)
	event.Add("statusCode", statusCode)
	event.Add("duration", elapsed)
	db.publish(event)
}

func (db *DebugBar) SendStoreCall(method string, success bool, elapsed float64) {
	if db.userID == "" || db.publish == nil {
		return
	}

	event := model.NewWebSocketEvent("debug", "", "", db.userID, nil, "")
	event.Add("time", model.GetMillis())
	event.Add("type", "store-call")
	event.Add("method", method)
	// event.Add("params", fmt.Sprintf("%v", []any{{`{`}}{{$element.Params | joinParams}}{{`}`}}))
	event.Add("success", success)
	event.Add("duration", elapsed)
	db.publish(event)
}

func (db *DebugBar) SendSqlQuery(query string, elapsed float64, args ...any) {
	if db.userID == "" || db.publish == nil {
		return
	}

	event := model.NewWebSocketEvent("debug", "", "", db.userID, nil, "")
	event.Add("time", model.GetMillis())
	event.Add("type", "sql-query")
	event.Add("query", query)
	event.Add("args", args)
	event.Add("duration", elapsed)
	db.publish(event)
}
