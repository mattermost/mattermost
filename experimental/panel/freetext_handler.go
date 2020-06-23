package panel

import (
	"encoding/json"

	"github.com/mattermost/mattermost-plugin-api/experimental/panel/settings"
)

func (p *panel) ftOnFetch(message, payload string) {
	var ftInfo settings.FreetextInfo
	err := json.Unmarshal([]byte(payload), &ftInfo)
	if err != nil {
		p.logger.Errorf("cannot unmarshal free text info, err=%s", err)
		return
	}

	err = p.settings[ftInfo.SettingID].Set(ftInfo.UserID, message)
	if err != nil {
		p.logger.Errorf("cannot unmarshal set free text value, err=%s", err)
		return
	}

	p.Print(ftInfo.UserID)
}

func (p *panel) ftOnCancel(payload string) {
	var ftInfo settings.FreetextInfo
	err := json.Unmarshal([]byte(payload), &ftInfo)
	if err != nil {
		p.logger.Errorf("cannot unmarshal free text info, err=%s", err)
		return
	}

	p.Print(ftInfo.UserID)
}
