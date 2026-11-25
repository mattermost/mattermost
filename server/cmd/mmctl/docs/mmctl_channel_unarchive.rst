.. _mmctl_channel_unarchive:

mmctl channel unarchive
-----------------------

Unarchive some channels

Synopsis
~~~~~~~~


Unarchive a previously archived channel
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.

When the server requires channel attributes, the values you pass are applied to every channel listed.

Pass each attribute value with --attribute "<attribute>=<value>". The attribute can be its name or its ID, and a select value can be an option name or option ID. Quote the argument when it contains spaces. The text splits on the first "=", so a value may contain "=" and commas.

An attribute that holds one value (select, text) can be passed only once. Repeat --attribute to set several values on a multiselect or graph attribute. A graph value is the name or ID of one of its nodes. The values you pass replace any value the channel already holds for those attributes. Run "mmctl channel attributes fields" to see the attributes and their options.

::

  mmctl channel unarchive [channels] [flags]

Examples
~~~~~~~~

::

    channel unarchive myteam:mychannel
    channel unarchive myteam:mychannel myteam:otherchannel --attribute "Classification=Secret"

Options
~~~~~~~

::

      --attribute stringArray   Attribute value to set, as "<attribute>=<value>". Repeat the flag to set several attributes or several values of a multiselect or graph attribute
  -h, --help                    help for unarchive

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

