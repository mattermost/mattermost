// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"hash/fnv"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/disintegration/imaging"
	"github.com/golang/freetype"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func CreateUserWithHash(user *model.User, hash string, data string) (*model.User, *model.AppError) {
	props := model.MapFromJson(strings.NewReader(data))

	if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt)) {
		return nil, model.NewLocAppError("CreateUserWithHash", "api.user.create_user.signup_link_invalid.app_error", nil, "")
	}

	if t, err := strconv.ParseInt(props["time"], 10, 64); err != nil || model.GetMillis()-t > 1000*60*60*48 { // 48 hours
		return nil, model.NewLocAppError("CreateUserWithHash", "api.user.create_user.signup_link_expired.app_error", nil, "")
	}

	teamId := props["id"]

	var team *model.Team
	if result := <-Srv.Store.Team().Get(teamId); result.Err != nil {
		return nil, result.Err
	} else {
		team = result.Data.(*model.Team)
	}

	user.Email = props["email"]
	user.EmailVerified = true

	var ruser *model.User
	var err *model.AppError
	if ruser, err = CreateUser(user); err != nil {
		return nil, err
	}

	if err := JoinUserToTeam(team, ruser); err != nil {
		return nil, err
	}

	AddDirectChannels(team.Id, ruser)

	return ruser, nil
}

func CreateUserWithInviteId(user *model.User, inviteId string) (*model.User, *model.AppError) {
	var team *model.Team
	if result := <-Srv.Store.Team().GetByInviteId(inviteId); result.Err != nil {
		return nil, result.Err
	} else {
		team = result.Data.(*model.Team)
	}

	var ruser *model.User
	var err *model.AppError
	if ruser, err = CreateUser(user); err != nil {
		return nil, err
	}

	if err := JoinUserToTeam(team, ruser); err != nil {
		return nil, err
	}

	AddDirectChannels(team.Id, ruser)

	return ruser, nil
}

func IsFirstUserAccount() bool {
	if SessionCacheLength() == 0 {
		if cr := <-Srv.Store.User().GetTotalUsersCount(); cr.Err != nil {
			l4g.Error(cr.Err)
			return false
		} else {
			count := cr.Data.(int64)
			if count <= 0 {
				return true
			}
		}
	}

	return false
}

func CreateUser(user *model.User) (*model.User, *model.AppError) {

	user.Roles = model.ROLE_SYSTEM_USER.Id

	// Below is a special case where the first user in the entire
	// system is granted the system_admin role
	if result := <-Srv.Store.User().GetTotalUsersCount(); result.Err != nil {
		return nil, result.Err
	} else {
		count := result.Data.(int64)
		if count <= 0 {
			user.Roles = model.ROLE_SYSTEM_ADMIN.Id + " " + model.ROLE_SYSTEM_USER.Id
		}
	}

	user.MakeNonNil()
	user.Locale = *utils.Cfg.LocalizationSettings.DefaultClientLocale

	if err := utils.IsPasswordValid(user.Password); user.AuthService == "" && err != nil {
		return nil, err
	}

	if result := <-Srv.Store.User().Save(user); result.Err != nil {
		l4g.Error(utils.T("api.user.create_user.save.error"), result.Err)
		return nil, result.Err
	} else {
		ruser := result.Data.(*model.User)

		if user.EmailVerified {
			if err := VerifyUserEmail(ruser.Id); err != nil {
				l4g.Error(utils.T("api.user.create_user.verified.error"), err)
			}
		}

		pref := model.Preference{UserId: ruser.Id, Category: model.PREFERENCE_CATEGORY_TUTORIAL_STEPS, Name: ruser.Id, Value: "0"}
		if presult := <-Srv.Store.Preference().Save(&model.Preferences{pref}); presult.Err != nil {
			l4g.Error(utils.T("api.user.create_user.tutorial.error"), presult.Err.Message)
		}

		ruser.Sanitize(map[string]bool{})

		// This message goes to everyone, so the teamId, channelId and userId are irrelevant
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_NEW_USER, "", "", "", nil)
		message.Add("user_id", ruser.Id)
		go Publish(message)

		return ruser, nil
	}
}

