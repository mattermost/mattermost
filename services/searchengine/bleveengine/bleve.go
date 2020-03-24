package bleveengine

import (
	"fmt"

	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v5/jobs"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"

	"github.com/blugelabs/bleve"
	"github.com/blugelabs/bleve/analysis/analyzer/keyword"
	"github.com/blugelabs/bleve/analysis/analyzer/standard"
	"github.com/blugelabs/bleve/mapping"
	"github.com/blugelabs/bleve/search/query"
)

type BleveEngine struct {
	postIndex    bleve.Index
	userIndex    bleve.Index
	channelIndex bleve.Index
	cfg          *model.Config
	jobServer    *jobs.JobServer
	indexSync bool
}

var emailRegex = regexp.MustCompile(`^[^\s"]+@[^\s"]+$`)

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

func (b *BleveEngine) IsIndexingSync() bool {
	return b.indexSync
}

func (b *BleveEngine) RefreshIndexes() *model.AppError {
	return nil
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
	channelQueries := []query.Query{}
	for _, channel := range *channels {
		channelIdQ := bleve.NewTermQuery(channel.Id)
		channelIdQ.SetField("ChannelId")
		channelQueries = append(channelQueries, channelIdQ)
	}
	channelDisjunctionQ := bleve.NewDisjunctionQuery(channelQueries...)

	termQueries := []query.Query{}
	filters := []query.Query{}
	notFilters := []query.Query{}
	for i, params := range searchParams {
		// ToDo: needs email filtering
		/*
           Not valid, probably will be TermQueries on the emails

		newTerms := []string{}
		for _, term := range strings.Split(params.Terms, " ") {
			if emailRegex.MatchString(term) {
				term = `"` + term + `"`
			}
			newTerms = append(newTerms, term)
		}

		params.Terms = strings.Join(newTerms, " ")
        */

		// Date, channels and FromUsers filters come in all
		// searchParams iteration, and as they are global to the
		// query, we only need to process them once
		if i == 0 {
			if len(params.InChannels) > 0 {
				for _, channelId := range params.InChannels {
					channelQ := bleve.NewTermQuery(channelId)
					channelQ.SetField("ChannelId")
					filters = append(filters, channelQ)
				}
			}

			if len(params.ExcludedChannels) > 0 {
				for _, channelId := range params.ExcludedChannels {
					channelQ := bleve.NewTermQuery(channelId)
					channelQ.SetField("ChannelId")
					notFilters = append(notFilters, channelQ)
				}
			}

			if len(params.FromUsers) > 0 {
				for _, userId := range params.FromUsers {
					userQ := bleve.NewTermQuery(userId)
					userQ.SetField("UserId")
					filters = append(filters, userQ)
				}
			}

			if len(params.ExcludedUsers) > 0 {
				for _, userId := range params.FromUsers {
					userQ := bleve.NewTermQuery(userId)
					userQ.SetField("UserId")
					notFilters = append(notFilters, userQ)
				}
			}
		}

		messageQ := bleve.NewQueryStringQuery(params.Terms)
		// messageQ.SetField("Message") // ToDo: override default field
		termQueries = append(termQueries, messageQ)
	}

	var allTermsQ query.Query
	if searchParams[0].OrTerms {
		allTermsQ = bleve.NewDisjunctionQuery(termQueries...)
	} else {
		allTermsQ = bleve.NewConjunctionQuery(termQueries...)
	}

	// ToDo: SIMPLE APPROACH
	query := bleve.NewBooleanQuery()
	query.AddMust(
		channelDisjunctionQ,
		allTermsQ,
	)
	if len(filters) > 0 {
		query.AddMust(bleve.NewConjunctionQuery(filters...))
	}
	if len(notFilters) > 0 {
		query.AddMustNot(notFilters...)
	}

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

	// ToDo: COMPLEX APPROACH
	// loop over params
	//  > compares term splits with email and adds it to newTerms
	//  > decides on or/and depending on searchParams[0].OrTerms
	//  > processes date, channels and fromusers filters on i == 0
	//    > len(InChannels) > 0
	//    > len(ExcludedChannels) > 0
	//    > len(FromUsers) > 0
	//    > len(ExcludedUsers) > 0
	//    > OnDate != 0
	//    > else
	//
	//  > IsHashtag ?
	//  > else

	// build queries
	// build highlight queries

	// return nil, nil, nil
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

	fmt.Println("====== USERS IN CHANNEL ======")
	fmt.Println(uchan)

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

	fmt.Println("==== USERS IN NOT CHANNEL ====")
	fmt.Println(nuchan)
	fmt.Println("==============================")

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

	var rootQ query.Query
	if term == "" && teamId == "" && restrictedToChannels == nil {
		rootQ = bleve.NewMatchAllQuery()
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

		if len(restrictedToChannels) > 0 {
			// restricted channels are already filtered by team, so we
			// can search only those matches
			restrictedChannelsQ := []query.Query{}
			for _, channelId := range restrictedToChannels {
				channelIdQ := bleve.NewTermQuery(channelId)
				channelIdQ.SetField("ChannelsIds")
				restrictedChannelsQ = append(restrictedChannelsQ, channelIdQ)
			}
			boolQ.AddMust(bleve.NewDisjunctionQuery(restrictedChannelsQ...))
		} else {
			// this means that we only need to restrict by team
			if teamId != "" {
				teamIdQ := bleve.NewTermQuery(teamId)
				teamIdQ.SetField("TeamsIds")
				boolQ.AddMust(teamIdQ)
			}
		}

		rootQ = boolQ
	}

	search := bleve.NewSearchRequest(rootQ)

	results, err := b.userIndex.Search(search)
	if err != nil {
		return nil, model.NewAppError("Bleveengine.SearchUsersInTeam", "bleveengine.search_users_in_team.error", nil, err.Error(), http.StatusInternalServerError)
	}

	fmt.Println("======= USERS IN TEAM ========")
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

func (b *BleveEngine) UpdateConfig(cfg *model.Config) {
	b.cfg = cfg
}
