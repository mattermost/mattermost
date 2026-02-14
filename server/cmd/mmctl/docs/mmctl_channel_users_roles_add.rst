.. _mmctl_channel_users_roles_add:

mmctl channel users roles add
-----------------------------

Give user(s) role(s) in a channel

Synopsis
~~~~~~~~


Give user(s) role(s) in a channel

::

  mmctl channel users roles add [team]:[channel] [flags]

Examples
~~~~~~~~

::

    channel users roles add myteam:mychannel userA,userB roleA,roleB
    Ex: channel users roles add myteam:mychannel user@example.com,user1@example.com scheme_admin,scheme_user
    Roles available: scheme_admin,scheme_user,scheme_guest

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

* `mmctl channel users roles <mmctl_channel_users_roles.rst>`_ 	 - Management of channel users

