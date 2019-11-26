package bleveengine

import (
	"fmt"

	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/jobs"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"

	"github.com/blevesearch/bleve"
	"github.com/blevesearch/bleve/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/analysis/analyzer/standard"
	"github.com/blevesearch/bleve/mapping"
	"github.com/blevesearch/bleve/search/query"
)

type BleveEngine struct {
	postIndex    bleve.Index
	userIndex    bleve.Index
	channelIndex bleve.Index
	cfg          *model.Config
	jobServer    *jobs.JobServer
}

var keywordMapping *mapping.FieldMapping
var standardMapping *mapping.FieldMapping
var dateMapping *mapping.FieldMapping

func init() {
	keywordMapping = bleve.NewTextFieldMapping()
	keywordMapping.Analyzer = keyword.Name

	standardMapping = bleve.NewTextFieldMapping()
	standardMapping.Analyzer = standard.Name

	dateMapping = bleve.NewDateTimeFieldMapping()
	// ToDo: set a format?
}

func getChannelIndexMapping() *mapping.IndexMappingImpl {
	channelMapping := bleve.NewDocumentMapping()
	channelMapping.AddFieldMappingsAt("Id", keywordMapping)
	channelMapping.AddFieldMappingsAt("TeamId", keywordMapping)
	channelMapping.AddFieldMappingsAt("NameSuggest", keywordMapping)

	indexMapping := bleve.NewIndexMapping()
	indexMapping.AddDocumentMapping("_default", channelMapping)

	return indexMapping
}

func getPostIndexMapping() *mapping.IndexMappingImpl {
	postMapping := bleve.NewDocumentMapping()
	postMapping.AddFieldMappingsAt("Id", keywordMapping)
	postMapping.AddFieldMappingsAt("TeamId", keywordMapping)
	postMapping.AddFieldMappingsAt("ChannelId", keywordMapping)
	postMapping.AddFieldMappingsAt("UserId", keywordMapping)
	postMapping.AddFieldMappingsAt("CreateAt", dateMapping)
	postMapping.AddFieldMappingsAt("Message", standardMapping)
	postMapping.AddFieldMappingsAt("Type", keywordMapping)
	postMapping.AddFieldMappingsAt("Hashtags", standardMapping)
	postMapping.AddFieldMappingsAt("Attachments", standardMapping)

	indexMapping := bleve.NewIndexMapping()
	indexMapping.AddDocumentMapping("_default", postMapping)

	return indexMapping
}

