.. _mmctl_plugin_keys_delete:

mmctl plugin keys delete
------------------------

Delete plugin signature public keys

Synopsis
~~~~~~~~


Delete public keys used to verify plugin signatures from your Mattermost server. Only available in local mode.

::

  mmctl plugin keys delete [keys] [flags]

Examples
~~~~~~~~

::

    plugin keys delete my-pk-file1.asc my-pk-file2.gpg --local

Options
~~~~~~~

::

  -h, --help   help for delete

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

* `mmctl plugin keys <mmctl_plugin_keys.rst>`_ 	 - List plugin signature public keys

