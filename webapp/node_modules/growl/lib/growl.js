// Growl - Copyright TJ Holowaychuk <tj@vision-media.ca> (MIT Licensed)

/**
 * Module dependencies.
 */

var exec = require('child_process').exec
  , fs = require('fs')
  , path = require('path')
  , exists = fs.existsSync || path.existsSync
  , os = require('os')
  , quote = JSON.stringify
  , cmd;

function which(name) {
  var paths = process.env.PATH.split(':');
  var loc;

  for (var i = 0, len = paths.length; i < len; ++i) {
    loc = path.join(paths[i], name);
    if (exists(loc)) return loc;
  }
}

switch(os.type()) {
  case 'Darwin':
    if (which('terminal-notifier')) {
      cmd = {
          type: "Darwin-NotificationCenter"
        , pkg: "terminal-notifier"
        , msg: '-message'
        , title: '-title'
        , subtitle: '-subtitle'
        , icon: '-appIcon'
        , sound:  '-sound'
        , url: '-open'
        , priority: {
              cmd: '-execute'
            , range: []
          }
      };
    } else {
      cmd = {
          type: "Darwin-Growl"
        , pkg: "growlnotify"
        , msg: '-m'
        , sticky: '--sticky'
        , priority: {
              cmd: '--priority'
            , range: [
                -2
              , -1
              , 0
              , 1
              , 2
              , "Very Low"
              , "Moderate"
              , "Normal"
              , "High"
              , "Emergency"
            ]
          }
      };
    }
    break;
  case 'Linux':
    if (which('growl')) {
      cmd = {
          type: "Linux-Growl"
        , pkg: "growl"
        , msg: '-m'
        , title: '-title'
        , subtitle: '-subtitle'
        , host: {
            cmd: '-H'
          , hostname: '192.168.33.1'
        }
      };
    } else {
      cmd = {
          type: "Linux"
        , pkg: "notify-send"
        , msg: ''
        , sticky: '-t 0'
        , icon: '-i'
        , priority: {
            cmd: '-u'
          , range: [
              "low"
            , "normal"
            , "critical"
          ]
        }
      };
    }
    break;
  case 'Windows_NT':
    cmd = {
        type: "Windows"
      , pkg: "growlnotify"
      , msg: ''
      , sticky: '/s:true'
      , title: '/t:'
      , icon: '/i:'
      , url: '/cu:'
      , priority: {
            cmd: '/p:'
          , range: [
              -2
            , -1
            , 0
            , 1
            , 2
          ]
        }
    };
    break;
}

/**
 * Expose `growl`.
 */

exports = module.exports = growl;

/**
 * Node-growl version.
 */

exports.version = '1.4.1'

/**
 * Send growl notification _msg_ with _options_.
 *
 * Options:
 *
 *  - title   Notification title
 *  - sticky  Make the notification stick (defaults to false)
 *  - priority  Specify an int or named key (default is 0)
 *  - name    Application name (defaults to growlnotify)
 *  - sound   Sound efect ( in OSx defined in preferences -> sound -> effects) * works only in OSX > 10.8x
 *  - image
 *    - path to an icon sets --iconpath
 *    - path to an image sets --image
 *    - capitalized word sets --appIcon
 *    - filename uses extname as --icon
 *    - otherwise treated as --icon
 *
 * Examples:
 *
 *   growl('New email')
 *   growl('5 new emails', { title: 'Thunderbird' })
 *   growl('5 new emails', { title: 'Thunderbird', sound: 'Purr' })
 *   growl('Email sent', function(){
 *     // ... notification sent
 *   })
 *
 * @param {string} msg
 * @param {object} options
 * @param {function} fn
 * @api public
 */

function growl(msg, options, fn) {
  var image
    , args
    , options = options || {}
    , fn = fn || function(){};

  if (options.exec) {
    cmd = {
        type: "Custom"
      , pkg: options.exec
      , range: []
    };
  }

  // noop
  if (!cmd) return fn(new Error('growl not supported on this platform'));
  args = [cmd.pkg];

  // image
  if (image = options.image) {
    switch(cmd.type) {
      case 'Darwin-Growl':
        var flag, ext = path.extname(image).substr(1)
        flag = flag || ext == 'icns' && 'iconpath'
        flag = flag || /^[A-Z]/.test(image) && 'appIcon'
        flag = flag || /^png|gif|jpe?g$/.test(ext) && 'image'
        flag = flag || ext && (image = ext) && 'icon'
        flag = flag || 'icon'
        args.push('--' + flag, quote(image))
        break;
      case 'Darwin-NotificationCenter':
        args.push(cmd.icon, quote(image));
        break;
      case 'Linux':
        args.push(cmd.icon, quote(image));
        // libnotify defaults to sticky, set a hint for transient notifications
        if (!options.sticky) args.push('--hint=int:transient:1');
        break;
      case 'Windows':
        args.push(cmd.icon + quote(image));
        break;
    }
  }

  // sticky
  if (options.sticky) args.push(cmd.sticky);

  // priority
  if (options.priority) {
    var priority = options.priority + '';
    var checkindexOf = cmd.priority.range.indexOf(priority);
    if (~cmd.priority.range.indexOf(priority)) {
      args.push(cmd.priority, options.priority);
    }
  }

  //sound
  if(options.sound && cmd.type === 'Darwin-NotificationCenter'){
    args.push(cmd.sound, options.sound)
  }

  // name
  if (options.name && cmd.type === "Darwin-Growl") {
    args.push('--name', options.name);
  }

  switch(cmd.type) {
    case 'Darwin-Growl':
      args.push(cmd.msg);
      args.push(quote(msg).replace(/\\n/g, '\n'));
      if (options.title) args.push(quote(options.title));
      break;
    case 'Darwin-NotificationCenter':
      args.push(cmd.msg);
      var stringifiedMsg = quote(msg);
      var escapedMsg = stringifiedMsg.replace(/\\n/g, '\n');
      args.push(escapedMsg);
      if (options.title) {
        args.push(cmd.title);
        args.push(quote(options.title));
      }
      if (options.subtitle) {
        args.push(cmd.subtitle);
        args.push(quote(options.subtitle));
      }
      if (options.url) {
        args.push(cmd.url);
        args.push(quote(options.url));
      }
      break;
    case 'Linux-Growl':
      args.push(cmd.msg);
      args.push(quote(msg).replace(/\\n/g, '\n'));
      if (options.title) args.push(quote(options.title));
      if (cmd.host) {
        args.push(cmd.host.cmd, cmd.host.hostname)
      }
      break;
    case 'Linux':
      if (options.title) {
        args.push(quote(options.title));
        args.push(cmd.msg);
        args.push(quote(msg).replace(/\\n/g, '\n'));
      } else {
        args.push(quote(msg).replace(/\\n/g, '\n'));
      }
      break;
    case 'Windows':
      args.push(quote(msg).replace(/\\n/g, '\n'));
      if (options.title) args.push(cmd.title + quote(options.title));
      if (options.url) args.push(cmd.url + quote(options.url));
      break;
    case 'Custom':
      args[0] = (function(origCommand) {
        var message = options.title
          ? options.title + ': ' + msg
          : msg;
        var command = origCommand.replace(/(^|[^%])%s/g, '$1' + quote(message));
        if (command === origCommand) args.push(quote(message));
        return command;
      })(args[0]);
      break;
  }

  // execute
  exec(args.join(' '), fn);
};
