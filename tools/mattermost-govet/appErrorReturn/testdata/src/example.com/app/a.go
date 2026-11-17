package app // want `baseline entry example.com/app.\(\*App\).Migrated no longer returns \*model.AppError` `baseline entry example.com/app.\(\*App\).Deleted no longer returns` `baseline entry example.com/app/gone.Foo belongs to a package that no longer exists`

import "github.com/mattermost/mattermost/server/public/model"

type App struct{}

type AppErr = model.AppError

type Store[T any] struct{}

func (a *App) Baselined() *model.AppError { return nil }

func (a App) BaselinedValueReceiver() (string, *model.AppError) { return "", nil }

func baselinedFunc() *model.AppError { return nil }

func (s *Store[T]) Get() (T, *model.AppError) {
	var zero T
	return zero, nil
}

func (a *App) Migrated() error { return nil }

func (a *App) New() *model.AppError { // want `\(\*App\).New returns \*model.AppError: declare the result as error instead`
	return model.NewAppError("New", "id")
}

func newViaAlias() *AppErr { // want `newViaAlias returns \*model.AppError`
	return nil
}

func (a *App) NotAnAppError() (*model.AppError, error) { // want `\(\*App\).NotAnAppError returns \*model.AppError`
	return nil, nil
}

func returnsSlice() []*model.AppError { return nil }

func literal() {
	_ = func() *model.AppError { return nil }
}
