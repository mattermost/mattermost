.. _mmctl_plugin_add:

mmctl plugin add
----------------

Add plugins

Synopsis
~~~~~~~~


Add plugins to your Mattermost server.

::

  mmctl plugin add [plugins] [flags]

Examples
~~~~~~~~

::

    plugin add hovercardexample.tar.gz pluginexample.tar.gz

Options
~~~~~~~

::

  -f, --force   overwrite a previously installed plugin with the same ID, if any
  -h, --help    help for add

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

