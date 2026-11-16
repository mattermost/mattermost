package listed

import "github.com/mattermost/mattermost/server/public/model"

type App struct{}

func (a *App) Foo() *model.AppError { return nil } // want `^appErrorReturn baseline entry: example.com/listed.\(\*App\).Foo$`

func bar() (int, *model.AppError) { return 0, nil } // want `^appErrorReturn baseline entry: example.com/listed.bar$`

func baz() error { return nil }
