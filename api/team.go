// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"fmt"
	"github.com/awslabs/aws-sdk-go/aws"
	"github.com/awslabs/aws-sdk-go/service/route53"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

func InitTeam(r *mux.Router) {
	l4g.Debug("Initializing team api routes")

	sr := r.PathPrefix("/teams").Subrouter()
	sr.Handle("/create", ApiAppHandler(createTeam)).Methods("POST")
	sr.Handle("/create_from_signup", ApiAppHandler(createTeamFromSignup)).Methods("POST")
	sr.Handle("/signup", ApiAppHandler(signupTeam)).Methods("POST")
	sr.Handle("/find_team_by_domain", ApiAppHandler(findTeamByDomain)).Methods("POST")
	sr.Handle("/find_teams", ApiAppHandler(findTeams)).Methods("POST")
	sr.Handle("/email_teams", ApiAppHandler(emailTeams)).Methods("POST")
	sr.Handle("/invite_members", ApiUserRequired(inviteMembers)).Methods("POST")
	sr.Handle("/update_name", ApiUserRequired(updateTeamName)).Methods("POST")
	sr.Handle("/update_valet_feature", ApiUserRequired(updateValetFeature)).Methods("POST")
	sr.Handle("/me", ApiUserRequired(getMyTeam)).Methods("GET")
}

func signupTeam(c *Context, w http.ResponseWriter, r *http.Request) {

	m := model.MapFromJson(r.Body)
	email := strings.ToLower(strings.TrimSpace(m["email"]))
	name := strings.TrimSpace(m["name"])

	if len(email) == 0 {
		c.SetInvalidParam("signupTeam", "email")
		return
	}

	if len(name) == 0 {
		c.SetInvalidParam("signupTeam", "name")
		return
	}

	subjectPage := NewServerTemplatePage("signup_team_subject", c.TeamUrl)
	bodyPage := NewServerTemplatePage("signup_team_body", c.TeamUrl)
	bodyPage.Props["TourUrl"] = utils.Cfg.TeamSettings.TourLink

	props := make(map[string]string)
	props["email"] = email
	props["name"] = name
	props["time"] = fmt.Sprintf("%v", model.GetMillis())

	data := model.MapToJson(props)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.ServiceSettings.InviteSalt))

	bodyPage.Props["Link"] = fmt.Sprintf("%s/signup_team_complete/?d=%s&h=%s", c.TeamUrl, url.QueryEscape(data), url.QueryEscape(hash))

	if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
		c.Err = err
		return
	}

	if utils.Cfg.ServiceSettings.Mode == utils.MODE_DEV || utils.Cfg.EmailSettings.ByPassEmail {
		m["follow_link"] = bodyPage.Props["Link"]
	}

	w.Header().Set("Access-Control-Allow-Origin", " *")
	w.Write([]byte(model.MapToJson(m)))
}

