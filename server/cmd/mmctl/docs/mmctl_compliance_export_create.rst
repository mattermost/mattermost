.. _mmctl_compliance_export_create:

mmctl compliance_export create
------------------------------

Create a compliance export job, of type 'csv' or 'actiance' or 'globalrelay'

Synopsis
~~~~~~~~


Create a compliance export job, of type 'csv' or 'actiance' or 'globalrelay'

::

  mmctl compliance_export create [complianceExportType] --date 2025-03-27 EDT [flags]

Examples
~~~~~~~~

::

  compliance_export create csv --date 2025-03-27 EDT

Options
~~~~~~~

::

      --date "YYYY-MM-DD -0000"   Run the export for one day, from 12am to 12am (minus one millisecond) inclusively, in the format with timezoneoffset: "YYYY-MM-DD -0000". E.g., "2024-10-21 -0400" for Oct 21, 2024 EDT timezone. "2023-11-01 +0000"for Nov 01, 2024 UTC. If set, the 'start' and 'end' flags will be ignored.
      --end 1743134400000         The end timestamp in unix milliseconds. Posts with updateAt <= end will be exported.If set, 'start' must be set as well. eg, 1743134400000 for 2025-03-28 EDT.
  -h, --help                      help for create
      --start 1743048000000       The start timestamp in unix milliseconds. Posts with updateAt >= start will be exported.If set, 'end' must be set as well. eg, 1743048000000 for 2025-03-27 EDT.

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

* `mmctl compliance_export <mmctl_compliance_export.rst>`_ 	 - Management of compliance exports

