// See LICENSE.txt for license information.

package sharedchannel

import (
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/remotecluster"
)

func (scs *Service) OnReceiveMessage(msg model.RemoteClusterMsg, rc *model.RemoteCluster, response remotecluster.Response) error {
	scs.server.GetLogger().Debug("Sync message received", mlog.String("remote", rc.DisplayName), mlog.Any("msg", msg))

	if len(msg.Payload) == 0 {
		return nil
	}

	var syncMessages []syncMsg

	if err := json.Unmarshal(msg.Payload, &syncMessages); err != nil {
		response[model.STATUS] = model.STATUS_FAIL
		response[StatusDescription] = fmt.Sprintf("Invalid sync message: %v", err)
		return err
	}

	//for _, sm := range syncMessages {

	//	}

	return nil //fmt.Errorf("Not implemented yet")
}