func getUserIndexMapping() *mapping.IndexMappingImpl {
	userMapping := bleve.NewDocumentMapping()
	userMapping.AddFieldMappingsAt("Id", keywordMapping)
	userMapping.AddFieldMappingsAt("SuggestionsWithFullname", keywordMapping)
	userMapping.AddFieldMappingsAt("SuggestionsWithoutFullname", keywordMapping)
	userMapping.AddFieldMappingsAt("TeamsIds", keywordMapping)
	userMapping.AddFieldMappingsAt("ChannelsIds", keywordMapping)

	indexMapping := bleve.NewIndexMapping()
	indexMapping.AddDocumentMapping("_default", userMapping)

	return indexMapping
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

func NewBleveEngine(cfg *model.Config, jobServer *jobs.JobServer) (*BleveEngine, error) {
	postIndex, err := createOrOpenIndex(cfg, "posts", getPostIndexMapping())
	if err != nil {
		return nil, err
	}

	userIndex, err := createOrOpenIndex(cfg, "users", getUserIndexMapping())
	if err != nil {
		return nil, err
	}

	channelIndex, err := createOrOpenIndex(cfg, "channels", getChannelIndexMapping())
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
	blvPost := BLVPostFromPost(post, teamId)
	if err := b.postIndex.Index(blvPost.Id, blvPost); err != nil {
		return model.NewAppError("Bleveengine.IndexPost", "bleveengine.index_post.error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (b *BleveEngine) SearchPosts(channels *model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, model.PostSearchMatches, *model.AppError) {
	var channelQueries []query.Query
	for _, channel := range *channels {
		channelIdQ := bleve.NewTermQuery(channel.Id)
		channelIdQ.SetField("ChannelId")
	}

	// ToDo: needs to loop
	params := searchParams[0]
	// ToDo: needs email filtering
	messageQ := bleve.NewMatchQuery(params.Terms)
	messageQ.SetField("Message")
	// ToDo: SIMPLE APPROACH
	query := bleve.NewConjunctionQuery(append(channelQueries, messageQ)...)
	search := bleve.NewSearchRequest(query)
	results, err := b.postIndex.Search(search)
	if err != nil {
		return nil, nil, model.NewAppError("Bleveengine.SearchPosts", "bleveengine.search_posts.error", nil, err.Error(), http.StatusInternalServerError)
	}

	postIds := []string{}
	matches := model.PostSearchMatches{}

	fmt.Println("=========== POSTS ============")
	fmt.Println(results)
	fmt.Println("==============================")

	for _, r := range results.Hits {
		postIds = append(postIds, r.ID)
		// process highlight
		// matchesForPost, err := getMatchesForHit()
	}

	return postIds, matches, nil
}

func (b *BleveEngine) DeletePost(post *model.Post) *model.AppError {
	if err := b.postIndex.Delete(post.Id); err != nil {
		return model.NewAppError("Bleveengine.DeletePost", "bleveengine.delete_post.error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (b *BleveEngine) IndexChannel(channel *model.Channel) *model.AppError {
	blvChannel := BLVChannelFromChannel(channel)
	if err := b.channelIndex.Index(blvChannel.Id, blvChannel); err != nil {
		return model.NewAppError("Bleveengine.IndexChannel", "bleveengine.index_channel.error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (b *BleveEngine) SearchChannels(teamId, term string) ([]string, *model.AppError) {
	teamIdQ := bleve.NewTermQuery(teamId)
	teamIdQ.SetField("TeamId")

	nameSuggestQ := bleve.NewPrefixQuery(strings.ToLower(term))
	nameSuggestQ.SetField("NameSuggest")

	query := bleve.NewSearchRequest(bleve.NewConjunctionQuery(teamIdQ, nameSuggestQ))
	results, err := b.channelIndex.Search(query)
	if err != nil {
		return nil, model.NewAppError("Bleveengine.SearchChannels", "bleveengine.search_channels.error", nil, err.Error(), http.StatusInternalServerError)
	}

	fmt.Println("========= CHANNELS ===========")
	fmt.Println(results)
	fmt.Println("==============================")

	channelIds := []string{}
	for _, result := range results.Hits {
		channelIds = append(channelIds, result.ID)
	}

	return channelIds, nil
}

func (b *BleveEngine) DeleteChannel(channel *model.Channel) *model.AppError {
	if err := b.channelIndex.Delete(channel.Id); err != nil {
		return model.NewAppError("Bleveengine.DeleteChannel", "bleveengine.delete_channel.error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (b *BleveEngine) IndexUser(user *model.User, teamsIds, channelsIds []string) *model.AppError {
	blvUser := BLVUserFromUserAndTeams(user, teamsIds, channelsIds)
	if err := b.userIndex.Index(blvUser.Id, blvUser); err != nil {
		return model.NewAppError("Bleveengine.IndexUser", "bleveengine.index_user.error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (b *BleveEngine) SearchUsersInChannel(teamId, channelId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, []string, *model.AppError) {
	if restrictedToChannels != nil && len(restrictedToChannels) == 0 {
		return []string{}, []string{}, nil
	}
	/*
		       -------------------------------------
			   - uchan
			   -------------------------------------

		       PrefixQuery term
		       TermQuery channelId
	*/

	var queries []query.Query
	if term != "" {
		termQ := bleve.NewPrefixQuery(strings.ToLower(term))
		if options.AllowFullNames {
			termQ.SetField("SuggestionsWithFullname")
		} else {
			termQ.SetField("SuggestionsWithoutFullname")
		}
		queries = append(queries, termQ)
	}

	channelIdQ := bleve.NewTermQuery(channelId)
	channelIdQ.SetField("ChannelsIds")
	queries = append(queries, channelIdQ)

	query := bleve.NewConjunctionQuery(queries...)

	uchan, err := b.userIndex.Search(bleve.NewSearchRequest(query))
	if err != nil {
		return nil, nil, model.NewAppError("Bleveengine.SearchUsersInChannel", "bleveengine.search_users_in_channel.uchan.error", nil, err.Error(), http.StatusInternalServerError)
	}

	fmt.Println("=========== USERS ============")
	fmt.Println(uchan)
	fmt.Println("==============================")

	// --------------- end uchan

	/*
		       -------------------------------------
			   - nuchan
			   -------------------------------------

		       PrefixQuery term
		       negative TermQuery channelId
		       one TermQuery for each restrictedInChannels
	*/

	boolQ := bleve.NewBooleanQuery()

	if term != "" {
		termQ := bleve.NewPrefixQuery(strings.ToLower(term))
		if options.AllowFullNames {
			termQ.SetField("SuggestionsWithFullname")
		} else {
			termQ.SetField("SuggestionsWithoutFullname")
		}
		boolQ.AddMust(termQ)
	}

	teamIdQ := bleve.NewTermQuery(teamId)
	teamIdQ.SetField("TeamsIds")
	boolQ.AddMust(teamIdQ)

	// ToDo: here we reuse channelIdQ var
	channelIdQ = bleve.NewTermQuery(channelId)
	channelIdQ.SetField("ChannelsIds")
	boolQ.AddMustNot(channelIdQ)

	if len(restrictedToChannels) > 0 {
		for _, channelId := range restrictedToChannels {
			restrictedChannelQ := bleve.NewTermQuery(channelId)
			boolQ.AddMust(restrictedChannelQ)
		}
	}

	nuchan, err := b.userIndex.Search(bleve.NewSearchRequest(boolQ))
	if err != nil {
		return nil, nil, model.NewAppError("Bleveengine.SearchUsersInChannel", "bleveengine.search_users_in_channel.nuchan.error", nil, err.Error(), http.StatusInternalServerError)
	}

	// --------------- end nuchan

	uchanIds := []string{}
	for _, result := range uchan.Hits {
		uchanIds = append(uchanIds, result.ID)
	}

	nuchanIds := []string{}
	for _, result := range nuchan.Hits {
		nuchanIds = append(nuchanIds, result.ID)
	}

	return uchanIds, nuchanIds, nil
}

func (b *BleveEngine) SearchUsersInTeam(teamId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, *model.AppError) {
	if restrictedToChannels != nil && len(restrictedToChannels) == 0 {
		return []string{}, nil
	}

	var query query.Query
	if term == "" && teamId == "" && restrictedToChannels == nil {
		query = bleve.NewMatchAllQuery()
	} else {
		boolQ := bleve.NewBooleanQuery()

		if term != "" {
			termQ := bleve.NewPrefixQuery(strings.ToLower(term))
			if options.AllowFullNames {
				termQ.SetField("SuggestionsWithFullname")
			} else {
				termQ.SetField("SuggestionsWithoutFullname")
			}
			boolQ.AddMust(termQ)
		}

		if restrictedToChannels == nil {
			// this means that we only need to restrict by team
			if teamId != "" {
				teamIdQ := bleve.NewTermQuery(teamId)
				teamIdQ.SetField("TeamsIds")
				boolQ.AddMust(teamIdQ)
			}
		} else {
			// restricted channels are already filtered by team, so we
			// can search only those matches
			for _, channelId := range restrictedToChannels {
				channelIdQ := bleve.NewTermQuery(channelId)
				channelIdQ.SetField("ChannelsIds")
				boolQ.AddMust(channelIdQ)
			}
		}

		query = boolQ
	}

	results, err := b.userIndex.Search(bleve.NewSearchRequest(query))
	if err != nil {
		return nil, model.NewAppError("Bleveengine.SearchUsersInTeam", "bleveengine.search_users_in_team.error", nil, err.Error(), http.StatusInternalServerError)
	}

	fmt.Println("=========== USERS ============")
	fmt.Println(results)
	fmt.Println("==============================")

	usersIds := []string{}
	for _, r := range results.Hits {
		usersIds = append(usersIds, r.ID)
	}

	return usersIds, nil
}

func (b *BleveEngine) DeleteUser(user *model.User) *model.AppError {
	if err := b.userIndex.Delete(user.Id); err != nil {
		return model.NewAppError("Bleveengine.DeleteUser", "bleveengine.delete_user.error", nil, err.Error(), http.StatusInternalServerError)
	}
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
