package plugin

type Hooks interface {
	OnActivate(API)
	OnDeactivate()
}
