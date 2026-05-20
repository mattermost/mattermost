.. _mmctl_permissions_add:

mmctl permissions add
---------------------

Add permissions to a role (EE Only)

Synopsis
~~~~~~~~


Add one or more permissions to an existing role (Only works in Enterprise Edition).

::

  mmctl permissions add <role> <permission...> [flags]

Examples
~~~~~~~~

::

    permissions add system_user list_open_teams
    permissions add system_manager sysconsole_read_user_management_channels

Options
~~~~~~~

::

  -h, --help   help for add

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

* `mmctl permissions <mmctl_permissions.rst>`_ 	 - Management of permissions

