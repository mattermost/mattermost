.. _mmctl_channel_modify:

mmctl channel modify
--------------------

Modify a channel's public/private type

Synopsis
~~~~~~~~


Change the Public/Private type of a channel.
Channel can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.

::

  mmctl channel modify [channel] [flags]

Examples
~~~~~~~~

::

    channel modify myteam:mychannel --private
    channel modify channelId --public

Options
~~~~~~~

::

  -h, --help      help for modify
      --private   Convert the channel to a private channel
      --public    Convert the channel to a public channel

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