func CreateOAuthUser(service string, userData io.Reader, teamId string) (*model.User, *model.AppError) {
	var user *model.User
	provider := einterfaces.GetOauthProvider(service)
	if provider == nil {
		return nil, model.NewLocAppError("CreateOAuthUser", "api.user.create_oauth_user.not_available.app_error", map[string]interface{}{"Service": strings.Title(service)}, "")
	} else {
		user = provider.GetUserFromJson(userData)
	}

	if user == nil {
		return nil, model.NewLocAppError("CreateOAuthUser", "api.user.create_oauth_user.create.app_error", map[string]interface{}{"Service": service}, "")
	}

	suchan := Srv.Store.User().GetByAuth(user.AuthData, service)
	euchan := Srv.Store.User().GetByEmail(user.Email)

	found := true
	count := 0
	for found {
		if found = IsUsernameTaken(user.Username); found {
			user.Username = user.Username + strconv.Itoa(count)
			count += 1
		}
	}

	if result := <-suchan; result.Err == nil {
		return nil, model.NewLocAppError("CreateOAuthUser", "api.user.create_oauth_user.already_used.app_error", map[string]interface{}{"Service": service}, "email="+user.Email)
	}

	if result := <-euchan; result.Err == nil {
		authService := result.Data.(*model.User).AuthService
		if authService == "" {
			return nil, model.NewLocAppError("CreateOAuthUser", "api.user.create_oauth_user.already_attached.app_error",
				map[string]interface{}{"Service": service, "Auth": model.USER_AUTH_SERVICE_EMAIL}, "email="+user.Email)
		} else {
			return nil, model.NewLocAppError("CreateOAuthUser", "api.user.create_oauth_user.already_attached.app_error",
				map[string]interface{}{"Service": service, "Auth": authService}, "email="+user.Email)
		}
	}

	user.EmailVerified = true

	ruser, err := CreateUser(user)
	if err != nil {
		return nil, err
	}

	if len(teamId) > 0 {
		err = AddUserToTeamByTeamId(teamId, user)
		if err != nil {
			return nil, err
		}

		err = AddDirectChannels(teamId, user)
		if err != nil {
			l4g.Error(err.Error())
		}
	}

	return ruser, nil
}

// Check if the username is already used by another user. Return false if the username is invalid.
func IsUsernameTaken(name string) bool {

	if !model.IsValidUsername(name) {
		return false
	}

	if result := <-Srv.Store.User().GetByUsername(name); result.Err != nil {
		return false
	} else {
		return true
	}

	return false
}

func GetUser(userId string) (*model.User, *model.AppError) {
	if result := <-Srv.Store.User().Get(userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.User), nil
	}
}

func GetUserByUsername(username string) (*model.User, *model.AppError) {
	if result := <-Srv.Store.User().GetByUsername(username); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.User), nil
	}
}

func GetUserByEmail(email string) (*model.User, *model.AppError) {
	if result := <-Srv.Store.User().GetByEmail(email); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.User), nil
	}
}

func GetUserByAuth(authData *string, authService string) (*model.User, *model.AppError) {
	if result := <-Srv.Store.User().GetByAuth(authData, authService); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.User), nil
	}
}

