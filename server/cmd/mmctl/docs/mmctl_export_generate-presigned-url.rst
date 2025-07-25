.. _mmctl_export_generate-presigned-url:

mmctl export generate-presigned-url
-----------------------------------

Generate a presigned url for an export file. This is helpful when an export is big and might have trouble downloading from the Mattermost server.

Synopsis
~~~~~~~~


Generate a presigned url for an export file. This is helpful when an export is big and might have trouble downloading from the Mattermost server.

::

  mmctl export generate-presigned-url [exportname] [flags]

Options
~~~~~~~

::

  -h, --help   help for generate-presigned-url

Options inherited from parent commands
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

      --config string                path to the configuration file (default "$XDG_CONFIG_HOME/mmctl/config")
      --disable-pager                disables paged output
      --insecure-sha1-intermediate   allows to use insecure TLS protocols, such as SHA-1
      --insecure-tls-version         allows to use TLS versions 1.0 and 1.1
      --json                         the output format will be in json format
      --local                        allows communicating with the server through a unix socket
      --local-user-id string         allows to set the user-id for local connections
      --quiet                        prevent mmctl to generate output for the commands
      --strict                       will only run commands if the mmctl version matches the server one
      --suppress-warnings            disables printing warning messages

SEE ALSO
~~~~~~~~

* `mmctl export <mmctl_export.rst>`_ 	 - Management of exports

