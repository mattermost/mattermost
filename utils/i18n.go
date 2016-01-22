package utils

import (
	"io/ioutil"
	"net/http"
	"path/filepath"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/cloudfoundry/jibber_jabber"
	"github.com/mattermost/platform/model"
	"github.com/nicksnyder/go-i18n/i18n"
)

const (
	SESSION_LOCALE = "MMLOCALE"
)

var T i18n.TranslateFunc
var locales map[string]string = make(map[string]string)

func InitTranslations() {
	i18nDirectory := FindDir("i18n")
	files, _ := ioutil.ReadDir(i18nDirectory)
	for _, f := range files {
		if filepath.Ext(f.Name()) == ".json" {
			filename := f.Name()
			locales[strings.Split(filename, ".")[0]] = i18nDirectory + filename
			i18n.MustLoadTranslationFile(i18nDirectory + filename)
		}
	}

	T = GetTranslationsBySystemLocale()
}

func GetTranslationsBySystemLocale() i18n.TranslateFunc {
	locale := model.DEFAULT_LOCALE
	if userLanguage, err := jibber_jabber.DetectLanguage(); err == nil {
		if _, ok := locales[userLanguage]; ok {
			locale = userLanguage
		} else {
			l4g.Error("Failed to load system translations for '%v' attempting to fall back to '%v'", locale, model.DEFAULT_LOCALE)
			locale = model.DEFAULT_LOCALE
		}
	}

	if locales[locale] == "" {
		panic("Failed to load system translations for '" + model.DEFAULT_LOCALE + "'")
	}

	translations, _ := i18n.Tfunc(locale)
	if translations == nil {
		panic("Failed to load system translations")
	}

	l4g.Info(translations("utils.i18n.loaded"), locale, locales[locale])
	return translations
}

func GetUserTranslations(locale string) i18n.TranslateFunc {
	if _, ok := locales[locale]; !ok {
		locale = model.DEFAULT_LOCALE
	}

	translations, _ := i18n.Tfunc(locale)
	return translations
}

func SetTranslations(locale string) i18n.TranslateFunc {
	translations, _ := i18n.Tfunc(locale)
	return translations
}

// func GetTranslations(w http.ResponseWriter, r *http.Request) i18n.TranslateFunc {
// 	translations, _ := getTranslationsAndLocale(w, r)
// 	return translations
// }

// func GetTranslationsAndLocale(w http.ResponseWriter, r *http.Request) (i18n.TranslateFunc, string) {
// 	return getTranslationsAndLocale(w, r)
// }

func SetLocaleCookie(w http.ResponseWriter, lang string, sessionCacheInMinutes int) {
	maxAge := (sessionCacheInMinutes * 60)
	cookie := &http.Cookie{
		Name:   SESSION_LOCALE,
		Value:  lang,
		Path:   "/",
		MaxAge: maxAge,
	}

	http.SetCookie(w, cookie)
}

// var keyRegexp = regexp.MustCompile(`:[[:word:]]+`)
// func MaybeExpandNamedText(text string, args ...interface{}) string {
// 	var (
// 		arg    = args[0]
// 		argval = reflect.ValueOf(arg)
// 	)
// 	if argval.Kind() == reflect.Ptr {
// 		argval = argval.Elem()
// 	}

// 	if argval.Kind() == reflect.Map && argval.Type().Key().Kind() == reflect.String {
// 		return expandNamedText(text, func(key string) reflect.Value {
// 			return argval.MapIndex(reflect.ValueOf(key))
// 		})
// 	}
// 	if argval.Kind() != reflect.Struct {
// 		return text
// 	}

// 	return expandNamedText(text, argval.FieldByName)
// }

// func expandNamedText(text string, keyGetter func(key string) reflect.Value) string {
// 	return keyRegexp.ReplaceAllStringFunc(text, func(key string) string {
// 		val := keyGetter(key[1:])
// 		if !val.IsValid() {
// 			return key
// 		}
// 		newVar, _ := val.Interface().(string)
// 		return newVar
// 	})
// }

func GetTranslationsAndLocale(w http.ResponseWriter, r *http.Request) (i18n.TranslateFunc, string) {
	var translations i18n.TranslateFunc
	var _ error
	localeCookie := ""
	if cookie, err := r.Cookie(SESSION_LOCALE); err == nil {
		localeCookie = cookie.Value
		if locales[localeCookie] != "" {
			translations, _ = i18n.Tfunc(localeCookie)
			return translations, localeCookie
		}
	}

	localeCookie = strings.Split(strings.Split(r.Header.Get("Accept-Language"), ",")[0], "-")[0]
	if locales[localeCookie] != "" {
		translations, _ = i18n.Tfunc(localeCookie)
		SetLocaleCookie(w, localeCookie, 10)
		return translations, localeCookie
	}

	translations, _ = i18n.Tfunc(model.DEFAULT_LOCALE)
	SetLocaleCookie(w, model.DEFAULT_LOCALE, 10)
	return translations, model.DEFAULT_LOCALE
}
