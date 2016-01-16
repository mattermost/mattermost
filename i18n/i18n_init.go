package i18n

import (
	"github.com/nicksnyder/go-i18n/i18n"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/cloudfoundry/jibber_jabber"
	"net/http"
	"strings"
	"reflect"
	"regexp"
	"io/ioutil"
	"path/filepath"
)

var keyRegexp = regexp.MustCompile(`:[[:word:]]+`)
var TranslateFunc i18n.TranslateFunc
var locales = []string{}
var i18nDirectory = "./i18n/"

func Init() {
	files, _ := ioutil.ReadDir(i18nDirectory)
	for _, f := range files {
		if filepath.Ext(f.Name()) == ".json" {
			filename := f.Name()
			locales = append(locales, strings.Split(filename, ".")[0])
			i18n.MustLoadTranslationFile(i18nDirectory + filename)
		}
	}
}

//GetTranslationsBySystemLocale get the Translations based on the LC_ALL OR LANG Environt variables
func GetTranslationsBySystemLocale() (i18n.TranslateFunc) {
	locale := model.DEFAULT_LOCALE
	if userLanguage, err := jibber_jabber.DetectLanguage(); err == nil {
		locale = userLanguage
	}
	translations, _ := i18n.Tfunc(locale)
	return translations
}

func SetTranslations(locale string) (i18n.TranslateFunc) {
	translations, _ := i18n.Tfunc(locale)
	return translations
}

func GetTranslations(w http.ResponseWriter, r *http.Request) (i18n.TranslateFunc) {
	translations, _ := getTranslationsAndLocale(w, r)
	return translations
}

func GetTranslationsAndLocale(w http.ResponseWriter, r *http.Request) (i18n.TranslateFunc, string) {
	return getTranslationsAndLocale(w, r)
}

func SetLocaleCookie(w http.ResponseWriter, lang string) {
	maxAge := (*utils.Cfg.ServiceSettings.SessionCacheInMinutes*60)
	cookie := &http.Cookie{
		Name:	model.SESSION_LOCALE,
		Value:	lang,
		Path:	"/",
		MaxAge: maxAge,
	}

	http.SetCookie(w, cookie)
}

func MaybeExpandNamedText(text string, args ...interface{}) string {
	var (
		arg    = args[0]
		argval = reflect.ValueOf(arg)
	)
	if argval.Kind() == reflect.Ptr {
		argval = argval.Elem()
	}

	if argval.Kind() == reflect.Map && argval.Type().Key().Kind() == reflect.String {
		return expandNamedText(text, func(key string) reflect.Value {
			return argval.MapIndex(reflect.ValueOf(key))
		})
	}
	if argval.Kind() != reflect.Struct {
		return text
	}

	return expandNamedText(text, argval.FieldByName)
}

func contains(l string) bool {
	for _, a := range locales {
		if a == l {
			return true
		}
	}
	return false
}

func expandNamedText(text string, keyGetter func(key string) reflect.Value) string {
	return keyRegexp.ReplaceAllStringFunc(text, func(key string) string {
		val := keyGetter(key[1:])
		if !val.IsValid() {
			return key
		}
		newVar, _ := val.Interface().(string)
		return newVar
	})
}

func getTranslationsAndLocale(w http.ResponseWriter, r *http.Request) (i18n.TranslateFunc, string) {
	var translations i18n.TranslateFunc
	var _ error
	localeCookie := ""
	if cookie, err := r.Cookie(model.SESSION_LOCALE); err == nil {
		localeCookie = cookie.Value
		if contains(localeCookie) {
			translations, _ = i18n.Tfunc(localeCookie)
			return translations, localeCookie
		}
	}

	localeCookie = strings.Split(strings.Split(r.Header.Get("Accept-Language"), ",")[0], "-")[0]
	if contains(localeCookie) {
		translations, _ = i18n.Tfunc(localeCookie)
		SetLocaleCookie(w, localeCookie)
		return translations, localeCookie
	}

	translations, _ = i18n.Tfunc(model.DEFAULT_LOCALE)
	SetLocaleCookie(w, model.DEFAULT_LOCALE)
	return translations, model.DEFAULT_LOCALE
}