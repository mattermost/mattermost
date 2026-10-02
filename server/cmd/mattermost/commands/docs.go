// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost/server/v8/channels/web"
)

var DocsCmd = &cobra.Command{
	Use:   "docs",
	Short: "Serve the offline product documentation",
	Long: `Serve the documentation bundle shipped with this release over HTTP on localhost.

Shares nothing with the Mattermost server startup path: no config file, no
database, and no app layer. Intended for reading the install guide and
troubleshooting pages when the server is not running.`,
	RunE: docsCmdF,
}

func init() {
	DocsCmd.Flags().Int("port", 8066, "Local TCP port to listen on")
	DocsCmd.Flags().String("dir", "", "Serve this bundle directory instead of the one in the release (e.g. docs/site/build)")
	RootCmd.AddCommand(DocsCmd)
}

func docsCmdF(command *cobra.Command, args []string) error {
	port, err := command.Flags().GetInt("port")
	if err != nil {
		return err
	}
	if port <= 0 || port > 65535 {
		return errors.Errorf("invalid --port %d", port)
	}

	docsDir, err := command.Flags().GetString("dir")
	if err != nil {
		return err
	}
	if docsDir == "" {
		clientDir, found := fileutils.FindDir(model.ClientDir)
		if !found {
			return errors.New("could not locate the client/ directory next to this binary; is this a packaged Mattermost install? (use --dir to serve a bundle from elsewhere)")
		}
		docsDir = filepath.Join(clientDir, web.DocsDir)
		if st, statErr := os.Stat(docsDir); statErr != nil || !st.IsDir() {
			return errors.Errorf("documentation bundle not found at %s (this install may have been packaged without docs)", docsDir)
		}
	} else if st, statErr := os.Stat(docsDir); statErr != nil || !st.IsDir() {
		return errors.Errorf("--dir %s is not a directory", docsDir)
	}

	// The bundle is built with BASE_URL=/documentation/, so absolute links
	// in the HTML only resolve when the handler is mounted at that prefix.
	mux := http.NewServeMux()
	mux.Handle("/"+web.DocsURLPrefix+"/", web.NewDocsHandlerForDir(docsDir, "/"))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.Redirect(w, r, "/"+web.DocsURLPrefix+"/", http.StatusFound)
			return
		}
		http.NotFound(w, r)
	})

	addr := fmt.Sprintf("127.0.0.1:%d", port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return errors.Wrapf(err, "failed to listen on %s", addr)
	}

	url := fmt.Sprintf("http://%s/%s/", addr, web.DocsURLPrefix)
	CommandPrintln("Serving documentation at " + url + " — press Ctrl-C to stop")

	srv := &http.Server{Handler: mux}
	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.Serve(ln)
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)

	select {
	case sig := <-sigCh:
		CommandPrintln("Received " + sig.String() + ", shutting down")
		_ = srv.Close()
		return nil
	case err := <-errCh:
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	}
}
