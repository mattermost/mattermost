# cfg

[![GoDoc](https://godoc.org/github.com/wiggin77/cfg?status.svg)](https://godoc.org/github.com/wiggin77/cfg)
[![Build Status](https://travis-ci.org/wiggin77/cfg.svg?branch=master)](https://travis-ci.org/wiggin77/cfg)

Go package for app configuration. Supports chained configuration sources for multiple levels of defaults.
Includes APIs for loading Linux style configuration files (name/value pairs) or INI files, map based properties,
or easily create new configuration sources (e.g. load from database).

Supports monitoring configuration sources for changes, hot loading properties, and notifying listeners of changes.

## Usage

```Go
config := &cfg.Config{}
defer config.Shutdown() // stops monitoring

// load file via filespec string, os.File
src, err := Config.NewSrcFileFromFilespec("./myfile.conf")
if err != nil {
    return err
}
// add src to top of chain, meaning first searched
cfg.PrependSource(src)

// fetch prop 'retries', default to 3 if not found
val := config.Int("retries", 3)
```

See [example](./example_test.go) for more complete example, including listening for configuration changes.

Config API parses the following data types:

| type    | method | example property values |
| ------- | ------ | -------- |
| string  | Config.String  | test, "" |
| int     | Config.Int     | -1, 77, 0  |
| int64   | Config.Int64   | -9223372036854775, 372036854775808 |
| float64 | Config.Float64 | -77.3456, 95642331.1 |
| bool    | Config.Bool    | T,t,true,True,1,0,False,false,f,F |
| time.Duration | Config.Duration | "10ms", "2 hours", "5 min" * |

\* Units of measure supported: ms, sec, min, hour, day, week, year.
