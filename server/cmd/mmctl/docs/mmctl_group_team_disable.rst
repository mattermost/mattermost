.. _mmctl_group_team_disable:

mmctl group team disable
------------------------

Disables group constrains in the specified team

Synopsis
~~~~~~~~


Disables group constrains in the specified team

::

  mmctl group team disable [team] [flags]

Examples
~~~~~~~~

::

    group team disable myteam

Options
~~~~~~~

::

  -h, --help   help for disable

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

* `mmctl group team <mmctl_group_team.rst>`_ 	 - Management of team groups

