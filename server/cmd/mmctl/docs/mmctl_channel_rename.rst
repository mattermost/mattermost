.. _mmctl_channel_rename:

mmctl channel rename
--------------------

Rename channel

Synopsis
~~~~~~~~


Rename an existing channel.

::

  mmctl channel rename [channel] [flags]

Examples
~~~~~~~~

::

    channel rename myteam:oldchannel --name 'new-channel' --display-name 'New Display Name'
    channel rename myteam:oldchannel --name 'new-channel'
    channel rename myteam:oldchannel --display-name 'New Display Name'

Options
~~~~~~~

::

      --display-name string   Channel Display Name
  -h, --help                  help for rename
      --name string           Channel Name

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

* `mmctl channel <mmctl_channel.rst>`_ 	 - Management of channels

