package pluginapi

import (
	"database/sql"
	"sync"

	// import sql drivers
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"

	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/driver"
	"github.com/pkg/errors"
)

// StoreService exposes the underlying database.
type StoreService struct {
	initializedMaster  bool
	initializedReplica bool
	api                plugin.API
	driver             plugin.Driver
	mutex              sync.Mutex

	masterDB  *sql.DB
	replicaDB *sql.DB
}

// GetMasterDB gets the master database handle.
//
// Minimum server version: 5.16
func (s *StoreService) GetMasterDB() (*sql.DB, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if err := s.initializeMaster(); err != nil {
		return nil, err
	}

	return s.masterDB, nil
}

// GetReplicaDB gets the replica database handle.
// Returns masterDB if a replica is not configured.
//
// Minimum server version: 5.16
func (s *StoreService) GetReplicaDB() (*sql.DB, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if err := s.initializeReplica(); err != nil {
		return nil, err
	}

	if s.replicaDB != nil {
		return s.replicaDB, nil
	}

	if err := s.initializeMaster(); err != nil {
		return nil, err
	}

	return s.masterDB, nil
}

// Close closes any open resources. This method is idempotent.
func (s *StoreService) Close() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.replicaDB != nil {
		if err := s.replicaDB.Close(); err != nil {
			return err
		}
	}

	if s.masterDB != nil {
		if err := s.masterDB.Close(); err != nil {
			return err
		}
	}

	return nil
}

// DriverName returns the driver name for the datasource.
func (s *StoreService) DriverName() string {
	return *s.api.GetConfig().SqlSettings.DriverName
}

func (s *StoreService) initializeMaster() error {
	if s.initializedMaster {
		return nil
	}

	if s.driver == nil {
		return errors.New("no db driver was provided")
	}

	// Set up master db
	db := sql.OpenDB(driver.NewConnector(s.driver, true /* IsMaster */))
	if err := db.Ping(); err != nil {
		return errors.Wrap(err, "failed to connect to master db")
	}
	s.masterDB = db

	s.initializedMaster = true

	return nil
}

func (s *StoreService) initializeReplica() error {
	if s.initializedReplica {
		return nil
	}

	config := s.api.GetUnsanitizedConfig()
	// Set up replica db
	if len(config.SqlSettings.DataSourceReplicas) > 0 {
		db := sql.OpenDB(driver.NewConnector(s.driver, false /* IsMaster */))
		if err := db.Ping(); err != nil {
			return errors.Wrap(err, "failed to connect to replica db")
		}
		s.replicaDB = db
	}

	s.initializedReplica = true
	return nil
}
