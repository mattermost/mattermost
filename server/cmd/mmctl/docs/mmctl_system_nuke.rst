.. _mmctl_system_nuke:

mmctl system nuke
-----------------

Destructive operations that permanently delete data

Synopsis
~~~~~~~~


Destructive operations that permanently and irreversibly delete server data. Use with extreme caution.

Options
~~~~~~~

::

  -h, --help   help for nuke

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

* `mmctl system <mmctl_system.rst>`_ 	 - System management
* `mmctl system nuke users <mmctl_system_nuke_users.rst>`_ 	 - Delete all users and all posts. Local command only.

