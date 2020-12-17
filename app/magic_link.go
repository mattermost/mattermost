package app

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

type magicLinkToken struct {
	UserId string
	Email  string
}

func (a *App) SendMagicLink(loginId string, siteURL string) (bool, *model.AppError) {
	user, err := a.GetUserForLogin("", loginId)
	if err != nil {
		return false, err
	}

	token, nErr := a.createMagicLinkToken(user.Id, user.Email)
	if nErr != nil {
		return false, model.NewAppError("SendMagicLink", "api.user.send_magic_link.token_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	return a.Srv().EmailService.SendMagicLinkEmail(user.Email, token, user.Locale, siteURL)
}

func (a *App) createMagicLinkToken(userId, email string) (*model.Token, error) {
	tokenExtra := magicLinkToken{
		userId,
		email,
	}

	jsonData, err := json.Marshal(tokenExtra)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to serialize magic link token data")
	}

	token := model.NewToken(TOKEN_TYPE_MAGIC_LINK, string(jsonData))

	if err := a.Srv().Store.Token().Save(token); err != nil {
		return nil, err
	}

	return token, nil
}

func (a *App) getMagicLinkToken(tokenString string) (*model.Token, error) {
	token, err := a.Srv().Store.Token().GetByToken(tokenString)
	if err != nil {
		return nil, err
	}

	if token.Type != TOKEN_TYPE_MAGIC_LINK {
		return nil, model.NewAppError("getMagicLinkToken", "api.user.magic_link.invalid_token", nil, "invalid token type in store", http.StatusBadRequest)
	}

	if model.GetMillis()-token.CreateAt >= MAGIC_LINK_EXPIRY_TIME {
		return nil, model.NewAppError("getMagicLinkToken", "api.user.magic_link.invalid_token", nil, "token has expired", http.StatusBadRequest)
	}

	return token, nil
}

func (a *App) AuthenticateUserWithToken(tokenString string) (user *model.User, err *model.AppError) {
	// Do statistics
	defer func() {
		if a.Metrics() != nil {
			if user == nil || err != nil {
				a.Metrics().IncrementLoginFail()
			} else {
				a.Metrics().IncrementLogin()
			}
		}
	}()

	token, nErr := a.getMagicLinkToken(tokenString)
	if nErr != nil {
		err = model.NewAppError("getMagicLinkToken", "api.user.magic_link.invalid_token", nil, nErr.Error(), http.StatusBadRequest)
		return
	}

	var tokenData magicLinkToken
	if nErr := json.Unmarshal([]byte(token.Extra), &tokenData); nErr != nil {
		err = model.NewAppError("getMagicLinkToken", "api.user.magic_link.invalid_token", nil, nErr.Error(), http.StatusInternalServerError)
		return
	}

	user, err = a.GetUser(tokenData.UserId)
	if err != nil {
		return nil, model.NewAppError("getMagicLinkToken", "api.user.magic_link.invalid_token", nil, err.Error(), http.StatusInternalServerError)
	}

	if user.Email != tokenData.Email {
		return nil, model.NewAppError("getMagicLinkToken", "api.user.magic_link.invalid_token", nil, "token does not match expected email", http.StatusBadRequest)
	}

	if deleteErr := a.DeleteToken(token); deleteErr != nil {
		mlog.Error("Failed to delete token", mlog.Err(deleteErr))
	}

	return user, nil
}
