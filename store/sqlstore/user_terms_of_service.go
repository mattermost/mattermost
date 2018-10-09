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
		table := db.AddTableWithName(model.UserTermsOfService{}, "UserTermsOfService").SetKeys(false, "UserId")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("TermsOfServiceId").SetMaxSize(26)
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
				result.Err = model.NewAppError("NewSqlUserTermsOfServiceStore.GetByUser", "store.sql_user_terms_of_service.get_by_user.no_rows.app_error", nil, "", http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("NewSqlUserTermsOfServiceStore.GetByUser", "store.sql_user_terms_of_service.get_by_user.app_error", nil, "", http.StatusInternalServerError)
			}
		} else {
			result.Data = userTermsOfService
		}
	})
}

func (s SqlUserTermsOfServiceStore) SaveOrUpdate(userTermsOfService *model.UserTermsOfService) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		userTermsOfService.PreSave()
		if result.Err = userTermsOfService.IsValid(); result.Err != nil {
			return
		}

		if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			if rowsAffected, err := s.GetMaster().Update(userTermsOfService); err != nil {
				result.Err = model.NewAppError("SqlUserTermsOfServiceStore.SaveOrUpdate", "store.sql_user_terms_of_service.save.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			} else if rowsAffected == 0 {
				if err := s.GetMaster().Insert(userTermsOfService); err != nil {
					result.Err = model.NewAppError("SqlUserTermsOfServiceStore.SaveOrUpdate", "store.sql_user_terms_of_service.save.app_error", nil, err.Error(), http.StatusInternalServerError)
					return
				}
			}
		} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
			if _, err := s.GetMaster().Exec("INSERT INTO UserTermsOfService VALUES(:UserId, :TermsOfServiceId, :CreateAt) ON DUPLICATE KEY UPDATE TermsOfServiceId = :TermsOfServiceId, CreateAt = :CreateAt", map[string]interface{}{"UserId": userTermsOfService.UserId, "TermsOfServiceId": userTermsOfService.TermsOfServiceId, "CreateAt": userTermsOfService.CreateAt}); err != nil {
				result.Err = model.NewAppError("SqlUserTermsOfServiceStore.SaveOrUpdate", "store.sql_user_terms_of_service.save.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			}
		}

		result.Data = userTermsOfService
	})
}