func GetUserForLogin(loginId string, onlyLdap bool) (*model.User, *model.AppError) {
	ldapAvailable := *utils.Cfg.LdapSettings.Enable && einterfaces.GetLdapInterface() != nil && utils.IsLicensed && *utils.License.Features.LDAP

	if result := <-Srv.Store.User().GetForLogin(
		loginId,
		*utils.Cfg.EmailSettings.EnableSignInWithUsername && !onlyLdap,
		*utils.Cfg.EmailSettings.EnableSignInWithEmail && !onlyLdap,
		ldapAvailable,
	); result.Err != nil && result.Err.Id == "store.sql_user.get_for_login.multiple_users" {
		// don't fall back to LDAP in this case since we already know there's an LDAP user, but that it shouldn't work
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else if result.Err != nil {
		if !ldapAvailable {
			// failed to find user and no LDAP server to fall back on
			result.Err.StatusCode = http.StatusBadRequest
			return nil, result.Err
		}

		// fall back to LDAP server to see if we can find a user
		if ldapUser, ldapErr := einterfaces.GetLdapInterface().GetUser(loginId); ldapErr != nil {
			ldapErr.StatusCode = http.StatusBadRequest
			return nil, ldapErr
		} else {
			return ldapUser, nil
		}
	} else {
		return result.Data.(*model.User), nil
	}
}

func GetUsers(offset int, limit int) (map[string]*model.User, *model.AppError) {
	if result := <-Srv.Store.User().GetAllProfiles(offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(map[string]*model.User), nil
	}
}

func GetUsersEtag() string {
	return (<-Srv.Store.User().GetEtagForAllProfiles()).Data.(string)
}

func GetUsersInTeam(teamId string, offset int, limit int) (map[string]*model.User, *model.AppError) {
	if result := <-Srv.Store.User().GetProfiles(teamId, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(map[string]*model.User), nil
	}
}

func GetUsersInTeamEtag(teamId string) string {
	return (<-Srv.Store.User().GetEtagForProfiles(teamId)).Data.(string)
}

func GetUsersInChannel(channelId string, offset int, limit int) (map[string]*model.User, *model.AppError) {
	if result := <-Srv.Store.User().GetProfilesInChannel(channelId, offset, limit, false); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(map[string]*model.User), nil
	}
}

func GetUsersNotInChannel(teamId string, channelId string, offset int, limit int) (map[string]*model.User, *model.AppError) {
	if result := <-Srv.Store.User().GetProfilesNotInChannel(teamId, channelId, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(map[string]*model.User), nil
	}
}

func GetUsersByIds(userIds []string) (map[string]*model.User, *model.AppError) {
	if result := <-Srv.Store.User().GetProfileByIds(userIds, true); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(map[string]*model.User), nil
	}
}

func ActivateMfa(userId, token string) *model.AppError {
	mfaInterface := einterfaces.GetMfaInterface()
	if mfaInterface == nil {
		err := model.NewLocAppError("ActivateMfa", "api.user.update_mfa.not_available.app_error", nil, "")
		err.StatusCode = http.StatusNotImplemented
		return err
	}

	var user *model.User
	if result := <-Srv.Store.User().Get(userId); result.Err != nil {
		return result.Err
	} else {
		user = result.Data.(*model.User)
	}

	if len(user.AuthService) > 0 && user.AuthService != model.USER_AUTH_SERVICE_LDAP {
		return model.NewLocAppError("ActivateMfa", "api.user.activate_mfa.email_and_ldap_only.app_error", nil, "")
	}

	if err := mfaInterface.Activate(user, token); err != nil {
		return err
	}

	return nil
}

func DeactivateMfa(userId string) *model.AppError {
	mfaInterface := einterfaces.GetMfaInterface()
	if mfaInterface == nil {
		err := model.NewLocAppError("DeactivateMfa", "api.user.update_mfa.not_available.app_error", nil, "")
		err.StatusCode = http.StatusNotImplemented
		return err
	}

	if err := mfaInterface.Deactivate(userId); err != nil {
		return err
	}

	return nil
}

