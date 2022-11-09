package model

type Hashtag struct {
	Id     string `json:"id"`
	PostId string `json:"post_id"`
	Value  string `json:"value"`
}

type HashtagWithMessageCount struct {
	Value    string
	Messages int64
}

type HashtagWithMessageCountSearch struct {
	Hashtag
	Messages int64
}
