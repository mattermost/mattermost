package app

import (
	"github.com/google/uuid"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/auth"
	"github.com/mattermost/focalboard/server/services/store"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"

	"github.com/pkg/errors"
)

const (
	DaysPerMonth     = 30
	DaysPerWeek      = 7
	HoursPerDay      = 24
	MinutesPerHour   = 60
	SecondsPerMinute = 60
)

// GetSession Get a user active session and refresh the session if is needed.
func (a *App) GetSession(token string) (*model.Session, error) {
	return a.auth.GetSession(token)
}

// IsValidReadToken validates the read token for a block.
func (a *App) IsValidReadToken(c store.Container, blockID string, readToken string) (bool, error) {
	return a.auth.IsValidReadToken(c, blockID, readToken)
}

// GetRegisteredUserCount returns the number of registered users.
func (a *App) GetRegisteredUserCount() (int, error) {
	return a.store.GetRegisteredUserCount()
}

// GetDailyActiveUsers returns the number of daily active users.
func (a *App) GetDailyActiveUsers() (int, error) {
	secondsAgo := int64(SecondsPerMinute * MinutesPerHour * HoursPerDay)
	return a.store.GetActiveUserCount(secondsAgo)
}

// GetWeeklyActiveUsers returns the number of weekly active users.
func (a *App) GetWeeklyActiveUsers() (int, error) {
	secondsAgo := int64(SecondsPerMinute * MinutesPerHour * HoursPerDay * DaysPerWeek)
	return a.store.GetActiveUserCount(secondsAgo)
}

// GetMonthlyActiveUsers returns the number of monthly active users.
func (a *App) GetMonthlyActiveUsers() (int, error) {
	secondsAgo := int64(SecondsPerMinute * MinutesPerHour * HoursPerDay * DaysPerMonth)
	return a.store.GetActiveUserCount(secondsAgo)
}

// GetUser gets an existing active user by id.
func (a *App) GetUser(id string) (*model.User, error) {
	if len(id) < 1 {
		return nil, errors.New("no user ID")
	}

	user, err := a.store.GetUserByID(id)
	if err != nil {
		return nil, errors.Wrap(err, "unable to find user")
	}
	return user, nil
}

// Login create a new user session if the authentication data is valid.
func (a *App) Login(username, email, password, mfaToken string) (string, error) {
	var user *model.User
	if username != "" {
		var err error
		user, err = a.store.GetUserByUsername(username)
		if err != nil {
			a.metrics.IncrementLoginFailCount(1)
			return "", errors.Wrap(err, "invalid username or password")
		}
	}

	if user == nil && email != "" {
		var err error
		user, err = a.store.GetUserByEmail(email)
		if err != nil {
			a.metrics.IncrementLoginFailCount(1)
			return "", errors.Wrap(err, "invalid username or password")
		}
	}
	if user == nil {
		a.metrics.IncrementLoginFailCount(1)
		return "", errors.New("invalid username or password")
	}

	if !auth.ComparePassword(user.Password, password) {
		a.metrics.IncrementLoginFailCount(1)
		a.logger.Debug("Invalid password for user", mlog.String("userID", user.ID))
		return "", errors.New("invalid username or password")
	}

	authService := user.AuthService
	if authService == "" {
		authService = "native"
	}

	session := model.Session{
		ID:          uuid.New().String(),
		Token:       uuid.New().String(),
		UserID:      user.ID,
		AuthService: authService,
		Props:       map[string]interface{}{},
	}
	err := a.store.CreateSession(&session)
	if err != nil {
		return "", errors.Wrap(err, "unable to create session")
	}

	a.metrics.IncrementLoginCount(1)

	// TODO: MFA verification
	return session.Token, nil
}

// RegisterUser creates a new user if the provided data is valid.
func (a *App) RegisterUser(username, email, password string) error {
	var user *model.User
	if username != "" {
		var err error
		user, err = a.store.GetUserByUsername(username)
		if err == nil && user != nil {
			return errors.New("The username already exists")
		}
	}

	if user == nil && email != "" {
		var err error
		user, err = a.store.GetUserByEmail(email)
		if err == nil && user != nil {
			return errors.New("The email already exists")
		}
	}

	// TODO: Move this into the config
	passwordSettings := auth.PasswordSettings{
		MinimumLength: 6,
	}

	err := auth.IsPasswordValid(password, passwordSettings)
	if err != nil {
		return errors.Wrap(err, "Invalid password")
	}

	err = a.store.CreateUser(&model.User{
		ID:          uuid.New().String(),
		Username:    username,
		Email:       email,
		Password:    auth.HashPassword(password),
		MfaSecret:   "",
		AuthService: a.config.AuthMode,
		AuthData:    "",
		Props:       map[string]interface{}{},
	})
	if err != nil {
		return errors.Wrap(err, "Unable to create the new user")
	}

	return nil
}

func (a *App) UpdateUserPassword(username, password string) error {
	err := a.store.UpdateUserPassword(username, auth.HashPassword(password))
	if err != nil {
		return err
	}

	return nil
}

func (a *App) ChangePassword(userID, oldPassword, newPassword string) error {
	var user *model.User
	if userID != "" {
		var err error
		user, err = a.store.GetUserByID(userID)
		if err != nil {
			return errors.Wrap(err, "invalid username or password")
		}
	}

	if user == nil {
		return errors.New("invalid username or password")
	}

	if !auth.ComparePassword(user.Password, oldPassword) {
		a.logger.Debug("Invalid password for user", mlog.String("userID", user.ID))
		return errors.New("invalid username or password")
	}

	err := a.store.UpdateUserPasswordByID(userID, auth.HashPassword(newPassword))
	if err != nil {
		return errors.Wrap(err, "unable to update password")
	}

	return nil
}
