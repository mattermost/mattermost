.. _mmctl_import_validate:

mmctl import validate
---------------------

Validate an import file

Synopsis
~~~~~~~~


Validate an import file

::

  mmctl import validate [filepath] [flags]

Examples
~~~~~~~~

::

    import validate import_file.zip --team myteam --team myotherteam

Options
~~~~~~~

::

      --check-missing-teams       Check for teams that are not defined but referenced in the archive
      --check-server-duplicates   Set to false to ignore teams, channels, and users already present on the server (default true)
  -h, --help                      help for validate
      --ignore-attachments        Don't check if the attached files are present in the archive
      --team stringArray          Predefined team[s] to assume as already present on the destination server. Implies --check-missing-teams. The flag can be repeated

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

* `mmctl import <mmctl_import.rst>`_ 	 - Management of imports

