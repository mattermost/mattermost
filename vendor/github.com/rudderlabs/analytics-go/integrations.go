package analytics

// This type is used to represent integrations in messages that support it.
// It is a free-form where values are most often booleans that enable or
// disable integrations.
// Here's a quick example of how this type is meant to be used:
//
//	analytics.Track{
//		UserId:       "0123456789",
//		Integrations: analytics.NewIntegrations()
//			.EnableAll()
//			.Disable("Salesforce")
//			.Disable("Marketo"),
//	}
//
// The specifications can be found at https://segment.com/docs/spec/common/#integrations
type Integrations map[string]interface{}

func NewIntegrations() Integrations {
	return make(Integrations, 10)
}

func (i Integrations) EnableAll() Integrations {
	return i.Enable("all")
}

func (i Integrations) DisableAll() Integrations {
	return i.Disable("all")
}

func (i Integrations) Enable(name string) Integrations {
	return i.Set(name, true)
}

func (i Integrations) Disable(name string) Integrations {
	return i.Set(name, false)
}

// Sets an integration named by the first argument to the specified value, any
// value other than `false` will be interpreted as enabling the integration.
func (i Integrations) Set(name string, value interface{}) Integrations {
	i[name] = value
	return i
}
