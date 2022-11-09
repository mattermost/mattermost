package mocks

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/model/sort"
	"github.com/stretchr/testify/mock"
)

type HashtagStore struct {
	mock.Mock
}

func (h HashtagStore) UpdateOnPostOverwrite(posts []*model.Post) error {
	panic("implement me")
}

func (h HashtagStore) UpdateOnPostEdit(oldPost *model.Post, newPost *model.Post) error {
	//TODO implement me
	panic("implement me")
}

func (h HashtagStore) SearchForUser(phrase string, userId string) ([]*model.HashtagWithMessageCountSearch, error) {
	//TODO implement me
	panic("implement me")
}

func (h HashtagStore) Save(hashtag *model.Hashtag) (*model.Hashtag, error) {
	//TODO implement me
	panic("implement me")
}

func (h HashtagStore) SaveMultipleForPosts(posts []*model.Post) ([]*model.Hashtag, error) {
	//TODO implement me
	panic("implement me")
}

func (h HashtagStore) GetAll() ([]*model.Hashtag, error) {
	//TODO implement me
	panic("implement me")
}

func (h HashtagStore) GetMostCommon(s sort.Sort) ([]*model.HashtagWithMessageCount, error) {
	//TODO implement me
	panic("implement me")
}
