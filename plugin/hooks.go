package plugin

type Hooks interface {
	OnActivate(API) error
	OnDeactivate() error
}