func createTeamFromSignup(c *Context, w http.ResponseWriter, r *http.Request) {

	teamSignup := model.TeamSignupFromJson(r.Body)

	if teamSignup == nil {
		c.SetInvalidParam("createTeam", "teamSignup")
		return
	}

	props := model.MapFromJson(strings.NewReader(teamSignup.Data))
	teamSignup.Team.Email = props["email"]
	teamSignup.User.Email = props["email"]

	teamSignup.Team.PreSave()

	if err := teamSignup.Team.IsValid(); err != nil {
		c.Err = err
		return
	}
	teamSignup.Team.Id = ""

	password := teamSignup.User.Password
	teamSignup.User.PreSave()
	teamSignup.User.TeamId = model.NewId()
	if err := teamSignup.User.IsValid(); err != nil {
		c.Err = err
		return
	}
	teamSignup.User.Id = ""
	teamSignup.User.TeamId = ""
	teamSignup.User.Password = password

	if !model.ComparePassword(teamSignup.Hash, fmt.Sprintf("%v:%v", teamSignup.Data, utils.Cfg.ServiceSettings.InviteSalt)) {
		c.Err = model.NewAppError("createTeamFromSignup", "The signup link does not appear to be valid", "")
		return
	}

	t, err := strconv.ParseInt(props["time"], 10, 64)
	if err != nil || model.GetMillis()-t > 1000*60*60 { // one hour
		c.Err = model.NewAppError("createTeamFromSignup", "The signup link has expired", "")
		return
	}

	found := FindTeamByDomain(c, teamSignup.Team.Domain, "true")
	if c.Err != nil {
		return
	}

	if found {
		c.Err = model.NewAppError("createTeamFromSignup", "This URL is unavailable. Please try another.", "d="+teamSignup.Team.Domain)
		return
	}

	if IsBetaDomain(r) {
		for key, value := range utils.Cfg.ServiceSettings.Shards {
			if strings.Index(r.Host, key) == 0 {
				createSubDomain(teamSignup.Team.Domain, value)
				break
			}
		}
	}

	teamSignup.Team.AllowValet = utils.Cfg.TeamSettings.AllowValetDefault

	if result := <-Srv.Store.Team().Save(&teamSignup.Team); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		rteam := result.Data.(*model.Team)

		if _, err := CreateDefaultChannels(c, rteam.Id); err != nil {
			c.Err = nil
			return
		}

		teamSignup.User.TeamId = rteam.Id
		teamSignup.User.EmailVerified = true

		ruser := CreateUser(c, rteam, &teamSignup.User)
		if c.Err != nil {
			return
		}

		if teamSignup.Team.AllowValet {
			CreateValet(c, rteam)
			if c.Err != nil {
				return
			}
		}

		InviteMembers(rteam, ruser, teamSignup.Invites)

		teamSignup.Team = *rteam
		teamSignup.User = *ruser

		w.Write([]byte(teamSignup.ToJson()))
	}
}

func createTeam(c *Context, w http.ResponseWriter, r *http.Request) {

	team := model.TeamFromJson(r.Body)

	if team == nil {
		c.SetInvalidParam("createTeam", "team")
		return
	}

	if utils.Cfg.ServiceSettings.Mode != utils.MODE_DEV {
		c.Err = model.NewAppError("createTeam", "The mode does not allow network creation without a valid invite", "")
		return
	}

	if result := <-Srv.Store.Team().Save(team); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		rteam := result.Data.(*model.Team)

		if _, err := CreateDefaultChannels(c, rteam.Id); err != nil {
			c.Err = nil
			return
		}

		if rteam.AllowValet {
			CreateValet(c, rteam)
			if c.Err != nil {
				return
			}
		}

		w.Write([]byte(rteam.ToJson()))
	}
}

func doesSubDomainExist(subDomain string) bool {

	// if it's configured for testing then skip this step
	if utils.Cfg.AWSSettings.Route53AccessKeyId == "" {
		return false
	}

	creds := aws.Creds(utils.Cfg.AWSSettings.Route53AccessKeyId, utils.Cfg.AWSSettings.Route53SecretAccessKey, "")
	r53 := route53.New(aws.DefaultConfig.Merge(&aws.Config{Credentials: creds, Region: utils.Cfg.AWSSettings.Route53Region}))

	r53req := &route53.ListResourceRecordSetsInput{
		HostedZoneID:    aws.String(utils.Cfg.AWSSettings.Route53ZoneId),
		MaxItems:        aws.String("1"),
		StartRecordName: aws.String(fmt.Sprintf("%v.%v.", subDomain, utils.Cfg.ServiceSettings.Domain)),
	}

	if result, err := r53.ListResourceRecordSets(r53req); err != nil {
		l4g.Error("error in doesSubDomainExist domain=%v err=%v", subDomain, err)
		return true
	} else {

		for _, v := range result.ResourceRecordSets {
			if v.Name != nil && *v.Name == fmt.Sprintf("%v.%v.", subDomain, utils.Cfg.ServiceSettings.Domain) {
				return true
			}
		}
	}

	return false
}

