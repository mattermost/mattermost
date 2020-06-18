package flow

import (
	"encoding/json"
)

type freetextInfo struct {
	Step     int
	Property string
	UserID   string
}

func (fc *flowController) ftOnFetch(message string, payload string) {
	var ftInfo freetextInfo
	err := json.Unmarshal([]byte(payload), &ftInfo)
	if err != nil {
		fc.Logger.Errorf("cannot unmarshal free text info, err=%s", err)
		return
	}

	err = fc.SetProperty(ftInfo.UserID, ftInfo.Property, message)
	if err != nil {
		fc.Logger.Errorf("cannot set free text property %s, err=%s", ftInfo.Property, err)
		return
	}

	fc.store.RemovePostID(ftInfo.UserID, ftInfo.Property)
	fc.NextStep(ftInfo.UserID, ftInfo.Step, message)
}

func (fc *flowController) ftOnCancel(payload string) {
	var ftInfo freetextInfo
	err := json.Unmarshal([]byte(payload), &ftInfo)
	if err != nil {
		fc.Logger.Errorf("cannot unmarshal free text info, err=%s", err)
		return
	}

	fc.store.RemovePostID(ftInfo.UserID, ftInfo.Property)
	fc.NextStep(ftInfo.UserID, ftInfo.Step, "")
}
