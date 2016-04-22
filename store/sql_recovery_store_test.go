// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestSqlPasswordRecoveryGet(t *testing.T) {
	Setup()

	recovery := &model.PasswordRecovery{UserId: "12345678901234567890123456"}
	Must(store.PasswordRecovery().SaveOrUpdate(recovery))

	result := <-store.PasswordRecovery().Get(recovery.UserId)
	rrecovery := result.Data.(*model.PasswordRecovery)
	if rrecovery.Code != recovery.Code {
		t.Fatal("codes didn't match")
	}

	result2 := <-store.PasswordRecovery().GetByCode(recovery.Code)
	rrecovery2 := result2.Data.(*model.PasswordRecovery)
	if rrecovery2.Code != recovery.Code {
		t.Fatal("codes didn't match")
	}
}

func TestSqlPasswordRecoverySaveOrUpdate(t *testing.T) {
	Setup()

	recovery := &model.PasswordRecovery{UserId: "12345678901234567890123456"}

	if err := (<-store.PasswordRecovery().SaveOrUpdate(recovery)).Err; err != nil {
		t.Fatal(err)
	}

	// not duplicate, testing update
	if err := (<-store.PasswordRecovery().SaveOrUpdate(recovery)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestSqlPasswordRecoveryDelete(t *testing.T) {
	Setup()

	recovery := &model.PasswordRecovery{UserId: "12345678901234567890123456"}
	Must(store.PasswordRecovery().SaveOrUpdate(recovery))

	if err := (<-store.PasswordRecovery().Delete(recovery.UserId)).Err; err != nil {
		t.Fatal(err)
	}
}