func createSubDomain(subDomain string, target string) {

	if utils.Cfg.AWSSettings.Route53AccessKeyId == "" {
		return
	}

	creds := aws.Creds(utils.Cfg.AWSSettings.Route53AccessKeyId, utils.Cfg.AWSSettings.Route53SecretAccessKey, "")
	r53 := route53.New(aws.DefaultConfig.Merge(&aws.Config{Credentials: creds, Region: utils.Cfg.AWSSettings.Route53Region}))

	rr := route53.ResourceRecord{
		Value: aws.String(target),
	}

	rrs := make([]*route53.ResourceRecord, 1)
	rrs[0] = &rr

	change := route53.Change{
		Action: aws.String("CREATE"),
		ResourceRecordSet: &route53.ResourceRecordSet{
			Name:            aws.String(fmt.Sprintf("%v.%v", subDomain, utils.Cfg.ServiceSettings.Domain)),
			TTL:             aws.Long(300),
			Type:            aws.String("CNAME"),
			ResourceRecords: rrs,
		},
	}

	changes := make([]*route53.Change, 1)
	changes[0] = &change

	r53req := &route53.ChangeResourceRecordSetsInput{
		HostedZoneID: aws.String(utils.Cfg.AWSSettings.Route53ZoneId),
		ChangeBatch: &route53.ChangeBatch{
			Changes: changes,
		},
	}

	if _, err := r53.ChangeResourceRecordSets(r53req); err != nil {
		l4g.Error("erro in createSubDomain domain=%v err=%v", subDomain, err)
		return
	}
}

func findTeamByDomain(c *Context, w http.ResponseWriter, r *http.Request) {

	m := model.MapFromJson(r.Body)

	domain := strings.ToLower(strings.TrimSpace(m["domain"]))
	all := strings.ToLower(strings.TrimSpace(m["all"]))

	found := FindTeamByDomain(c, domain, all)

	if c.Err != nil {
		return
	}

	if found {
		w.Write([]byte("true"))
	} else {
		w.Write([]byte("false"))
	}
}

func FindTeamByDomain(c *Context, domain string, all string) bool {

	if domain == "" || len(domain) > 64 {
		c.SetInvalidParam("findTeamByDomain", "domain")
		return false
	}

	if model.IsReservedDomain(domain) {
		c.Err = model.NewAppError("findTeamByDomain", "This URL is unavailable. Please try another.", "d="+domain)
		return false
	}

	if all == "false" {
		if result := <-Srv.Store.Team().GetByDomain(domain); result.Err != nil {
			return false
		} else {
			return true
		}
	} else {
		if doesSubDomainExist(domain) {
			return true
		}

		protocol := "http"

		if utils.Cfg.ServiceSettings.UseSSL {
			protocol = "https"
		}

		for key, _ := range utils.Cfg.ServiceSettings.Shards {
			url := fmt.Sprintf("%v://%v.%v/api/v1", protocol, key, utils.Cfg.ServiceSettings.Domain)

			if strings.Index(utils.Cfg.ServiceSettings.Domain, "localhost") == 0 {
				url = fmt.Sprintf("%v://%v/api/v1", protocol, utils.Cfg.ServiceSettings.Domain)
			}

			client := model.NewClient(url)

			if result, err := client.FindTeamByDomain(domain, false); err != nil {
				c.Err = err
				return false
			} else {
				if result.Data.(bool) {
					return true
				}
			}
		}

		return false
	}
}

func findTeams(c *Context, w http.ResponseWriter, r *http.Request) {

	m := model.MapFromJson(r.Body)

	email := strings.ToLower(strings.TrimSpace(m["email"]))

	if email == "" {
		c.SetInvalidParam("findTeam", "email")
		return
	}

	if result := <-Srv.Store.Team().GetTeamsForEmail(email); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		teams := result.Data.([]*model.Team)

		s := make([]string, 0, len(teams))

		for _, v := range teams {
			s = append(s, v.Domain)
		}

		w.Write([]byte(model.ArrayToJson(s)))
	}
}

