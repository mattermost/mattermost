// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

type SqlTermsOfServiceStore struct {
	SqlStore
	metrics einterfaces.MetricsInterface
}

var termsOfServiceCache = utils.NewLru(model.TERMS_OF_SERVICE_CACHE_SIZE)

const (
	termsOfServiceCacheName = "TermsOfServiceStore"
)

func NewSqlTermsOfServiceStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.TermsOfServiceStore {
	s := SqlTermsOfServiceStore{sqlStore, metrics}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.TermsOfService{}, "TermsOfService").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Text").SetMaxSize(model.POST_MESSAGE_MAX_BYTES_V2)
	}

	return s
}

func (s SqlTermsOfServiceStore) CreateIndexesIfNotExists() {
}

func (s SqlTermsOfServiceStore) Save(termsOfService *model.TermsOfService) (*model.TermsOfService, *model.AppError) {
	if len(termsOfService.Id) > 0 {
		return nil, model.NewAppError("SqlTermsOfServiceStore.Save", "store.sql_terms_of_service_store.save.existing.app_error", nil, "id="+termsOfService.Id, http.StatusBadRequest)
	}

	termsOfService.PreSave()

	if err := termsOfService.IsValid(); err != nil {
		return nil, err
	}

	if err := s.GetMaster().Insert(termsOfService); err != nil {
		return nil, model.NewAppError("SqlTermsOfServiceStore.Save", "store.sql_terms_of_service.save.app_error", nil, "terms_of_service_id="+termsOfService.Id+",err="+err.Error(), http.StatusInternalServerError)
	}

	termsOfServiceCache.AddWithDefaultExpires(termsOfService.Id, termsOfService)

	return termsOfService, nil
}

func (s SqlTermsOfServiceStore) GetLatest(allowFromCache bool) (*model.TermsOfService, *model.AppError) {
	if allowFromCache {
		if termsOfServiceCache.Len() != 0 {
			if cacheItem, ok := termsOfServiceCache.Get(termsOfServiceCache.Keys()[0]); ok {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheHitCounter(termsOfServiceCacheName)
				}

				return cacheItem.(*model.TermsOfService), nil
			}
		}
	}

	if s.metrics != nil {
		s.metrics.IncrementMemCacheMissCounter(termsOfServiceCacheName)
	}

	var termsOfService *model.TermsOfService

	err := s.GetReplica().SelectOne(&termsOfService, "SELECT * FROM TermsOfService ORDER BY CreateAt DESC LIMIT 1")
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlTermsOfServiceStore.GetLatest", "store.sql_terms_of_service_store.get.no_rows.app_error", nil, "err="+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlTermsOfServiceStore.GetLatest", "store.sql_terms_of_service_store.get.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}

	if allowFromCache {
		termsOfServiceCache.AddWithDefaultExpires(termsOfService.Id, termsOfService)
	}
	return termsOfService, nil
}

func (s SqlTermsOfServiceStore) Get(id string, allowFromCache bool) (*model.TermsOfService, *model.AppError) {
	if allowFromCache {
		if termsOfServiceCache.Len() != 0 {
			if cacheItem, ok := termsOfServiceCache.Get(id); ok {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheHitCounter(termsOfServiceCacheName)
				}

				return cacheItem.(*model.TermsOfService), nil
			}
		}
	}
	if s.metrics != nil {
		s.metrics.IncrementMemCacheMissCounter(termsOfServiceCacheName)
	}

	obj, err := s.GetReplica().Get(model.TermsOfService{}, id)
	if err != nil {
		return nil, model.NewAppError("SqlTermsOfServiceStore.Get", "store.sql_terms_of_service_store.get.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	if obj == nil {
		return nil, model.NewAppError("SqlTermsOfServiceStore.GetLatest", "store.sql_terms_of_service_store.get.no_rows.app_error", nil, "", http.StatusNotFound)
	}
	return obj.(*model.TermsOfService), nil
}
