// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bleveengine

import (
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"sync/atomic"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/standard"
	"github.com/blevesearch/bleve/v2/mapping"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

const (
	EngineName   = "bleve"
	PostIndex    = "posts"
	FileIndex    = "files"
	UserIndex    = "users"
	ChannelIndex = "channels"
)

type BleveEngine struct {
	PostIndex    bleve.Index
	FileIndex    bleve.Index
	UserIndex    bleve.Index
	ChannelIndex bleve.Index
	Mutex        sync.RWMutex
	ready        int32
	cfg          *model.Config
	indexSync    bool
}

var keywordMapping *mapping.FieldMapping
var standardMapping *mapping.FieldMapping
var dateMapping *mapping.FieldMapping

func init() {
	keywordMapping = bleve.NewTextFieldMapping()
	keywordMapping.Analyzer = keyword.Name

	standardMapping = bleve.NewTextFieldMapping()
	standardMapping.Analyzer = standard.Name

	dateMapping = bleve.NewNumericFieldMapping()
}

func getChannelIndexMapping() *mapping.IndexMappingImpl {
	channelMapping := bleve.NewDocumentMapping()
	channelMapping.AddFieldMappingsAt("Id", keywordMapping)
	channelMapping.AddFieldMappingsAt("Type", keywordMapping)
	channelMapping.AddFieldMappingsAt("TeamId", keywordMapping)
	channelMapping.AddFieldMappingsAt("NameSuggest", keywordMapping)
	channelMapping.AddFieldMappingsAt("UserIDs", keywordMapping)
	channelMapping.AddFieldMappingsAt("TeamMemberIDs", keywordMapping)

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

func getFileIndexMapping() *mapping.IndexMappingImpl {
	fileMapping := bleve.NewDocumentMapping()
	fileMapping.AddFieldMappingsAt("Id", keywordMapping)
	fileMapping.AddFieldMappingsAt("CreatorId", keywordMapping)
	fileMapping.AddFieldMappingsAt("ChannelId", keywordMapping)
	fileMapping.AddFieldMappingsAt("CreateAt", dateMapping)
	fileMapping.AddFieldMappingsAt("Name", standardMapping)
	fileMapping.AddFieldMappingsAt("Content", standardMapping)
	fileMapping.AddFieldMappingsAt("Extension", keywordMapping)
	fileMapping.AddFieldMappingsAt("Content", standardMapping)

	indexMapping := bleve.NewIndexMapping()
	indexMapping.AddDocumentMapping("_default", fileMapping)

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

func NewBleveEngine(cfg *model.Config) *BleveEngine {
	return &BleveEngine{
		cfg: cfg,
	}
}

func (b *BleveEngine) getIndexDir(indexName string) string {
	return filepath.Join(*b.cfg.BleveSettings.IndexDir, indexName+".bleve")
}

func (b *BleveEngine) createOrOpenIndex(indexName string, mapping *mapping.IndexMappingImpl) (bleve.Index, error) {
	indexPath := b.getIndexDir(indexName)
	if index, err := bleve.Open(indexPath); err == nil {
		return index, nil
	}

	index, err := bleve.NewUsing(indexPath, mapping, "scorch", "scorch", map[string]any{
		"forceSegmentType":    "zap",
		"forceSegmentVersion": 15,
	})
	if err != nil {
		return nil, err
	}
	return index, nil
}

func (b *BleveEngine) openIndexes() *model.AppError {
	if atomic.LoadInt32(&b.ready) != 0 {
		return model.NewAppError("Bleveengine.Start", "bleveengine.already_started.error", nil, "", http.StatusInternalServerError)
	}

	var err error
	b.PostIndex, err = b.createOrOpenIndex(PostIndex, getPostIndexMapping())
	if err != nil {
		return model.NewAppError("Bleveengine.Start", "bleveengine.create_post_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	b.FileIndex, err = b.createOrOpenIndex(FileIndex, getFileIndexMapping())
	if err != nil {
		return model.NewAppError("Bleveengine.Start", "bleveengine.create_file_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	b.UserIndex, err = b.createOrOpenIndex(UserIndex, getUserIndexMapping())
	if err != nil {
		return model.NewAppError("Bleveengine.Start", "bleveengine.create_user_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	b.ChannelIndex, err = b.createOrOpenIndex(ChannelIndex, getChannelIndexMapping())
	if err != nil {
		return model.NewAppError("Bleveengine.Start", "bleveengine.create_channel_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	atomic.StoreInt32(&b.ready, 1)
	return nil
}

func (b *BleveEngine) Start() *model.AppError {
	if !*b.cfg.BleveSettings.EnableIndexing || *b.cfg.BleveSettings.IndexDir == "" {
		return nil
	}

	b.Mutex.Lock()
	defer b.Mutex.Unlock()

	mlog.Info("EXPERIMENTAL: Starting Bleve")

	return b.openIndexes()
}

func (b *BleveEngine) closeIndexes() *model.AppError {
	if b.IsActive() {
		if err := b.PostIndex.Close(); err != nil {
			return model.NewAppError("Bleveengine.Stop", "bleveengine.stop_post_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if err := b.FileIndex.Close(); err != nil {
			return model.NewAppError("Bleveengine.Stop", "bleveengine.stop_file_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if err := b.UserIndex.Close(); err != nil {
			return model.NewAppError("Bleveengine.Stop", "bleveengine.stop_user_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if err := b.ChannelIndex.Close(); err != nil {
			return model.NewAppError("Bleveengine.Stop", "bleveengine.stop_channel_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	atomic.StoreInt32(&b.ready, 0)
	return nil
}

func (b *BleveEngine) Stop() *model.AppError {
	b.Mutex.Lock()
	defer b.Mutex.Unlock()

	mlog.Info("Stopping Bleve")

	return b.closeIndexes()
}

func (b *BleveEngine) IsActive() bool {
	return atomic.LoadInt32(&b.ready) == 1
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

func (b *BleveEngine) GetFullVersion() string {
	return "0"
}

func (b *BleveEngine) GetPlugins() []string {
	return []string{}
}

func (b *BleveEngine) GetName() string {
	return EngineName
}

func (b *BleveEngine) TestConfig(cfg *model.Config) *model.AppError {
	return nil
}

func (b *BleveEngine) deleteIndexes() *model.AppError {
	if err := os.RemoveAll(b.getIndexDir(PostIndex)); err != nil {
		return model.NewAppError("Bleveengine.PurgeIndexes", "bleveengine.purge_post_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := os.RemoveAll(b.getIndexDir(UserIndex)); err != nil {
		return model.NewAppError("Bleveengine.PurgeIndexes", "bleveengine.purge_user_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := os.RemoveAll(b.getIndexDir(ChannelIndex)); err != nil {
		return model.NewAppError("Bleveengine.PurgeIndexes", "bleveengine.purge_channel_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := os.RemoveAll(b.getIndexDir(FileIndex)); err != nil {
		return model.NewAppError("Bleveengine.PurgeIndexes", "bleveengine.purge_file_index.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (b *BleveEngine) PurgeIndexes() *model.AppError {
	if *b.cfg.BleveSettings.IndexDir == "" {
		return nil
	}

	b.Mutex.Lock()
	defer b.Mutex.Unlock()

	mlog.Info("PurgeIndexes Bleve")
	if err := b.closeIndexes(); err != nil {
		return err
	}

	if err := b.deleteIndexes(); err != nil {
		return err
	}

	return b.openIndexes()
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
	b.Mutex.Lock()
	defer b.Mutex.Unlock()

	if reflect.DeepEqual(cfg.BleveSettings, b.cfg.BleveSettings) {
		return
	}

	mlog.Info("UpdateConf Bleve")

	if *cfg.BleveSettings.EnableIndexing != *b.cfg.BleveSettings.EnableIndexing || *cfg.BleveSettings.IndexDir != *b.cfg.BleveSettings.IndexDir {
		if err := b.closeIndexes(); err != nil {
			mlog.Error("Error closing Bleve indexes to update the config", mlog.Err(err))
			return
		}
		b.cfg = cfg
		if err := b.openIndexes(); err != nil {
			mlog.Error("Error opening Bleve indexes after updating the config", mlog.Err(err))
		}
		return
	}
	b.cfg = cfg
}
