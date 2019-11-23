package nullengine

import (
	"time"

	"github.com/mattermost/mattermost-server/model"
)

type NullEngine struct{}

func NewNullEngine() (*NullEngine, error) {
	return &NullEngine{}, nil
}

func (b *NullEngine) Start() *model.AppError {
	return nil
}

func (b *NullEngine) Stop() *model.AppError {
	return nil
}

func (b *NullEngine) IsActive() bool {
	return true
}

func (b *NullEngine) GetVersion() int {
	return 0
}

func (b *NullEngine) GetName() string {
	return "null"
}

func (b *NullEngine) IndexPost(post *model.Post, teamId string) *model.AppError {
	return nil
}

func (b *NullEngine) SearchPosts(channels *model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, model.PostSearchMatches, *model.AppError) {
	return nil, nil, nil
}

func (b *NullEngine) DeletePost(post *model.Post) *model.AppError {
	return nil
}

func (b *NullEngine) IndexChannel(channel *model.Channel) *model.AppError {
	return nil
}

func (b *NullEngine) SearchChannels(teamId, term string) ([]string, *model.AppError) {
	return nil, nil
}

func (b *NullEngine) DeleteChannel(channel *model.Channel) *model.AppError {
	return nil
}

func (b *NullEngine) IndexUser(user *model.User, teamsIds, channelsIds []string) *model.AppError {
	return nil
}

func (b *NullEngine) SearchUsersInChannel(teamId, channelId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, []string, *model.AppError) {
	return nil, nil, nil
}

func (b *NullEngine) SearchUsersInTeam(teamId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, *model.AppError) {
	return nil, nil
}

func (b *NullEngine) DeleteUser(user *model.User) *model.AppError {
	return nil
}

func (b *NullEngine) TestConfig(cfg *model.Config) *model.AppError {
	return nil
}

func (b *NullEngine) PurgeIndexes() *model.AppError {
	return nil
}

func (b *NullEngine) DataRetentionDeleteIndexes(cutoff time.Time) *model.AppError {
	return nil
}

func (b *NullEngine) IsAutocompletionEnabled() bool {
	return false
}

func (b *NullEngine) IsIndexingEnabled() bool {
	return false
}

func (b *NullEngine) IsSearchEnabled() bool {
	return false
}