func CreateProfileImage(username string, userId string) ([]byte, *model.AppError) {
	colors := []color.NRGBA{
		{197, 8, 126, 255},
		{227, 207, 18, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
	}

	h := fnv.New32a()
	h.Write([]byte(userId))
	seed := h.Sum32()

	initial := string(strings.ToUpper(username)[0])

	fontBytes, err := ioutil.ReadFile(utils.FindDir("fonts") + utils.Cfg.FileSettings.InitialFont)
	if err != nil {
		return nil, model.NewLocAppError("CreateProfileImage", "api.user.create_profile_image.default_font.app_error", nil, err.Error())
	}
	font, err := freetype.ParseFont(fontBytes)
	if err != nil {
		return nil, model.NewLocAppError("CreateProfileImage", "api.user.create_profile_image.default_font.app_error", nil, err.Error())
	}

	width := int(utils.Cfg.FileSettings.ProfileWidth)
	height := int(utils.Cfg.FileSettings.ProfileHeight)
	color := colors[int64(seed)%int64(len(colors))]
	dstImg := image.NewRGBA(image.Rect(0, 0, width, height))
	srcImg := image.White
	draw.Draw(dstImg, dstImg.Bounds(), &image.Uniform{color}, image.ZP, draw.Src)
	size := float64((width + height) / 4)

	c := freetype.NewContext()
	c.SetFont(font)
	c.SetFontSize(size)
	c.SetClip(dstImg.Bounds())
	c.SetDst(dstImg)
	c.SetSrc(srcImg)

	pt := freetype.Pt(width/6, height*2/3)
	_, err = c.DrawString(initial, pt)
	if err != nil {
		return nil, model.NewLocAppError("CreateProfileImage", "api.user.create_profile_image.initial.app_error", nil, err.Error())
	}

	buf := new(bytes.Buffer)

	if imgErr := png.Encode(buf, dstImg); imgErr != nil {
		return nil, model.NewLocAppError("CreateProfileImage", "api.user.create_profile_image.encode.app_error", nil, imgErr.Error())
	} else {
		return buf.Bytes(), nil
	}
}

func GetProfileImage(user *model.User) ([]byte, *model.AppError) {
	var img []byte

	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		var err *model.AppError
		if img, err = CreateProfileImage(user.Username, user.Id); err != nil {
			return nil, err
		}
	} else {
		path := "users/" + user.Id + "/profile.png"

		if data, err := ReadFile(path); err != nil {
			if img, err = CreateProfileImage(user.Username, user.Id); err != nil {
				return nil, err
			}

			if user.LastPictureUpdate == 0 {
				if err := WriteFile(img, path); err != nil {
					return nil, err
				}
			}

		} else {
			img = data
		}
	}

	return img, nil
}

func SetProfileImage(userId string, imageData *multipart.FileHeader) *model.AppError {
	file, err := imageData.Open()
	defer file.Close()
	if err != nil {
		return model.NewLocAppError("SetProfileImage", "api.user.upload_profile_user.open.app_error", nil, err.Error())
	}

	// Decode image config first to check dimensions before loading the whole thing into memory later on
	config, _, err := image.DecodeConfig(file)
	if err != nil {
		return model.NewLocAppError("SetProfileImage", "api.user.upload_profile_user.decode_config.app_error", nil, err.Error())
	} else if config.Width*config.Height > model.MaxImageSize {
		return model.NewLocAppError("SetProfileImage", "api.user.upload_profile_user.too_large.app_error", nil, err.Error())
	}

	file.Seek(0, 0)

	// Decode image into Image object
	img, _, err := image.Decode(file)
	if err != nil {
		return model.NewLocAppError("SetProfileImage", "api.user.upload_profile_user.decode.app_error", nil, err.Error())
	}

	// Scale profile image
	img = imaging.Resize(img, utils.Cfg.FileSettings.ProfileWidth, utils.Cfg.FileSettings.ProfileHeight, imaging.Lanczos)

	buf := new(bytes.Buffer)
	err = png.Encode(buf, img)
	if err != nil {
		return model.NewLocAppError("SetProfileImage", "api.user.upload_profile_user.encode.app_error", nil, err.Error())
	}

	path := "users/" + userId + "/profile.png"

	if err := WriteFile(buf.Bytes(), path); err != nil {
		return model.NewLocAppError("SetProfileImage", "api.user.upload_profile_user.upload_profile.app_error", nil, "")
	}

	Srv.Store.User().UpdateLastPictureUpdate(userId)

	if user, err := GetUser(userId); err != nil {
		l4g.Error(utils.T("api.user.get_me.getting.error"), userId)
	} else {
		options := utils.Cfg.GetSanitizeOptions()
		user.SanitizeProfile(options)

		omitUsers := make(map[string]bool, 1)
		omitUsers[userId] = true
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_UPDATED, "", "", "", omitUsers)
		message.Add("user", user)

		Publish(message)
	}

	return nil
}

