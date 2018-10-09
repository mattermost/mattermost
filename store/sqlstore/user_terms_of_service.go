package sqlstore

import (
	"database/sql"
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
	"net/http"
)

type SqlUserTermsOfServiceStore struct {
	SqlStore
	metrics einterfaces.MetricsInterface
}

var userTermsOfServiceCache = utils.NewLru(model.USER_TERMS_OF_SERVICE_CACHE_SIZE)

const userTermsOfServiceCacheName = "UserTermsOfServiceStore"

func NewSqlUserTermsOfServiceStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.UserTermsOfServiceStore {
	s := SqlUserTermsOfServiceStore{sqlStore, metrics}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.UserTermsOfService{}, "UserTermsOfService").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("AcceptedTermsOfServiceId").SetMaxSize(26)
	}

	return s
}

func (s SqlUserTermsOfServiceStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_user_terms_of_service_user_id", "UserTermsOfService", "UserId")
}

func (s SqlUserTermsOfServiceStore) GetByUser(userId string, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var userTermsOfService *model.UserTermsOfService

		err := s.GetReplica().SelectOne(&userTermsOfService, "SELECT * FROM UserTermsOfService WHERE UserId = :userId", map[string]interface{}{"userId": userId})
		if err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("NewSqlUserTermsOfServiceStore.GetByUser.no_rows.app_error", "store.sql_user_terms_of_service.get_by_user", nil, "", http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("NewSqlUserTermsOfServiceStore.GetByUser.app_error", "store.sql_user_terms_of_service.get_by_user", nil, "", http.StatusInternalServerError)
			}
		} else {
			result.Data = userTermsOfService
		}
	})
}