func emailTeams(c *Context, w http.ResponseWriter, r *http.Request) {

	m := model.MapFromJson(r.Body)

	email := strings.ToLower(strings.TrimSpace(m["email"]))

	if email == "" {
		c.SetInvalidParam("findTeam", "email")
		return
	}

	protocol := "http"

	if utils.Cfg.ServiceSettings.UseSSL {
		protocol = "https"
	}

	subjectPage := NewServerTemplatePage("find_teams_subject", c.TeamUrl)
	bodyPage := NewServerTemplatePage("find_teams_body", c.TeamUrl)

	for key, _ := range utils.Cfg.ServiceSettings.Shards {
		url := fmt.Sprintf("%v://%v.%v/api/v1", protocol, key, utils.Cfg.ServiceSettings.Domain)

		if strings.Index(utils.Cfg.ServiceSettings.Domain, "localhost") == 0 {
			url = fmt.Sprintf("%v://%v/api/v1", protocol, utils.Cfg.ServiceSettings.Domain)
		}

		client := model.NewClient(url)

		if result, err := client.FindTeams(email); err != nil {
			l4g.Error("An error occured while finding teams at %v err=%v", key, err)
		} else {
			data := result.Data.([]string)
			for _, domain := range data {
				bodyPage.Props[fmt.Sprintf("%v://%v.%v", protocol, domain, utils.Cfg.ServiceSettings.Domain)] = ""
			}
		}
	}

	if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
		l4g.Error("An error occured while sending an email in emailTeams err=%v", err)
	}

	w.Write([]byte(model.MapToJson(m)))
}

func inviteMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	invites := model.InvitesFromJson(r.Body)
	if len(invites.Invites) == 0 {
		c.Err = model.NewAppError("Team.InviteMembers", "No one to invite.", "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	tchan := Srv.Store.Team().Get(c.Session.TeamId)
	uchan := Srv.Store.User().Get(c.Session.UserId)

	var team *model.Team
	if result := <-tchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	var invNum int64 = 0
	for i, invite := range invites.Invites {
		if result := <-Srv.Store.User().GetByEmail(c.Session.TeamId, invite["email"]); result.Err == nil || result.Err.Message != "We couldn't find the existing account" {
			invNum = int64(i)
			c.Err = model.NewAppError("invite_members", "This person is already on your team", strconv.FormatInt(invNum, 10))
			return
		}
	}

	ia := make([]string, len(invites.Invites))
	for _, invite := range invites.Invites {
		ia = append(ia, invite["email"])
	}

	InviteMembers(team, user, ia)

	w.Write([]byte(invites.ToJson()))
}

func InviteMembers(team *model.Team, user *model.User, invites []string) {
	for _, invite := range invites {
		if len(invite) > 0 {
			teamUrl := ""
			if utils.Cfg.ServiceSettings.Mode == utils.MODE_DEV {
				teamUrl = "http://localhost:8065"
			} else if utils.Cfg.ServiceSettings.UseSSL {
				teamUrl = fmt.Sprintf("https://%v.%v", team.Domain, utils.Cfg.ServiceSettings.Domain)
			} else {
				teamUrl = fmt.Sprintf("http://%v.%v", team.Domain, utils.Cfg.ServiceSettings.Domain)
			}

			sender := ""
			if len(strings.TrimSpace(user.FullName)) == 0 {
				sender = user.Username
			} else {
				sender = user.FullName
			}

			senderRole := ""
			if strings.Contains(user.Roles, model.ROLE_ADMIN) || strings.Contains(user.Roles, model.ROLE_SYSTEM_ADMIN) {
				senderRole = "administrator"
			} else {
				senderRole = "member"
			}

			subjectPage := NewServerTemplatePage("invite_subject", teamUrl)
			subjectPage.Props["SenderName"] = sender
			subjectPage.Props["TeamName"] = team.Name
			bodyPage := NewServerTemplatePage("invite_body", teamUrl)
			bodyPage.Props["TeamName"] = team.Name
			bodyPage.Props["SenderName"] = sender
			bodyPage.Props["SenderStatus"] = senderRole

			bodyPage.Props["Email"] = invite

			props := make(map[string]string)
			props["email"] = invite
			props["id"] = team.Id
			props["name"] = team.Name
			props["domain"] = team.Domain
			props["time"] = fmt.Sprintf("%v", model.GetMillis())
			data := model.MapToJson(props)
			hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.ServiceSettings.InviteSalt))
			bodyPage.Props["Link"] = fmt.Sprintf("%s/signup_user_complete/?d=%s&h=%s", teamUrl, url.QueryEscape(data), url.QueryEscape(hash))

			if utils.Cfg.ServiceSettings.Mode == utils.MODE_DEV {
				l4g.Info("sending invitation to %v %v", invite, bodyPage.Props["Link"])
			}

			if err := utils.SendMail(invite, subjectPage.Render(), bodyPage.Render()); err != nil {
				l4g.Error("Failed to send invite email successfully err=%v", err)
			}
		}
	}
}

