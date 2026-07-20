package wraperrors

import (
	"errors"
	"fmt"
	"net/http"

	"model"
)

func dosomething() {
	err := errors.New("test")
	appErr := model.NewAppError("SetJobError", "app.job.update.app_error", nil, err.Error(), http.StatusInternalServerError) // want `Don't use the details field to report the original error, call model\.NewAppError\(\.\.\.\)\.Wrap\(err\) instead`
	fmt.Println(appErr)
	appErr = model.NewAppError("SetJobError", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	fmt.Println(appErr)
	appErr = model.NewAppError("SetJobError", "app.job.update.app_error", nil, "something else", http.StatusInternalServerError)
	fmt.Println(appErr)
}
