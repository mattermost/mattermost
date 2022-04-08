## Upgrade from v1 to v2
The only difference between v1 and v2 is that we added use of [context](https://golang.org/pkg/context).

```diff
- loader.Load(key string) Thunk
+ loader.Load(ctx context.Context, key string) Thunk
- loader.LoadMany(keys []string) ThunkMany
+ loader.LoadMany(ctx context.Context, keys []string) ThunkMany
```

```diff
- type BatchFunc func([]string) []*Result
+ type BatchFunc func(context.Context, []string) []*Result
```

## Upgrade from v2 to v3
```diff
// dataloader.Interface as added context.Context to methods
- loader.Prime(key string, value interface{}) Interface
+ loader.Prime(ctx context.Context, key string, value interface{}) Interface
- loader.Clear(key string) Interface
+ loader.Clear(ctx context.Context, key string) Interface
```

```diff
// cache interface as added context.Context to methods
type Cache interface {
-	Get(string) (Thunk, bool)
+	Get(context.Context, string) (Thunk, bool)
-	Set(string, Thunk)
+	Set(context.Context, string, Thunk)
-	Delete(string) bool
+	Delete(context.Context, string) bool
	Clear()
}
```

## Upgrade from v3 to v4
```diff
// dataloader.Interface as now allows interace{} as key rather than string
- loader.Load(context.Context, key string) Thunk
+ loader.Load(ctx context.Context, key interface{}) Thunk
- loader.LoadMany(context.Context, key []string) ThunkMany
+ loader.LoadMany(ctx context.Context, keys []interface{}) ThunkMany
- loader.Prime(context.Context, key string, value interface{}) Interface
+ loader.Prime(ctx context.Context, key interface{}, value interface{}) Interface
- loader.Clear(context.Context, key string) Interface
+ loader.Clear(ctx context.Context, key interface{}) Interface
```

```diff
// cache interface now allows interface{} as key instead of string
type Cache interface {
-	Get(context.Context, string) (Thunk, bool)
+	Get(context.Context, interface{}) (Thunk, bool)
-	Set(context.Context, string, Thunk)
+	Set(context.Context, interface{}, Thunk)
-	Delete(context.Context, string) bool
+	Delete(context.Context, interface{}) bool
	Clear()
}
```

## Upgrade from v4 to v5
```diff
// dataloader.Interface as now allows interace{} as key rather than string
- loader.Load(context.Context, key interface{}) Thunk
+ loader.Load(ctx context.Context, key Key) Thunk
- loader.LoadMany(context.Context, key []interface{}) ThunkMany
+ loader.LoadMany(ctx context.Context, keys Keys) ThunkMany
- loader.Prime(context.Context, key interface{}, value interface{}) Interface
+ loader.Prime(ctx context.Context, key Key, value interface{}) Interface
- loader.Clear(context.Context, key interface{}) Interface
+ loader.Clear(ctx context.Context, key Key) Interface
```

```diff
// cache interface now allows interface{} as key instead of string
type Cache interface {
-	Get(context.Context, interface{}) (Thunk, bool)
+	Get(context.Context, Key) (Thunk, bool)
-	Set(context.Context, interface{}, Thunk)
+	Set(context.Context, Key, Thunk)
-	Delete(context.Context, interface{}) bool
+	Delete(context.Context, Key) bool
	Clear()
}
```

## Upgrade from v5 to v6

We add major version release because we switched to using Go Modules from dep,
and drop build tags for older versions of Go (1.9).

The preferred import method includes the major version tag.

```go
import "github.com/graph-gophers/dataloader/v6"
```
