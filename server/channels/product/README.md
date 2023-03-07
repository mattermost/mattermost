# Product

Package product defines the interfaces provided in the multi-product architecture framework. The service interfaces are designed to be a drop in replacement for services defined in the https://github.com/mattermost/mattermost-plugin-api project. Due to limitations such as the use of https://github.com/mattermost/mattermost-server/blob/master/plugin/api.go emerged this new API. Our hope is to use a single API definition or maybe even more interesting solutions like using the app.AppIFace instead (temporarily).

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

The `app.Server` will take care of starting and stopping products. The product shall register itself via a function called `RegisterProduct` provided by `github.com/mattermost/mattermost-server/server/v7/app` package. To register a product,
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
	app.RegisterProduct("focalboard", app.ProductManifest{
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

### Adding services to the framework

A product can provide services to the framework. In fact, `Channels` product provides many services by itself, so it will only need to register the service to `services` map provided by the product initializer. An example of registering a service to the "registry" is shown below:

```Go
func NewChannels(*app.Server, map[app.ServiceKey]interface{}) (app.Product, error){
	...
	services[app.PostKey] = &postService{
		...
	}
	...
}
```

To improve the developer experience, you should also add the service interface to the [api definition](api.go) so that a consumer of the service can explore the methods available to them. Another good practice would be to add the servie key to the [server.go](../app/server.go) file.

### How does a product get initialized?

The overall server initialization starts with essential components such as the store, config etc. Right after that we start to initialize the services which are either a standalone service such as the `FileStore` and `UserService` or some services which are eventually wrappers to the server struct itself such as `ClusterService` and `LicenseService`. And the initial service map is created after these stages.

```Go
func NewServer(options ...Option) (*Server, error) {
	...
	s := &Server{}
	...
	serviceMap := map[ServiceKey]interface{}{
		...
	}

	if err := s.initializeProducts(products, serviceMap); err != nil {
		return nil, errors.Wrap(err, "failed to initialize products")
	}
	...
}
```

And the product initialization is figured out by a trial and error fashion hence it is done by a maximum possible trials of initialization attempts. The order is not determined elsewhere therefore we do a on the fly sorting here. Which means the initialization order will be resolved during the loop.  We have dependencies defined in the product manifest defined above. During the initialization we check if the serviceMap has all the dependencies registered. If not, we continue to the try initialize other products and register their services if they have any.

### How to add a product to the mattermost-server?

We don't need to define a product dependency in the `go.mod` file, we can leverage the [module workspaces](https://go.dev/ref/mod#workspaces) here.  You can get more info about how we use it [here](https://docs.google.com/document/d/1Uwg_dTSNR9mx9ZDx-7osjlD4n3w13cnG6Kpz3ZGXzsM). We create another file such as `go.work`, and add the dependency there as following:

```
go 1.18
use ./
use ../sample-product
```

This tells the compiler to include `sample-product` to be compiled with the mattermost-server. And in order to trigger `init()` function of a product we add an empty import to a file as following:

```Go
package imports

import (
	...
	// Product Imports
	_ "github.com/mattermost/focalboard/product"
)
```

### Frequently asked questions

#### Can a product use app.App instead of services?

Theoretically yes, but you shouldn't. The reason is we want to figure out the common entry points and use cases for the services so that we can divide the App into meaningful and functional sub services. The current service interfaces are great example of how we want to use the services among the products.

#### How to handle circular dependency of two products?

We are not expecting this is a requirement for the initial phase, once we complete the first product migration we can think start thinking about this. The first attempt would be to increase the granularity of the initialization phase by adopting service initialization resolution. So that a service can be initialized even a product initialization starts.
