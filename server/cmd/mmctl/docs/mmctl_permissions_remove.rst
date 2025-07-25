.. _mmctl_permissions_remove:

mmctl permissions remove
------------------------

Remove permissions from a role (EE Only)

Synopsis
~~~~~~~~


Remove one or more permissions from an existing role (Only works in Enterprise Edition).

::

  mmctl permissions remove <role> <permission...> [flags]

Examples
~~~~~~~~

::

    permissions remove system_user list_open_teams
    permissions remove system_manager sysconsole_read_user_management_channels

Options
~~~~~~~

::

  -h, --help   help for remove

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

* `mmctl permissions <mmctl_permissions.rst>`_ 	 - Management of permissions

