package bleveengine

import (
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/jobs"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"

	"github.com/blevesearch/bleve"
	"github.com/blevesearch/bleve/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/mapping"
)

type BleveEngine struct {
	postIndex    bleve.Index
	userIndex    bleve.Index
	channelIndex bleve.Index
	cfg          *model.Config
	jobServer    *jobs.JobServer
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

func getChannelsIndexMapping() *mapping.IndexMappingImpl {
	keywordMapping := bleve.NewTextFieldMapping()
	keywordMapping.Analyzer = keyword.Name

	channelMapping := bleve.NewDocumentMapping()
	channelMapping.AddFieldMappingsAt("TeamId", keywordMapping)
	channelMapping.AddFieldMappingsAt("NameSuggest", keywordMapping)

	indexMapping := bleve.NewIndexMapping()
	indexMapping.AddDocumentMapping("_default", channelMapping)

	return indexMapping
}

func getPostsIndexMapping() *mapping.IndexMappingImpl {
	return bleve.NewIndexMapping()
}

func getUsersIndexMapping() *mapping.IndexMappingImpl {
	return bleve.NewIndexMapping()
}

func createOrOpenIndex(cfg *model.Config, indexName string, mapping *mapping.IndexMappingImpl) (bleve.Index, error) {
	// ToDo: Check if indexDir exists and create it if it doesn't

	indexPath := filepath.Join(*cfg.BleveSettings.IndexDir, indexName+".bleve")
	if index, err := bleve.Open(indexPath); err == nil {
		return index, nil
	}

	index, err := bleve.New(indexPath, mapping)
	if err != nil {
		return nil, err
	}
	return index, nil
}

func NewBleveEngine(cfg *model.Config, license *model.License, jobServer *jobs.JobServer) (*BleveEngine, error) {
	postIndex, err := createOrOpenIndex(cfg, "posts", getPostsIndexMapping())
	if err != nil {
		return nil, err
	}

	userIndex, err := createOrOpenIndex(cfg, "users", getUsersIndexMapping())
	if err != nil {
		return nil, err
	}

	channelIndex, err := createOrOpenIndex(cfg, "channels", getChannelsIndexMapping())
	if err != nil {
		return nil, err
	}

	return &BleveEngine{
		postIndex:    postIndex,
		userIndex:    userIndex,
		channelIndex: channelIndex,
		cfg:          cfg,
		jobServer:    jobServer,
	}, nil
}

func (b *BleveEngine) Start() *model.AppError {
	mlog.Warn("Start Bleve")
	return nil
}

func (b *BleveEngine) Stop() *model.AppError {
	mlog.Warn("Stop Bleve")
	return nil
}

func (b *BleveEngine) IsActive() bool {
	return *b.cfg.BleveSettings.EnableIndexing
}

func (b *BleveEngine) GetVersion() int {
	return 0
}

func (b *BleveEngine) GetName() string {
	return "bleve"
}

func (b *BleveEngine) IndexPost(post *model.Post, teamId string) *model.AppError {
	mlog.Warn("IndexPost Bleve")
	// ToDo: Check what do we need to index
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
	b.postIndex.Index(post.Id, searchPost)
	return nil
}

func (b *BleveEngine) SearchPosts(channels *model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, model.PostSearchMatches, *model.AppError) {
	mlog.Warn("SearchPosts Bleve")
	return nil, nil, nil
}

func (b *BleveEngine) DeletePost(post *model.Post) *model.AppError {
	mlog.Warn("DeletePost Bleve")
	return nil
}

func (b *BleveEngine) IndexChannel(channel *model.Channel) *model.AppError {
	mlog.Warn("IndexChannel Bleve")
	blvChannel := BLVChannelFromChannel(channel)
	b.channelIndex.Index(blvChannel.Id, blvChannel) // ToDo: error control
	return nil
}

func (b *BleveEngine) SearchChannels(teamId, term string) ([]string, *model.AppError) {
	teamIdQ := bleve.NewTermQuery(teamId)
	teamIdQ.SetField("TeamId")

	nameSuggestQ := bleve.NewPrefixQuery(term)
	nameSuggestQ.SetField("NameSuggest")

	query := bleve.NewSearchRequest(bleve.NewConjunctionQuery(teamIdQ, nameSuggestQ))
	results, err := b.channelIndex.Search(query)
	if err != nil {
		return nil, model.NewAppError("Bleveengine.SearchChannels", "bleveengine.search_channels.error", nil, err.Error(), http.StatusInternalServerError)
	}

	channelIds := []string{}
	for _, result := range results.Hits {
		channelIds = append(channelIds, result.ID)
	}

	return channelIds, nil
}

func (b *BleveEngine) DeleteChannel(channel *model.Channel) *model.AppError {
	mlog.Warn("DeleteChannel Bleve")
	return nil
}

func (b *BleveEngine) IndexUser(user *model.User, teamsIds, channelsIds []string) *model.AppError {
	mlog.Warn("IndexUser Bleve")
	blvUser := BLVUserFromUserAndTeams(user, teamsIds, channelsIds)
	b.userIndex.Index(blvUser.Id, blvUser) // ToDo: error control
	return nil
}

func (b *BleveEngine) SearchUsersInChannel(teamId, channelId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, []string, *model.AppError) {
	mlog.Warn("SearchUsersInChannel Bleve")
	query := bleve.NewPrefixQuery(term)
	search := bleve.NewSearchRequest(query)
	search.Fields = []string{"SuggestionsWithFullname"}
	results, err := b.userIndex.Search(search)
	if err != nil {
		panic(err)
		// return nil, nil, err
	}

	/*
		       -------------------------------------
			   - uchan
			   -------------------------------------

		       PrefixQuery term
		       TermQuery channelId
	*/

	/*
		       -------------------------------------
			   - nuchan
			   -------------------------------------

		       PrefixQuery term
		       negative TermQuery channelId
		       one TermQuery for each restrictedInChannels
	*/

	// uchan and nuchan
	for _, r := range results.Hits {
		mlog.Warn(">>>>>>>>> Result: " + r.ID)
	}

	return nil, nil, nil
}

func (b *BleveEngine) SearchUsersInTeam(teamId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, *model.AppError) {
	mlog.Warn("SearchUsersInTeam Bleve")
	return nil, nil
}

func (b *BleveEngine) DeleteUser(user *model.User) *model.AppError {
	mlog.Warn("DeleteUser Bleve")
	return nil
}

func (b *BleveEngine) TestConfig(cfg *model.Config) *model.AppError {
	mlog.Warn("TestConfig Bleve")
	return nil
}

func (b *BleveEngine) PurgeIndexes() *model.AppError {
	mlog.Warn("PurgeIndexes Bleve")
	return nil
}

func (b *BleveEngine) DataRetentionDeleteIndexes(cutoff time.Time) *model.AppError {
	return nil
}

func (b *BleveEngine) IsAutocompletionEnabled() bool {
	return *b.cfg.BleveSettings.EnableAutocomplete
}

func (b *BleveEngine) IsIndexingEnabled() bool {
	return *b.cfg.BleveSettings.EnableIndexing
}

func (b *BleveEngine) IsSearchEnabled() bool {
	return *b.cfg.BleveSettings.EnableSearching
}