func UpdateActive(user *model.User, active bool) (*model.User, *model.AppError) {
	if active {
		user.DeleteAt = 0
	} else {
		user.DeleteAt = model.GetMillis()
	}

	if result := <-Srv.Store.User().Update(user, true); result.Err != nil {
		return nil, result.Err
	} else {
		if user.DeleteAt > 0 {
			if err := RevokeAllSessions(user.Id); err != nil {
				return nil, err
			}
		}

		if extra := <-Srv.Store.Channel().ExtraUpdateByUser(user.Id, model.GetMillis()); extra.Err != nil {
			return nil, extra.Err
		}

		ruser := result.Data.([2]*model.User)[0]
		options := utils.Cfg.GetSanitizeOptions()
		options["passwordupdate"] = false
		ruser.Sanitize(options)

		if !active {
			SetStatusOffline(ruser.Id, false)
		}

		return ruser, nil
	}
}

func UpdateUser(user *model.User, siteURL string) (*model.User, *model.AppError) {
	if result := <-Srv.Store.User().Update(user, false); result.Err != nil {
		return nil, result.Err
	} else {
		rusers := result.Data.([2]*model.User)

		if rusers[0].Email != rusers[1].Email {
			go func() {
				if err := SendEmailChangeEmail(rusers[1].Email, rusers[0].Email, rusers[0].Locale, siteURL); err != nil {
					l4g.Error(err.Error())
				}
			}()

			if utils.Cfg.EmailSettings.RequireEmailVerification {
				go func() {
					if err := SendEmailChangeVerifyEmail(rusers[0].Id, rusers[0].Email, rusers[0].Locale, siteURL); err != nil {
						l4g.Error(err.Error())
					}
				}()
			}
		}

		if rusers[0].Username != rusers[1].Username {
			go func() {
				if err := SendChangeUsernameEmail(rusers[1].Username, rusers[0].Username, rusers[0].Email, rusers[0].Locale, siteURL); err != nil {
					l4g.Error(err.Error())
				}
			}()
		}

		InvalidateCacheForUser(user.Id)

		return rusers[0], nil
	}
}

func UpdatePassword(user *model.User, hashedPassword string) *model.AppError {
	if result := <-Srv.Store.User().UpdatePassword(user.Id, hashedPassword); result.Err != nil {
		return model.NewLocAppError("UpdatePassword", "api.user.update_password.failed.app_error", nil, result.Err.Error())
	}

	return nil
}

func UpdatePasswordSendEmail(user *model.User, hashedPassword, method, siteURL string) *model.AppError {
	if err := UpdatePassword(user, hashedPassword); err != nil {
		return err
	}

	go func() {
		if err := SendPasswordChangeEmail(user.Email, method, user.Locale, siteURL); err != nil {
			l4g.Error(err.Error())
		}
	}()

	return nil
}

func CreatePasswordRecovery(userId string) (*model.PasswordRecovery, *model.AppError) {
	recovery := &model.PasswordRecovery{}
	recovery.UserId = userId

	if result := <-Srv.Store.PasswordRecovery().SaveOrUpdate(recovery); result.Err != nil {
		return nil, result.Err
	}

	return recovery, nil
}

func GetPasswordRecovery(code string) (*model.PasswordRecovery, *model.AppError) {
	if result := <-Srv.Store.PasswordRecovery().GetByCode(code); result.Err != nil {
		return nil, model.NewLocAppError("GetPasswordRecovery", "api.user.reset_password.invalid_link.app_error", nil, result.Err.Error())
	} else {
		return result.Data.(*model.PasswordRecovery), nil
	}
}

func DeletePasswordRecoveryForUser(userId string) *model.AppError {
	if result := <-Srv.Store.PasswordRecovery().Delete(userId); result.Err != nil {
		return result.Err
	}

	return nil
}

