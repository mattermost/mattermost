.. _mmctl_export_create:

mmctl export create
-------------------

Create export file

Synopsis
~~~~~~~~


Create export file

::

  mmctl export create [flags]

Options
~~~~~~~

::

      --channel-id string           Export only the specified channel(s) by ID. Accepts a comma-separated list. The team is inferred from each channel when --team-name/--team-id is omitted; if teams are provided, each channel must belong to one of them. Mutually exclusive with --channel-name.
      --channel-name string         Export only the specified channel(s) by name. Accepts a comma-separated list. Requires --team-name or --team-id. Mutually exclusive with --channel-id.
  -h, --help                        help for create
      --include-archived-channels   Include archived channels in the export file.
      --include-profile-pictures    Include profile pictures in the export file.
      --no-attachments              Exclude file attachments from the export file.
      --no-roles-and-schemes        Exclude roles and custom permission schemes from the export file.
      --team-id string              Export only the specified team(s) by ID. Accepts a comma-separated list. Mutually exclusive with --team-name.
      --team-name string            Export only the specified team(s) by name/slug. Accepts a comma-separated list. Mutually exclusive with --team-id.

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

* `mmctl export <mmctl_export.rst>`_ 	 - Management of exports

