// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

const (
	PASSWORD_RECOVERY_CODE_SIZE  = 128
	PASSWORD_RECOVER_EXPIRY_TIME = 1000 * 60 * 60 // 1 hour
)

type PasswordRecovery struct {
	UserId   string
	Code     string
	CreateAt int64
}

func (p *PasswordRecovery) IsValid() *AppError {

	if len(p.UserId) != 26 {
		return NewLocAppError("User.IsValid", "model.password_recovery.is_valid.user_id.app_error", nil, "")
	}

	if len(p.Code) != PASSWORD_RECOVERY_CODE_SIZE {
		return NewLocAppError("User.IsValid", "model.password_recovery.is_valid.code.app_error", nil, "")
	}

	if p.CreateAt == 0 {
		return NewLocAppError("User.IsValid", "model.password_recovery.is_valid.create_at.app_error", nil, "")
	}

	return nil
}

func (p *PasswordRecovery) PreSave() {
	p.Code = NewRandomString(PASSWORD_RECOVERY_CODE_SIZE)
	p.CreateAt = GetMillis()
}
