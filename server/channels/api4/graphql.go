// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	_ "embed"
	"encoding/json"
	"net/http"

	"github.com/graph-gophers/dataloader/v6"
	graphql "github.com/graph-gophers/graphql-go"
	gqlerrors "github.com/graph-gophers/graphql-go/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/web"
)

type graphQLInput struct {
	Query         string         `json:"query"`
	OperationName string         `json:"operationName"`
	Variables     map[string]any `json:"variables"`
}

// Unique type to hold our context.
type ctxKey int

const (
	webCtx            ctxKey = 0
	rolesLoaderCtx    ctxKey = 1
	channelsLoaderCtx ctxKey = 2
	teamsLoaderCtx    ctxKey = 3
	usersLoaderCtx    ctxKey = 4
)

const loaderBatchCapacity = web.PerPageMaximum

//go:embed schema.graphqls
var schemaRaw string

func (api *API) InitGraphQL() error {
	// Guard with a feature flag.
	if !api.srv.Config().FeatureFlags.GraphQL {
		return nil
	}

	var err error
	opts := []graphql.SchemaOpt{
		graphql.UseFieldResolvers(),
		graphql.Logger(mlog.NewGraphQLLogger(api.srv.Log())),
		graphql.MaxParallelism(loaderBatchCapacity), // This is dangerous if the query
		// uses any non-dataloader backed object. So we need to be a bit careful here.
	}

	if isProd() {
		opts = append(opts,
			// MaxDepth cannot be moved as a general param
			// because otherwise introspection also doesn't work
			// with just a depth of 4.
			graphql.MaxDepth(4),
			graphql.DisableIntrospection(),
		)
	}

	api.schema, err = graphql.ParseSchema(schemaRaw, &resolver{}, opts...)
	if err != nil {
		return err
	}

	api.BaseRoutes.APIRoot5.Handle("/graphql", api.APIHandlerTrustRequester(graphiQL)).Methods("GET")
	api.BaseRoutes.APIRoot5.Handle("/graphql", api.APISessionRequired(api.graphQL)).Methods("POST")
	return nil
}

func (api *API) graphQL(c *Context, w http.ResponseWriter, r *http.Request) {
	var response *graphql.Response
	defer func() {
		if response != nil {
			if err := json.NewEncoder(w).Encode(response); err != nil {
				c.Logger.Warn("Error while writing response", mlog.Err(err))
			}
		}
	}()

	// Limit bodies to 100KiB.
	// We need to enforce a lower limit than the file upload size,
	// to prevent the library doing unnecessary parsing.
	r.Body = http.MaxBytesReader(w, r.Body, 102400)

	var params graphQLInput
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		err2 := gqlerrors.Errorf("invalid request body: %v", err)
		response = &graphql.Response{Errors: []*gqlerrors.QueryError{err2}}
		return
	}

	if isProd() && params.OperationName == "" {
		err2 := gqlerrors.Errorf("operation name not passed")
		response = &graphql.Response{Errors: []*gqlerrors.QueryError{err2}}
		return
	}

	c.GraphQLOperationName = params.OperationName

	// Populate the context with required info.
	reqCtx := r.Context()
	reqCtx = context.WithValue(reqCtx, webCtx, c)

	rolesLoader := dataloader.NewBatchedLoader(graphQLRolesLoader, dataloader.WithBatchCapacity(loaderBatchCapacity))
	reqCtx = context.WithValue(reqCtx, rolesLoaderCtx, rolesLoader)

	channelsLoader := dataloader.NewBatchedLoader(graphQLChannelsLoader, dataloader.WithBatchCapacity(loaderBatchCapacity))
	reqCtx = context.WithValue(reqCtx, channelsLoaderCtx, channelsLoader)

	teamsLoader := dataloader.NewBatchedLoader(graphQLTeamsLoader, dataloader.WithBatchCapacity(loaderBatchCapacity))
	reqCtx = context.WithValue(reqCtx, teamsLoaderCtx, teamsLoader)

	usersLoader := dataloader.NewBatchedLoader(graphQLUsersLoader, dataloader.WithBatchCapacity(loaderBatchCapacity))
	reqCtx = context.WithValue(reqCtx, usersLoaderCtx, usersLoader)

	response = api.schema.Exec(reqCtx,
		params.Query,
		params.OperationName,
		params.Variables)

	if len(response.Errors) > 0 {
		logFunc := mlog.Error
		for _, gqlErr := range response.Errors {
			if gqlErr.Err != nil {
				if appErr, ok := gqlErr.Err.(*model.AppError); ok && appErr.StatusCode < http.StatusInternalServerError {
					logFunc = mlog.Debug
					break
				}
			}
		}
		logFunc("Error executing request", mlog.String("operation", params.OperationName),
			mlog.Array("errors", response.Errors))
	}
}

func graphiQL(c *Context, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	w.Write(graphiqlPage)
}

var graphiqlPage = []byte(`
<!DOCTYPE html>
<html>
	<head>
		<title>GraphiQL editor | Mattermost</title>
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/graphiql/0.11.11/graphiql.min.css" integrity="sha256-gSgd+on4bTXigueyd/NSRNAy4cBY42RAVNaXnQDjOW8=" crossorigin="anonymous"/>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/es6-promise/4.1.1/es6-promise.auto.min.js" integrity="sha256-OI3N9zCKabDov2rZFzl8lJUXCcP7EmsGcGoP6DMXQCo=" crossorigin="anonymous"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/fetch/2.0.3/fetch.min.js" integrity="sha256-aB35laj7IZhLTx58xw/Gm1EKOoJJKZt6RY+bH1ReHxs=" crossorigin="anonymous"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/react/16.2.0/umd/react.production.min.js" integrity="sha256-wouRkivKKXA3y6AuyFwcDcF50alCNV8LbghfYCH6Z98=" crossorigin="anonymous"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/16.2.0/umd/react-dom.production.min.js" integrity="sha256-9hrJxD4IQsWHdNpzLkJKYGiY/SEZFJJSUqyeZPNKd8g=" crossorigin="anonymous"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/graphiql/0.11.11/graphiql.min.js" integrity="sha256-oeWyQyKKUurcnbFRsfeSgrdOpXXiRYopnPjTVZ+6UmI=" crossorigin="anonymous"></script>
	</head>
	<body style="width: 100%; height: 100%; margin: 0; overflow: hidden;">
		<div id="graphiql" style="height: 100vh;">Loading...</div>
		<script>
			function graphQLFetcher(graphQLParams) {
				return fetch("/api/v5/graphql", {
					method: "post",
					body: JSON.stringify(graphQLParams),
					credentials: "include",
					headers: {
						'X-Requested-With': 'XMLHttpRequest'
					}
				}).then(function (response) {
					return response.text();
				}).then(function (responseBody) {
					try {
						return JSON.parse(responseBody);
					} catch (error) {
						return responseBody;
					}
				});
			}
			ReactDOM.render(
				React.createElement(GraphiQL, {fetcher: graphQLFetcher}),
				document.getElementById("graphiql")
			);
		</script>
	</body>
</html>
`)

// isProd is a helper function to apply prod-specific graphQL validations.
func isProd() bool {
	return model.BuildNumber != "dev"
}
