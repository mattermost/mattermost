.. _mmctl_team_delete:

mmctl team delete
-----------------

Delete teams

Synopsis
~~~~~~~~


Permanently delete some teams.
Permanently deletes a team along with all related information including posts from the database.

::

  mmctl team delete [teams] [flags]

Examples
~~~~~~~~

::

    team delete myteam

Options
~~~~~~~

::

      --confirm   Confirm you really want to delete the team and a DB backup has been performed.
  -h, --help      help for delete

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

* `mmctl team <mmctl_team.rst>`_ 	 - Management of teams

