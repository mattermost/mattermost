.. _mmctl_plugin_install-url:

mmctl plugin install-url
------------------------

Install plugin from url

Synopsis
~~~~~~~~


Supply one or multiple URLs to plugins compressed in a .tar.gz file. Plugins must be enabled in the server's config settings

::

  mmctl plugin install-url <url>... [flags]

Examples
~~~~~~~~

::

    # You can install one plugin
    $ mmctl plugin install-url https://example.com/mattermost-plugin.tar.gz

    # Or install multiple in one go
    $ mmctl plugin install-url https://example.com/mattermost-plugin-one.tar.gz https://example.com/mattermost-plugin-two.tar.gz

Options
~~~~~~~

::

  -f, --force   overwrite a previously installed plugin with the same ID, if any
  -h, --help    help for install-url

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

* `mmctl plugin <mmctl_plugin.rst>`_ 	 - Management of plugins