func updateTeamName(c *Context, w http.ResponseWriter, r *http.Request) {

	props := model.MapFromJson(r.Body)

	new_name := props["new_name"]
	if len(new_name) == 0 {
		c.SetInvalidParam("updateTeamName", "new_name")
		return
	}

	teamId := props["team_id"]
	if len(teamId) > 0 && len(teamId) != 26 {
		c.SetInvalidParam("updateTeamName", "team_id")
		return
	} else if len(teamId) == 0 {
		teamId = c.Session.TeamId
	}

	if !c.HasPermissionsToTeam(teamId, "updateTeamName") {
		return
	}

	if !strings.Contains(c.Session.Roles, model.ROLE_ADMIN) {
		c.Err = model.NewAppError("updateTeamName", "You do not have the appropriate permissions", "userId="+c.Session.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if result := <-Srv.Store.Team().UpdateName(new_name, c.Session.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	}

	w.Write([]byte(model.MapToJson(props)))
}

func updateValetFeature(c *Context, w http.ResponseWriter, r *http.Request) {

	props := model.MapFromJson(r.Body)

	allowValetStr := props["allow_valet"]
	if len(allowValetStr) == 0 {
		c.SetInvalidParam("updateValetFeature", "allow_valet")
		return
	}

	allowValet := allowValetStr == "true"

	teamId := props["team_id"]
	if len(teamId) > 0 && len(teamId) != 26 {
		c.SetInvalidParam("updateValetFeature", "team_id")
		return
	} else if len(teamId) == 0 {
		teamId = c.Session.TeamId
	}

	tchan := Srv.Store.Team().Get(teamId)

	if !c.HasPermissionsToTeam(teamId, "updateValetFeature") {
		return
	}

	if !strings.Contains(c.Session.Roles, model.ROLE_ADMIN) {
		c.Err = model.NewAppError("updateValetFeature", "You do not have the appropriate permissions", "userId="+c.Session.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	var team *model.Team
	if tResult := <-tchan; tResult.Err != nil {
		c.Err = tResult.Err
		return
	} else {
		team = tResult.Data.(*model.Team)
	}

	team.AllowValet = allowValet

	if result := <-Srv.Store.Team().Update(team); result.Err != nil {
		c.Err = result.Err
		return
	}

	w.Write([]byte(model.MapToJson(props)))
}

func getMyTeam(c *Context, w http.ResponseWriter, r *http.Request) {

	if len(c.Session.TeamId) == 0 {
		return
	}

	if result := <-Srv.Store.Team().Get(c.Session.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else if HandleEtag(result.Data.(*model.Team).Etag(), w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, result.Data.(*model.Team).Etag())
		w.Header().Set("Expires", "-1")
		w.Write([]byte(result.Data.(*model.Team).ToJson()))
		return
	}
}
