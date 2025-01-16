package app


const (
	// Login Events
	TopicUserLoggedIn = "user_logged_in"
)

// UserLoggedInEvent represents the payload for a login event
type UserLoggedInEvent struct {
	UserID    string `json:"user_id"`
	UserAgent string `json:"user_agent"`
	IPAddress string `json:"ip_address"`
}

// Event schemas
var (
	userLoggedInSchema = []byte(`{
		"type": "object",
		"properties": {
			"user_id": {"type": "string"},
			"user_agent": {"type": "string"},
			"ip_address": {"type": "string"}
		},
		"required": ["user_id", "user_agent", "ip_address"]
	}`)
)

// InitSystemEventBus registers all system bus events and their schemas
func InitSystemEventBus(s *Server) error {
	if s.SystemBus() == nil {
		return nil
	}

	// Login events
	if err := s.SystemBus().RegisterTopic(TopicUserLoggedIn, "Event emitted when a user successfully logs in", userLoggedInSchema); err != nil {
		return err
	}

	return nil
}
