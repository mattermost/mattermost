// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"errors"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func newTestPasskey(userID string) *model.Passkey {
	return &model.Passkey{
		UserId:         userID,
		Name:           "Laptop",
		UserHandle:     []byte(model.NewId()),
		CredentialId:   []byte(model.NewId()),
		PublicKey:      []byte{1, 2, 3},
		AAGUID:         []byte{4, 5, 6},
		Transports:     "internal,hybrid",
		SignCount:      7,
		BackupEligible: true,
		BackupState:    true,
	}
}

func TestPasskeyStore(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		t.Run("SaveAndGetRoundTrip", func(t *testing.T) {
			p := newTestPasskey(model.NewId())
			saved, err := ss.Passkey().SaveIfUnderLimit(p, model.PasskeyMaxPerUser)
			require.NoError(t, err)
			require.NotNil(t, saved)

			got, err := ss.Passkey().GetForUser(p.UserId)
			require.NoError(t, err)
			require.Len(t, got, 1)
			assert.Equal(t, p, got[0])
			assert.NotEmpty(t, got[0].Id)
			assert.NotZero(t, got[0].CreateAt)
		})

		t.Run("InvalidPasskeyIsRejected", func(t *testing.T) {
			p := newTestPasskey(model.NewId())
			p.Name = ""
			_, err := ss.Passkey().SaveIfUnderLimit(p, model.PasskeyMaxPerUser)
			require.Error(t, err)

			got, err := ss.Passkey().GetForUser(p.UserId)
			require.NoError(t, err)
			assert.Empty(t, got)
		})

		t.Run("GetForUserOrdersByCreateAt", func(t *testing.T) {
			userID := model.NewId()
			second := newTestPasskey(userID)
			second.CreateAt = 2000
			first := newTestPasskey(userID)
			first.CreateAt = 1000
			_, err := ss.Passkey().SaveIfUnderLimit(second, model.PasskeyMaxPerUser)
			require.NoError(t, err)
			_, err = ss.Passkey().SaveIfUnderLimit(first, model.PasskeyMaxPerUser)
			require.NoError(t, err)

			got, err := ss.Passkey().GetForUser(userID)
			require.NoError(t, err)
			require.Len(t, got, 2)
			assert.Equal(t, first.Id, got[0].Id)
			assert.Equal(t, second.Id, got[1].Id)
		})

		t.Run("GetForUserWithNoPasskeysIsEmptyNonNil", func(t *testing.T) {
			got, err := ss.Passkey().GetForUser(model.NewId())
			require.NoError(t, err)
			assert.NotNil(t, got)
			assert.Empty(t, got)
		})

		t.Run("LimitReached", func(t *testing.T) {
			userID := model.NewId()
			for range 2 {
				_, err := ss.Passkey().SaveIfUnderLimit(newTestPasskey(userID), 2)
				require.NoError(t, err)
			}

			_, err := ss.Passkey().SaveIfUnderLimit(newTestPasskey(userID), 2)
			var limitErr *store.ErrLimitExceeded
			require.ErrorAs(t, err, &limitErr)

			got, err := ss.Passkey().GetForUser(userID)
			require.NoError(t, err)
			assert.Len(t, got, 2)
		})

		t.Run("ConcurrentSavesByDifferentUsersAllSucceed", func(t *testing.T) {
			userIDs := make([]string, 2)
			for i := range userIDs {
				u, err := ss.User().Save(rctx, &model.User{Username: model.NewUsername(), Email: storetest.MakeEmail()})
				require.NoError(t, err)
				userIDs[i] = u.Id
			}

			const perUser = 4
			start := make(chan struct{})
			var wg sync.WaitGroup
			errs := make(chan error, perUser*len(userIDs))
			for _, userID := range userIDs {
				for range perUser {
					wg.Go(func() {
						<-start
						_, err := ss.Passkey().SaveIfUnderLimit(newTestPasskey(userID), model.PasskeyMaxPerUser)
						errs <- err
					})
				}
			}
			close(start)
			wg.Wait()
			close(errs)

			for err := range errs {
				require.NoError(t, err)
			}
			for _, userID := range userIDs {
				got, err := ss.Passkey().GetForUser(userID)
				require.NoError(t, err)
				assert.Len(t, got, perUser)
			}
		})

		t.Run("ConcurrentSavesForOneUserHoldTheLimit", func(t *testing.T) {
			u, err := ss.User().Save(rctx, &model.User{Username: model.NewUsername(), Email: storetest.MakeEmail()})
			require.NoError(t, err)

			const attempts, limit = 8, 3
			start := make(chan struct{})
			var wg sync.WaitGroup
			errs := make(chan error, attempts)
			for range attempts {
				wg.Go(func() {
					<-start
					_, saveErr := ss.Passkey().SaveIfUnderLimit(newTestPasskey(u.Id), limit)
					errs <- saveErr
				})
			}
			close(start)
			wg.Wait()
			close(errs)

			var saved, limited int
			for err := range errs {
				var limitErr *store.ErrLimitExceeded
				switch {
				case err == nil:
					saved++
				case errors.As(err, &limitErr):
					limited++
				default:
					require.NoError(t, err)
				}
			}
			assert.Equal(t, limit, saved)
			assert.Equal(t, attempts-limit, limited)

			got, err := ss.Passkey().GetForUser(u.Id)
			require.NoError(t, err)
			assert.Len(t, got, limit)
		})

		t.Run("DuplicateCredentialIdConflicts", func(t *testing.T) {
			p := newTestPasskey(model.NewId())
			_, err := ss.Passkey().SaveIfUnderLimit(p, model.PasskeyMaxPerUser)
			require.NoError(t, err)

			for _, userID := range []string{p.UserId, model.NewId()} {
				dup := newTestPasskey(userID)
				dup.CredentialId = p.CredentialId
				_, err = ss.Passkey().SaveIfUnderLimit(dup, model.PasskeyMaxPerUser)
				var conflictErr *store.ErrConflict
				require.ErrorAs(t, err, &conflictErr)
			}
		})

		t.Run("GetByCredentialId", func(t *testing.T) {
			p := newTestPasskey(model.NewId())
			_, err := ss.Passkey().SaveIfUnderLimit(p, model.PasskeyMaxPerUser)
			require.NoError(t, err)

			got, err := ss.Passkey().GetByCredentialId(p.CredentialId)
			require.NoError(t, err)
			assert.Equal(t, p, got)

			_, err = ss.Passkey().GetByCredentialId([]byte(model.NewId()))
			var nfErr *store.ErrNotFound
			require.ErrorAs(t, err, &nfErr)
		})

		t.Run("UpdateUsage", func(t *testing.T) {
			p := newTestPasskey(model.NewId())
			_, err := ss.Passkey().SaveIfUnderLimit(p, model.PasskeyMaxPerUser)
			require.NoError(t, err)

			var nfErr *store.ErrNotFound
			require.ErrorAs(t, ss.Passkey().UpdateUsage(p.Id, 3, 9, 5000), &nfErr)
			got, err := ss.Passkey().GetByCredentialId(p.CredentialId)
			require.NoError(t, err)
			assert.Equal(t, p, got)

			require.ErrorAs(t, ss.Passkey().UpdateUsage(model.NewId(), 7, 8, 5000), &nfErr)

			require.NoError(t, ss.Passkey().UpdateUsage(p.Id, 7, 8, 5000))
			got, err = ss.Passkey().GetByCredentialId(p.CredentialId)
			require.NoError(t, err)
			assert.EqualValues(t, 8, got.SignCount)
			assert.EqualValues(t, 5000, got.LastUsedAt)
		})

		t.Run("UpdateUsageWithCounterAtZeroAlwaysSucceeds", func(t *testing.T) {
			p := newTestPasskey(model.NewId())
			p.SignCount = 0
			_, err := ss.Passkey().SaveIfUnderLimit(p, model.PasskeyMaxPerUser)
			require.NoError(t, err)

			require.NoError(t, ss.Passkey().UpdateUsage(p.Id, 0, 0, 100))
			require.NoError(t, ss.Passkey().UpdateUsage(p.Id, 0, 0, 200))
			got, err := ss.Passkey().GetByCredentialId(p.CredentialId)
			require.NoError(t, err)
			assert.EqualValues(t, 200, got.LastUsedAt)
		})

		t.Run("ConcurrentUpdateUsageWithSameCounterOnlyOneWins", func(t *testing.T) {
			p := newTestPasskey(model.NewId())
			_, err := ss.Passkey().SaveIfUnderLimit(p, model.PasskeyMaxPerUser)
			require.NoError(t, err)

			const attempts = 8
			start := make(chan struct{})
			var wg sync.WaitGroup
			errs := make(chan error, attempts)
			for range attempts {
				wg.Go(func() {
					<-start
					errs <- ss.Passkey().UpdateUsage(p.Id, 7, 8, model.GetMillis())
				})
			}
			close(start)
			wg.Wait()
			close(errs)

			var won, lost int
			for err := range errs {
				var nfErr *store.ErrNotFound
				switch {
				case err == nil:
					won++
				case errors.As(err, &nfErr):
					lost++
				default:
					require.NoError(t, err)
				}
			}
			assert.Equal(t, 1, won)
			assert.Equal(t, attempts-1, lost)
		})

		t.Run("DeleteChecksOwner", func(t *testing.T) {
			p := newTestPasskey(model.NewId())
			_, err := ss.Passkey().SaveIfUnderLimit(p, model.PasskeyMaxPerUser)
			require.NoError(t, err)

			err = ss.Passkey().Delete(model.NewId(), p.Id)
			var nfErr *store.ErrNotFound
			require.ErrorAs(t, err, &nfErr)

			got, err := ss.Passkey().GetForUser(p.UserId)
			require.NoError(t, err)
			assert.Len(t, got, 1)

			require.NoError(t, ss.Passkey().Delete(p.UserId, p.Id))
			got, err = ss.Passkey().GetForUser(p.UserId)
			require.NoError(t, err)
			assert.Empty(t, got)

			err = ss.Passkey().Delete(p.UserId, p.Id)
			require.ErrorAs(t, err, &nfErr)
		})

		t.Run("PermanentDeleteByUser", func(t *testing.T) {
			userID, otherID := model.NewId(), model.NewId()
			for _, id := range []string{userID, userID, otherID} {
				_, err := ss.Passkey().SaveIfUnderLimit(newTestPasskey(id), model.PasskeyMaxPerUser)
				require.NoError(t, err)
			}

			require.NoError(t, ss.Passkey().PermanentDeleteByUser(userID))
			require.NoError(t, ss.Passkey().PermanentDeleteByUser(model.NewId()))

			got, err := ss.Passkey().GetForUser(userID)
			require.NoError(t, err)
			assert.Empty(t, got)
			got, err = ss.Passkey().GetForUser(otherID)
			require.NoError(t, err)
			assert.Len(t, got, 1)
		})
	})
}
