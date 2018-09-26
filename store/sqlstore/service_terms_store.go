// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
	"net/http"
)

type SqlServiceTermsStore struct {
	SqlStore
	metrics einterfaces.MetricsInterface
}

var serviceTermsCache = utils.NewLru(model.SERVICE_TERMS_CACHE_SIZE)

const serviceTermsCacheName = "ServiceTerms"

func NewSqlTermStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.ServiceTermsStore {
	s := SqlServiceTermsStore{sqlStore, metrics}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.ServiceTerms{}, "ServiceTerms").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Text").SetMaxSize(model.POST_MESSAGE_MAX_BYTES_V2)
	}

	return s
}

func (s SqlServiceTermsStore) CreateIndexesIfNotExists() {
}

func (s SqlServiceTermsStore) Save(serviceTerms *model.ServiceTerms) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if len(serviceTerms.Id) > 0 {
			result.Err = model.NewAppError(
				"SqlServiceTermsStore.Save",
				"store.sql_service_terms_store.save.existing.app_error",
				nil,
				"id="+serviceTerms.Id, http.StatusBadRequest,
			)
			return
		}

		serviceTerms.PreSave()

		if result.Err = serviceTerms.IsValid(); result.Err != nil {
			return
		}

		if err := s.GetMaster().Insert(serviceTerms); err != nil {
			result.Err = model.NewAppError(
				"SqlServiceTermsStore.Save",
				"store.sql_service_terms.save.app_error",
				nil,
				"service_term_id="+serviceTerms.Id+",err="+err.Error(),
				http.StatusInternalServerError,
			)
		}

		result.Data = serviceTerms

		serviceTermsCache.AddWithDefaultExpires(serviceTerms.Id, serviceTerms)
	})
}

func (s SqlServiceTermsStore) GetLatest(allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if allowFromCache {
			if serviceTermsCache.Len() == 0 {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheMissCounter(serviceTermsCacheName)
				}
			} else {
				if cacheItem, ok := serviceTermsCache.Get(serviceTermsCache.Keys()[0]); ok {
					if s.metrics != nil {
						s.metrics.IncrementMemCacheHitCounter(serviceTermsCacheName)
					}

					result.Data = cacheItem.(*model.ServiceTerms)
					return
				} else if s.metrics != nil {
					s.metrics.IncrementMemCacheMissCounter(serviceTermsCacheName)
				}
			}
		}

		var serviceTerms *model.ServiceTerms

		err := s.GetReplica().SelectOne(&serviceTerms, "SELECT * FROM ServiceTerms ORDER BY CreateAt DESC LIMIT 1")
		if err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlServiceTermsStore.GetLatest", "store.sql_service_terms_store.get.no_rows.app_error", nil, "err="+err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlServiceTermsStore.GetLatest", "store.sql_service_terms_store.get.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
			}
		} else {
			result.Data = serviceTerms

			if allowFromCache {
				serviceTermsCache.AddWithDefaultExpires(serviceTerms.Id, serviceTerms)
			}
		}
	})
}

func (s SqlServiceTermsStore) Get(id string, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if allowFromCache {
			if serviceTermsCache.Len() == 0 {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheMissCounter(serviceTermsCacheName)
				}
			} else {
				if cacheItem, ok := serviceTermsCache.Get(id); ok {
					if s.metrics != nil {
						s.metrics.IncrementMemCacheHitCounter(serviceTermsCacheName)
					}

					result.Data = cacheItem.(*model.ServiceTerms)
					return
				} else if s.metrics != nil {
					s.metrics.IncrementMemCacheMissCounter(serviceTermsCacheName)
				}
			}
		}

		if obj, err := s.GetReplica().Get(model.ServiceTerms{}, id); err != nil {
			result.Err = model.NewAppError("SqlServiceTermsStore.Get", "store.sql_service_terms_store.get.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
		} else if obj == nil {
			result.Err = model.NewAppError("SqlServiceTermsStore.GetLatest", "store.sql_service_terms_store.get.no_rows.app_error", nil, "", http.StatusNotFound)
		} else {
			result.Data = obj.(*model.ServiceTerms)
		}
	})
}
