---
title: "Logging"
heading: "Logging"
description: "Describes the logging module"
date: 2023-04-03T00:00:00-05:00
weight: 5
aliases:
  - /contribute/desktop/architecture/logging
---

Our application uses the `electron-log` module to do most of our logging. It facilitates both file and console logging.
For file logging, you can find the location of the log files by going to **Help** > **View Logs** from within the application.

Our app supports the following log levels: `error`, `warn`, `info`, `verbose`, `debug`, and `silly`.

In addition to the library, we provide a **Logger** object that simplifies and streamlines setting up logging for an individual module.
To create a **Logger** object, simply create a new one:

```js
import {Logger} from 'common/log';

const log = new Logger('MyModuleName');
```

You can then use the resulting *log* object to call any of the provided `electron-log` functions, and each log entry with be automatically prefixed with your module name.

```js
// Will print out "[MyModuleName] a long entry"
log.debug('a log entry'); 
```

If you need to add additional prefixing, for example to log events on a specific object instance, we provide the `withPrefix()` method which allows you to add additional prefixes.

```js
// Will print out "[MyModuleName] [some-id] a long entry"
const myObjectId = 'some-id';
log.withPrefix(myObjectId).debug('a log entry');
```
    