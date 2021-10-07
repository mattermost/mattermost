// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

type sqlClusterDiscoveryStore struct {
	*SqlStore
}

func newSqlClusterDiscoveryStore(sqlStore *SqlStore) store.ClusterDiscoveryStore {
	s := &sqlClusterDiscoveryStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.ClusterDiscovery{}, "ClusterDiscovery").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Type").SetMaxSize(64)
		table.ColMap("ClusterName").SetMaxSize(64)
		table.ColMap("Hostname").SetMaxSize(512)
	}

	return s
}

func (s sqlClusterDiscoveryStore) Save(ClusterDiscovery *model.ClusterDiscovery) error {
	ClusterDiscovery.PreSave()
	if err := ClusterDiscovery.IsValid(); err != nil {
		return err
	}

	if _, err := s.GetMasterX().NamedExec(`
		INSERT INTO 
			ClusterDiscovery
			(Id, Type, ClusterName, Hostname, GossipPort, Port, CreateAt, LastPingAt)
		VALUES
			(:Id, :Type, :ClusterName, :Hostname, :GossipPort, :Port, :CreateAt, :LastPingAt)
	`, ClusterDiscovery); err != nil {
		return errors.Wrap(err, "failed to save ClusterDiscovery")
	}

	return nil
}

func (s sqlClusterDiscoveryStore) Delete(ClusterDiscovery *model.ClusterDiscovery) (bool, error) {
	res, err := s.GetMasterX().NamedExec(`
		DELETE FROM 
			ClusterDiscovery
		WHERE
			Type=:Type AND ClusterName=:ClusterName AND Hostname=:Hostname 
	`, ClusterDiscovery)

	if err != nil {
		return false, errors.Wrap(err, "failed to delete ClusterDiscovery")
	}

	count, err := res.RowsAffected()
	if err != nil {
		return false, errors.Wrap(err, "failed to count rows affected")
	}
	if count == 0 {
		return false, nil
	}
	return true, nil
}

func (s sqlClusterDiscoveryStore) Exists(ClusterDiscovery *model.ClusterDiscovery) (bool, error) {
	var count int
	err := s.GetMasterX().Get(&count, `
		SELECT
			COUNT(*) 
		FROM 
			ClusterDiscovery
		WHERE
			Type=? AND ClusterName=? AND Hostname=? 
	`, ClusterDiscovery.Type, ClusterDiscovery.ClusterName, ClusterDiscovery.Hostname)

	if err != nil {
		return false, errors.Wrap(err, "failed to count ClusterDiscovery")
	}
	if count == 0 {
		return false, nil
	}
	return true, nil
}

func (s sqlClusterDiscoveryStore) GetAll(ClusterDiscoveryType, clusterName string) ([]*model.ClusterDiscovery, error) {
	list := []*model.ClusterDiscovery{}
	err := s.GetMasterX().Select(&list, `
		SELECT
			* 
		FROM 
			ClusterDiscovery
		WHERE
			Type=? AND ClusterName=? AND LastPingAt=? 
	`, ClusterDiscoveryType, clusterName, model.GetMillis()-model.CDSOfflineAfterMillis)

	if err != nil {
		return nil, errors.Wrap(err, "failed to find ClusterDiscovery")
	}

	return list, nil
}

func (s sqlClusterDiscoveryStore) SetLastPingAt(ClusterDiscovery *model.ClusterDiscovery) error {
	if _, err := s.GetMasterX().Exec(`
		UPDATE 
			ClusterDiscovery
		SET
			LastPingAt = ?
		WHERE
			Type=? AND ClusterName=? AND Hostname=? 
	`, model.GetMillis(), ClusterDiscovery.Type, ClusterDiscovery.ClusterName, ClusterDiscovery.Hostname); err != nil {
		return errors.Wrap(err, "failed to update ClusterDiscovery")
	}

	return nil
}

func (s sqlClusterDiscoveryStore) Cleanup() error {
	if _, err := s.GetMasterX().Exec(`
		DELETE FROM 
			ClusterDiscovery
		WHERE
			LastPingAt<? 
	`, model.GetMillis()-model.CDSOfflineAfterMillis); err != nil {
		return errors.Wrap(err, "failed to delete ClusterDiscovery")
	}

	return nil
}
