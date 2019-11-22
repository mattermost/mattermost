package bleve

import (
	"strings"
	"time"

	"github.com/blevesearch/bleve"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
)

type Bleve struct {
	idx bleve.Index
	App *app.App
}

type BlevePost struct {
	Id        string   `json:"id"`
	TeamId    string   `json:"team_id"`
	ChannelId string   `json:"channel_id"`
	UserId    string   `json:"user_id"`
	CreateAt  int64    `json:"create_at"`
	Message   string   `json:"message"`
	Type      string   `json:"type"`
	Hashtags  []string `json:"hashtags"`
}

func (b *Bleve) Start() {
}

func (b *Bleve) IndexPost(post *model.Post, teamId string) *model.AppError {
	searchPost := BlevePost{
		Id:        post.Id,
		TeamId:    teamId,
		ChannelId: post.ChannelId,
		UserId:    post.UserId,
		CreateAt:  post.CreateAt,
		Message:   post.Message,
		Type:      post.Type,
		Hashtags:  strings.Split(post.Hashtags, " "),
	}
	b.idx.Index(post.Id, searchPost)
	return nil
}

func (b *Bleve) SearchPosts(channels *model.ChannelList, searchParams []*model.SearchParams) ([]string, *model.AppError) {
	// b.idx.Search(post.id)
	return nil, nil
}

func (b *Bleve) DeletePost(post *model.Post) *model.AppError {
	// b.idx.Delete(post.id)
	return nil
}

func (b *Bleve) TestConfig(cfg *model.Config) *model.AppError {
	return nil
}

func (b *Bleve) PurgeIndexes() *model.AppError {
	return nil
}

func (b *Bleve) DataRetentionDeleteIndexes(cutoff time.Time) *model.AppError {
	return nil
}
