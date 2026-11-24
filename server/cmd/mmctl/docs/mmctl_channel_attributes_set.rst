.. _mmctl_channel_attributes_set:

mmctl channel attributes set
----------------------------

Set attribute values on a channel

Synopsis
~~~~~~~~


Set attribute values on a channel. The values you pass replace the ones the channel holds for those attributes.

Pass each value with --attribute "<attribute>=<value>". The attribute can be its name or its ID, and a select value can be an option name or option ID. Quote the argument when it contains spaces. The text splits on the first "=", so a value may contain "=" and commas.

An attribute that holds one value (select, text) can be passed only once. Repeat --attribute to set several values on a multiselect attribute. Run "mmctl channel attributes fields" to see the attributes and their options.

Channel can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.

::

  mmctl channel attributes set [channel] [flags]

Examples
~~~~~~~~

::

    channel attributes set myteam:mychannel --attribute "Classification=Secret"
    channel attributes set myteam:mychannel --attribute "Region=EMEA" --attribute "Region=APAC"
    channel attributes set myteam:mychannel --attribute "Notes=Review in Q3, then archive"

Options
~~~~~~~

::

      --attribute stringArray   Attribute value to set, as "<attribute>=<value>". Repeat the flag to set several attributes or several values of a multiselect attribute
  -h, --help                    help for set

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

* `mmctl channel attributes <mmctl_channel_attributes.rst>`_ 	 - Management of channel attribute values

