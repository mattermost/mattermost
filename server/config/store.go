// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"reflect"
	"sync"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/utils"
)

var (
	// ErrReadOnlyStore is returned when an attempt to modify a read-only
	// configuration store is made.
	ErrReadOnlyStore = errors.New("configuration store is read-only")
)

// databaseStoreReconcileInterval is how often a database-backed store checks
// the active configuration row for changes made by other nodes. The check is a
// single-row indexed query, so it is cheap relative to the convergence it
// guarantees when a cluster config-change notification is lost.
const databaseStoreReconcileInterval = 30 * time.Second

// Retry schedule for reading a cluster-pushed configuration change back from
// the database. The sender persists a new active row before notifying peers,
// so a read that still matches the last known checksum means the read landed
// on a lagging replica (e.g. behind a load-balancing proxy) or the change was
// already applied; a few short retries cover typical replication lag, and the
// periodic reconciler covers anything longer.
const (
	clusterConfigReadRetries    = 5
	clusterConfigReadRetryDelay = 500 * time.Millisecond
)

// Store is the higher level object that handles storing and retrieval of config data.
// To do so it relies on a variety of backing stores (e.g. file, database, memory).
type Store struct {
	emitter
	backingStore BackingStore

	configLock           sync.RWMutex
	config               *model.Config
	configNoEnv          *model.Config
	configCustomDefaults *model.Config

	readOnly   bool
	readOnlyFF bool

	reconcilerDone chan struct{}
	reconcilerWg   sync.WaitGroup
	reconcilerOnce sync.Once
}

// BackingStore defines the behaviour exposed by the underlying store
// implementation (e.g. file, database).
type BackingStore interface {
	// Set replaces the current configuration in its entirety and updates the backing store.
	Set(*model.Config) error

	// Load retrieves the configuration stored. If there is no configuration stored
	// the io.ReadCloser will be nil
	Load() ([]byte, error)

	// GetFile fetches the contents of a previously persisted configuration file.
	// If no such file exists, an empty byte array will be returned without error.
	GetFile(name string) ([]byte, error)

	// SetFile sets or replaces the contents of a configuration file.
	SetFile(name string, data []byte) error

	// HasFile returns true if the given file was previously persisted.
	HasFile(name string) (bool, error)

	// RemoveFile removes a previously persisted configuration file.
	RemoveFile(name string) error

	// String describes the backing store for the config.
	String() string

	// Close cleans up resources associated with the store.
	Close() error
}

// NewStoreFromBacking creates and returns a new config store given a backing store.
func NewStoreFromBacking(backingStore BackingStore, customDefaults *model.Config, readOnly bool) (*Store, error) {
	store := &Store{
		backingStore:         backingStore,
		configCustomDefaults: customDefaults,
		readOnly:             readOnly,
		readOnlyFF:           true,
	}

	if err := store.Load(); err != nil {
		return nil, errors.Wrap(err, "unable to load on store creation")
	}

	if databaseStore, ok := backingStore.(*DatabaseStore); ok && !readOnly {
		store.startReconciler(databaseStore)
	}

	return store, nil
}

// startReconciler periodically compares the active configuration row against
// the last configuration loaded or persisted through this store and reloads on
// mismatch. Cluster peers normally learn about config changes through a
// cluster message, but that delivery is best effort once the sender gives up;
// this poll guarantees every node sharing a configuration database converges
// on the latest configuration even if a notification is lost.
func (s *Store) startReconciler(databaseStore *DatabaseStore) {
	s.reconcilerDone = make(chan struct{})

	s.reconcilerWg.Go(func() {
		ticker := time.NewTicker(databaseStoreReconcileInterval)
		defer ticker.Stop()

		for {
			select {
			case <-s.reconcilerDone:
				return
			case <-ticker.C:
				s.reconcileFromDatabase(databaseStore)
			}
		}
	})
}

// stopReconciler signals the reconciler goroutine to stop and waits for it to
// exit. Safe to call multiple times and when no reconciler was started.
func (s *Store) stopReconciler() {
	s.reconcilerOnce.Do(func() {
		if s.reconcilerDone != nil {
			close(s.reconcilerDone)
			s.reconcilerWg.Wait()
		}
	})
}

