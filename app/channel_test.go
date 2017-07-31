package app

import (
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestPermanentDeleteChannel(t *testing.T) {
	th := Setup().InitBasic()

	incomingWasEnabled := utils.Cfg.ServiceSettings.EnableIncomingWebhooks
	outgoingWasEnabled := utils.Cfg.ServiceSettings.EnableOutgoingWebhooks
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = true
	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = true
	defer func() {
		utils.Cfg.ServiceSettings.EnableIncomingWebhooks = incomingWasEnabled
		utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = outgoingWasEnabled
	}()

	channel, err := CreateChannel(&model.Channel{DisplayName: "deletion-test", Name: "deletion-test", Type: model.CHANNEL_OPEN, TeamId: th.BasicTeam.Id}, false)
	if err != nil {
		t.Fatal(err.Error())
	}
	defer func() {
		PermanentDeleteChannel(channel)
	}()

	incoming, err := CreateIncomingWebhookForChannel(th.BasicUser.Id, channel, &model.IncomingWebhook{ChannelId: channel.Id})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer DeleteIncomingWebhook(incoming.Id)

	if incoming, err = GetIncomingWebhook(incoming.Id); incoming == nil || err != nil {
		t.Fatal("unable to get new incoming webhook")
	}

	outgoing, err := CreateOutgoingWebhook(&model.OutgoingWebhook{
		ChannelId:    channel.Id,
		TeamId:       channel.TeamId,
		CreatorId:    th.BasicUser.Id,
		CallbackURLs: []string{"http://foo"},
	})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer DeleteOutgoingWebhook(outgoing.Id)

	if outgoing, err = GetOutgoingWebhook(outgoing.Id); outgoing == nil || err != nil {
		t.Fatal("unable to get new outgoing webhook")
	}

	if err := PermanentDeleteChannel(channel); err != nil {
		t.Fatal(err.Error())
	}

	if incoming, err = GetIncomingWebhook(incoming.Id); incoming != nil || err == nil {
		t.Error("incoming webhook wasn't deleted")
	}

	if outgoing, err = GetOutgoingWebhook(outgoing.Id); outgoing != nil || err == nil {
		t.Error("outgoing webhook wasn't deleted")
	}
}
