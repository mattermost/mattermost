package actionitem

type ExternalNotification struct {
	ActionItem
}

type ActionItem struct {
	Id       int64             `json:"id"`
	Provider string            `json:"provider"`
	Type     string            `json:"type"`
	SourceID string            `json:"source_id"`
	UserId   string            `json:"user_id"`
	Title    string            `json:"title"`
	Body     string            `json:"body"`
	URL      string            `json:"url"`
	Metadata map[string]string `json:"metadata"`
}

type ActionItemCount struct {
	Provider string `json:"provider"`
	Type     string `json:"type"`
	Value    int64  `json:"value"`
}