// reconcileFromDatabase reloads the configuration if the active configuration
// row was changed by another writer. The reload never writes back to the
// database: the other writer owns the active row, and normalization
// differences (e.g. between server versions during a rolling upgrade) must not
// cause nodes to rewrite each other's rows in a loop.
func (s *Store) reconcileFromDatabase(databaseStore *DatabaseStore) {
	changed, err := databaseStore.hasChangedExternally()
	if err != nil {
		mlog.Warn("Failed to check configuration store for external changes", mlog.Err(err))
		return
	}
	if !changed {
		return
	}

	mlog.Info("Configuration changed externally in the database, reloading")
	if err := s.load(false); err != nil {
		mlog.Error("Failed to reload configuration after external change", mlog.Err(err))
	}
}

// ApplyClusterConfig applies a configuration received from another cluster
// node. Database-backed stores re-read the shared database, which the sender
// already updated, rather than persisting the pushed payload: concurrent
// pushes can be applied out of order, and rewriting the active row could
// reactivate a stale configuration. File-backed stores persist the payload
// locally as usual, since each node owns its copy of the file.
func (s *Store) ApplyClusterConfig(newCfg *model.Config) error {
	databaseStore, ok := s.backingStore.(*DatabaseStore)
	if !ok {
		_, _, err := s.Set(newCfg)
		return err
	}

	// The sender persisted a new active row before notifying, so a fresh read
	// must expose a checksum we haven't seen. If it doesn't, either the read
	// hit a lagging replica or the change was already applied locally; retry
	// briefly and otherwise leave convergence to the reconciler.
	for attempt := 0; ; attempt++ {
		changed, err := databaseStore.hasChangedExternally()
		if err != nil {
			return err
		}
		if changed {
			break
		}
		if attempt >= clusterConfigReadRetries {
			mlog.Debug("Cluster config change not yet visible in the database; deferring to the reconciler")
			return nil
		}
		time.Sleep(clusterConfigReadRetryDelay)
	}

	return s.load(false)
}

// NewStoreFromDSN creates and returns a new config store backed by either a database or file store
// depending on the value of the given data source name string.
func NewStoreFromDSN(dsn string, readOnly bool, customDefaults *model.Config, createFileIfNotExist bool) (*Store, error) {
	var err error
	var backingStore BackingStore
	if IsDatabaseDSN(dsn) {
		backingStore, err = NewDatabaseStore(dsn)
	} else {
		backingStore, err = NewFileStore(dsn, createFileIfNotExist)
	}
	if err != nil {
		return nil, err
	}

	store, err := NewStoreFromBacking(backingStore, customDefaults, readOnly)
	if err != nil {
		backingStore.Close()
		return nil, errors.Wrap(err, "failed to create store")
	}

	return store, nil
}

// NewTestMemoryStore returns a new config store backed by a memory store
// to be used for testing purposes.
func NewTestMemoryStore() *Store {
	memoryStore, err := NewMemoryStore()
	if err != nil {
		panic("failed to initialize memory store: " + err.Error())
	}

	configStore, err := NewStoreFromBacking(memoryStore, nil, false)
	if err != nil {
		panic("failed to initialize config store: " + err.Error())
	}

	return configStore
}

// Get fetches the current, cached configuration.
func (s *Store) Get() *model.Config {
	s.configLock.RLock()
	defer s.configLock.RUnlock()
	return s.config
}

// GetNoEnv fetches the current cached configuration without environment variable overrides.
func (s *Store) GetNoEnv() *model.Config {
	s.configLock.RLock()
	defer s.configLock.RUnlock()
	return s.configNoEnv
}

// GetEnvironmentOverrides fetches the configuration fields overridden by environment variables.
func (s *Store) GetEnvironmentOverrides() map[string]any {
	return generateEnvironmentMap(GetEnvironment(), nil)
}

// GetEnvironmentOverridesWithFilter fetches the configuration fields overridden by environment variables.
// If filter is not nil and returns false for a struct field, that field will be omitted.
func (s *Store) GetEnvironmentOverridesWithFilter(filter func(reflect.StructField) bool) map[string]any {
	return generateEnvironmentMap(GetEnvironment(), filter)
}

// RemoveEnvironmentOverrides returns a new config without the environment
// overrides.
func (s *Store) RemoveEnvironmentOverrides(cfg *model.Config) *model.Config {
	s.configLock.RLock()
	defer s.configLock.RUnlock()
	return removeEnvOverrides(cfg, s.configNoEnv, s.GetEnvironmentOverrides())
}

// SetReadOnlyFF sets whether feature flags should be written out to
// config or treated as read-only.
func (s *Store) SetReadOnlyFF(readOnly bool) {
	s.configLock.Lock()
	defer s.configLock.Unlock()
	s.readOnlyFF = readOnly
}

