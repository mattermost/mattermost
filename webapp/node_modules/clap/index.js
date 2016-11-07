var MAX_LINE_WIDTH = process.stdout.columns || 200;
var MIN_OFFSET = 25;

var errorHandler;
var commandsPath;

var reAstral = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
var ansiRegex = /\x1B\[([0-9]{1,3}(;[0-9]{1,3})*)?[m|K]/g;
var hasOwnProperty = Object.prototype.hasOwnProperty;

function stringLength(str){
  return str
    .replace(ansiRegex, '')
    .replace(reAstral, ' ')
    .length;
}

function camelize(name){
  return name.replace(/-(.)/g, function(m, ch){
    return ch.toUpperCase();
  });
}

function assign(dest, source){
  for (var key in source)
    if (hasOwnProperty.call(source, key))
      dest[key] = source[key];

  return dest;
}

function returnFirstArg(value){
  return value;
}

function pad(width, str){
  return str + Array(Math.max(0, width - stringLength(str)) + 1).join(' ');
}

function noop(){
  // nothing todo
}

function parseParams(str){
  // params [..<required>] [..[optional]]
  // <foo> - require
  // [foo] - optional
  var tmp;
  var left = str.trim();
  var result = {
    minArgsCount: 0,
    maxArgsCount: 0,
    args: []
  };

  do {
    tmp = left;
    left = left.replace(/^<([a-zA-Z][a-zA-Z0-9\-\_]*)>\s*/, function(m, name){
      result.args.push(new Argument(name, true));
      result.minArgsCount++;
      result.maxArgsCount++;

      return '';
    });
  }
  while (tmp != left);

  do {
    tmp = left;
    left = left.replace(/^\[([a-zA-Z][a-zA-Z0-9\-\_]*)\]\s*/, function(m, name){
      result.args.push(new Argument(name, false));
      result.maxArgsCount++;

      return '';
    });
  }
  while (tmp != left);

  if (left)
    throw new SyntaxError('Bad parameter description: ' + str);

  return result.args.length ? result : false;
}

/**
* @class
*/

var SyntaxError = function(message){
  this.message = message;
};
SyntaxError.prototype = Object.create(Error.prototype);
SyntaxError.prototype.name = 'SyntaxError';
SyntaxError.prototype.clap = true;

/**
* @class
*/
var Argument = function(name, required){
  this.name = name;
  this.required = required;
};
Argument.prototype = {
  required: false,
  name: '',
  normalize: returnFirstArg,
  suggest: function(){
    return [];
  }
};

/**
* @class
* @param {string} usage
* @param {string} description
*/
var Option = function(usage, description){
  var self = this;
  var params;
  var left = usage.trim()
    // short usage
    // -x
    .replace(/^-([a-zA-Z])(?:\s*,\s*|\s+)/, function(m, name){
      self.short = name;

      return '';
    })
    // long usage
    // --flag
    // --no-flag - invert value if flag is boolean
    .replace(/^--([a-zA-Z][a-zA-Z0-9\-\_]+)\s*/, function(m, name){
      self.long = name;
      self.name = name.replace(/(^|-)no-/, '$1');
      self.defValue = self.name != self.long;

      return '';
    });

  if (!this.long)
    throw new SyntaxError('Usage has no long name: ' + usage);

  try {
    params = parseParams(left);
  } catch(e) {
    throw new SyntaxError('Bad paramenter description in usage for option: ' + usage, e);
  }

  if (params)
  {
    left = '';
    this.name = this.long;
    this.defValue = undefined;

    assign(this, params);
  }

  if (left)
    throw new SyntaxError('Bad usage description for option: ' + usage);

  if (!this.name)
    this.name = this.long;

  this.description = description || '';
  this.usage = usage.trim();
  this.camelName = camelize(this.name);
};

Option.prototype = {
  name: '',
  description: '',
  short: '',
  long: '',

  beforeInit: false,
  required: false,
  minArgsCount: 0,
  maxArgsCount: 0,
  args: null,

  defValue: undefined,
  normalize: returnFirstArg
};


//
// Command
//

function createOption(usage, description, opt_1, opt_2){
  var option = new Option(usage, description);

  // if (option.bool && arguments.length > 2)
  //   throw new SyntaxError('bool flags can\'t has default value or validator');

  if (arguments.length == 3)
  {
    if (opt_1 && opt_1.constructor === Object)
    {
      for (var key in opt_1)
        if (key == 'normalize' ||
            key == 'defValue' ||
            key == 'beforeInit')
          option[key] = opt_1[key];

      // old name for `beforeInit` setting is `hot`
      if (opt_1.hot)
        option.beforeInit = true;
    }
    else
    {
      if (typeof opt_1 == 'function')
        option.normalize = opt_1;
      else
        option.defValue = opt_1;
    }
  }

  if (arguments.length == 4)
  {
    if (typeof opt_1 == 'function')
      option.normalize = opt_1;

    option.defValue = opt_2;
  }

  return option;
}

function addOptionToCommand(command, option){
  var commandOption;

  // short
  if (option.short)
  {
    commandOption = command.short[option.short];

    if (commandOption)
      throw new SyntaxError('Short option name -' + option.short + ' already in use by ' + commandOption.usage + ' ' + commandOption.description);

    command.short[option.short] = option;
  }

  // long
  commandOption = command.long[option.long];

  if (commandOption)
    throw new SyntaxError('Long option --' + option.long + ' already in use by ' + commandOption.usage + ' ' + commandOption.description);

  command.long[option.long] = option;

  // camel
  commandOption = command.options[option.camelName];

  if (commandOption)
    throw new SyntaxError('Name option ' + option.camelName + ' already in use by ' + commandOption.usage + ' ' + commandOption.description);

  command.options[option.camelName] = option;

  // set default value
  if (typeof option.defValue != 'undefined')
    command.setOption(option.camelName, option.defValue, true);

  // add to suggestions
  command.suggestions.push('--' + option.long);

  return option;
}

function findVariants(obj, entry){
  return obj.suggestions.filter(function(item){
    return item.substr(0, entry.length) == entry;
  });
}

function processArgs(command, args, suggest){
  function processOption(option, command){
    var params = [];

    if (option.maxArgsCount)
    {
      for (var j = 0; j < option.maxArgsCount; j++)
      {
        var suggestPoint = suggest && i + 1 + j >= args.length - 1;
        var nextToken = args[i + 1];

        // TODO: suggestions for options
        if (suggestPoint)
        {
          // search for suggest
          noSuggestions = true;
          i = args.length;
          return;
        }

        if (!nextToken || nextToken[0] == '-')
          break;

        params.push(args[++i]);
      }

      if (params.length < option.minArgsCount)
        throw new SyntaxError('Option ' + token + ' should be used with at least ' + option.minArgsCount + ' argument(s)\nUsage: ' + option.usage);
    }
    else
    {
      params = !option.defValue;
    }

    //command.values[option.camelName] = newValue;
    resultToken.options.push({
      option: option,
      value: params
    });
  }

  var resultToken = {
    command: command,
    args: [],
    literalArgs: [],
    options: []
  };
  var result = [resultToken];

  var suggestStartsWith = '';
  var noSuggestions = false;
  var collectArgs = false;
  var commandArgs = [];
  var noOptionsYet = true;
  var option;

  commandsPath = [command.name];

  for (var i = 0; i < args.length; i++)
  {
    var suggestPoint = suggest && i == args.length - 1;
    var token = args[i];

    if (collectArgs)
    {
      commandArgs.push(token);
      continue;
    }

    if (suggestPoint && (token == '--' || token == '-' || token[0] != '-'))
    {
      suggestStartsWith = token;
      break; // returns long option & command list outside the loop
    }

    if (token == '--')
    {
      noOptionsYet = false;
      collectArgs = true;
      continue;
    }

    if (token[0] == '-')
    {
      noOptionsYet = false;

      if (commandArgs.length)
      {
        //command.args_.apply(command, commandArgs);
        resultToken.args = commandArgs;
        commandArgs = [];
      }

      if (token[1] == '-')
      {
        // long option
        option = command.long[token.substr(2)];

        if (!option)
        {
          // option doesn't exist
          if (suggestPoint)
            return findVariants(command, token);
          else
            throw new SyntaxError('Unknown option: ' + token);
        }

        // process option
        processOption(option, command);
      }
      else
      {
        // short flags sequence
        if (!/^-[a-zA-Z]+$/.test(token))
          throw new SyntaxError('Wrong short option sequence: ' + token);

        if (token.length == 2)
        {
          option = command.short[token[1]];

          if (!option)
            throw new SyntaxError('Unknown short option name: -' + token[1]);

          // single option
          processOption(option, command);
        }
        else
        {
          // short options sequence
          for (var j = 1; j < token.length; j++)
          {
            option = command.short[token[j]];

            if (!option)
              throw new SyntaxError('Unknown short option name: -' + token[j]);

            if (option.maxArgsCount)
              throw new SyntaxError('Non-boolean option -' + token[j] + ' can\'t be used in short option sequence: ' + token);

            processOption(option, command);
          }
        }
      }
    }
    else
    {
      if (command.commands[token] && (!command.params || commandArgs.length >= command.params.minArgsCount))
      {
        if (noOptionsYet)
        {
          resultToken.args = commandArgs;
          commandArgs = [];
        }

        if (command.params && resultToken.args.length < command.params.minArgsCount)
          throw new SyntaxError('Missed required argument(s) for command `' + command.name + '`');

        // switch control to another command
        command = command.commands[token];
        noOptionsYet = true;

        commandsPath.push(command.name);

        resultToken = {
          command: command,
          args: [],
          literalArgs: [],
          options: []
        };
        result.push(resultToken);
      }
      else
      {
        if (noOptionsYet && command.params && commandArgs.length < command.params.maxArgsCount)
        {
          commandArgs.push(token);
          continue;
        }

        if (suggestPoint)
          return findVariants(command, token);
        else
          throw new SyntaxError('Unknown command: ' + token);
      }
    }
  }

  if (suggest)
  {
    if (collectArgs || noSuggestions)
      return [];

    return findVariants(command, suggestStartsWith);
  }
  else
  {
    if (!noOptionsYet)
      resultToken.literalArgs = commandArgs;
    else
      resultToken.args = commandArgs;

    if (command.params && resultToken.args.length < command.params.minArgsCount)
      throw new SyntaxError('Missed required argument(s) for command `' + command.name + '`');
  }

  return result;
}

function setFunctionFactory(name){
  return function(fn){
    var property = name + '_';

    if (this[property] !== noop)
      throw new SyntaxError('Method `' + name + '` could be invoked only once');

    if (typeof fn != 'function')
      throw new SyntaxError('Value for `' + name + '` method should be a function');

    this[property] = fn;

    return this;
  }
}

/**
* @class
*/
var Command = function(name, params){
  this.name = name;
  this.params = false;

  try {
    if (params)
      this.params = parseParams(params);
  } catch(e) {
    throw new SyntaxError('Bad paramenter description in command definition: ' + this.name + ' ' + params);
  }

  this.commands = {};

  this.options = {};
  this.short = {};
  this.long = {};
  this.values = {};
  this.defaults_ = {};

  this.suggestions = [];

  this.option('-h, --help', 'Output usage information', function(){
    this.showHelp();
    process.exit(0);
  }, undefined);
};

Command.prototype = {
  params: null,
  commands: null,
  options: null,
  short: null,
  long: null,
  values: null,
  defaults_: null,
  suggestions: null,

  description_: '',
  version_: '',
  initContext_: noop,
  init_: noop,
  delegate_: noop,
  action_: noop,
  args_: noop,
  end_: null,

  option: function(usage, description, opt_1, opt_2){
    addOptionToCommand(this, createOption.apply(null, arguments));

    return this;
  },
  shortcut: function(usage, description, fn, opt_1, opt_2){
    if (typeof fn != 'function')
      throw new SyntaxError('fn should be a function');

    var command = this;
    var option = addOptionToCommand(this, createOption(usage, description, opt_1, opt_2));
    var normalize = option.normalize;

    option.normalize = function(value){
      var values;

      value = normalize.call(command, value);
      values = fn(value);

      for (var name in values)
        if (hasOwnProperty.call(values, name))
          if (hasOwnProperty.call(command.options, name))
            command.setOption(name, values[name]);
          else
            command.values[name] = values[name];

      command.values[option.name] = value;

      return value;
    };

    return this;
  },
  hasOption: function(name){
    return hasOwnProperty.call(this.options, name);
  },
  hasOptions: function(){
    return Object.keys(this.options).length > 0;
  },
  setOption: function(name, value, isDefault){
    if (!this.hasOption(name))
      throw new SyntaxError('Option `' + name + '` is not defined');

    var option = this.options[name];
    var newValue = Array.isArray(value)
          ? option.normalize.apply(this, value)
          : option.normalize.call(this, value);

    this.values[name] = option.maxArgsCount ? newValue : value;

    if (isDefault && !hasOwnProperty.call(this.defaults_, name))
      this.defaults_[name] = this.values[name];
  },
  setOptions: function(values){
    for (var name in values)
      if (hasOwnProperty.call(values, name) && this.hasOption(name))
        this.setOption(name, values[name]);
  },
  reset: function(){
    this.values = {};

    assign(this.values, this.defaults_);
  },

  command: function(nameOrCommand, params){
    var name;
    var command;

    if (nameOrCommand instanceof Command)
    {
      command = nameOrCommand;
      name = command.name;
    }
    else
    {
      name = nameOrCommand;

      if (!/^[a-zA-Z][a-zA-Z0-9\-\_]*$/.test(name))
        throw new SyntaxError('Wrong command name: ' + name);
    }

    // search for existing one
    var subcommand = this.commands[name];

    if (!subcommand)
    {
      // create new one if not exists
      subcommand = command || new Command(name, params);
      subcommand.end_ = this;
      this.commands[name] = subcommand;
      this.suggestions.push(name);
    }

    return subcommand;
  },
  end: function() {
    return this.end_;
  },
  hasCommands: function(){
    return Object.keys(this.commands).length > 0;
  },

  version: function(version, usage, description){
    if (this.version_)
      throw new SyntaxError('Version for command could be set only once');

    this.version_ = version;
    this.option(
      usage || '-v, --version',
      description || 'Output version',
      function(){
        console.log(this.version_);
        process.exit(0);
      },
      undefined
    );

    return this;
  },
  description: function(description){
    if (this.description_)
      throw new SyntaxError('Description for command could be set only once');

    this.description_ = description;

    return this;
  },

  init: setFunctionFactory('init'),
  initContext: setFunctionFactory('initContext'),
  args: setFunctionFactory('args'),
  delegate: setFunctionFactory('delegate'),
  action: setFunctionFactory('action'),

  extend: function(fn){
    fn.apply(null, [this].concat(Array.prototype.slice.call(arguments, 1)));
    return this;
  },

  parse: function(args, suggest){
    if (!args)
      args = process.argv.slice(2);

    if (!errorHandler)
      return processArgs(this, args, suggest);
    else
      try {
        return processArgs(this, args, suggest);
      } catch(e) {
        errorHandler(e.message || e);
      }
  },
  run: function(args, context){
    var commands = this.parse(args);

    if (!commands)
      return;

    var prevCommand;
    var context = assign({}, context || this.initContext_());
    for (var i = 0; i < commands.length; i++)
    {
      var item = commands[i];
      var command = item.command;

      // reset command values
      command.reset();
      command.context = context;
      command.root = this;

      if (prevCommand)
        prevCommand.delegate_(command);

      // apply beforeInit options
      command.setOptions(
        item.options.reduce(function(res, entry){
          if (entry.option.beforeInit)
            res[entry.option.camelName] = entry.value;
          return res;
        }, {})
      );

      command.init_(item.args);

      if (item.args.length)
        command.args_(item.args);

      // apply regular options
      command.setOptions(
        item.options.reduce(function(res, entry){
          if (!entry.option.beforeInit)
            res[entry.option.camelName] = entry.value;
          return res;
        }, {})
      );

      prevCommand = command;
    }

    // return last command action result
    if (command)
      return command.action_(item.args, item.literalArgs);
  },

  normalize: function(values){
    var result = {};

    if (!values)
      values = {};

    for (var name in this.values)
      if (hasOwnProperty.call(this.values, name))
        result[name] = hasOwnProperty.call(values, name) && hasOwnProperty(this.options, name)
          ? this.options[name].normalize.call(this, values[name])
          : this.values[name];

    for (var name in values)
      if (hasOwnProperty.call(values, name) && !hasOwnProperty.call(this.options, name))
        result[name] = values[name];

    return result;
  },

  showHelp: function(){
    console.log(showCommandHelp(this));
  }
};


//
// help
//

/**
 * Return program help documentation.
 *
 * @return {String}
 * @api private
 */

function showCommandHelp(command){
  function breakByLines(str, offset){
    var words = str.split(' ');
    var maxWidth = MAX_LINE_WIDTH - offset || 0;
    var lines = [];
    var line = '';

    while (words.length)
    {
      var word = words.shift();
      if (!line || (line.length + word.length + 1) < maxWidth)
      {
        line += (line ? ' ' : '') + word;
      }
      else
      {
        lines.push(line);
        words.unshift(word);
        line = '';
      }
    }

    lines.push(line);

    return lines.map(function(line, idx){
      return (idx && offset ? pad(offset, '') : '') + line;
    }).join('\n');
  }

  function args(command){
    return command.params.args.map(function(arg){
        return arg.required
          ? '<' + arg.name + '>'
          : '[' + arg.name + ']';
      }).join(' ');
  }

  function commandsHelp(){
    if (!command.hasCommands())
      return '';

    var maxNameLength = MIN_OFFSET - 2;
    var lines = Object.keys(command.commands).sort().map(function(name){
      var subcommand = command.commands[name];

      var line = {
        name: chalk.green(name) + chalk.gray(
          (subcommand.params ? ' ' + args(subcommand) : '')
          // (subcommand.hasOptions() ? ' [options]' : '')
        ),
        description: subcommand.description_ || ''
      };

      maxNameLength = Math.max(maxNameLength, stringLength(line.name));

      return line;
    });

    return [
      '',
      'Commands:',
      '',
      lines.map(function(line){
        return '  ' + pad(maxNameLength, line.name) + '  ' + breakByLines(line.description, maxNameLength + 4);
      }).join('\n'),
      ''
    ].join('\n');
  }

  function optionsHelp(){
    if (!command.hasOptions())
      return '';

    var hasShortOptions = Object.keys(command.short).length > 0;
    var maxNameLength = MIN_OFFSET - 2;
    var lines = Object.keys(command.long).sort().map(function(name){
      var option = command.long[name];
      var line = {
        name: option.usage
          .replace(/^(?:-., |)/, function(m){
            return m || (hasShortOptions ? '    ' : '');
          })
          .replace(/(^|\s)(-[^\s,]+)/ig, function(m, p, flag){
            return p + chalk.yellow(flag);
          }),
        description: option.description
      };

      maxNameLength = Math.max(maxNameLength, stringLength(line.name));

      return line;
    });

    // Prepend the help information
    return [
      '',
      'Options:',
      '',
      lines.map(function(line){
        return '  ' + pad(maxNameLength, line.name) + '  ' + breakByLines(line.description, maxNameLength + 4);
      }).join('\n'),
      ''
    ].join('\n');
  }

  var output = [];
  var chalk = require('chalk');

  chalk.enabled = module.exports.color && process.stdout.isTTY;

  if (command.description_)
    output.push(command.description_ + '\n');

  output.push(
    'Usage:\n\n  ' +
      chalk.cyan(commandsPath ? commandsPath.join(' ') : command.name) +
      (command.params ? ' ' + chalk.magenta(args(command)) : '') +
      (command.hasOptions() ? ' [' + chalk.yellow('options') + ']' : '') +
      (command.hasCommands() ? ' [' + chalk.green('command') + ']' : ''),
    commandsHelp() +
    optionsHelp()
  );

  return output.join('\n');
};


//
// export
//

module.exports = {
  color: true,

  Error: SyntaxError,
  Argument: Argument,
  Command: Command,
  Option: Option,

  error: function(fn){
    if (errorHandler)
      throw new SyntaxError('Error handler should be set only once');

    if (typeof fn != 'function')
      throw new SyntaxError('Error handler should be a function');

    errorHandler = fn;

    return this;
  },

  create: function(name, params){
    return new Command(name || require('path').basename(process.argv[1]) || 'cli', params);
  },

  confirm: function(message, fn){
    process.stdout.write(message);
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', function(val){
      process.stdin.pause();
      fn(/^y|yes|ok|true$/i.test(val.trim()));
    });
    process.stdin.resume();
  }
};
