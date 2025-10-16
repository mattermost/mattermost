package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
)

type SqlE2EEStore struct {
	*SqlStore
	deviceSelect sq.SelectBuilder
	spkSelect    sq.SelectBuilder
	opkSelect    sq.SelectBuilder
	snapSelect   sq.SelectBuilder
}

func newSqlE2EEStore(sqlStore *SqlStore) store.E2EEStore {
	s := &SqlE2EEStore{SqlStore: sqlStore}
	qb := s.getQueryBuilder()

	s.deviceSelect = qb.
		Select("UserId", "DeviceId", "DeviceLabel", "RegistrationId", "IdentityKeyPublic", "CreateAt", "UpdateAt", "DeleteAt").
		From("E2EEDevices")

	s.spkSelect = qb.
		Select("UserId", "DeviceId", "KeyId", "PublicKey", "Signature", "CreateAt", "RotateAt", "DeleteAt").
		From("E2EESignedPreKeys")

	s.opkSelect = qb.
		Select("Userid", "DeviceId", "KeyId", "PublicKey", "CreateAt", "ConsumedAt", "DeleteAt").
		From("E2EEOneTimePreKeys")

	s.snapSelect = qb.
		Select("UserId", "DeviceListHash", "DevicesCount", "Version", "UpdateAt").
		From("E2EEDeviceListSnapshots")

	return s
}

func (s *SqlE2EEStore) UpsertDevice(c request.CTX, de *model.E2EEDevice) (*model.E2EEDevice, error) {
	if de == nil {
		return nil, errors.New("nil device")
	}

	now := model.GetMillis()
	tx, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin tx")
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
			return
		}
		if cerr := tx.Commit(); cerr != nil {
			err = cerr
		}
	}()

	ib := s.getQueryBuilder().Insert("E2EEDevices")
	ib = ib.Columns("UserId", "DeviceLabel", "RegistrationId", "IdentityKeyPublic", "IdentityKeyFingerprint", "CreateAt", "UpdateAt", "DeleteAt").
		Values(de.UserId, de.DeviceLabel, de.RegistrationId, de.IdentityKeyPublic, de.IdentityKeyFingerprint, now, int64(0), int64(0))
	ib = ib.Suffix("RETURNING DeviceId")
	var newId int64
	if err = tx.GetBuilder(&newId, ib); err != nil {
		return nil, errors.Wrap(err, "insert device")
	}
	if newId == 0 {
		return nil, errors.New("DeviceId not returned")
	}
	de.DeviceId = newId

	de.CreateAt = now
	de.UpdateAt = int64(0)
	de.DeleteAt = int64(0)

	return de, nil
}

func (s *SqlE2EEStore) GetDevicesByUser(c request.CTX, userId string, includeDeleted bool) ([]*model.E2EEDevice, error) {
	q := s.deviceSelect.Where(sq.Eq{"UserId": userId})
	if !includeDeleted {
		q = q.Where(sq.Eq{"DeleteAt": 0})
	}
	var rows []*model.E2EEDevice
	if err := s.GetReplica().SelectBuilder(&rows, q); err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *SqlE2EEStore) UpsertSignedPreKey(c request.CTX, spk *model.E2EESignedPreKey) error {
	if spk == nil {
		return errors.New("nil spk")
	}
	now := model.GetMillis()

	tx, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin tx")
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
			return
		}
		if cerr := tx.Commit(); cerr != nil {
			err = cerr
		}
	}()

	upd := s.getQueryBuilder().Update("E2EESignedPreKeys").
		Set("RotateAt", now).
		Where(sq.Eq{"UserId": spk.UserId})

	if _, err = tx.ExecBuilder(upd); err != nil {
		return err
	}

	ins := s.getQueryBuilder().
		Insert("E2EESignedPreKeys").
		Columns("UserId", "DeviceId", "KeyId", "PublicKey", "Signature", "CreateAt", "RotateAt", "DeleteAt").
		Values(spk.UserId, spk.DeviceId, spk.KeyId, spk.PublicKey, spk.Signature, now, int64(0), int64(0))

	if _, err = tx.ExecBuilder(ins); err != nil {
		return err
	}
	return err
}

