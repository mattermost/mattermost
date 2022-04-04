package sources

import (
	"github.com/mattermost/morph/models"
)

type Source interface {
	Migrations() (migrations []*models.Migration)
}