// Set replaces the current configuration in its entirety and updates the backing store.
// It returns both old and new versions of the config.
func (s *Store) Set(newCfg *model.Config) (*model.Config, *model.Config, error) {
	s.configLock.Lock()
	defer s.configLock.Unlock()

	if s.readOnly {
		return nil, nil, ErrReadOnlyStore
	}

	newCfg = newCfg.Clone()
	oldCfg := s.config.Clone()
	oldCfgNoEnv := s.configNoEnv

	// Setting defaults allows us to accept partial config objects.
	newCfg.SetDefaults()

	// Sometimes the config is received with "fake" data in sensitive fields. Apply the real
	// data from the existing config as necessary.
	Desanitize(oldCfg, newCfg)

	// We apply back environment overrides since the input config may or
	// may not have them applied.
	newCfg = applyEnvironmentMap(newCfg, GetEnvironment())
	fixConfig(newCfg)

	if err := newCfg.IsValid(); err != nil {
		return nil, nil, errors.Wrap(err, "new configuration is invalid")
	}

	// We attempt to remove any environment override that may be present in the input config.
	newCfgNoEnv := removeEnvOverrides(newCfg, oldCfgNoEnv, s.GetEnvironmentOverrides())

	// Don't store feature flags unless we are on MM cloud
	// MM cloud uses config in the DB as a cache of the feature flag
	// settings in case the management system is down when a pod starts.

	// Backing up feature flags section in case we need to restore them later on.
	oldCfgFF := oldCfg.FeatureFlags
	oldCfgNoEnvFF := oldCfgNoEnv.FeatureFlags
	// Clearing FF sections to avoid both comparing and persisting them.
	if s.readOnlyFF {
		oldCfg.FeatureFlags = nil
		newCfg.FeatureFlags = nil
		newCfgNoEnv.FeatureFlags = nil
	}

	if err := s.backingStore.Set(newCfgNoEnv); err != nil {
		return nil, nil, errors.Wrap(err, "failed to persist")
	}

	hasChanged, err := equal(oldCfg, newCfg)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to compare configs")
	}

	// We restore the previously cleared feature flags sections back.
	if s.readOnlyFF {
		oldCfg.FeatureFlags = oldCfgFF
		newCfg.FeatureFlags = oldCfgFF
		newCfgNoEnv.FeatureFlags = oldCfgNoEnvFF
	}

	s.configNoEnv = newCfgNoEnv
	s.config = newCfg

	newCfgCopy := newCfg.Clone()

	if hasChanged {
		s.configLock.Unlock()
		s.invokeConfigListeners(oldCfg, newCfgCopy.Clone())
		s.configLock.Lock()
	}

	return oldCfg, newCfgCopy, nil
}

// Load updates the current configuration from the backing store, possibly initializing.
func (s *Store) Load() error {
	return s.load(true)
}