func (s *SqlE2EEStore) GetLatestSignedPreKey(c request.CTX, userId string, deviceId int64) (*model.E2EESignedPreKey, error) {
	q := s.spkSelect.
		Where(sq.Eq{"UserId": userId, "DeviceId": deviceId, "DeleteAt": 0}).
		OrderBy("CreateAt DESC").
		Limit(1)

	var spk model.E2EESignedPreKey
	if err := s.GetReplica().GetBuilder(&spk, q); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &spk, nil
}

func (s *SqlE2EEStore) InsertOneTimePreKeys(c request.CTX, opks []model.E2EEOneTimePreKey) error {
	if len(opks) == 0 {
		return nil
	}
	now := model.GetMillis()
	ib := s.getQueryBuilder().Insert("E2EEOneTimePreKeys").
		Columns("UserId", "DeviceId", "KeyId", "PublicKey", "CreateAt", "ConsumedAt", "DeleteAt")
	for _, k := range opks {
		ib = ib.Values(k.UserId, k.DeviceId, k.KeyId, k.PublicKey, now, int64(0), int64(0))
	}
	_, err := s.GetMaster().ExecBuilder(ib)
	return err
}

func (s *SqlE2EEStore) ConsumeOneTimePreKey(c request.CTX, userId string, deviceId int64) (*model.E2EEOneTimePreKey, error) {
	tx, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin tx")
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
			return
		}
		if cerr := tx.Commit(); cerr != nil {
			err = cerr
		}
	}()
	now := model.GetMillis()
	sel := s.getQueryBuilder().
		Select("UserId", "DeviceId", "KeyId", "PublicKey", "CreateAt", "ConsumedAt", "DeleteAt").
		From("E2EEOneTimePreKeys").
		Where(sq.Eq{"UserId": userId, "DeviceId": deviceId, "DeleteAt": 0}).
		Where(sq.Eq{"ConsumedAt": 0}).
		OrderBy("KeyId ASC").
		Limit(1)

	sel = sel.Suffix("FOR UPDATE")
	var opk model.E2EEOneTimePreKey
	if err = tx.GetBuilder(&opk, sel); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	upd := s.getQueryBuilder().
		Update("E2EEOneTimePreKeys").
		Set("ConsumedAt", now).
		Where(sq.Eq{"UserId": userId, "DeviceId": deviceId, "KeyId": opk.KeyId})

	if _, err = tx.ExecBuilder(upd); err != nil {
		return nil, err
	}
	opk.ConsumedAt = now
	return &opk, nil
}

func (s *SqlE2EEStore) GetDeviceListSnapshot(c request.CTX, userId string) (*model.E2EEDeviceListSnapshot, error) {
	q := s.snapSelect.Where(sq.Eq{"UserId": userId})
	var snap model.E2EEDeviceListSnapshot
	if err := s.GetReplica().GetBuilder(&snap, q); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &snap, nil
}

func (s *SqlE2EEStore) RecomputeDeviceListSnapshot(c request.CTX, userId string) error {
	q := "SELECT E2EERecomputeListSnapshot($1)"
	_, err := s.GetMaster().Exec(q, userId)
	return err
}

func (s *SqlE2EEStore) GetDeviceListHashes(c request.CTX, userIds []string) (map[string]string, error) {
	if len(userIds) == 0 {
		return nil, nil
	}

	result := make(map[string]string, len(userIds))

	chunkSize := 1000

	for start := 0; start < len(userIds); start += chunkSize {
		end := start + chunkSize
		if end > len(userIds) {
			end = len(userIds)
		}

		chunk := userIds[start:end]

		q := s.snapSelect.Where(sq.Eq{"UserIds": chunk})

		var snaps []model.E2EEDeviceListSnapshot
		if err := s.GetReplica().SelectBuilder(&snaps, q); err != nil {
			return nil, errors.Wrap(err, "Select device list snapshots")
		}

		for _, sn := range snaps {
			result[sn.UserId] = sn.DeviceListHash
		}
	}

	return result, nil
}
