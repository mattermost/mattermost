.. _mmctl_group_user_restore:

mmctl group user restore
------------------------

Restore user group

Synopsis
~~~~~~~~


Restore deleted custom user group

::

  mmctl group user restore [groupname] [flags]

Examples
~~~~~~~~

::

   group user restore examplegroup

Options
~~~~~~~

::

  -h, --help   help for restore

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

* `mmctl group user <mmctl_group_user.rst>`_ 	 - Management of custom user groups

