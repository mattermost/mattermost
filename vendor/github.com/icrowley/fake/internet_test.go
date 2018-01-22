package fake

import (
	"testing"
)

func TestInternet(t *testing.T) {
	for _, lang := range GetLangs() {
		SetLang(lang)

		v := UserName()
		if v == "" {
			t.Errorf("UserName failed with lang %s", lang)
		}

		v = TopLevelDomain()
		if v == "" {
			t.Errorf("TopLevelDomain failed with lang %s", lang)
		}

		v = DomainName()
		if v == "" {
			t.Errorf("DomainName failed with lang %s", lang)
		}

		v = EmailAddress()
		if v == "" {
			t.Errorf("EmailAddress failed with lang %s", lang)
		}

		v = EmailSubject()
		if v == "" {
			t.Errorf("EmailSubject failed with lang %s", lang)
		}

		v = EmailBody()
		if v == "" {
			t.Errorf("EmailBody failed with lang %s", lang)
		}

		v = DomainZone()
		if v == "" {
			t.Errorf("DomainZone failed with lang %s", lang)
		}

		v = IPv4()
		if v == "" {
			t.Errorf("IPv4 failed with lang %s", lang)
		}

		v = UserAgent()
		if v == "" {
			t.Errorf("UserAgent failed with lang %s", lang)
		}

		v = IPv6()
		if v == "" {
			t.Errorf("IPv6 failed with lang %s", lang)
		}
	}
}
