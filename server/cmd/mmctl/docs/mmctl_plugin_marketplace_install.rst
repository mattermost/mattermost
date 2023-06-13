.. _mmctl_plugin_marketplace_install:

mmctl plugin marketplace install
--------------------------------

Install a plugin from the marketplace

Synopsis
~~~~~~~~


Installs a plugin listed in the marketplace server

::

  mmctl plugin marketplace install <id> [flags]

Examples
~~~~~~~~

::

    plugin marketplace install jitsi

Options
~~~~~~~

::

  -h, --help   help for install

Options inherited from parent commands
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

      --config string                path to the configuration file (default "$XDG_CONFIG_HOME/mmctl/config")
      --disable-pager                disables paged output
      --insecure-sha1-intermediate   allows to use insecure TLS protocols, such as SHA-1
      --insecure-tls-version         allows to use TLS versions 1.0 and 1.1
      --json                         the output format will be in json format
      --local                        allows communicating with the server through a unix socket
      --quiet                        prevent mmctl to generate output for the commands
      --strict                       will only run commands if the mmctl version matches the server one
      --suppress-warnings            disables printing warning messages

SEE ALSO
~~~~~~~~

* `mmctl plugin marketplace <mmctl_plugin_marketplace.rst>`_ 	 - Management of marketplace plugins