func UpdateUserRoles(userId string, newRoles string) (*model.User, *model.AppError) {
	var user *model.User
	var err *model.AppError
	if user, err = GetUser(userId); err != nil {
		err.StatusCode = http.StatusBadRequest
		return nil, err
	}

	user.Roles = newRoles
	uchan := Srv.Store.User().Update(user, true)
	schan := Srv.Store.Session().UpdateRoles(user.Id, newRoles)

	var ruser *model.User
	if result := <-uchan; result.Err != nil {
		return nil, result.Err
	} else {
		ruser = result.Data.([2]*model.User)[0]
	}

	if result := <-schan; result.Err != nil {
		// soft error since the user roles were still updated
		l4g.Error(result.Err)
	}

	ClearSessionCacheForUser(user.Id)

	return ruser, nil
}

func PermanentDeleteUser(user *model.User) *model.AppError {
	l4g.Warn(utils.T("api.user.permanent_delete_user.attempting.warn"), user.Email, user.Id)
	if user.IsInRole(model.ROLE_SYSTEM_ADMIN.Id) {
		l4g.Warn(utils.T("api.user.permanent_delete_user.system_admin.warn"), user.Email)
	}

	if _, err := UpdateActive(user, false); err != nil {
		return err
	}

	if result := <-Srv.Store.Session().PermanentDeleteSessionsByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.OAuth().PermanentDeleteAuthDataByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Webhook().PermanentDeleteIncomingByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Webhook().PermanentDeleteOutgoingByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Command().PermanentDeleteByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Preference().PermanentDeleteByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Channel().PermanentDeleteMembersByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Post().PermanentDeleteByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.User().PermanentDelete(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Audit().PermanentDeleteByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Team().RemoveAllMembersByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.PasswordRecovery().Delete(user.Id); result.Err != nil {
		return result.Err
	}

	l4g.Warn(utils.T("api.user.permanent_delete_user.deleted.warn"), user.Email, user.Id)

	return nil
}

func PermanentDeleteAllUsers() *model.AppError {
	if result := <-Srv.Store.User().GetAll(); result.Err != nil {
		return result.Err
	} else {
		users := result.Data.([]*model.User)
		for _, user := range users {
			PermanentDeleteUser(user)
		}
	}

	return nil
}

func VerifyUserEmail(userId string) *model.AppError {
	if err := (<-Srv.Store.User().VerifyEmail(userId)).Err; err != nil {
		return err
	}

	return nil
}

func SearchUsersInChannel(channelId string, term string, searchOptions map[string]bool) ([]*model.User, *model.AppError) {
	if result := <-Srv.Store.User().SearchInChannel(channelId, term, searchOptions); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.User), nil
	}
}

func SearchUsersNotInChannel(teamId string, channelId string, term string, searchOptions map[string]bool) ([]*model.User, *model.AppError) {
	if result := <-Srv.Store.User().SearchNotInChannel(teamId, channelId, term, searchOptions); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.User), nil
	}
}

func SearchUsersInTeam(teamId string, term string, searchOptions map[string]bool) ([]*model.User, *model.AppError) {
	if result := <-Srv.Store.User().Search(teamId, term, searchOptions); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.User), nil
	}
}

func AutocompleteUsersInChannel(teamId string, channelId string, term string, searchOptions map[string]bool) (*model.UserAutocompleteInChannel, *model.AppError) {
	uchan := Srv.Store.User().SearchInChannel(channelId, term, searchOptions)
	nuchan := Srv.Store.User().SearchNotInChannel(teamId, channelId, term, searchOptions)

	autocomplete := &model.UserAutocompleteInChannel{}

	if result := <-uchan; result.Err != nil {
		return nil, result.Err
	} else {
		autocomplete.InChannel = result.Data.([]*model.User)
	}

	if result := <-nuchan; result.Err != nil {
		return nil, result.Err
	} else {
		autocomplete.OutOfChannel = result.Data.([]*model.User)
	}

	return autocomplete, nil
}

func AutocompleteUsersInTeam(teamId string, term string, searchOptions map[string]bool) (*model.UserAutocompleteInTeam, *model.AppError) {
	autocomplete := &model.UserAutocompleteInTeam{}

	if result := <-Srv.Store.User().Search(teamId, term, searchOptions); result.Err != nil {
		return nil, result.Err
	} else {
		autocomplete.InTeam = result.Data.([]*model.User)
	}

	return autocomplete, nil
}
