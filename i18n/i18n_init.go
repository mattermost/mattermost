package i18n

import (
	"github.com/nicksnyder/go-i18n/i18n"
	"github.com/mattermost/platform/model"
	"github.com/cloudfoundry/jibber_jabber"
	"net/http"
	"strings"
)

var TranslateFunc i18n.TranslateFunc
var languages = [2]string{"es", "en"}

func Init() {
	i18n.MustLoadTranslationFile("./i18n/en.all.json")
	i18n.MustLoadTranslationFile("./i18n/es.all.json")
}

func GetSystemLanguage() (i18n.TranslateFunc) {
	lang := languages[0]
	if userLanguage, err := jibber_jabber.DetectLanguage(); err == nil {
		lang = userLanguage
	}
	Lang, _ := i18n.Tfunc(lang)
	return Lang
}

func SetLanguage(lang string) (i18n.TranslateFunc) {
	Lang, _ := i18n.Tfunc(lang)
	return Lang
}

func Language(w http.ResponseWriter, r *http.Request) (i18n.TranslateFunc) {
	var Lang i18n.TranslateFunc
	var _ error
	langCookie := ""
	if cookie, err := r.Cookie(model.SESSION_LANGUAGE); err == nil {
		langCookie = cookie.Value
		if contains(langCookie) {
			Lang, _ = i18n.Tfunc(langCookie)
			return Lang
		}
	}

	langHeader := strings.Split(strings.Split(r.Header.Get("Accept-Language"), ",")[0], "-")[0]
	if contains(langHeader) {
		Lang, _ = i18n.Tfunc(langHeader)
		SetLanguageCookie(w, langHeader)
		return Lang
	}

	Lang, _ = i18n.Tfunc(languages[0])
	SetLanguageCookie(w, languages[0])
	return Lang
}

func GetLanguage(w http.ResponseWriter, r *http.Request) (i18n.TranslateFunc, string) {
	var Lang i18n.TranslateFunc
	var _ error
	langCookie := ""
	if cookie, err := r.Cookie(model.SESSION_LANGUAGE); err == nil {
		langCookie = cookie.Value
		if contains(langCookie) {
			Lang, _ = i18n.Tfunc(langCookie)
			return Lang, langCookie
		}
	}

	langHeader := strings.Split(strings.Split(r.Header.Get("Accept-Language"), ",")[0], "-")[0]
	if contains(langHeader) {
		Lang, _ = i18n.Tfunc(langHeader)
		SetLanguageCookie(w, langHeader)
		return Lang, langHeader
	}

	Lang, _ = i18n.Tfunc(languages[0])
	SetLanguageCookie(w, languages[0])
	return Lang, languages[0]
}

func SetLanguageCookie(w http.ResponseWriter, lang string) {
	maxAge := model.SESSION_TIME_WEB_IN_SECS
	cookie := &http.Cookie{
		Name:	model.SESSION_LANGUAGE,
		Value:	lang,
		Path:	"/",
		MaxAge: maxAge,
	}

	http.SetCookie(w, cookie)
}

func contains(l string) bool {
	for _, a := range languages {
		if a == l {
			return true
		}
	}
	return false
}