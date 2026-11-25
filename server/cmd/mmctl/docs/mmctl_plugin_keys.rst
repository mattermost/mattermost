.. _mmctl_plugin_keys:

mmctl plugin keys
-----------------

List plugin signature public keys

Synopsis
~~~~~~~~


List the names of the public keys used to verify plugin signatures on your Mattermost server. Only available in local mode.

::

  mmctl plugin keys [flags]

Examples
~~~~~~~~

::

    plugin keys --local
    plugin keys --verbose --local

Options
~~~~~~~

::

  -h, --help      help for keys
      --verbose   Also print the contents of each public key

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
* `mmctl plugin keys add <mmctl_plugin_keys_add.rst>`_ 	 - Add plugin signature public keys
* `mmctl plugin keys delete <mmctl_plugin_keys_delete.rst>`_ 	 - Delete plugin signature public keys

