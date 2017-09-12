package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
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

	channel, err := th.App.CreateChannel(&model.Channel{DisplayName: "deletion-test", Name: "deletion-test", Type: model.CHANNEL_OPEN, TeamId: th.BasicTeam.Id}, false)
	if err != nil {
		t.Fatal(err.Error())
	}
	defer func() {
		th.App.PermanentDeleteChannel(channel)
	}()

	incoming, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, channel, &model.IncomingWebhook{ChannelId: channel.Id})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer th.App.DeleteIncomingWebhook(incoming.Id)

	if incoming, err = th.App.GetIncomingWebhook(incoming.Id); incoming == nil || err != nil {
		t.Fatal("unable to get new incoming webhook")
	}

	outgoing, err := th.App.CreateOutgoingWebhook(&model.OutgoingWebhook{
		ChannelId:    channel.Id,
		TeamId:       channel.TeamId,
		CreatorId:    th.BasicUser.Id,
		CallbackURLs: []string{"http://foo"},
	})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer th.App.DeleteOutgoingWebhook(outgoing.Id)

	if outgoing, err = th.App.GetOutgoingWebhook(outgoing.Id); outgoing == nil || err != nil {
		t.Fatal("unable to get new outgoing webhook")
	}

	if err := th.App.PermanentDeleteChannel(channel); err != nil {
		t.Fatal(err.Error())
	}

	if incoming, err = th.App.GetIncomingWebhook(incoming.Id); incoming != nil || err == nil {
		t.Error("incoming webhook wasn't deleted")
	}

	if outgoing, err = th.App.GetOutgoingWebhook(outgoing.Id); outgoing != nil || err == nil {
		t.Error("outgoing webhook wasn't deleted")
	}
}

func TestMoveChannel(t *testing.T) {
	th := Setup().InitBasic()

	sourceTeam := th.CreateTeam()
	targetTeam := th.CreateTeam()
	channel1 := th.CreateChannel(sourceTeam)
	defer func() {
		th.App.PermanentDeleteChannel(channel1)
		th.App.PermanentDeleteTeam(sourceTeam)
		th.App.PermanentDeleteTeam(targetTeam)
	}()

	if _, err := th.App.AddUserToTeam(sourceTeam.Id, th.BasicUser.Id, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := th.App.AddUserToTeam(sourceTeam.Id, th.BasicUser2.Id, ""); err != nil {
		t.Fatal(err)
	}

	if _, err := th.App.AddUserToTeam(targetTeam.Id, th.BasicUser.Id, ""); err != nil {
		t.Fatal(err)
	}

	if _, err := th.App.AddUserToChannel(th.BasicUser, channel1); err != nil {
		t.Fatal(err)
	}
	if _, err := th.App.AddUserToChannel(th.BasicUser2, channel1); err != nil {
		t.Fatal(err)
	}

	if err := th.App.MoveChannel(targetTeam, channel1); err == nil {
		t.Fatal("Should have failed due to mismatched members.")
	}

	if _, err := th.App.AddUserToTeam(targetTeam.Id, th.BasicUser2.Id, ""); err != nil {
		t.Fatal(err)
	}

	if err := th.App.MoveChannel(targetTeam, channel1); err != nil {
		t.Fatal(err)
	}
}
