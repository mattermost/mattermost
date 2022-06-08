# Product

Package product defines the interfaces provided in the multi-product architecture framework. The service interfaces are designed to be a drop in replacement for services defined in the https://github.com/mattermost/mattermost-plugin-api project. Due to limitations such as the use of https://github.com/mattermost/mattermost-server/blob/master/plugin/api.go emerged this new API. Our hope is to use a single API definition or maybe even more interesting solutions like using the app.AppIFace instead.

## Multi-product architecture framework

The main goal of multi-product architecture effort is to divide the prominent “app” package into sub packages so that we can maintain the complexity and lay the groundwork for future scaling opportunities. And the framework is the implementation of this idea. Currently the framework is very early to be stable and it's going to be evolve in time once we start using it.

### How does the framework work?

A product should conform to the following interface:

```Go
type Product interface {
	Start() error
	Stop() error
}
```

The `app.Server` will take care of starting and stopping products. The product shall register itself via a function called `RegisterProduct` provided by `github.com/mattermost/mattermost-server/v6/app` package. To register a product,
a product initializer is required. The signature of a product initializer is defined as following:

```Go
type app.ProductManifest struct {
	Initializer  func(*app.Server, map[app.ServiceKey]interface{}) (app.Product, error)
	Dependencies map[app.ServiceKey]struct{}
}
```

Note that adding dependencies is crucial to let product framework sort product initialization. For example Channels product provides the `product.PostService` implementation therefore it should be initialized before the Boards product since it requires the PostService. An example registration could be depicted as following:

```Go
func init() {
	app.RegisterProduct("boards", app.ProductManifest{
		Initializer:  NewBoards,
		Dependencies: map[app.ServiceKey]struct{}{
            app.PostKey:        {},
			app.PermissionsKey: {},
			app.UserKey:        {},
			...
        },
	})
}
```