// load updates the current configuration from the backing store. When
// persistOnChange is true, a changed or missing configuration is normalized
// and written back to the backing store.
func (s *Store) load(persistOnChange bool) error {
	s.configLock.Lock()
	defer s.configLock.Unlock()

	oldCfg := &model.Config{}
	if s.config != nil {
		oldCfg = s.config.Clone()
	}

	configBytes, err := s.backingStore.Load()
	if err != nil {
		return err
	}

	loadedCfg := &model.Config{}
	if len(configBytes) != 0 {
		if err = json.Unmarshal(configBytes, &loadedCfg); err != nil {
			return utils.HumanizeJSONError(err, configBytes)
		}
	}

	// If we have custom defaults set, the initial config is merged on
	// top of them and we delete them not to be used again in the
	// configuration reloads
	if s.configCustomDefaults != nil {
		var mErr error
		loadedCfg, mErr = Merge(s.configCustomDefaults, loadedCfg, nil)
		if mErr != nil {
			return errors.Wrap(mErr, "failed to merge custom config defaults")
		}
		s.configCustomDefaults = nil
	}

	// We set the SiteURL to empty (if nil) so that the following call to
	// SetDefaults() will generate missing data. This avoids an additional write
	// to the backing store.
	if loadedCfg.ServiceSettings.SiteURL == nil {
		loadedCfg.ServiceSettings.SiteURL = new("")
	}

	// Setting defaults allows us to accept partial config objects.
	loadedCfg.SetDefaults()

	// No need to clone here since the below call to applyEnvironmentMap
	// already does that internally.
	loadedCfgNoEnv := loadedCfg
	fixConfig(loadedCfgNoEnv)

	loadedCfg = applyEnvironmentMap(loadedCfg, GetEnvironment())
	fixConfig(loadedCfg)
	if appErr := loadedCfg.IsValid(); appErr != nil {
		// Translating the error before displaying it in the console.
		// Defaulting to english for server side language.
		appErr.Translate(i18n.GetUserTranslations("en"))
		return errors.Wrap(appErr, "invalid config")
	}

	// Backing up feature flags section in case we need to restore them later on.
	oldCfgFF := oldCfg.FeatureFlags
	loadedCfgFF := loadedCfg.FeatureFlags
	loadedCfgNoEnvFF := loadedCfgNoEnv.FeatureFlags
	// Clearing FF sections to avoid both comparing and persisting them.
	if s.readOnlyFF {
		oldCfg.FeatureFlags = nil
		loadedCfg.FeatureFlags = nil
		loadedCfgNoEnv.FeatureFlags = nil
	}

	// Check for changes that may have happened on load to the backing store.
	hasChanged, err := equal(oldCfg, loadedCfg)
	if err != nil {
		return errors.Wrap(err, "failed to compare configs")
	}

	// We write back to the backing store only if requested, the store is not
	// read-only, and the config has either changed or is missing.
	if persistOnChange && !s.readOnly && (hasChanged || len(configBytes) == 0) {
		err := s.backingStore.Set(loadedCfgNoEnv)
		if err != nil && !errors.Is(err, ErrReadOnlyConfiguration) {
			return errors.Wrap(err, "failed to persist")
		}
	}

	// We restore the previously cleared feature flags sections back.
	if s.readOnlyFF {
		oldCfg.FeatureFlags = oldCfgFF
		loadedCfg.FeatureFlags = loadedCfgFF
		loadedCfgNoEnv.FeatureFlags = loadedCfgNoEnvFF
	}

	s.config = loadedCfg
	s.configNoEnv = loadedCfgNoEnv

	loadedCfgCopy := loadedCfg.Clone()

	if hasChanged {
		s.configLock.Unlock()
		s.invokeConfigListeners(oldCfg, loadedCfgCopy)
		s.configLock.Lock()
	}

	return nil
}

// GetFile fetches the contents of a previously persisted configuration file.
// If no such file exists, an empty byte array will be returned without error.
func (s *Store) GetFile(name string) ([]byte, error) {
	s.configLock.RLock()
	defer s.configLock.RUnlock()
	return s.backingStore.GetFile(name)
}

// SetFile sets or replaces the contents of a configuration file.
func (s *Store) SetFile(name string, data []byte) error {
	s.configLock.Lock()
	defer s.configLock.Unlock()
	if s.readOnly {
		return ErrReadOnlyStore
	}
	return s.backingStore.SetFile(name, data)
}

// HasFile returns true if the given file was previously persisted.
func (s *Store) HasFile(name string) (bool, error) {
	s.configLock.RLock()
	defer s.configLock.RUnlock()
	return s.backingStore.HasFile(name)
}

// RemoveFile removes a previously persisted configuration file.
func (s *Store) RemoveFile(name string) error {
	s.configLock.Lock()
	defer s.configLock.Unlock()
	if s.readOnly {
		return ErrReadOnlyStore
	}
	return s.backingStore.RemoveFile(name)
}

// String describes the backing store for the config.
func (s *Store) String() string {
	return s.backingStore.String()
}

// Close cleans up resources associated with the store.
func (s *Store) Close() error {
	// Wait for any in-flight reconcile before closing the backing store; the
	// reconciler takes configLock itself, so this must happen before locking.
	s.stopReconciler()

	s.configLock.Lock()
	defer s.configLock.Unlock()
	return s.backingStore.Close()
}

// IsReadOnly returns whether or not the store is read-only.
func (s *Store) IsReadOnly() bool {
	s.configLock.RLock()
	defer s.configLock.RUnlock()
	return s.readOnly
}

// Cleanup removes outdated configurations from the database.
// this is a no-op function for FileStore type backing store.
func (s *Store) CleanUp() error {
	switch bs := s.backingStore.(type) {
	case *DatabaseStore:
		dur := time.Duration(*s.config.JobSettings.CleanupConfigThresholdDays) * time.Hour * 24
		expiry := model.GetMillisForTime(time.Now().Add(-dur))
		return bs.cleanUp(expiry)
	default:
		return nil
	}
}
