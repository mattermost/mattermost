#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var require$$0 = require('node:events');
var require$$1 = require('node:child_process');
var require$$2 = require('node:path');
var require$$3 = require('node:fs');
var process$1 = require('node:process');
var os = require('node:os');
var tty = require('node:tty');
var require$$2$1 = require('os');
var require$$3$1 = require('crypto');
var print = require('./print-APSvEmKI.js');
require('testcontainers');
require('@testcontainers/postgresql');
require('child_process');
require('http');
require('url');

function _interopNamespaceDefault(e) {
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var fs__namespace = /*#__PURE__*/_interopNamespaceDefault(fs);
var path__namespace = /*#__PURE__*/_interopNamespaceDefault(path);

var commander = {};

var argument = {};

var error = {};

/**
 * CommanderError class
 */

var hasRequiredError;

function requireError () {
	if (hasRequiredError) return error;
	hasRequiredError = 1;
	class CommanderError extends Error {
	  /**
	   * Constructs the CommanderError class
	   * @param {number} exitCode suggested exit code which could be used with process.exit
	   * @param {string} code an id string representing the error
	   * @param {string} message human-readable description of the error
	   */
	  constructor(exitCode, code, message) {
	    super(message);
	    // properly capture stack trace in Node.js
	    Error.captureStackTrace(this, this.constructor);
	    this.name = this.constructor.name;
	    this.code = code;
	    this.exitCode = exitCode;
	    this.nestedError = undefined;
	  }
	}

	/**
	 * InvalidArgumentError class
	 */
	class InvalidArgumentError extends CommanderError {
	  /**
	   * Constructs the InvalidArgumentError class
	   * @param {string} [message] explanation of why argument is invalid
	   */
	  constructor(message) {
	    super(1, 'commander.invalidArgument', message);
	    // properly capture stack trace in Node.js
	    Error.captureStackTrace(this, this.constructor);
	    this.name = this.constructor.name;
	  }
	}

	error.CommanderError = CommanderError;
	error.InvalidArgumentError = InvalidArgumentError;
	return error;
}

var hasRequiredArgument;

function requireArgument () {
	if (hasRequiredArgument) return argument;
	hasRequiredArgument = 1;
	const { InvalidArgumentError } = requireError();

	class Argument {
	  /**
	   * Initialize a new command argument with the given name and description.
	   * The default is that the argument is required, and you can explicitly
	   * indicate this with <> around the name. Put [] around the name for an optional argument.
	   *
	   * @param {string} name
	   * @param {string} [description]
	   */

	  constructor(name, description) {
	    this.description = description || '';
	    this.variadic = false;
	    this.parseArg = undefined;
	    this.defaultValue = undefined;
	    this.defaultValueDescription = undefined;
	    this.argChoices = undefined;

	    switch (name[0]) {
	      case '<': // e.g. <required>
	        this.required = true;
	        this._name = name.slice(1, -1);
	        break;
	      case '[': // e.g. [optional]
	        this.required = false;
	        this._name = name.slice(1, -1);
	        break;
	      default:
	        this.required = true;
	        this._name = name;
	        break;
	    }

	    if (this._name.endsWith('...')) {
	      this.variadic = true;
	      this._name = this._name.slice(0, -3);
	    }
	  }

	  /**
	   * Return argument name.
	   *
	   * @return {string}
	   */

	  name() {
	    return this._name;
	  }

	  /**
	   * @package
	   */

	  _collectValue(value, previous) {
	    if (previous === this.defaultValue || !Array.isArray(previous)) {
	      return [value];
	    }

	    previous.push(value);
	    return previous;
	  }

	  /**
	   * Set the default value, and optionally supply the description to be displayed in the help.
	   *
	   * @param {*} value
	   * @param {string} [description]
	   * @return {Argument}
	   */

	  default(value, description) {
	    this.defaultValue = value;
	    this.defaultValueDescription = description;
	    return this;
	  }

	  /**
	   * Set the custom handler for processing CLI command arguments into argument values.
	   *
	   * @param {Function} [fn]
	   * @return {Argument}
	   */

	  argParser(fn) {
	    this.parseArg = fn;
	    return this;
	  }

	  /**
	   * Only allow argument value to be one of choices.
	   *
	   * @param {string[]} values
	   * @return {Argument}
	   */

	  choices(values) {
	    this.argChoices = values.slice();
	    this.parseArg = (arg, previous) => {
	      if (!this.argChoices.includes(arg)) {
	        throw new InvalidArgumentError(
	          `Allowed choices are ${this.argChoices.join(', ')}.`,
	        );
	      }
	      if (this.variadic) {
	        return this._collectValue(arg, previous);
	      }
	      return arg;
	    };
	    return this;
	  }

	  /**
	   * Make argument required.
	   *
	   * @returns {Argument}
	   */
	  argRequired() {
	    this.required = true;
	    return this;
	  }

	  /**
	   * Make argument optional.
	   *
	   * @returns {Argument}
	   */
	  argOptional() {
	    this.required = false;
	    return this;
	  }
	}

	/**
	 * Takes an argument and returns its human readable equivalent for help usage.
	 *
	 * @param {Argument} arg
	 * @return {string}
	 * @private
	 */

	function humanReadableArgName(arg) {
	  const nameOutput = arg.name() + (arg.variadic === true ? '...' : '');

	  return arg.required ? '<' + nameOutput + '>' : '[' + nameOutput + ']';
	}

	argument.Argument = Argument;
	argument.humanReadableArgName = humanReadableArgName;
	return argument;
}

var command = {};

var help = {};

var hasRequiredHelp;

function requireHelp () {
	if (hasRequiredHelp) return help;
	hasRequiredHelp = 1;
	const { humanReadableArgName } = requireArgument();

	/**
	 * TypeScript import types for JSDoc, used by Visual Studio Code IntelliSense and `npm run typescript-checkJS`
	 * https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html#import-types
	 * @typedef { import("./argument.js").Argument } Argument
	 * @typedef { import("./command.js").Command } Command
	 * @typedef { import("./option.js").Option } Option
	 */

	// Although this is a class, methods are static in style to allow override using subclass or just functions.
	class Help {
	  constructor() {
	    this.helpWidth = undefined;
	    this.minWidthToWrap = 40;
	    this.sortSubcommands = false;
	    this.sortOptions = false;
	    this.showGlobalOptions = false;
	  }

	  /**
	   * prepareContext is called by Commander after applying overrides from `Command.configureHelp()`
	   * and just before calling `formatHelp()`.
	   *
	   * Commander just uses the helpWidth and the rest is provided for optional use by more complex subclasses.
	   *
	   * @param {{ error?: boolean, helpWidth?: number, outputHasColors?: boolean }} contextOptions
	   */
	  prepareContext(contextOptions) {
	    this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
	  }

	  /**
	   * Get an array of the visible subcommands. Includes a placeholder for the implicit help command, if there is one.
	   *
	   * @param {Command} cmd
	   * @returns {Command[]}
	   */

	  visibleCommands(cmd) {
	    const visibleCommands = cmd.commands.filter((cmd) => !cmd._hidden);
	    const helpCommand = cmd._getHelpCommand();
	    if (helpCommand && !helpCommand._hidden) {
	      visibleCommands.push(helpCommand);
	    }
	    if (this.sortSubcommands) {
	      visibleCommands.sort((a, b) => {
	        // @ts-ignore: because overloaded return type
	        return a.name().localeCompare(b.name());
	      });
	    }
	    return visibleCommands;
	  }

	  /**
	   * Compare options for sort.
	   *
	   * @param {Option} a
	   * @param {Option} b
	   * @returns {number}
	   */
	  compareOptions(a, b) {
	    const getSortKey = (option) => {
	      // WYSIWYG for order displayed in help. Short used for comparison if present. No special handling for negated.
	      return option.short
	        ? option.short.replace(/^-/, '')
	        : option.long.replace(/^--/, '');
	    };
	    return getSortKey(a).localeCompare(getSortKey(b));
	  }

	  /**
	   * Get an array of the visible options. Includes a placeholder for the implicit help option, if there is one.
	   *
	   * @param {Command} cmd
	   * @returns {Option[]}
	   */

	  visibleOptions(cmd) {
	    const visibleOptions = cmd.options.filter((option) => !option.hidden);
	    // Built-in help option.
	    const helpOption = cmd._getHelpOption();
	    if (helpOption && !helpOption.hidden) {
	      // Automatically hide conflicting flags. Bit dubious but a historical behaviour that is convenient for single-command programs.
	      const removeShort = helpOption.short && cmd._findOption(helpOption.short);
	      const removeLong = helpOption.long && cmd._findOption(helpOption.long);
	      if (!removeShort && !removeLong) {
	        visibleOptions.push(helpOption); // no changes needed
	      } else if (helpOption.long && !removeLong) {
	        visibleOptions.push(
	          cmd.createOption(helpOption.long, helpOption.description),
	        );
	      } else if (helpOption.short && !removeShort) {
	        visibleOptions.push(
	          cmd.createOption(helpOption.short, helpOption.description),
	        );
	      }
	    }
	    if (this.sortOptions) {
	      visibleOptions.sort(this.compareOptions);
	    }
	    return visibleOptions;
	  }

	  /**
	   * Get an array of the visible global options. (Not including help.)
	   *
	   * @param {Command} cmd
	   * @returns {Option[]}
	   */

	  visibleGlobalOptions(cmd) {
	    if (!this.showGlobalOptions) return [];

	    const globalOptions = [];
	    for (
	      let ancestorCmd = cmd.parent;
	      ancestorCmd;
	      ancestorCmd = ancestorCmd.parent
	    ) {
	      const visibleOptions = ancestorCmd.options.filter(
	        (option) => !option.hidden,
	      );
	      globalOptions.push(...visibleOptions);
	    }
	    if (this.sortOptions) {
	      globalOptions.sort(this.compareOptions);
	    }
	    return globalOptions;
	  }

	  /**
	   * Get an array of the arguments if any have a description.
	   *
	   * @param {Command} cmd
	   * @returns {Argument[]}
	   */

	  visibleArguments(cmd) {
	    // Side effect! Apply the legacy descriptions before the arguments are displayed.
	    if (cmd._argsDescription) {
	      cmd.registeredArguments.forEach((argument) => {
	        argument.description =
	          argument.description || cmd._argsDescription[argument.name()] || '';
	      });
	    }

	    // If there are any arguments with a description then return all the arguments.
	    if (cmd.registeredArguments.find((argument) => argument.description)) {
	      return cmd.registeredArguments;
	    }
	    return [];
	  }

	  /**
	   * Get the command term to show in the list of subcommands.
	   *
	   * @param {Command} cmd
	   * @returns {string}
	   */

	  subcommandTerm(cmd) {
	    // Legacy. Ignores custom usage string, and nested commands.
	    const args = cmd.registeredArguments
	      .map((arg) => humanReadableArgName(arg))
	      .join(' ');
	    return (
	      cmd._name +
	      (cmd._aliases[0] ? '|' + cmd._aliases[0] : '') +
	      (cmd.options.length ? ' [options]' : '') + // simplistic check for non-help option
	      (args ? ' ' + args : '')
	    );
	  }

	  /**
	   * Get the option term to show in the list of options.
	   *
	   * @param {Option} option
	   * @returns {string}
	   */

	  optionTerm(option) {
	    return option.flags;
	  }

	  /**
	   * Get the argument term to show in the list of arguments.
	   *
	   * @param {Argument} argument
	   * @returns {string}
	   */

	  argumentTerm(argument) {
	    return argument.name();
	  }

	  /**
	   * Get the longest command term length.
	   *
	   * @param {Command} cmd
	   * @param {Help} helper
	   * @returns {number}
	   */

	  longestSubcommandTermLength(cmd, helper) {
	    return helper.visibleCommands(cmd).reduce((max, command) => {
	      return Math.max(
	        max,
	        this.displayWidth(
	          helper.styleSubcommandTerm(helper.subcommandTerm(command)),
	        ),
	      );
	    }, 0);
	  }

	  /**
	   * Get the longest option term length.
	   *
	   * @param {Command} cmd
	   * @param {Help} helper
	   * @returns {number}
	   */

	  longestOptionTermLength(cmd, helper) {
	    return helper.visibleOptions(cmd).reduce((max, option) => {
	      return Math.max(
	        max,
	        this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))),
	      );
	    }, 0);
	  }

	  /**
	   * Get the longest global option term length.
	   *
	   * @param {Command} cmd
	   * @param {Help} helper
	   * @returns {number}
	   */

	  longestGlobalOptionTermLength(cmd, helper) {
	    return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
	      return Math.max(
	        max,
	        this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))),
	      );
	    }, 0);
	  }

	  /**
	   * Get the longest argument term length.
	   *
	   * @param {Command} cmd
	   * @param {Help} helper
	   * @returns {number}
	   */

	  longestArgumentTermLength(cmd, helper) {
	    return helper.visibleArguments(cmd).reduce((max, argument) => {
	      return Math.max(
	        max,
	        this.displayWidth(
	          helper.styleArgumentTerm(helper.argumentTerm(argument)),
	        ),
	      );
	    }, 0);
	  }

	  /**
	   * Get the command usage to be displayed at the top of the built-in help.
	   *
	   * @param {Command} cmd
	   * @returns {string}
	   */

	  commandUsage(cmd) {
	    // Usage
	    let cmdName = cmd._name;
	    if (cmd._aliases[0]) {
	      cmdName = cmdName + '|' + cmd._aliases[0];
	    }
	    let ancestorCmdNames = '';
	    for (
	      let ancestorCmd = cmd.parent;
	      ancestorCmd;
	      ancestorCmd = ancestorCmd.parent
	    ) {
	      ancestorCmdNames = ancestorCmd.name() + ' ' + ancestorCmdNames;
	    }
	    return ancestorCmdNames + cmdName + ' ' + cmd.usage();
	  }

	  /**
	   * Get the description for the command.
	   *
	   * @param {Command} cmd
	   * @returns {string}
	   */

	  commandDescription(cmd) {
	    // @ts-ignore: because overloaded return type
	    return cmd.description();
	  }

	  /**
	   * Get the subcommand summary to show in the list of subcommands.
	   * (Fallback to description for backwards compatibility.)
	   *
	   * @param {Command} cmd
	   * @returns {string}
	   */

	  subcommandDescription(cmd) {
	    // @ts-ignore: because overloaded return type
	    return cmd.summary() || cmd.description();
	  }

	  /**
	   * Get the option description to show in the list of options.
	   *
	   * @param {Option} option
	   * @return {string}
	   */

	  optionDescription(option) {
	    const extraInfo = [];

	    if (option.argChoices) {
	      extraInfo.push(
	        // use stringify to match the display of the default value
	        `choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(', ')}`,
	      );
	    }
	    if (option.defaultValue !== undefined) {
	      // default for boolean and negated more for programmer than end user,
	      // but show true/false for boolean option as may be for hand-rolled env or config processing.
	      const showDefault =
	        option.required ||
	        option.optional ||
	        (option.isBoolean() && typeof option.defaultValue === 'boolean');
	      if (showDefault) {
	        extraInfo.push(
	          `default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`,
	        );
	      }
	    }
	    // preset for boolean and negated are more for programmer than end user
	    if (option.presetArg !== undefined && option.optional) {
	      extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
	    }
	    if (option.envVar !== undefined) {
	      extraInfo.push(`env: ${option.envVar}`);
	    }
	    if (extraInfo.length > 0) {
	      const extraDescription = `(${extraInfo.join(', ')})`;
	      if (option.description) {
	        return `${option.description} ${extraDescription}`;
	      }
	      return extraDescription;
	    }

	    return option.description;
	  }

	  /**
	   * Get the argument description to show in the list of arguments.
	   *
	   * @param {Argument} argument
	   * @return {string}
	   */

	  argumentDescription(argument) {
	    const extraInfo = [];
	    if (argument.argChoices) {
	      extraInfo.push(
	        // use stringify to match the display of the default value
	        `choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(', ')}`,
	      );
	    }
	    if (argument.defaultValue !== undefined) {
	      extraInfo.push(
	        `default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`,
	      );
	    }
	    if (extraInfo.length > 0) {
	      const extraDescription = `(${extraInfo.join(', ')})`;
	      if (argument.description) {
	        return `${argument.description} ${extraDescription}`;
	      }
	      return extraDescription;
	    }
	    return argument.description;
	  }

	  /**
	   * Format a list of items, given a heading and an array of formatted items.
	   *
	   * @param {string} heading
	   * @param {string[]} items
	   * @param {Help} helper
	   * @returns string[]
	   */
	  formatItemList(heading, items, helper) {
	    if (items.length === 0) return [];

	    return [helper.styleTitle(heading), ...items, ''];
	  }

	  /**
	   * Group items by their help group heading.
	   *
	   * @param {Command[] | Option[]} unsortedItems
	   * @param {Command[] | Option[]} visibleItems
	   * @param {Function} getGroup
	   * @returns {Map<string, Command[] | Option[]>}
	   */
	  groupItems(unsortedItems, visibleItems, getGroup) {
	    const result = new Map();
	    // Add groups in order of appearance in unsortedItems.
	    unsortedItems.forEach((item) => {
	      const group = getGroup(item);
	      if (!result.has(group)) result.set(group, []);
	    });
	    // Add items in order of appearance in visibleItems.
	    visibleItems.forEach((item) => {
	      const group = getGroup(item);
	      if (!result.has(group)) {
	        result.set(group, []);
	      }
	      result.get(group).push(item);
	    });
	    return result;
	  }

	  /**
	   * Generate the built-in help text.
	   *
	   * @param {Command} cmd
	   * @param {Help} helper
	   * @returns {string}
	   */

	  formatHelp(cmd, helper) {
	    const termWidth = helper.padWidth(cmd, helper);
	    const helpWidth = helper.helpWidth ?? 80; // in case prepareContext() was not called

	    function callFormatItem(term, description) {
	      return helper.formatItem(term, termWidth, description, helper);
	    }

	    // Usage
	    let output = [
	      `${helper.styleTitle('Usage:')} ${helper.styleUsage(helper.commandUsage(cmd))}`,
	      '',
	    ];

	    // Description
	    const commandDescription = helper.commandDescription(cmd);
	    if (commandDescription.length > 0) {
	      output = output.concat([
	        helper.boxWrap(
	          helper.styleCommandDescription(commandDescription),
	          helpWidth,
	        ),
	        '',
	      ]);
	    }

	    // Arguments
	    const argumentList = helper.visibleArguments(cmd).map((argument) => {
	      return callFormatItem(
	        helper.styleArgumentTerm(helper.argumentTerm(argument)),
	        helper.styleArgumentDescription(helper.argumentDescription(argument)),
	      );
	    });
	    output = output.concat(
	      this.formatItemList('Arguments:', argumentList, helper),
	    );

	    // Options
	    const optionGroups = this.groupItems(
	      cmd.options,
	      helper.visibleOptions(cmd),
	      (option) => option.helpGroupHeading ?? 'Options:',
	    );
	    optionGroups.forEach((options, group) => {
	      const optionList = options.map((option) => {
	        return callFormatItem(
	          helper.styleOptionTerm(helper.optionTerm(option)),
	          helper.styleOptionDescription(helper.optionDescription(option)),
	        );
	      });
	      output = output.concat(this.formatItemList(group, optionList, helper));
	    });

	    if (helper.showGlobalOptions) {
	      const globalOptionList = helper
	        .visibleGlobalOptions(cmd)
	        .map((option) => {
	          return callFormatItem(
	            helper.styleOptionTerm(helper.optionTerm(option)),
	            helper.styleOptionDescription(helper.optionDescription(option)),
	          );
	        });
	      output = output.concat(
	        this.formatItemList('Global Options:', globalOptionList, helper),
	      );
	    }

	    // Commands
	    const commandGroups = this.groupItems(
	      cmd.commands,
	      helper.visibleCommands(cmd),
	      (sub) => sub.helpGroup() || 'Commands:',
	    );
	    commandGroups.forEach((commands, group) => {
	      const commandList = commands.map((sub) => {
	        return callFormatItem(
	          helper.styleSubcommandTerm(helper.subcommandTerm(sub)),
	          helper.styleSubcommandDescription(helper.subcommandDescription(sub)),
	        );
	      });
	      output = output.concat(this.formatItemList(group, commandList, helper));
	    });

	    return output.join('\n');
	  }

	  /**
	   * Return display width of string, ignoring ANSI escape sequences. Used in padding and wrapping calculations.
	   *
	   * @param {string} str
	   * @returns {number}
	   */
	  displayWidth(str) {
	    return stripColor(str).length;
	  }

	  /**
	   * Style the title for displaying in the help. Called with 'Usage:', 'Options:', etc.
	   *
	   * @param {string} str
	   * @returns {string}
	   */
	  styleTitle(str) {
	    return str;
	  }

	  styleUsage(str) {
	    // Usage has lots of parts the user might like to color separately! Assume default usage string which is formed like:
	    //    command subcommand [options] [command] <foo> [bar]
	    return str
	      .split(' ')
	      .map((word) => {
	        if (word === '[options]') return this.styleOptionText(word);
	        if (word === '[command]') return this.styleSubcommandText(word);
	        if (word[0] === '[' || word[0] === '<')
	          return this.styleArgumentText(word);
	        return this.styleCommandText(word); // Restrict to initial words?
	      })
	      .join(' ');
	  }
	  styleCommandDescription(str) {
	    return this.styleDescriptionText(str);
	  }
	  styleOptionDescription(str) {
	    return this.styleDescriptionText(str);
	  }
	  styleSubcommandDescription(str) {
	    return this.styleDescriptionText(str);
	  }
	  styleArgumentDescription(str) {
	    return this.styleDescriptionText(str);
	  }
	  styleDescriptionText(str) {
	    return str;
	  }
	  styleOptionTerm(str) {
	    return this.styleOptionText(str);
	  }
	  styleSubcommandTerm(str) {
	    // This is very like usage with lots of parts! Assume default string which is formed like:
	    //    subcommand [options] <foo> [bar]
	    return str
	      .split(' ')
	      .map((word) => {
	        if (word === '[options]') return this.styleOptionText(word);
	        if (word[0] === '[' || word[0] === '<')
	          return this.styleArgumentText(word);
	        return this.styleSubcommandText(word); // Restrict to initial words?
	      })
	      .join(' ');
	  }
	  styleArgumentTerm(str) {
	    return this.styleArgumentText(str);
	  }
	  styleOptionText(str) {
	    return str;
	  }
	  styleArgumentText(str) {
	    return str;
	  }
	  styleSubcommandText(str) {
	    return str;
	  }
	  styleCommandText(str) {
	    return str;
	  }

	  /**
	   * Calculate the pad width from the maximum term length.
	   *
	   * @param {Command} cmd
	   * @param {Help} helper
	   * @returns {number}
	   */

	  padWidth(cmd, helper) {
	    return Math.max(
	      helper.longestOptionTermLength(cmd, helper),
	      helper.longestGlobalOptionTermLength(cmd, helper),
	      helper.longestSubcommandTermLength(cmd, helper),
	      helper.longestArgumentTermLength(cmd, helper),
	    );
	  }

	  /**
	   * Detect manually wrapped and indented strings by checking for line break followed by whitespace.
	   *
	   * @param {string} str
	   * @returns {boolean}
	   */
	  preformatted(str) {
	    return /\n[^\S\r\n]/.test(str);
	  }

	  /**
	   * Format the "item", which consists of a term and description. Pad the term and wrap the description, indenting the following lines.
	   *
	   * So "TTT", 5, "DDD DDDD DD DDD" might be formatted for this.helpWidth=17 like so:
	   *   TTT  DDD DDDD
	   *        DD DDD
	   *
	   * @param {string} term
	   * @param {number} termWidth
	   * @param {string} description
	   * @param {Help} helper
	   * @returns {string}
	   */
	  formatItem(term, termWidth, description, helper) {
	    const itemIndent = 2;
	    const itemIndentStr = ' '.repeat(itemIndent);
	    if (!description) return itemIndentStr + term;

	    // Pad the term out to a consistent width, so descriptions are aligned.
	    const paddedTerm = term.padEnd(
	      termWidth + term.length - helper.displayWidth(term),
	    );

	    // Format the description.
	    const spacerWidth = 2; // between term and description
	    const helpWidth = this.helpWidth ?? 80; // in case prepareContext() was not called
	    const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
	    let formattedDescription;
	    if (
	      remainingWidth < this.minWidthToWrap ||
	      helper.preformatted(description)
	    ) {
	      formattedDescription = description;
	    } else {
	      const wrappedDescription = helper.boxWrap(description, remainingWidth);
	      formattedDescription = wrappedDescription.replace(
	        /\n/g,
	        '\n' + ' '.repeat(termWidth + spacerWidth),
	      );
	    }

	    // Construct and overall indent.
	    return (
	      itemIndentStr +
	      paddedTerm +
	      ' '.repeat(spacerWidth) +
	      formattedDescription.replace(/\n/g, `\n${itemIndentStr}`)
	    );
	  }

	  /**
	   * Wrap a string at whitespace, preserving existing line breaks.
	   * Wrapping is skipped if the width is less than `minWidthToWrap`.
	   *
	   * @param {string} str
	   * @param {number} width
	   * @returns {string}
	   */
	  boxWrap(str, width) {
	    if (width < this.minWidthToWrap) return str;

	    const rawLines = str.split(/\r\n|\n/);
	    // split up text by whitespace
	    const chunkPattern = /[\s]*[^\s]+/g;
	    const wrappedLines = [];
	    rawLines.forEach((line) => {
	      const chunks = line.match(chunkPattern);
	      if (chunks === null) {
	        wrappedLines.push('');
	        return;
	      }

	      let sumChunks = [chunks.shift()];
	      let sumWidth = this.displayWidth(sumChunks[0]);
	      chunks.forEach((chunk) => {
	        const visibleWidth = this.displayWidth(chunk);
	        // Accumulate chunks while they fit into width.
	        if (sumWidth + visibleWidth <= width) {
	          sumChunks.push(chunk);
	          sumWidth += visibleWidth;
	          return;
	        }
	        wrappedLines.push(sumChunks.join(''));

	        const nextChunk = chunk.trimStart(); // trim space at line break
	        sumChunks = [nextChunk];
	        sumWidth = this.displayWidth(nextChunk);
	      });
	      wrappedLines.push(sumChunks.join(''));
	    });

	    return wrappedLines.join('\n');
	  }
	}

	/**
	 * Strip style ANSI escape sequences from the string. In particular, SGR (Select Graphic Rendition) codes.
	 *
	 * @param {string} str
	 * @returns {string}
	 * @package
	 */

	function stripColor(str) {
	  // eslint-disable-next-line no-control-regex
	  const sgrPattern = /\x1b\[\d*(;\d*)*m/g;
	  return str.replace(sgrPattern, '');
	}

	help.Help = Help;
	help.stripColor = stripColor;
	return help;
}

var option = {};

var hasRequiredOption;

function requireOption () {
	if (hasRequiredOption) return option;
	hasRequiredOption = 1;
	const { InvalidArgumentError } = requireError();

	class Option {
	  /**
	   * Initialize a new `Option` with the given `flags` and `description`.
	   *
	   * @param {string} flags
	   * @param {string} [description]
	   */

	  constructor(flags, description) {
	    this.flags = flags;
	    this.description = description || '';

	    this.required = flags.includes('<'); // A value must be supplied when the option is specified.
	    this.optional = flags.includes('['); // A value is optional when the option is specified.
	    // variadic test ignores <value,...> et al which might be used to describe custom splitting of single argument
	    this.variadic = /\w\.\.\.[>\]]$/.test(flags); // The option can take multiple values.
	    this.mandatory = false; // The option must have a value after parsing, which usually means it must be specified on command line.
	    const optionFlags = splitOptionFlags(flags);
	    this.short = optionFlags.shortFlag; // May be a short flag, undefined, or even a long flag (if option has two long flags).
	    this.long = optionFlags.longFlag;
	    this.negate = false;
	    if (this.long) {
	      this.negate = this.long.startsWith('--no-');
	    }
	    this.defaultValue = undefined;
	    this.defaultValueDescription = undefined;
	    this.presetArg = undefined;
	    this.envVar = undefined;
	    this.parseArg = undefined;
	    this.hidden = false;
	    this.argChoices = undefined;
	    this.conflictsWith = [];
	    this.implied = undefined;
	    this.helpGroupHeading = undefined; // soft initialised when option added to command
	  }

	  /**
	   * Set the default value, and optionally supply the description to be displayed in the help.
	   *
	   * @param {*} value
	   * @param {string} [description]
	   * @return {Option}
	   */

	  default(value, description) {
	    this.defaultValue = value;
	    this.defaultValueDescription = description;
	    return this;
	  }

	  /**
	   * Preset to use when option used without option-argument, especially optional but also boolean and negated.
	   * The custom processing (parseArg) is called.
	   *
	   * @example
	   * new Option('--color').default('GREYSCALE').preset('RGB');
	   * new Option('--donate [amount]').preset('20').argParser(parseFloat);
	   *
	   * @param {*} arg
	   * @return {Option}
	   */

	  preset(arg) {
	    this.presetArg = arg;
	    return this;
	  }

	  /**
	   * Add option name(s) that conflict with this option.
	   * An error will be displayed if conflicting options are found during parsing.
	   *
	   * @example
	   * new Option('--rgb').conflicts('cmyk');
	   * new Option('--js').conflicts(['ts', 'jsx']);
	   *
	   * @param {(string | string[])} names
	   * @return {Option}
	   */

	  conflicts(names) {
	    this.conflictsWith = this.conflictsWith.concat(names);
	    return this;
	  }

	  /**
	   * Specify implied option values for when this option is set and the implied options are not.
	   *
	   * The custom processing (parseArg) is not called on the implied values.
	   *
	   * @example
	   * program
	   *   .addOption(new Option('--log', 'write logging information to file'))
	   *   .addOption(new Option('--trace', 'log extra details').implies({ log: 'trace.txt' }));
	   *
	   * @param {object} impliedOptionValues
	   * @return {Option}
	   */
	  implies(impliedOptionValues) {
	    let newImplied = impliedOptionValues;
	    if (typeof impliedOptionValues === 'string') {
	      // string is not documented, but easy mistake and we can do what user probably intended.
	      newImplied = { [impliedOptionValues]: true };
	    }
	    this.implied = Object.assign(this.implied || {}, newImplied);
	    return this;
	  }

	  /**
	   * Set environment variable to check for option value.
	   *
	   * An environment variable is only used if when processed the current option value is
	   * undefined, or the source of the current value is 'default' or 'config' or 'env'.
	   *
	   * @param {string} name
	   * @return {Option}
	   */

	  env(name) {
	    this.envVar = name;
	    return this;
	  }

	  /**
	   * Set the custom handler for processing CLI option arguments into option values.
	   *
	   * @param {Function} [fn]
	   * @return {Option}
	   */

	  argParser(fn) {
	    this.parseArg = fn;
	    return this;
	  }

	  /**
	   * Whether the option is mandatory and must have a value after parsing.
	   *
	   * @param {boolean} [mandatory=true]
	   * @return {Option}
	   */

	  makeOptionMandatory(mandatory = true) {
	    this.mandatory = !!mandatory;
	    return this;
	  }

	  /**
	   * Hide option in help.
	   *
	   * @param {boolean} [hide=true]
	   * @return {Option}
	   */

	  hideHelp(hide = true) {
	    this.hidden = !!hide;
	    return this;
	  }

	  /**
	   * @package
	   */

	  _collectValue(value, previous) {
	    if (previous === this.defaultValue || !Array.isArray(previous)) {
	      return [value];
	    }

	    previous.push(value);
	    return previous;
	  }

	  /**
	   * Only allow option value to be one of choices.
	   *
	   * @param {string[]} values
	   * @return {Option}
	   */

	  choices(values) {
	    this.argChoices = values.slice();
	    this.parseArg = (arg, previous) => {
	      if (!this.argChoices.includes(arg)) {
	        throw new InvalidArgumentError(
	          `Allowed choices are ${this.argChoices.join(', ')}.`,
	        );
	      }
	      if (this.variadic) {
	        return this._collectValue(arg, previous);
	      }
	      return arg;
	    };
	    return this;
	  }

	  /**
	   * Return option name.
	   *
	   * @return {string}
	   */

	  name() {
	    if (this.long) {
	      return this.long.replace(/^--/, '');
	    }
	    return this.short.replace(/^-/, '');
	  }

	  /**
	   * Return option name, in a camelcase format that can be used
	   * as an object attribute key.
	   *
	   * @return {string}
	   */

	  attributeName() {
	    if (this.negate) {
	      return camelcase(this.name().replace(/^no-/, ''));
	    }
	    return camelcase(this.name());
	  }

	  /**
	   * Set the help group heading.
	   *
	   * @param {string} heading
	   * @return {Option}
	   */
	  helpGroup(heading) {
	    this.helpGroupHeading = heading;
	    return this;
	  }

	  /**
	   * Check if `arg` matches the short or long flag.
	   *
	   * @param {string} arg
	   * @return {boolean}
	   * @package
	   */

	  is(arg) {
	    return this.short === arg || this.long === arg;
	  }

	  /**
	   * Return whether a boolean option.
	   *
	   * Options are one of boolean, negated, required argument, or optional argument.
	   *
	   * @return {boolean}
	   * @package
	   */

	  isBoolean() {
	    return !this.required && !this.optional && !this.negate;
	  }
	}

	/**
	 * This class is to make it easier to work with dual options, without changing the existing
	 * implementation. We support separate dual options for separate positive and negative options,
	 * like `--build` and `--no-build`, which share a single option value. This works nicely for some
	 * use cases, but is tricky for others where we want separate behaviours despite
	 * the single shared option value.
	 */
	class DualOptions {
	  /**
	   * @param {Option[]} options
	   */
	  constructor(options) {
	    this.positiveOptions = new Map();
	    this.negativeOptions = new Map();
	    this.dualOptions = new Set();
	    options.forEach((option) => {
	      if (option.negate) {
	        this.negativeOptions.set(option.attributeName(), option);
	      } else {
	        this.positiveOptions.set(option.attributeName(), option);
	      }
	    });
	    this.negativeOptions.forEach((value, key) => {
	      if (this.positiveOptions.has(key)) {
	        this.dualOptions.add(key);
	      }
	    });
	  }

	  /**
	   * Did the value come from the option, and not from possible matching dual option?
	   *
	   * @param {*} value
	   * @param {Option} option
	   * @returns {boolean}
	   */
	  valueFromOption(value, option) {
	    const optionKey = option.attributeName();
	    if (!this.dualOptions.has(optionKey)) return true;

	    // Use the value to deduce if (probably) came from the option.
	    const preset = this.negativeOptions.get(optionKey).presetArg;
	    const negativeValue = preset !== undefined ? preset : false;
	    return option.negate === (negativeValue === value);
	  }
	}

	/**
	 * Convert string from kebab-case to camelCase.
	 *
	 * @param {string} str
	 * @return {string}
	 * @private
	 */

	function camelcase(str) {
	  return str.split('-').reduce((str, word) => {
	    return str + word[0].toUpperCase() + word.slice(1);
	  });
	}

	/**
	 * Split the short and long flag out of something like '-m,--mixed <value>'
	 *
	 * @private
	 */

	function splitOptionFlags(flags) {
	  let shortFlag;
	  let longFlag;
	  // short flag, single dash and single character
	  const shortFlagExp = /^-[^-]$/;
	  // long flag, double dash and at least one character
	  const longFlagExp = /^--[^-]/;

	  const flagParts = flags.split(/[ |,]+/).concat('guard');
	  // Normal is short and/or long.
	  if (shortFlagExp.test(flagParts[0])) shortFlag = flagParts.shift();
	  if (longFlagExp.test(flagParts[0])) longFlag = flagParts.shift();
	  // Long then short. Rarely used but fine.
	  if (!shortFlag && shortFlagExp.test(flagParts[0]))
	    shortFlag = flagParts.shift();
	  // Allow two long flags, like '--ws, --workspace'
	  // This is the supported way to have a shortish option flag.
	  if (!shortFlag && longFlagExp.test(flagParts[0])) {
	    shortFlag = longFlag;
	    longFlag = flagParts.shift();
	  }

	  // Check for unprocessed flag. Fail noisily rather than silently ignore.
	  if (flagParts[0].startsWith('-')) {
	    const unsupportedFlag = flagParts[0];
	    const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
	    if (/^-[^-][^-]/.test(unsupportedFlag))
	      throw new Error(
	        `${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`,
	      );
	    if (shortFlagExp.test(unsupportedFlag))
	      throw new Error(`${baseError}
- too many short flags`);
	    if (longFlagExp.test(unsupportedFlag))
	      throw new Error(`${baseError}
- too many long flags`);

	    throw new Error(`${baseError}
- unrecognised flag format`);
	  }
	  if (shortFlag === undefined && longFlag === undefined)
	    throw new Error(
	      `option creation failed due to no flags found in '${flags}'.`,
	    );

	  return { shortFlag, longFlag };
	}

	option.Option = Option;
	option.DualOptions = DualOptions;
	return option;
}

var suggestSimilar = {};

var hasRequiredSuggestSimilar;

function requireSuggestSimilar () {
	if (hasRequiredSuggestSimilar) return suggestSimilar;
	hasRequiredSuggestSimilar = 1;
	const maxDistance = 3;

	function editDistance(a, b) {
	  // https://en.wikipedia.org/wiki/Damerau–Levenshtein_distance
	  // Calculating optimal string alignment distance, no substring is edited more than once.
	  // (Simple implementation.)

	  // Quick early exit, return worst case.
	  if (Math.abs(a.length - b.length) > maxDistance)
	    return Math.max(a.length, b.length);

	  // distance between prefix substrings of a and b
	  const d = [];

	  // pure deletions turn a into empty string
	  for (let i = 0; i <= a.length; i++) {
	    d[i] = [i];
	  }
	  // pure insertions turn empty string into b
	  for (let j = 0; j <= b.length; j++) {
	    d[0][j] = j;
	  }

	  // fill matrix
	  for (let j = 1; j <= b.length; j++) {
	    for (let i = 1; i <= a.length; i++) {
	      let cost = 1;
	      if (a[i - 1] === b[j - 1]) {
	        cost = 0;
	      } else {
	        cost = 1;
	      }
	      d[i][j] = Math.min(
	        d[i - 1][j] + 1, // deletion
	        d[i][j - 1] + 1, // insertion
	        d[i - 1][j - 1] + cost, // substitution
	      );
	      // transposition
	      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
	        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
	      }
	    }
	  }

	  return d[a.length][b.length];
	}

	/**
	 * Find close matches, restricted to same number of edits.
	 *
	 * @param {string} word
	 * @param {string[]} candidates
	 * @returns {string}
	 */

	function suggestSimilar$1(word, candidates) {
	  if (!candidates || candidates.length === 0) return '';
	  // remove possible duplicates
	  candidates = Array.from(new Set(candidates));

	  const searchingOptions = word.startsWith('--');
	  if (searchingOptions) {
	    word = word.slice(2);
	    candidates = candidates.map((candidate) => candidate.slice(2));
	  }

	  let similar = [];
	  let bestDistance = maxDistance;
	  const minSimilarity = 0.4;
	  candidates.forEach((candidate) => {
	    if (candidate.length <= 1) return; // no one character guesses

	    const distance = editDistance(word, candidate);
	    const length = Math.max(word.length, candidate.length);
	    const similarity = (length - distance) / length;
	    if (similarity > minSimilarity) {
	      if (distance < bestDistance) {
	        // better edit distance, throw away previous worse matches
	        bestDistance = distance;
	        similar = [candidate];
	      } else if (distance === bestDistance) {
	        similar.push(candidate);
	      }
	    }
	  });

	  similar.sort((a, b) => a.localeCompare(b));
	  if (searchingOptions) {
	    similar = similar.map((candidate) => `--${candidate}`);
	  }

	  if (similar.length > 1) {
	    return `\n(Did you mean one of ${similar.join(', ')}?)`;
	  }
	  if (similar.length === 1) {
	    return `\n(Did you mean ${similar[0]}?)`;
	  }
	  return '';
	}

	suggestSimilar.suggestSimilar = suggestSimilar$1;
	return suggestSimilar;
}

var hasRequiredCommand;

function requireCommand () {
	if (hasRequiredCommand) return command;
	hasRequiredCommand = 1;
	const EventEmitter = require$$0.EventEmitter;
	const childProcess = require$$1;
	const path = require$$2;
	const fs = require$$3;
	const process = process$1;

	const { Argument, humanReadableArgName } = requireArgument();
	const { CommanderError } = requireError();
	const { Help, stripColor } = requireHelp();
	const { Option, DualOptions } = requireOption();
	const { suggestSimilar } = requireSuggestSimilar();

	class Command extends EventEmitter {
	  /**
	   * Initialize a new `Command`.
	   *
	   * @param {string} [name]
	   */

	  constructor(name) {
	    super();
	    /** @type {Command[]} */
	    this.commands = [];
	    /** @type {Option[]} */
	    this.options = [];
	    this.parent = null;
	    this._allowUnknownOption = false;
	    this._allowExcessArguments = false;
	    /** @type {Argument[]} */
	    this.registeredArguments = [];
	    this._args = this.registeredArguments; // deprecated old name
	    /** @type {string[]} */
	    this.args = []; // cli args with options removed
	    this.rawArgs = [];
	    this.processedArgs = []; // like .args but after custom processing and collecting variadic
	    this._scriptPath = null;
	    this._name = name || '';
	    this._optionValues = {};
	    this._optionValueSources = {}; // default, env, cli etc
	    this._storeOptionsAsProperties = false;
	    this._actionHandler = null;
	    this._executableHandler = false;
	    this._executableFile = null; // custom name for executable
	    this._executableDir = null; // custom search directory for subcommands
	    this._defaultCommandName = null;
	    this._exitCallback = null;
	    this._aliases = [];
	    this._combineFlagAndOptionalValue = true;
	    this._description = '';
	    this._summary = '';
	    this._argsDescription = undefined; // legacy
	    this._enablePositionalOptions = false;
	    this._passThroughOptions = false;
	    this._lifeCycleHooks = {}; // a hash of arrays
	    /** @type {(boolean | string)} */
	    this._showHelpAfterError = false;
	    this._showSuggestionAfterError = true;
	    this._savedState = null; // used in save/restoreStateBeforeParse

	    // see configureOutput() for docs
	    this._outputConfiguration = {
	      writeOut: (str) => process.stdout.write(str),
	      writeErr: (str) => process.stderr.write(str),
	      outputError: (str, write) => write(str),
	      getOutHelpWidth: () =>
	        process.stdout.isTTY ? process.stdout.columns : undefined,
	      getErrHelpWidth: () =>
	        process.stderr.isTTY ? process.stderr.columns : undefined,
	      getOutHasColors: () =>
	        useColor() ?? (process.stdout.isTTY && process.stdout.hasColors?.()),
	      getErrHasColors: () =>
	        useColor() ?? (process.stderr.isTTY && process.stderr.hasColors?.()),
	      stripColor: (str) => stripColor(str),
	    };

	    this._hidden = false;
	    /** @type {(Option | null | undefined)} */
	    this._helpOption = undefined; // Lazy created on demand. May be null if help option is disabled.
	    this._addImplicitHelpCommand = undefined; // undecided whether true or false yet, not inherited
	    /** @type {Command} */
	    this._helpCommand = undefined; // lazy initialised, inherited
	    this._helpConfiguration = {};
	    /** @type {string | undefined} */
	    this._helpGroupHeading = undefined; // soft initialised when added to parent
	    /** @type {string | undefined} */
	    this._defaultCommandGroup = undefined;
	    /** @type {string | undefined} */
	    this._defaultOptionGroup = undefined;
	  }

	  /**
	   * Copy settings that are useful to have in common across root command and subcommands.
	   *
	   * (Used internally when adding a command using `.command()` so subcommands inherit parent settings.)
	   *
	   * @param {Command} sourceCommand
	   * @return {Command} `this` command for chaining
	   */
	  copyInheritedSettings(sourceCommand) {
	    this._outputConfiguration = sourceCommand._outputConfiguration;
	    this._helpOption = sourceCommand._helpOption;
	    this._helpCommand = sourceCommand._helpCommand;
	    this._helpConfiguration = sourceCommand._helpConfiguration;
	    this._exitCallback = sourceCommand._exitCallback;
	    this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
	    this._combineFlagAndOptionalValue =
	      sourceCommand._combineFlagAndOptionalValue;
	    this._allowExcessArguments = sourceCommand._allowExcessArguments;
	    this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
	    this._showHelpAfterError = sourceCommand._showHelpAfterError;
	    this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;

	    return this;
	  }

	  /**
	   * @returns {Command[]}
	   * @private
	   */

	  _getCommandAndAncestors() {
	    const result = [];
	    // eslint-disable-next-line @typescript-eslint/no-this-alias
	    for (let command = this; command; command = command.parent) {
	      result.push(command);
	    }
	    return result;
	  }

	  /**
	   * Define a command.
	   *
	   * There are two styles of command: pay attention to where to put the description.
	   *
	   * @example
	   * // Command implemented using action handler (description is supplied separately to `.command`)
	   * program
	   *   .command('clone <source> [destination]')
	   *   .description('clone a repository into a newly created directory')
	   *   .action((source, destination) => {
	   *     console.log('clone command called');
	   *   });
	   *
	   * // Command implemented using separate executable file (description is second parameter to `.command`)
	   * program
	   *   .command('start <service>', 'start named service')
	   *   .command('stop [service]', 'stop named service, or all if no name supplied');
	   *
	   * @param {string} nameAndArgs - command name and arguments, args are `<required>` or `[optional]` and last may also be `variadic...`
	   * @param {(object | string)} [actionOptsOrExecDesc] - configuration options (for action), or description (for executable)
	   * @param {object} [execOpts] - configuration options (for executable)
	   * @return {Command} returns new command for action handler, or `this` for executable command
	   */

	  command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
	    let desc = actionOptsOrExecDesc;
	    let opts = execOpts;
	    if (typeof desc === 'object' && desc !== null) {
	      opts = desc;
	      desc = null;
	    }
	    opts = opts || {};
	    const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);

	    const cmd = this.createCommand(name);
	    if (desc) {
	      cmd.description(desc);
	      cmd._executableHandler = true;
	    }
	    if (opts.isDefault) this._defaultCommandName = cmd._name;
	    cmd._hidden = !!(opts.noHelp || opts.hidden); // noHelp is deprecated old name for hidden
	    cmd._executableFile = opts.executableFile || null; // Custom name for executable file, set missing to null to match constructor
	    if (args) cmd.arguments(args);
	    this._registerCommand(cmd);
	    cmd.parent = this;
	    cmd.copyInheritedSettings(this);

	    if (desc) return this;
	    return cmd;
	  }

	  /**
	   * Factory routine to create a new unattached command.
	   *
	   * See .command() for creating an attached subcommand, which uses this routine to
	   * create the command. You can override createCommand to customise subcommands.
	   *
	   * @param {string} [name]
	   * @return {Command} new command
	   */

	  createCommand(name) {
	    return new Command(name);
	  }

	  /**
	   * You can customise the help with a subclass of Help by overriding createHelp,
	   * or by overriding Help properties using configureHelp().
	   *
	   * @return {Help}
	   */

	  createHelp() {
	    return Object.assign(new Help(), this.configureHelp());
	  }

	  /**
	   * You can customise the help by overriding Help properties using configureHelp(),
	   * or with a subclass of Help by overriding createHelp().
	   *
	   * @param {object} [configuration] - configuration options
	   * @return {(Command | object)} `this` command for chaining, or stored configuration
	   */

	  configureHelp(configuration) {
	    if (configuration === undefined) return this._helpConfiguration;

	    this._helpConfiguration = configuration;
	    return this;
	  }

	  /**
	   * The default output goes to stdout and stderr. You can customise this for special
	   * applications. You can also customise the display of errors by overriding outputError.
	   *
	   * The configuration properties are all functions:
	   *
	   *     // change how output being written, defaults to stdout and stderr
	   *     writeOut(str)
	   *     writeErr(str)
	   *     // change how output being written for errors, defaults to writeErr
	   *     outputError(str, write) // used for displaying errors and not used for displaying help
	   *     // specify width for wrapping help
	   *     getOutHelpWidth()
	   *     getErrHelpWidth()
	   *     // color support, currently only used with Help
	   *     getOutHasColors()
	   *     getErrHasColors()
	   *     stripColor() // used to remove ANSI escape codes if output does not have colors
	   *
	   * @param {object} [configuration] - configuration options
	   * @return {(Command | object)} `this` command for chaining, or stored configuration
	   */

	  configureOutput(configuration) {
	    if (configuration === undefined) return this._outputConfiguration;

	    this._outputConfiguration = {
	      ...this._outputConfiguration,
	      ...configuration,
	    };
	    return this;
	  }

	  /**
	   * Display the help or a custom message after an error occurs.
	   *
	   * @param {(boolean|string)} [displayHelp]
	   * @return {Command} `this` command for chaining
	   */
	  showHelpAfterError(displayHelp = true) {
	    if (typeof displayHelp !== 'string') displayHelp = !!displayHelp;
	    this._showHelpAfterError = displayHelp;
	    return this;
	  }

	  /**
	   * Display suggestion of similar commands for unknown commands, or options for unknown options.
	   *
	   * @param {boolean} [displaySuggestion]
	   * @return {Command} `this` command for chaining
	   */
	  showSuggestionAfterError(displaySuggestion = true) {
	    this._showSuggestionAfterError = !!displaySuggestion;
	    return this;
	  }

	  /**
	   * Add a prepared subcommand.
	   *
	   * See .command() for creating an attached subcommand which inherits settings from its parent.
	   *
	   * @param {Command} cmd - new subcommand
	   * @param {object} [opts] - configuration options
	   * @return {Command} `this` command for chaining
	   */

	  addCommand(cmd, opts) {
	    if (!cmd._name) {
	      throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
	    }

	    opts = opts || {};
	    if (opts.isDefault) this._defaultCommandName = cmd._name;
	    if (opts.noHelp || opts.hidden) cmd._hidden = true; // modifying passed command due to existing implementation

	    this._registerCommand(cmd);
	    cmd.parent = this;
	    cmd._checkForBrokenPassThrough();

	    return this;
	  }

	  /**
	   * Factory routine to create a new unattached argument.
	   *
	   * See .argument() for creating an attached argument, which uses this routine to
	   * create the argument. You can override createArgument to return a custom argument.
	   *
	   * @param {string} name
	   * @param {string} [description]
	   * @return {Argument} new argument
	   */

	  createArgument(name, description) {
	    return new Argument(name, description);
	  }

	  /**
	   * Define argument syntax for command.
	   *
	   * The default is that the argument is required, and you can explicitly
	   * indicate this with <> around the name. Put [] around the name for an optional argument.
	   *
	   * @example
	   * program.argument('<input-file>');
	   * program.argument('[output-file]');
	   *
	   * @param {string} name
	   * @param {string} [description]
	   * @param {(Function|*)} [parseArg] - custom argument processing function or default value
	   * @param {*} [defaultValue]
	   * @return {Command} `this` command for chaining
	   */
	  argument(name, description, parseArg, defaultValue) {
	    const argument = this.createArgument(name, description);
	    if (typeof parseArg === 'function') {
	      argument.default(defaultValue).argParser(parseArg);
	    } else {
	      argument.default(parseArg);
	    }
	    this.addArgument(argument);
	    return this;
	  }

	  /**
	   * Define argument syntax for command, adding multiple at once (without descriptions).
	   *
	   * See also .argument().
	   *
	   * @example
	   * program.arguments('<cmd> [env]');
	   *
	   * @param {string} names
	   * @return {Command} `this` command for chaining
	   */

	  arguments(names) {
	    names
	      .trim()
	      .split(/ +/)
	      .forEach((detail) => {
	        this.argument(detail);
	      });
	    return this;
	  }

	  /**
	   * Define argument syntax for command, adding a prepared argument.
	   *
	   * @param {Argument} argument
	   * @return {Command} `this` command for chaining
	   */
	  addArgument(argument) {
	    const previousArgument = this.registeredArguments.slice(-1)[0];
	    if (previousArgument?.variadic) {
	      throw new Error(
	        `only the last argument can be variadic '${previousArgument.name()}'`,
	      );
	    }
	    if (
	      argument.required &&
	      argument.defaultValue !== undefined &&
	      argument.parseArg === undefined
	    ) {
	      throw new Error(
	        `a default value for a required argument is never used: '${argument.name()}'`,
	      );
	    }
	    this.registeredArguments.push(argument);
	    return this;
	  }

	  /**
	   * Customise or override default help command. By default a help command is automatically added if your command has subcommands.
	   *
	   * @example
	   *    program.helpCommand('help [cmd]');
	   *    program.helpCommand('help [cmd]', 'show help');
	   *    program.helpCommand(false); // suppress default help command
	   *    program.helpCommand(true); // add help command even if no subcommands
	   *
	   * @param {string|boolean} enableOrNameAndArgs - enable with custom name and/or arguments, or boolean to override whether added
	   * @param {string} [description] - custom description
	   * @return {Command} `this` command for chaining
	   */

	  helpCommand(enableOrNameAndArgs, description) {
	    if (typeof enableOrNameAndArgs === 'boolean') {
	      this._addImplicitHelpCommand = enableOrNameAndArgs;
	      if (enableOrNameAndArgs && this._defaultCommandGroup) {
	        // make the command to store the group
	        this._initCommandGroup(this._getHelpCommand());
	      }
	      return this;
	    }

	    const nameAndArgs = enableOrNameAndArgs ?? 'help [command]';
	    const [, helpName, helpArgs] = nameAndArgs.match(/([^ ]+) *(.*)/);
	    const helpDescription = description ?? 'display help for command';

	    const helpCommand = this.createCommand(helpName);
	    helpCommand.helpOption(false);
	    if (helpArgs) helpCommand.arguments(helpArgs);
	    if (helpDescription) helpCommand.description(helpDescription);

	    this._addImplicitHelpCommand = true;
	    this._helpCommand = helpCommand;
	    // init group unless lazy create
	    if (enableOrNameAndArgs || description) this._initCommandGroup(helpCommand);

	    return this;
	  }

	  /**
	   * Add prepared custom help command.
	   *
	   * @param {(Command|string|boolean)} helpCommand - custom help command, or deprecated enableOrNameAndArgs as for `.helpCommand()`
	   * @param {string} [deprecatedDescription] - deprecated custom description used with custom name only
	   * @return {Command} `this` command for chaining
	   */
	  addHelpCommand(helpCommand, deprecatedDescription) {
	    // If not passed an object, call through to helpCommand for backwards compatibility,
	    // as addHelpCommand was originally used like helpCommand is now.
	    if (typeof helpCommand !== 'object') {
	      this.helpCommand(helpCommand, deprecatedDescription);
	      return this;
	    }

	    this._addImplicitHelpCommand = true;
	    this._helpCommand = helpCommand;
	    this._initCommandGroup(helpCommand);
	    return this;
	  }

	  /**
	   * Lazy create help command.
	   *
	   * @return {(Command|null)}
	   * @package
	   */
	  _getHelpCommand() {
	    const hasImplicitHelpCommand =
	      this._addImplicitHelpCommand ??
	      (this.commands.length &&
	        !this._actionHandler &&
	        !this._findCommand('help'));

	    if (hasImplicitHelpCommand) {
	      if (this._helpCommand === undefined) {
	        this.helpCommand(undefined, undefined); // use default name and description
	      }
	      return this._helpCommand;
	    }
	    return null;
	  }

	  /**
	   * Add hook for life cycle event.
	   *
	   * @param {string} event
	   * @param {Function} listener
	   * @return {Command} `this` command for chaining
	   */

	  hook(event, listener) {
	    const allowedValues = ['preSubcommand', 'preAction', 'postAction'];
	    if (!allowedValues.includes(event)) {
	      throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
	    }
	    if (this._lifeCycleHooks[event]) {
	      this._lifeCycleHooks[event].push(listener);
	    } else {
	      this._lifeCycleHooks[event] = [listener];
	    }
	    return this;
	  }

	  /**
	   * Register callback to use as replacement for calling process.exit.
	   *
	   * @param {Function} [fn] optional callback which will be passed a CommanderError, defaults to throwing
	   * @return {Command} `this` command for chaining
	   */

	  exitOverride(fn) {
	    if (fn) {
	      this._exitCallback = fn;
	    } else {
	      this._exitCallback = (err) => {
	        if (err.code !== 'commander.executeSubCommandAsync') {
	          throw err;
	        }
	      };
	    }
	    return this;
	  }

	  /**
	   * Call process.exit, and _exitCallback if defined.
	   *
	   * @param {number} exitCode exit code for using with process.exit
	   * @param {string} code an id string representing the error
	   * @param {string} message human-readable description of the error
	   * @return never
	   * @private
	   */

	  _exit(exitCode, code, message) {
	    if (this._exitCallback) {
	      this._exitCallback(new CommanderError(exitCode, code, message));
	      // Expecting this line is not reached.
	    }
	    process.exit(exitCode);
	  }

	  /**
	   * Register callback `fn` for the command.
	   *
	   * @example
	   * program
	   *   .command('serve')
	   *   .description('start service')
	   *   .action(function() {
	   *      // do work here
	   *   });
	   *
	   * @param {Function} fn
	   * @return {Command} `this` command for chaining
	   */

	  action(fn) {
	    const listener = (args) => {
	      // The .action callback takes an extra parameter which is the command or options.
	      const expectedArgsCount = this.registeredArguments.length;
	      const actionArgs = args.slice(0, expectedArgsCount);
	      if (this._storeOptionsAsProperties) {
	        actionArgs[expectedArgsCount] = this; // backwards compatible "options"
	      } else {
	        actionArgs[expectedArgsCount] = this.opts();
	      }
	      actionArgs.push(this);

	      return fn.apply(this, actionArgs);
	    };
	    this._actionHandler = listener;
	    return this;
	  }

	  /**
	   * Factory routine to create a new unattached option.
	   *
	   * See .option() for creating an attached option, which uses this routine to
	   * create the option. You can override createOption to return a custom option.
	   *
	   * @param {string} flags
	   * @param {string} [description]
	   * @return {Option} new option
	   */

	  createOption(flags, description) {
	    return new Option(flags, description);
	  }

	  /**
	   * Wrap parseArgs to catch 'commander.invalidArgument'.
	   *
	   * @param {(Option | Argument)} target
	   * @param {string} value
	   * @param {*} previous
	   * @param {string} invalidArgumentMessage
	   * @private
	   */

	  _callParseArg(target, value, previous, invalidArgumentMessage) {
	    try {
	      return target.parseArg(value, previous);
	    } catch (err) {
	      if (err.code === 'commander.invalidArgument') {
	        const message = `${invalidArgumentMessage} ${err.message}`;
	        this.error(message, { exitCode: err.exitCode, code: err.code });
	      }
	      throw err;
	    }
	  }

	  /**
	   * Check for option flag conflicts.
	   * Register option if no conflicts found, or throw on conflict.
	   *
	   * @param {Option} option
	   * @private
	   */

	  _registerOption(option) {
	    const matchingOption =
	      (option.short && this._findOption(option.short)) ||
	      (option.long && this._findOption(option.long));
	    if (matchingOption) {
	      const matchingFlag =
	        option.long && this._findOption(option.long)
	          ? option.long
	          : option.short;
	      throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
	    }

	    this._initOptionGroup(option);
	    this.options.push(option);
	  }

	  /**
	   * Check for command name and alias conflicts with existing commands.
	   * Register command if no conflicts found, or throw on conflict.
	   *
	   * @param {Command} command
	   * @private
	   */

	  _registerCommand(command) {
	    const knownBy = (cmd) => {
	      return [cmd.name()].concat(cmd.aliases());
	    };

	    const alreadyUsed = knownBy(command).find((name) =>
	      this._findCommand(name),
	    );
	    if (alreadyUsed) {
	      const existingCmd = knownBy(this._findCommand(alreadyUsed)).join('|');
	      const newCmd = knownBy(command).join('|');
	      throw new Error(
	        `cannot add command '${newCmd}' as already have command '${existingCmd}'`,
	      );
	    }

	    this._initCommandGroup(command);
	    this.commands.push(command);
	  }

	  /**
	   * Add an option.
	   *
	   * @param {Option} option
	   * @return {Command} `this` command for chaining
	   */
	  addOption(option) {
	    this._registerOption(option);

	    const oname = option.name();
	    const name = option.attributeName();

	    // store default value
	    if (option.negate) {
	      // --no-foo is special and defaults foo to true, unless a --foo option is already defined
	      const positiveLongFlag = option.long.replace(/^--no-/, '--');
	      if (!this._findOption(positiveLongFlag)) {
	        this.setOptionValueWithSource(
	          name,
	          option.defaultValue === undefined ? true : option.defaultValue,
	          'default',
	        );
	      }
	    } else if (option.defaultValue !== undefined) {
	      this.setOptionValueWithSource(name, option.defaultValue, 'default');
	    }

	    // handler for cli and env supplied values
	    const handleOptionValue = (val, invalidValueMessage, valueSource) => {
	      // val is null for optional option used without an optional-argument.
	      // val is undefined for boolean and negated option.
	      if (val == null && option.presetArg !== undefined) {
	        val = option.presetArg;
	      }

	      // custom processing
	      const oldValue = this.getOptionValue(name);
	      if (val !== null && option.parseArg) {
	        val = this._callParseArg(option, val, oldValue, invalidValueMessage);
	      } else if (val !== null && option.variadic) {
	        val = option._collectValue(val, oldValue);
	      }

	      // Fill-in appropriate missing values. Long winded but easy to follow.
	      if (val == null) {
	        if (option.negate) {
	          val = false;
	        } else if (option.isBoolean() || option.optional) {
	          val = true;
	        } else {
	          val = ''; // not normal, parseArg might have failed or be a mock function for testing
	        }
	      }
	      this.setOptionValueWithSource(name, val, valueSource);
	    };

	    this.on('option:' + oname, (val) => {
	      const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
	      handleOptionValue(val, invalidValueMessage, 'cli');
	    });

	    if (option.envVar) {
	      this.on('optionEnv:' + oname, (val) => {
	        const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
	        handleOptionValue(val, invalidValueMessage, 'env');
	      });
	    }

	    return this;
	  }

	  /**
	   * Internal implementation shared by .option() and .requiredOption()
	   *
	   * @return {Command} `this` command for chaining
	   * @private
	   */
	  _optionEx(config, flags, description, fn, defaultValue) {
	    if (typeof flags === 'object' && flags instanceof Option) {
	      throw new Error(
	        'To add an Option object use addOption() instead of option() or requiredOption()',
	      );
	    }
	    const option = this.createOption(flags, description);
	    option.makeOptionMandatory(!!config.mandatory);
	    if (typeof fn === 'function') {
	      option.default(defaultValue).argParser(fn);
	    } else if (fn instanceof RegExp) {
	      // deprecated
	      const regex = fn;
	      fn = (val, def) => {
	        const m = regex.exec(val);
	        return m ? m[0] : def;
	      };
	      option.default(defaultValue).argParser(fn);
	    } else {
	      option.default(fn);
	    }

	    return this.addOption(option);
	  }

	  /**
	   * Define option with `flags`, `description`, and optional argument parsing function or `defaultValue` or both.
	   *
	   * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space. A required
	   * option-argument is indicated by `<>` and an optional option-argument by `[]`.
	   *
	   * See the README for more details, and see also addOption() and requiredOption().
	   *
	   * @example
	   * program
	   *     .option('-p, --pepper', 'add pepper')
	   *     .option('--pt, --pizza-type <TYPE>', 'type of pizza') // required option-argument
	   *     .option('-c, --cheese [CHEESE]', 'add extra cheese', 'mozzarella') // optional option-argument with default
	   *     .option('-t, --tip <VALUE>', 'add tip to purchase cost', parseFloat) // custom parse function
	   *
	   * @param {string} flags
	   * @param {string} [description]
	   * @param {(Function|*)} [parseArg] - custom option processing function or default value
	   * @param {*} [defaultValue]
	   * @return {Command} `this` command for chaining
	   */

	  option(flags, description, parseArg, defaultValue) {
	    return this._optionEx({}, flags, description, parseArg, defaultValue);
	  }

	  /**
	   * Add a required option which must have a value after parsing. This usually means
	   * the option must be specified on the command line. (Otherwise the same as .option().)
	   *
	   * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space.
	   *
	   * @param {string} flags
	   * @param {string} [description]
	   * @param {(Function|*)} [parseArg] - custom option processing function or default value
	   * @param {*} [defaultValue]
	   * @return {Command} `this` command for chaining
	   */

	  requiredOption(flags, description, parseArg, defaultValue) {
	    return this._optionEx(
	      { mandatory: true },
	      flags,
	      description,
	      parseArg,
	      defaultValue,
	    );
	  }

	  /**
	   * Alter parsing of short flags with optional values.
	   *
	   * @example
	   * // for `.option('-f,--flag [value]'):
	   * program.combineFlagAndOptionalValue(true);  // `-f80` is treated like `--flag=80`, this is the default behaviour
	   * program.combineFlagAndOptionalValue(false) // `-fb` is treated like `-f -b`
	   *
	   * @param {boolean} [combine] - if `true` or omitted, an optional value can be specified directly after the flag.
	   * @return {Command} `this` command for chaining
	   */
	  combineFlagAndOptionalValue(combine = true) {
	    this._combineFlagAndOptionalValue = !!combine;
	    return this;
	  }

	  /**
	   * Allow unknown options on the command line.
	   *
	   * @param {boolean} [allowUnknown] - if `true` or omitted, no error will be thrown for unknown options.
	   * @return {Command} `this` command for chaining
	   */
	  allowUnknownOption(allowUnknown = true) {
	    this._allowUnknownOption = !!allowUnknown;
	    return this;
	  }

	  /**
	   * Allow excess command-arguments on the command line. Pass false to make excess arguments an error.
	   *
	   * @param {boolean} [allowExcess] - if `true` or omitted, no error will be thrown for excess arguments.
	   * @return {Command} `this` command for chaining
	   */
	  allowExcessArguments(allowExcess = true) {
	    this._allowExcessArguments = !!allowExcess;
	    return this;
	  }

	  /**
	   * Enable positional options. Positional means global options are specified before subcommands which lets
	   * subcommands reuse the same option names, and also enables subcommands to turn on passThroughOptions.
	   * The default behaviour is non-positional and global options may appear anywhere on the command line.
	   *
	   * @param {boolean} [positional]
	   * @return {Command} `this` command for chaining
	   */
	  enablePositionalOptions(positional = true) {
	    this._enablePositionalOptions = !!positional;
	    return this;
	  }

	  /**
	   * Pass through options that come after command-arguments rather than treat them as command-options,
	   * so actual command-options come before command-arguments. Turning this on for a subcommand requires
	   * positional options to have been enabled on the program (parent commands).
	   * The default behaviour is non-positional and options may appear before or after command-arguments.
	   *
	   * @param {boolean} [passThrough] for unknown options.
	   * @return {Command} `this` command for chaining
	   */
	  passThroughOptions(passThrough = true) {
	    this._passThroughOptions = !!passThrough;
	    this._checkForBrokenPassThrough();
	    return this;
	  }

	  /**
	   * @private
	   */

	  _checkForBrokenPassThrough() {
	    if (
	      this.parent &&
	      this._passThroughOptions &&
	      !this.parent._enablePositionalOptions
	    ) {
	      throw new Error(
	        `passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`,
	      );
	    }
	  }

	  /**
	   * Whether to store option values as properties on command object,
	   * or store separately (specify false). In both cases the option values can be accessed using .opts().
	   *
	   * @param {boolean} [storeAsProperties=true]
	   * @return {Command} `this` command for chaining
	   */

	  storeOptionsAsProperties(storeAsProperties = true) {
	    if (this.options.length) {
	      throw new Error('call .storeOptionsAsProperties() before adding options');
	    }
	    if (Object.keys(this._optionValues).length) {
	      throw new Error(
	        'call .storeOptionsAsProperties() before setting option values',
	      );
	    }
	    this._storeOptionsAsProperties = !!storeAsProperties;
	    return this;
	  }

	  /**
	   * Retrieve option value.
	   *
	   * @param {string} key
	   * @return {object} value
	   */

	  getOptionValue(key) {
	    if (this._storeOptionsAsProperties) {
	      return this[key];
	    }
	    return this._optionValues[key];
	  }

	  /**
	   * Store option value.
	   *
	   * @param {string} key
	   * @param {object} value
	   * @return {Command} `this` command for chaining
	   */

	  setOptionValue(key, value) {
	    return this.setOptionValueWithSource(key, value, undefined);
	  }

	  /**
	   * Store option value and where the value came from.
	   *
	   * @param {string} key
	   * @param {object} value
	   * @param {string} source - expected values are default/config/env/cli/implied
	   * @return {Command} `this` command for chaining
	   */

	  setOptionValueWithSource(key, value, source) {
	    if (this._storeOptionsAsProperties) {
	      this[key] = value;
	    } else {
	      this._optionValues[key] = value;
	    }
	    this._optionValueSources[key] = source;
	    return this;
	  }

	  /**
	   * Get source of option value.
	   * Expected values are default | config | env | cli | implied
	   *
	   * @param {string} key
	   * @return {string}
	   */

	  getOptionValueSource(key) {
	    return this._optionValueSources[key];
	  }

	  /**
	   * Get source of option value. See also .optsWithGlobals().
	   * Expected values are default | config | env | cli | implied
	   *
	   * @param {string} key
	   * @return {string}
	   */

	  getOptionValueSourceWithGlobals(key) {
	    // global overwrites local, like optsWithGlobals
	    let source;
	    this._getCommandAndAncestors().forEach((cmd) => {
	      if (cmd.getOptionValueSource(key) !== undefined) {
	        source = cmd.getOptionValueSource(key);
	      }
	    });
	    return source;
	  }

	  /**
	   * Get user arguments from implied or explicit arguments.
	   * Side-effects: set _scriptPath if args included script. Used for default program name, and subcommand searches.
	   *
	   * @private
	   */

	  _prepareUserArgs(argv, parseOptions) {
	    if (argv !== undefined && !Array.isArray(argv)) {
	      throw new Error('first parameter to parse must be array or undefined');
	    }
	    parseOptions = parseOptions || {};

	    // auto-detect argument conventions if nothing supplied
	    if (argv === undefined && parseOptions.from === undefined) {
	      if (process.versions?.electron) {
	        parseOptions.from = 'electron';
	      }
	      // check node specific options for scenarios where user CLI args follow executable without scriptname
	      const execArgv = process.execArgv ?? [];
	      if (
	        execArgv.includes('-e') ||
	        execArgv.includes('--eval') ||
	        execArgv.includes('-p') ||
	        execArgv.includes('--print')
	      ) {
	        parseOptions.from = 'eval'; // internal usage, not documented
	      }
	    }

	    // default to using process.argv
	    if (argv === undefined) {
	      argv = process.argv;
	    }
	    this.rawArgs = argv.slice();

	    // extract the user args and scriptPath
	    let userArgs;
	    switch (parseOptions.from) {
	      case undefined:
	      case 'node':
	        this._scriptPath = argv[1];
	        userArgs = argv.slice(2);
	        break;
	      case 'electron':
	        // @ts-ignore: because defaultApp is an unknown property
	        if (process.defaultApp) {
	          this._scriptPath = argv[1];
	          userArgs = argv.slice(2);
	        } else {
	          userArgs = argv.slice(1);
	        }
	        break;
	      case 'user':
	        userArgs = argv.slice(0);
	        break;
	      case 'eval':
	        userArgs = argv.slice(1);
	        break;
	      default:
	        throw new Error(
	          `unexpected parse option { from: '${parseOptions.from}' }`,
	        );
	    }

	    // Find default name for program from arguments.
	    if (!this._name && this._scriptPath)
	      this.nameFromFilename(this._scriptPath);
	    this._name = this._name || 'program';

	    return userArgs;
	  }

	  /**
	   * Parse `argv`, setting options and invoking commands when defined.
	   *
	   * Use parseAsync instead of parse if any of your action handlers are async.
	   *
	   * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
	   *
	   * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
	   * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
	   * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
	   * - `'user'`: just user arguments
	   *
	   * @example
	   * program.parse(); // parse process.argv and auto-detect electron and special node flags
	   * program.parse(process.argv); // assume argv[0] is app and argv[1] is script
	   * program.parse(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
	   *
	   * @param {string[]} [argv] - optional, defaults to process.argv
	   * @param {object} [parseOptions] - optionally specify style of options with from: node/user/electron
	   * @param {string} [parseOptions.from] - where the args are from: 'node', 'user', 'electron'
	   * @return {Command} `this` command for chaining
	   */

	  parse(argv, parseOptions) {
	    this._prepareForParse();
	    const userArgs = this._prepareUserArgs(argv, parseOptions);
	    this._parseCommand([], userArgs);

	    return this;
	  }

	  /**
	   * Parse `argv`, setting options and invoking commands when defined.
	   *
	   * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
	   *
	   * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
	   * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
	   * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
	   * - `'user'`: just user arguments
	   *
	   * @example
	   * await program.parseAsync(); // parse process.argv and auto-detect electron and special node flags
	   * await program.parseAsync(process.argv); // assume argv[0] is app and argv[1] is script
	   * await program.parseAsync(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
	   *
	   * @param {string[]} [argv]
	   * @param {object} [parseOptions]
	   * @param {string} parseOptions.from - where the args are from: 'node', 'user', 'electron'
	   * @return {Promise}
	   */

	  async parseAsync(argv, parseOptions) {
	    this._prepareForParse();
	    const userArgs = this._prepareUserArgs(argv, parseOptions);
	    await this._parseCommand([], userArgs);

	    return this;
	  }

	  _prepareForParse() {
	    if (this._savedState === null) {
	      this.saveStateBeforeParse();
	    } else {
	      this.restoreStateBeforeParse();
	    }
	  }

	  /**
	   * Called the first time parse is called to save state and allow a restore before subsequent calls to parse.
	   * Not usually called directly, but available for subclasses to save their custom state.
	   *
	   * This is called in a lazy way. Only commands used in parsing chain will have state saved.
	   */
	  saveStateBeforeParse() {
	    this._savedState = {
	      // name is stable if supplied by author, but may be unspecified for root command and deduced during parsing
	      _name: this._name,
	      // option values before parse have default values (including false for negated options)
	      // shallow clones
	      _optionValues: { ...this._optionValues },
	      _optionValueSources: { ...this._optionValueSources },
	    };
	  }

	  /**
	   * Restore state before parse for calls after the first.
	   * Not usually called directly, but available for subclasses to save their custom state.
	   *
	   * This is called in a lazy way. Only commands used in parsing chain will have state restored.
	   */
	  restoreStateBeforeParse() {
	    if (this._storeOptionsAsProperties)
	      throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);

	    // clear state from _prepareUserArgs
	    this._name = this._savedState._name;
	    this._scriptPath = null;
	    this.rawArgs = [];
	    // clear state from setOptionValueWithSource
	    this._optionValues = { ...this._savedState._optionValues };
	    this._optionValueSources = { ...this._savedState._optionValueSources };
	    // clear state from _parseCommand
	    this.args = [];
	    // clear state from _processArguments
	    this.processedArgs = [];
	  }

	  /**
	   * Throw if expected executable is missing. Add lots of help for author.
	   *
	   * @param {string} executableFile
	   * @param {string} executableDir
	   * @param {string} subcommandName
	   */
	  _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
	    if (fs.existsSync(executableFile)) return;

	    const executableDirMessage = executableDir
	      ? `searched for local subcommand relative to directory '${executableDir}'`
	      : 'no directory for search for local subcommand, use .executableDir() to supply a custom directory';
	    const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
	    throw new Error(executableMissing);
	  }

	  /**
	   * Execute a sub-command executable.
	   *
	   * @private
	   */

	  _executeSubCommand(subcommand, args) {
	    args = args.slice();
	    let launchWithNode = false; // Use node for source targets so do not need to get permissions correct, and on Windows.
	    const sourceExt = ['.js', '.ts', '.tsx', '.mjs', '.cjs'];

	    function findFile(baseDir, baseName) {
	      // Look for specified file
	      const localBin = path.resolve(baseDir, baseName);
	      if (fs.existsSync(localBin)) return localBin;

	      // Stop looking if candidate already has an expected extension.
	      if (sourceExt.includes(path.extname(baseName))) return undefined;

	      // Try all the extensions.
	      const foundExt = sourceExt.find((ext) =>
	        fs.existsSync(`${localBin}${ext}`),
	      );
	      if (foundExt) return `${localBin}${foundExt}`;

	      return undefined;
	    }

	    // Not checking for help first. Unlikely to have mandatory and executable, and can't robustly test for help flags in external command.
	    this._checkForMissingMandatoryOptions();
	    this._checkForConflictingOptions();

	    // executableFile and executableDir might be full path, or just a name
	    let executableFile =
	      subcommand._executableFile || `${this._name}-${subcommand._name}`;
	    let executableDir = this._executableDir || '';
	    if (this._scriptPath) {
	      let resolvedScriptPath; // resolve possible symlink for installed npm binary
	      try {
	        resolvedScriptPath = fs.realpathSync(this._scriptPath);
	      } catch {
	        resolvedScriptPath = this._scriptPath;
	      }
	      executableDir = path.resolve(
	        path.dirname(resolvedScriptPath),
	        executableDir,
	      );
	    }

	    // Look for a local file in preference to a command in PATH.
	    if (executableDir) {
	      let localFile = findFile(executableDir, executableFile);

	      // Legacy search using prefix of script name instead of command name
	      if (!localFile && !subcommand._executableFile && this._scriptPath) {
	        const legacyName = path.basename(
	          this._scriptPath,
	          path.extname(this._scriptPath),
	        );
	        if (legacyName !== this._name) {
	          localFile = findFile(
	            executableDir,
	            `${legacyName}-${subcommand._name}`,
	          );
	        }
	      }
	      executableFile = localFile || executableFile;
	    }

	    launchWithNode = sourceExt.includes(path.extname(executableFile));

	    let proc;
	    if (process.platform !== 'win32') {
	      if (launchWithNode) {
	        args.unshift(executableFile);
	        // add executable arguments to spawn
	        args = incrementNodeInspectorPort(process.execArgv).concat(args);

	        proc = childProcess.spawn(process.argv[0], args, { stdio: 'inherit' });
	      } else {
	        proc = childProcess.spawn(executableFile, args, { stdio: 'inherit' });
	      }
	    } else {
	      this._checkForMissingExecutable(
	        executableFile,
	        executableDir,
	        subcommand._name,
	      );
	      args.unshift(executableFile);
	      // add executable arguments to spawn
	      args = incrementNodeInspectorPort(process.execArgv).concat(args);
	      proc = childProcess.spawn(process.execPath, args, { stdio: 'inherit' });
	    }

	    if (!proc.killed) {
	      // testing mainly to avoid leak warnings during unit tests with mocked spawn
	      const signals = ['SIGUSR1', 'SIGUSR2', 'SIGTERM', 'SIGINT', 'SIGHUP'];
	      signals.forEach((signal) => {
	        process.on(signal, () => {
	          if (proc.killed === false && proc.exitCode === null) {
	            // @ts-ignore because signals not typed to known strings
	            proc.kill(signal);
	          }
	        });
	      });
	    }

	    // By default terminate process when spawned process terminates.
	    const exitCallback = this._exitCallback;
	    proc.on('close', (code) => {
	      code = code ?? 1; // code is null if spawned process terminated due to a signal
	      if (!exitCallback) {
	        process.exit(code);
	      } else {
	        exitCallback(
	          new CommanderError(
	            code,
	            'commander.executeSubCommandAsync',
	            '(close)',
	          ),
	        );
	      }
	    });
	    proc.on('error', (err) => {
	      // @ts-ignore: because err.code is an unknown property
	      if (err.code === 'ENOENT') {
	        this._checkForMissingExecutable(
	          executableFile,
	          executableDir,
	          subcommand._name,
	        );
	        // @ts-ignore: because err.code is an unknown property
	      } else if (err.code === 'EACCES') {
	        throw new Error(`'${executableFile}' not executable`);
	      }
	      if (!exitCallback) {
	        process.exit(1);
	      } else {
	        const wrappedError = new CommanderError(
	          1,
	          'commander.executeSubCommandAsync',
	          '(error)',
	        );
	        wrappedError.nestedError = err;
	        exitCallback(wrappedError);
	      }
	    });

	    // Store the reference to the child process
	    this.runningCommand = proc;
	  }

	  /**
	   * @private
	   */

	  _dispatchSubcommand(commandName, operands, unknown) {
	    const subCommand = this._findCommand(commandName);
	    if (!subCommand) this.help({ error: true });

	    subCommand._prepareForParse();
	    let promiseChain;
	    promiseChain = this._chainOrCallSubCommandHook(
	      promiseChain,
	      subCommand,
	      'preSubcommand',
	    );
	    promiseChain = this._chainOrCall(promiseChain, () => {
	      if (subCommand._executableHandler) {
	        this._executeSubCommand(subCommand, operands.concat(unknown));
	      } else {
	        return subCommand._parseCommand(operands, unknown);
	      }
	    });
	    return promiseChain;
	  }

	  /**
	   * Invoke help directly if possible, or dispatch if necessary.
	   * e.g. help foo
	   *
	   * @private
	   */

	  _dispatchHelpCommand(subcommandName) {
	    if (!subcommandName) {
	      this.help();
	    }
	    const subCommand = this._findCommand(subcommandName);
	    if (subCommand && !subCommand._executableHandler) {
	      subCommand.help();
	    }

	    // Fallback to parsing the help flag to invoke the help.
	    return this._dispatchSubcommand(
	      subcommandName,
	      [],
	      [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? '--help'],
	    );
	  }

	  /**
	   * Check this.args against expected this.registeredArguments.
	   *
	   * @private
	   */

	  _checkNumberOfArguments() {
	    // too few
	    this.registeredArguments.forEach((arg, i) => {
	      if (arg.required && this.args[i] == null) {
	        this.missingArgument(arg.name());
	      }
	    });
	    // too many
	    if (
	      this.registeredArguments.length > 0 &&
	      this.registeredArguments[this.registeredArguments.length - 1].variadic
	    ) {
	      return;
	    }
	    if (this.args.length > this.registeredArguments.length) {
	      this._excessArguments(this.args);
	    }
	  }

	  /**
	   * Process this.args using this.registeredArguments and save as this.processedArgs!
	   *
	   * @private
	   */

	  _processArguments() {
	    const myParseArg = (argument, value, previous) => {
	      // Extra processing for nice error message on parsing failure.
	      let parsedValue = value;
	      if (value !== null && argument.parseArg) {
	        const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
	        parsedValue = this._callParseArg(
	          argument,
	          value,
	          previous,
	          invalidValueMessage,
	        );
	      }
	      return parsedValue;
	    };

	    this._checkNumberOfArguments();

	    const processedArgs = [];
	    this.registeredArguments.forEach((declaredArg, index) => {
	      let value = declaredArg.defaultValue;
	      if (declaredArg.variadic) {
	        // Collect together remaining arguments for passing together as an array.
	        if (index < this.args.length) {
	          value = this.args.slice(index);
	          if (declaredArg.parseArg) {
	            value = value.reduce((processed, v) => {
	              return myParseArg(declaredArg, v, processed);
	            }, declaredArg.defaultValue);
	          }
	        } else if (value === undefined) {
	          value = [];
	        }
	      } else if (index < this.args.length) {
	        value = this.args[index];
	        if (declaredArg.parseArg) {
	          value = myParseArg(declaredArg, value, declaredArg.defaultValue);
	        }
	      }
	      processedArgs[index] = value;
	    });
	    this.processedArgs = processedArgs;
	  }

	  /**
	   * Once we have a promise we chain, but call synchronously until then.
	   *
	   * @param {(Promise|undefined)} promise
	   * @param {Function} fn
	   * @return {(Promise|undefined)}
	   * @private
	   */

	  _chainOrCall(promise, fn) {
	    // thenable
	    if (promise?.then && typeof promise.then === 'function') {
	      // already have a promise, chain callback
	      return promise.then(() => fn());
	    }
	    // callback might return a promise
	    return fn();
	  }

	  /**
	   *
	   * @param {(Promise|undefined)} promise
	   * @param {string} event
	   * @return {(Promise|undefined)}
	   * @private
	   */

	  _chainOrCallHooks(promise, event) {
	    let result = promise;
	    const hooks = [];
	    this._getCommandAndAncestors()
	      .reverse()
	      .filter((cmd) => cmd._lifeCycleHooks[event] !== undefined)
	      .forEach((hookedCommand) => {
	        hookedCommand._lifeCycleHooks[event].forEach((callback) => {
	          hooks.push({ hookedCommand, callback });
	        });
	      });
	    if (event === 'postAction') {
	      hooks.reverse();
	    }

	    hooks.forEach((hookDetail) => {
	      result = this._chainOrCall(result, () => {
	        return hookDetail.callback(hookDetail.hookedCommand, this);
	      });
	    });
	    return result;
	  }

	  /**
	   *
	   * @param {(Promise|undefined)} promise
	   * @param {Command} subCommand
	   * @param {string} event
	   * @return {(Promise|undefined)}
	   * @private
	   */

	  _chainOrCallSubCommandHook(promise, subCommand, event) {
	    let result = promise;
	    if (this._lifeCycleHooks[event] !== undefined) {
	      this._lifeCycleHooks[event].forEach((hook) => {
	        result = this._chainOrCall(result, () => {
	          return hook(this, subCommand);
	        });
	      });
	    }
	    return result;
	  }

	  /**
	   * Process arguments in context of this command.
	   * Returns action result, in case it is a promise.
	   *
	   * @private
	   */

	  _parseCommand(operands, unknown) {
	    const parsed = this.parseOptions(unknown);
	    this._parseOptionsEnv(); // after cli, so parseArg not called on both cli and env
	    this._parseOptionsImplied();
	    operands = operands.concat(parsed.operands);
	    unknown = parsed.unknown;
	    this.args = operands.concat(unknown);

	    if (operands && this._findCommand(operands[0])) {
	      return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
	    }
	    if (
	      this._getHelpCommand() &&
	      operands[0] === this._getHelpCommand().name()
	    ) {
	      return this._dispatchHelpCommand(operands[1]);
	    }
	    if (this._defaultCommandName) {
	      this._outputHelpIfRequested(unknown); // Run the help for default command from parent rather than passing to default command
	      return this._dispatchSubcommand(
	        this._defaultCommandName,
	        operands,
	        unknown,
	      );
	    }
	    if (
	      this.commands.length &&
	      this.args.length === 0 &&
	      !this._actionHandler &&
	      !this._defaultCommandName
	    ) {
	      // probably missing subcommand and no handler, user needs help (and exit)
	      this.help({ error: true });
	    }

	    this._outputHelpIfRequested(parsed.unknown);
	    this._checkForMissingMandatoryOptions();
	    this._checkForConflictingOptions();

	    // We do not always call this check to avoid masking a "better" error, like unknown command.
	    const checkForUnknownOptions = () => {
	      if (parsed.unknown.length > 0) {
	        this.unknownOption(parsed.unknown[0]);
	      }
	    };

	    const commandEvent = `command:${this.name()}`;
	    if (this._actionHandler) {
	      checkForUnknownOptions();
	      this._processArguments();

	      let promiseChain;
	      promiseChain = this._chainOrCallHooks(promiseChain, 'preAction');
	      promiseChain = this._chainOrCall(promiseChain, () =>
	        this._actionHandler(this.processedArgs),
	      );
	      if (this.parent) {
	        promiseChain = this._chainOrCall(promiseChain, () => {
	          this.parent.emit(commandEvent, operands, unknown); // legacy
	        });
	      }
	      promiseChain = this._chainOrCallHooks(promiseChain, 'postAction');
	      return promiseChain;
	    }
	    if (this.parent?.listenerCount(commandEvent)) {
	      checkForUnknownOptions();
	      this._processArguments();
	      this.parent.emit(commandEvent, operands, unknown); // legacy
	    } else if (operands.length) {
	      if (this._findCommand('*')) {
	        // legacy default command
	        return this._dispatchSubcommand('*', operands, unknown);
	      }
	      if (this.listenerCount('command:*')) {
	        // skip option check, emit event for possible misspelling suggestion
	        this.emit('command:*', operands, unknown);
	      } else if (this.commands.length) {
	        this.unknownCommand();
	      } else {
	        checkForUnknownOptions();
	        this._processArguments();
	      }
	    } else if (this.commands.length) {
	      checkForUnknownOptions();
	      // This command has subcommands and nothing hooked up at this level, so display help (and exit).
	      this.help({ error: true });
	    } else {
	      checkForUnknownOptions();
	      this._processArguments();
	      // fall through for caller to handle after calling .parse()
	    }
	  }

	  /**
	   * Find matching command.
	   *
	   * @private
	   * @return {Command | undefined}
	   */
	  _findCommand(name) {
	    if (!name) return undefined;
	    return this.commands.find(
	      (cmd) => cmd._name === name || cmd._aliases.includes(name),
	    );
	  }

	  /**
	   * Return an option matching `arg` if any.
	   *
	   * @param {string} arg
	   * @return {Option}
	   * @package
	   */

	  _findOption(arg) {
	    return this.options.find((option) => option.is(arg));
	  }

	  /**
	   * Display an error message if a mandatory option does not have a value.
	   * Called after checking for help flags in leaf subcommand.
	   *
	   * @private
	   */

	  _checkForMissingMandatoryOptions() {
	    // Walk up hierarchy so can call in subcommand after checking for displaying help.
	    this._getCommandAndAncestors().forEach((cmd) => {
	      cmd.options.forEach((anOption) => {
	        if (
	          anOption.mandatory &&
	          cmd.getOptionValue(anOption.attributeName()) === undefined
	        ) {
	          cmd.missingMandatoryOptionValue(anOption);
	        }
	      });
	    });
	  }

	  /**
	   * Display an error message if conflicting options are used together in this.
	   *
	   * @private
	   */
	  _checkForConflictingLocalOptions() {
	    const definedNonDefaultOptions = this.options.filter((option) => {
	      const optionKey = option.attributeName();
	      if (this.getOptionValue(optionKey) === undefined) {
	        return false;
	      }
	      return this.getOptionValueSource(optionKey) !== 'default';
	    });

	    const optionsWithConflicting = definedNonDefaultOptions.filter(
	      (option) => option.conflictsWith.length > 0,
	    );

	    optionsWithConflicting.forEach((option) => {
	      const conflictingAndDefined = definedNonDefaultOptions.find((defined) =>
	        option.conflictsWith.includes(defined.attributeName()),
	      );
	      if (conflictingAndDefined) {
	        this._conflictingOption(option, conflictingAndDefined);
	      }
	    });
	  }

	  /**
	   * Display an error message if conflicting options are used together.
	   * Called after checking for help flags in leaf subcommand.
	   *
	   * @private
	   */
	  _checkForConflictingOptions() {
	    // Walk up hierarchy so can call in subcommand after checking for displaying help.
	    this._getCommandAndAncestors().forEach((cmd) => {
	      cmd._checkForConflictingLocalOptions();
	    });
	  }

	  /**
	   * Parse options from `argv` removing known options,
	   * and return argv split into operands and unknown arguments.
	   *
	   * Side effects: modifies command by storing options. Does not reset state if called again.
	   *
	   * Examples:
	   *
	   *     argv => operands, unknown
	   *     --known kkk op => [op], []
	   *     op --known kkk => [op], []
	   *     sub --unknown uuu op => [sub], [--unknown uuu op]
	   *     sub -- --unknown uuu op => [sub --unknown uuu op], []
	   *
	   * @param {string[]} args
	   * @return {{operands: string[], unknown: string[]}}
	   */

	  parseOptions(args) {
	    const operands = []; // operands, not options or values
	    const unknown = []; // first unknown option and remaining unknown args
	    let dest = operands;

	    function maybeOption(arg) {
	      return arg.length > 1 && arg[0] === '-';
	    }

	    const negativeNumberArg = (arg) => {
	      // return false if not a negative number
	      if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg)) return false;
	      // negative number is ok unless digit used as an option in command hierarchy
	      return !this._getCommandAndAncestors().some((cmd) =>
	        cmd.options
	          .map((opt) => opt.short)
	          .some((short) => /^-\d$/.test(short)),
	      );
	    };

	    // parse options
	    let activeVariadicOption = null;
	    let activeGroup = null; // working through group of short options, like -abc
	    let i = 0;
	    while (i < args.length || activeGroup) {
	      const arg = activeGroup ?? args[i++];
	      activeGroup = null;

	      // literal
	      if (arg === '--') {
	        if (dest === unknown) dest.push(arg);
	        dest.push(...args.slice(i));
	        break;
	      }

	      if (
	        activeVariadicOption &&
	        (!maybeOption(arg) || negativeNumberArg(arg))
	      ) {
	        this.emit(`option:${activeVariadicOption.name()}`, arg);
	        continue;
	      }
	      activeVariadicOption = null;

	      if (maybeOption(arg)) {
	        const option = this._findOption(arg);
	        // recognised option, call listener to assign value with possible custom processing
	        if (option) {
	          if (option.required) {
	            const value = args[i++];
	            if (value === undefined) this.optionMissingArgument(option);
	            this.emit(`option:${option.name()}`, value);
	          } else if (option.optional) {
	            let value = null;
	            // historical behaviour is optional value is following arg unless an option
	            if (
	              i < args.length &&
	              (!maybeOption(args[i]) || negativeNumberArg(args[i]))
	            ) {
	              value = args[i++];
	            }
	            this.emit(`option:${option.name()}`, value);
	          } else {
	            // boolean flag
	            this.emit(`option:${option.name()}`);
	          }
	          activeVariadicOption = option.variadic ? option : null;
	          continue;
	        }
	      }

	      // Look for combo options following single dash, eat first one if known.
	      if (arg.length > 2 && arg[0] === '-' && arg[1] !== '-') {
	        const option = this._findOption(`-${arg[1]}`);
	        if (option) {
	          if (
	            option.required ||
	            (option.optional && this._combineFlagAndOptionalValue)
	          ) {
	            // option with value following in same argument
	            this.emit(`option:${option.name()}`, arg.slice(2));
	          } else {
	            // boolean option
	            this.emit(`option:${option.name()}`);
	            // remove the processed option and keep processing group
	            activeGroup = `-${arg.slice(2)}`;
	          }
	          continue;
	        }
	      }

	      // Look for known long flag with value, like --foo=bar
	      if (/^--[^=]+=/.test(arg)) {
	        const index = arg.indexOf('=');
	        const option = this._findOption(arg.slice(0, index));
	        if (option && (option.required || option.optional)) {
	          this.emit(`option:${option.name()}`, arg.slice(index + 1));
	          continue;
	        }
	      }

	      // Not a recognised option by this command.
	      // Might be a command-argument, or subcommand option, or unknown option, or help command or option.

	      // An unknown option means further arguments also classified as unknown so can be reprocessed by subcommands.
	      // A negative number in a leaf command is not an unknown option.
	      if (
	        dest === operands &&
	        maybeOption(arg) &&
	        !(this.commands.length === 0 && negativeNumberArg(arg))
	      ) {
	        dest = unknown;
	      }

	      // If using positionalOptions, stop processing our options at subcommand.
	      if (
	        (this._enablePositionalOptions || this._passThroughOptions) &&
	        operands.length === 0 &&
	        unknown.length === 0
	      ) {
	        if (this._findCommand(arg)) {
	          operands.push(arg);
	          unknown.push(...args.slice(i));
	          break;
	        } else if (
	          this._getHelpCommand() &&
	          arg === this._getHelpCommand().name()
	        ) {
	          operands.push(arg, ...args.slice(i));
	          break;
	        } else if (this._defaultCommandName) {
	          unknown.push(arg, ...args.slice(i));
	          break;
	        }
	      }

	      // If using passThroughOptions, stop processing options at first command-argument.
	      if (this._passThroughOptions) {
	        dest.push(arg, ...args.slice(i));
	        break;
	      }

	      // add arg
	      dest.push(arg);
	    }

	    return { operands, unknown };
	  }

	  /**
	   * Return an object containing local option values as key-value pairs.
	   *
	   * @return {object}
	   */
	  opts() {
	    if (this._storeOptionsAsProperties) {
	      // Preserve original behaviour so backwards compatible when still using properties
	      const result = {};
	      const len = this.options.length;

	      for (let i = 0; i < len; i++) {
	        const key = this.options[i].attributeName();
	        result[key] =
	          key === this._versionOptionName ? this._version : this[key];
	      }
	      return result;
	    }

	    return this._optionValues;
	  }

	  /**
	   * Return an object containing merged local and global option values as key-value pairs.
	   *
	   * @return {object}
	   */
	  optsWithGlobals() {
	    // globals overwrite locals
	    return this._getCommandAndAncestors().reduce(
	      (combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()),
	      {},
	    );
	  }

	  /**
	   * Display error message and exit (or call exitOverride).
	   *
	   * @param {string} message
	   * @param {object} [errorOptions]
	   * @param {string} [errorOptions.code] - an id string representing the error
	   * @param {number} [errorOptions.exitCode] - used with process.exit
	   */
	  error(message, errorOptions) {
	    // output handling
	    this._outputConfiguration.outputError(
	      `${message}\n`,
	      this._outputConfiguration.writeErr,
	    );
	    if (typeof this._showHelpAfterError === 'string') {
	      this._outputConfiguration.writeErr(`${this._showHelpAfterError}\n`);
	    } else if (this._showHelpAfterError) {
	      this._outputConfiguration.writeErr('\n');
	      this.outputHelp({ error: true });
	    }

	    // exit handling
	    const config = errorOptions || {};
	    const exitCode = config.exitCode || 1;
	    const code = config.code || 'commander.error';
	    this._exit(exitCode, code, message);
	  }

	  /**
	   * Apply any option related environment variables, if option does
	   * not have a value from cli or client code.
	   *
	   * @private
	   */
	  _parseOptionsEnv() {
	    this.options.forEach((option) => {
	      if (option.envVar && option.envVar in process.env) {
	        const optionKey = option.attributeName();
	        // Priority check. Do not overwrite cli or options from unknown source (client-code).
	        if (
	          this.getOptionValue(optionKey) === undefined ||
	          ['default', 'config', 'env'].includes(
	            this.getOptionValueSource(optionKey),
	          )
	        ) {
	          if (option.required || option.optional) {
	            // option can take a value
	            // keep very simple, optional always takes value
	            this.emit(`optionEnv:${option.name()}`, process.env[option.envVar]);
	          } else {
	            // boolean
	            // keep very simple, only care that envVar defined and not the value
	            this.emit(`optionEnv:${option.name()}`);
	          }
	        }
	      }
	    });
	  }

	  /**
	   * Apply any implied option values, if option is undefined or default value.
	   *
	   * @private
	   */
	  _parseOptionsImplied() {
	    const dualHelper = new DualOptions(this.options);
	    const hasCustomOptionValue = (optionKey) => {
	      return (
	        this.getOptionValue(optionKey) !== undefined &&
	        !['default', 'implied'].includes(this.getOptionValueSource(optionKey))
	      );
	    };
	    this.options
	      .filter(
	        (option) =>
	          option.implied !== undefined &&
	          hasCustomOptionValue(option.attributeName()) &&
	          dualHelper.valueFromOption(
	            this.getOptionValue(option.attributeName()),
	            option,
	          ),
	      )
	      .forEach((option) => {
	        Object.keys(option.implied)
	          .filter((impliedKey) => !hasCustomOptionValue(impliedKey))
	          .forEach((impliedKey) => {
	            this.setOptionValueWithSource(
	              impliedKey,
	              option.implied[impliedKey],
	              'implied',
	            );
	          });
	      });
	  }

	  /**
	   * Argument `name` is missing.
	   *
	   * @param {string} name
	   * @private
	   */

	  missingArgument(name) {
	    const message = `error: missing required argument '${name}'`;
	    this.error(message, { code: 'commander.missingArgument' });
	  }

	  /**
	   * `Option` is missing an argument.
	   *
	   * @param {Option} option
	   * @private
	   */

	  optionMissingArgument(option) {
	    const message = `error: option '${option.flags}' argument missing`;
	    this.error(message, { code: 'commander.optionMissingArgument' });
	  }

	  /**
	   * `Option` does not have a value, and is a mandatory option.
	   *
	   * @param {Option} option
	   * @private
	   */

	  missingMandatoryOptionValue(option) {
	    const message = `error: required option '${option.flags}' not specified`;
	    this.error(message, { code: 'commander.missingMandatoryOptionValue' });
	  }

	  /**
	   * `Option` conflicts with another option.
	   *
	   * @param {Option} option
	   * @param {Option} conflictingOption
	   * @private
	   */
	  _conflictingOption(option, conflictingOption) {
	    // The calling code does not know whether a negated option is the source of the
	    // value, so do some work to take an educated guess.
	    const findBestOptionFromValue = (option) => {
	      const optionKey = option.attributeName();
	      const optionValue = this.getOptionValue(optionKey);
	      const negativeOption = this.options.find(
	        (target) => target.negate && optionKey === target.attributeName(),
	      );
	      const positiveOption = this.options.find(
	        (target) => !target.negate && optionKey === target.attributeName(),
	      );
	      if (
	        negativeOption &&
	        ((negativeOption.presetArg === undefined && optionValue === false) ||
	          (negativeOption.presetArg !== undefined &&
	            optionValue === negativeOption.presetArg))
	      ) {
	        return negativeOption;
	      }
	      return positiveOption || option;
	    };

	    const getErrorMessage = (option) => {
	      const bestOption = findBestOptionFromValue(option);
	      const optionKey = bestOption.attributeName();
	      const source = this.getOptionValueSource(optionKey);
	      if (source === 'env') {
	        return `environment variable '${bestOption.envVar}'`;
	      }
	      return `option '${bestOption.flags}'`;
	    };

	    const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
	    this.error(message, { code: 'commander.conflictingOption' });
	  }

	  /**
	   * Unknown option `flag`.
	   *
	   * @param {string} flag
	   * @private
	   */

	  unknownOption(flag) {
	    if (this._allowUnknownOption) return;
	    let suggestion = '';

	    if (flag.startsWith('--') && this._showSuggestionAfterError) {
	      // Looping to pick up the global options too
	      let candidateFlags = [];
	      // eslint-disable-next-line @typescript-eslint/no-this-alias
	      let command = this;
	      do {
	        const moreFlags = command
	          .createHelp()
	          .visibleOptions(command)
	          .filter((option) => option.long)
	          .map((option) => option.long);
	        candidateFlags = candidateFlags.concat(moreFlags);
	        command = command.parent;
	      } while (command && !command._enablePositionalOptions);
	      suggestion = suggestSimilar(flag, candidateFlags);
	    }

	    const message = `error: unknown option '${flag}'${suggestion}`;
	    this.error(message, { code: 'commander.unknownOption' });
	  }

	  /**
	   * Excess arguments, more than expected.
	   *
	   * @param {string[]} receivedArgs
	   * @private
	   */

	  _excessArguments(receivedArgs) {
	    if (this._allowExcessArguments) return;

	    const expected = this.registeredArguments.length;
	    const s = expected === 1 ? '' : 's';
	    const forSubcommand = this.parent ? ` for '${this.name()}'` : '';
	    const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
	    this.error(message, { code: 'commander.excessArguments' });
	  }

	  /**
	   * Unknown command.
	   *
	   * @private
	   */

	  unknownCommand() {
	    const unknownName = this.args[0];
	    let suggestion = '';

	    if (this._showSuggestionAfterError) {
	      const candidateNames = [];
	      this.createHelp()
	        .visibleCommands(this)
	        .forEach((command) => {
	          candidateNames.push(command.name());
	          // just visible alias
	          if (command.alias()) candidateNames.push(command.alias());
	        });
	      suggestion = suggestSimilar(unknownName, candidateNames);
	    }

	    const message = `error: unknown command '${unknownName}'${suggestion}`;
	    this.error(message, { code: 'commander.unknownCommand' });
	  }

	  /**
	   * Get or set the program version.
	   *
	   * This method auto-registers the "-V, --version" option which will print the version number.
	   *
	   * You can optionally supply the flags and description to override the defaults.
	   *
	   * @param {string} [str]
	   * @param {string} [flags]
	   * @param {string} [description]
	   * @return {(this | string | undefined)} `this` command for chaining, or version string if no arguments
	   */

	  version(str, flags, description) {
	    if (str === undefined) return this._version;
	    this._version = str;
	    flags = flags || '-V, --version';
	    description = description || 'output the version number';
	    const versionOption = this.createOption(flags, description);
	    this._versionOptionName = versionOption.attributeName();
	    this._registerOption(versionOption);

	    this.on('option:' + versionOption.name(), () => {
	      this._outputConfiguration.writeOut(`${str}\n`);
	      this._exit(0, 'commander.version', str);
	    });
	    return this;
	  }

	  /**
	   * Set the description.
	   *
	   * @param {string} [str]
	   * @param {object} [argsDescription]
	   * @return {(string|Command)}
	   */
	  description(str, argsDescription) {
	    if (str === undefined && argsDescription === undefined)
	      return this._description;
	    this._description = str;
	    if (argsDescription) {
	      this._argsDescription = argsDescription;
	    }
	    return this;
	  }

	  /**
	   * Set the summary. Used when listed as subcommand of parent.
	   *
	   * @param {string} [str]
	   * @return {(string|Command)}
	   */
	  summary(str) {
	    if (str === undefined) return this._summary;
	    this._summary = str;
	    return this;
	  }

	  /**
	   * Set an alias for the command.
	   *
	   * You may call more than once to add multiple aliases. Only the first alias is shown in the auto-generated help.
	   *
	   * @param {string} [alias]
	   * @return {(string|Command)}
	   */

	  alias(alias) {
	    if (alias === undefined) return this._aliases[0]; // just return first, for backwards compatibility

	    /** @type {Command} */
	    // eslint-disable-next-line @typescript-eslint/no-this-alias
	    let command = this;
	    if (
	      this.commands.length !== 0 &&
	      this.commands[this.commands.length - 1]._executableHandler
	    ) {
	      // assume adding alias for last added executable subcommand, rather than this
	      command = this.commands[this.commands.length - 1];
	    }

	    if (alias === command._name)
	      throw new Error("Command alias can't be the same as its name");
	    const matchingCommand = this.parent?._findCommand(alias);
	    if (matchingCommand) {
	      // c.f. _registerCommand
	      const existingCmd = [matchingCommand.name()]
	        .concat(matchingCommand.aliases())
	        .join('|');
	      throw new Error(
	        `cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`,
	      );
	    }

	    command._aliases.push(alias);
	    return this;
	  }

	  /**
	   * Set aliases for the command.
	   *
	   * Only the first alias is shown in the auto-generated help.
	   *
	   * @param {string[]} [aliases]
	   * @return {(string[]|Command)}
	   */

	  aliases(aliases) {
	    // Getter for the array of aliases is the main reason for having aliases() in addition to alias().
	    if (aliases === undefined) return this._aliases;

	    aliases.forEach((alias) => this.alias(alias));
	    return this;
	  }

	  /**
	   * Set / get the command usage `str`.
	   *
	   * @param {string} [str]
	   * @return {(string|Command)}
	   */

	  usage(str) {
	    if (str === undefined) {
	      if (this._usage) return this._usage;

	      const args = this.registeredArguments.map((arg) => {
	        return humanReadableArgName(arg);
	      });
	      return []
	        .concat(
	          this.options.length || this._helpOption !== null ? '[options]' : [],
	          this.commands.length ? '[command]' : [],
	          this.registeredArguments.length ? args : [],
	        )
	        .join(' ');
	    }

	    this._usage = str;
	    return this;
	  }

	  /**
	   * Get or set the name of the command.
	   *
	   * @param {string} [str]
	   * @return {(string|Command)}
	   */

	  name(str) {
	    if (str === undefined) return this._name;
	    this._name = str;
	    return this;
	  }

	  /**
	   * Set/get the help group heading for this subcommand in parent command's help.
	   *
	   * @param {string} [heading]
	   * @return {Command | string}
	   */

	  helpGroup(heading) {
	    if (heading === undefined) return this._helpGroupHeading ?? '';
	    this._helpGroupHeading = heading;
	    return this;
	  }

	  /**
	   * Set/get the default help group heading for subcommands added to this command.
	   * (This does not override a group set directly on the subcommand using .helpGroup().)
	   *
	   * @example
	   * program.commandsGroup('Development Commands:);
	   * program.command('watch')...
	   * program.command('lint')...
	   * ...
	   *
	   * @param {string} [heading]
	   * @returns {Command | string}
	   */
	  commandsGroup(heading) {
	    if (heading === undefined) return this._defaultCommandGroup ?? '';
	    this._defaultCommandGroup = heading;
	    return this;
	  }

	  /**
	   * Set/get the default help group heading for options added to this command.
	   * (This does not override a group set directly on the option using .helpGroup().)
	   *
	   * @example
	   * program
	   *   .optionsGroup('Development Options:')
	   *   .option('-d, --debug', 'output extra debugging')
	   *   .option('-p, --profile', 'output profiling information')
	   *
	   * @param {string} [heading]
	   * @returns {Command | string}
	   */
	  optionsGroup(heading) {
	    if (heading === undefined) return this._defaultOptionGroup ?? '';
	    this._defaultOptionGroup = heading;
	    return this;
	  }

	  /**
	   * @param {Option} option
	   * @private
	   */
	  _initOptionGroup(option) {
	    if (this._defaultOptionGroup && !option.helpGroupHeading)
	      option.helpGroup(this._defaultOptionGroup);
	  }

	  /**
	   * @param {Command} cmd
	   * @private
	   */
	  _initCommandGroup(cmd) {
	    if (this._defaultCommandGroup && !cmd.helpGroup())
	      cmd.helpGroup(this._defaultCommandGroup);
	  }

	  /**
	   * Set the name of the command from script filename, such as process.argv[1],
	   * or require.main.filename, or __filename.
	   *
	   * (Used internally and public although not documented in README.)
	   *
	   * @example
	   * program.nameFromFilename(require.main.filename);
	   *
	   * @param {string} filename
	   * @return {Command}
	   */

	  nameFromFilename(filename) {
	    this._name = path.basename(filename, path.extname(filename));

	    return this;
	  }

	  /**
	   * Get or set the directory for searching for executable subcommands of this command.
	   *
	   * @example
	   * program.executableDir(__dirname);
	   * // or
	   * program.executableDir('subcommands');
	   *
	   * @param {string} [path]
	   * @return {(string|null|Command)}
	   */

	  executableDir(path) {
	    if (path === undefined) return this._executableDir;
	    this._executableDir = path;
	    return this;
	  }

	  /**
	   * Return program help documentation.
	   *
	   * @param {{ error: boolean }} [contextOptions] - pass {error:true} to wrap for stderr instead of stdout
	   * @return {string}
	   */

	  helpInformation(contextOptions) {
	    const helper = this.createHelp();
	    const context = this._getOutputContext(contextOptions);
	    helper.prepareContext({
	      error: context.error,
	      helpWidth: context.helpWidth,
	      outputHasColors: context.hasColors,
	    });
	    const text = helper.formatHelp(this, helper);
	    if (context.hasColors) return text;
	    return this._outputConfiguration.stripColor(text);
	  }

	  /**
	   * @typedef HelpContext
	   * @type {object}
	   * @property {boolean} error
	   * @property {number} helpWidth
	   * @property {boolean} hasColors
	   * @property {function} write - includes stripColor if needed
	   *
	   * @returns {HelpContext}
	   * @private
	   */

	  _getOutputContext(contextOptions) {
	    contextOptions = contextOptions || {};
	    const error = !!contextOptions.error;
	    let baseWrite;
	    let hasColors;
	    let helpWidth;
	    if (error) {
	      baseWrite = (str) => this._outputConfiguration.writeErr(str);
	      hasColors = this._outputConfiguration.getErrHasColors();
	      helpWidth = this._outputConfiguration.getErrHelpWidth();
	    } else {
	      baseWrite = (str) => this._outputConfiguration.writeOut(str);
	      hasColors = this._outputConfiguration.getOutHasColors();
	      helpWidth = this._outputConfiguration.getOutHelpWidth();
	    }
	    const write = (str) => {
	      if (!hasColors) str = this._outputConfiguration.stripColor(str);
	      return baseWrite(str);
	    };
	    return { error, write, hasColors, helpWidth };
	  }

	  /**
	   * Output help information for this command.
	   *
	   * Outputs built-in help, and custom text added using `.addHelpText()`.
	   *
	   * @param {{ error: boolean } | Function} [contextOptions] - pass {error:true} to write to stderr instead of stdout
	   */

	  outputHelp(contextOptions) {
	    let deprecatedCallback;
	    if (typeof contextOptions === 'function') {
	      deprecatedCallback = contextOptions;
	      contextOptions = undefined;
	    }

	    const outputContext = this._getOutputContext(contextOptions);
	    /** @type {HelpTextEventContext} */
	    const eventContext = {
	      error: outputContext.error,
	      write: outputContext.write,
	      command: this,
	    };

	    this._getCommandAndAncestors()
	      .reverse()
	      .forEach((command) => command.emit('beforeAllHelp', eventContext));
	    this.emit('beforeHelp', eventContext);

	    let helpInformation = this.helpInformation({ error: outputContext.error });
	    if (deprecatedCallback) {
	      helpInformation = deprecatedCallback(helpInformation);
	      if (
	        typeof helpInformation !== 'string' &&
	        !Buffer.isBuffer(helpInformation)
	      ) {
	        throw new Error('outputHelp callback must return a string or a Buffer');
	      }
	    }
	    outputContext.write(helpInformation);

	    if (this._getHelpOption()?.long) {
	      this.emit(this._getHelpOption().long); // deprecated
	    }
	    this.emit('afterHelp', eventContext);
	    this._getCommandAndAncestors().forEach((command) =>
	      command.emit('afterAllHelp', eventContext),
	    );
	  }

	  /**
	   * You can pass in flags and a description to customise the built-in help option.
	   * Pass in false to disable the built-in help option.
	   *
	   * @example
	   * program.helpOption('-?, --help' 'show help'); // customise
	   * program.helpOption(false); // disable
	   *
	   * @param {(string | boolean)} flags
	   * @param {string} [description]
	   * @return {Command} `this` command for chaining
	   */

	  helpOption(flags, description) {
	    // Support enabling/disabling built-in help option.
	    if (typeof flags === 'boolean') {
	      if (flags) {
	        if (this._helpOption === null) this._helpOption = undefined; // reenable
	        if (this._defaultOptionGroup) {
	          // make the option to store the group
	          this._initOptionGroup(this._getHelpOption());
	        }
	      } else {
	        this._helpOption = null; // disable
	      }
	      return this;
	    }

	    // Customise flags and description.
	    this._helpOption = this.createOption(
	      flags ?? '-h, --help',
	      description ?? 'display help for command',
	    );
	    // init group unless lazy create
	    if (flags || description) this._initOptionGroup(this._helpOption);

	    return this;
	  }

	  /**
	   * Lazy create help option.
	   * Returns null if has been disabled with .helpOption(false).
	   *
	   * @returns {(Option | null)} the help option
	   * @package
	   */
	  _getHelpOption() {
	    // Lazy create help option on demand.
	    if (this._helpOption === undefined) {
	      this.helpOption(undefined, undefined);
	    }
	    return this._helpOption;
	  }

	  /**
	   * Supply your own option to use for the built-in help option.
	   * This is an alternative to using helpOption() to customise the flags and description etc.
	   *
	   * @param {Option} option
	   * @return {Command} `this` command for chaining
	   */
	  addHelpOption(option) {
	    this._helpOption = option;
	    this._initOptionGroup(option);
	    return this;
	  }

	  /**
	   * Output help information and exit.
	   *
	   * Outputs built-in help, and custom text added using `.addHelpText()`.
	   *
	   * @param {{ error: boolean }} [contextOptions] - pass {error:true} to write to stderr instead of stdout
	   */

	  help(contextOptions) {
	    this.outputHelp(contextOptions);
	    let exitCode = Number(process.exitCode ?? 0); // process.exitCode does allow a string or an integer, but we prefer just a number
	    if (
	      exitCode === 0 &&
	      contextOptions &&
	      typeof contextOptions !== 'function' &&
	      contextOptions.error
	    ) {
	      exitCode = 1;
	    }
	    // message: do not have all displayed text available so only passing placeholder.
	    this._exit(exitCode, 'commander.help', '(outputHelp)');
	  }

	  /**
	   * // Do a little typing to coordinate emit and listener for the help text events.
	   * @typedef HelpTextEventContext
	   * @type {object}
	   * @property {boolean} error
	   * @property {Command} command
	   * @property {function} write
	   */

	  /**
	   * Add additional text to be displayed with the built-in help.
	   *
	   * Position is 'before' or 'after' to affect just this command,
	   * and 'beforeAll' or 'afterAll' to affect this command and all its subcommands.
	   *
	   * @param {string} position - before or after built-in help
	   * @param {(string | Function)} text - string to add, or a function returning a string
	   * @return {Command} `this` command for chaining
	   */

	  addHelpText(position, text) {
	    const allowedValues = ['beforeAll', 'before', 'after', 'afterAll'];
	    if (!allowedValues.includes(position)) {
	      throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
	    }

	    const helpEvent = `${position}Help`;
	    this.on(helpEvent, (/** @type {HelpTextEventContext} */ context) => {
	      let helpStr;
	      if (typeof text === 'function') {
	        helpStr = text({ error: context.error, command: context.command });
	      } else {
	        helpStr = text;
	      }
	      // Ignore falsy value when nothing to output.
	      if (helpStr) {
	        context.write(`${helpStr}\n`);
	      }
	    });
	    return this;
	  }

	  /**
	   * Output help information if help flags specified
	   *
	   * @param {Array} args - array of options to search for help flags
	   * @private
	   */

	  _outputHelpIfRequested(args) {
	    const helpOption = this._getHelpOption();
	    const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
	    if (helpRequested) {
	      this.outputHelp();
	      // (Do not have all displayed text available so only passing placeholder.)
	      this._exit(0, 'commander.helpDisplayed', '(outputHelp)');
	    }
	  }
	}

	/**
	 * Scan arguments and increment port number for inspect calls (to avoid conflicts when spawning new command).
	 *
	 * @param {string[]} args - array of arguments from node.execArgv
	 * @returns {string[]}
	 * @private
	 */

	function incrementNodeInspectorPort(args) {
	  // Testing for these options:
	  //  --inspect[=[host:]port]
	  //  --inspect-brk[=[host:]port]
	  //  --inspect-port=[host:]port
	  return args.map((arg) => {
	    if (!arg.startsWith('--inspect')) {
	      return arg;
	    }
	    let debugOption;
	    let debugHost = '127.0.0.1';
	    let debugPort = '9229';
	    let match;
	    if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
	      // e.g. --inspect
	      debugOption = match[1];
	    } else if (
	      (match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null
	    ) {
	      debugOption = match[1];
	      if (/^\d+$/.test(match[3])) {
	        // e.g. --inspect=1234
	        debugPort = match[3];
	      } else {
	        // e.g. --inspect=localhost
	        debugHost = match[3];
	      }
	    } else if (
	      (match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null
	    ) {
	      // e.g. --inspect=localhost:1234
	      debugOption = match[1];
	      debugHost = match[3];
	      debugPort = match[4];
	    }

	    if (debugOption && debugPort !== '0') {
	      return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
	    }
	    return arg;
	  });
	}

	/**
	 * @returns {boolean | undefined}
	 * @package
	 */
	function useColor() {
	  // Test for common conventions.
	  // NB: the observed behaviour is in combination with how author adds color! For example:
	  //   - we do not test NODE_DISABLE_COLORS, but util:styletext does
	  //   - we do test NO_COLOR, but Chalk does not
	  //
	  // References:
	  // https://no-color.org
	  // https://bixense.com/clicolors/
	  // https://github.com/nodejs/node/blob/0a00217a5f67ef4a22384cfc80eb6dd9a917fdc1/lib/internal/tty.js#L109
	  // https://github.com/chalk/supports-color/blob/c214314a14bcb174b12b3014b2b0a8de375029ae/index.js#L33
	  // (https://force-color.org recent web page from 2023, does not match major javascript implementations)

	  if (
	    process.env.NO_COLOR ||
	    process.env.FORCE_COLOR === '0' ||
	    process.env.FORCE_COLOR === 'false'
	  )
	    return false;
	  if (process.env.FORCE_COLOR || process.env.CLICOLOR_FORCE !== undefined)
	    return true;
	  return undefined;
	}

	command.Command = Command;
	command.useColor = useColor; // exporting for tests
	return command;
}

var hasRequiredCommander;

function requireCommander () {
	if (hasRequiredCommander) return commander;
	hasRequiredCommander = 1;
	const { Argument } = requireArgument();
	const { Command } = requireCommand();
	const { CommanderError, InvalidArgumentError } = requireError();
	const { Help } = requireHelp();
	const { Option } = requireOption();

	commander.program = new Command();

	commander.createCommand = (name) => new Command(name);
	commander.createOption = (flags, description) => new Option(flags, description);
	commander.createArgument = (name, description) => new Argument(name, description);

	/**
	 * Expose classes
	 */

	commander.Command = Command;
	commander.Option = Option;
	commander.Argument = Argument;
	commander.Help = Help;

	commander.CommanderError = CommanderError;
	commander.InvalidArgumentError = InvalidArgumentError;
	commander.InvalidOptionArgumentError = InvalidArgumentError; // Deprecated
	return commander;
}

var commanderExports = requireCommander();

const ANSI_BACKGROUND_OFFSET = 10;

const wrapAnsi16 = (offset = 0) => code => `\u001B[${code + offset}m`;

const wrapAnsi256 = (offset = 0) => code => `\u001B[${38 + offset};5;${code}m`;

const wrapAnsi16m = (offset = 0) => (red, green, blue) => `\u001B[${38 + offset};2;${red};${green};${blue}m`;

const styles$1 = {
	modifier: {
		reset: [0, 0],
		// 21 isn't widely supported and 22 does the same thing
		bold: [1, 22],
		dim: [2, 22],
		italic: [3, 23],
		underline: [4, 24],
		overline: [53, 55],
		inverse: [7, 27],
		hidden: [8, 28],
		strikethrough: [9, 29],
	},
	color: {
		black: [30, 39],
		red: [31, 39],
		green: [32, 39],
		yellow: [33, 39],
		blue: [34, 39],
		magenta: [35, 39],
		cyan: [36, 39],
		white: [37, 39],

		// Bright color
		blackBright: [90, 39],
		gray: [90, 39], // Alias of `blackBright`
		grey: [90, 39], // Alias of `blackBright`
		redBright: [91, 39],
		greenBright: [92, 39],
		yellowBright: [93, 39],
		blueBright: [94, 39],
		magentaBright: [95, 39],
		cyanBright: [96, 39],
		whiteBright: [97, 39],
	},
	bgColor: {
		bgBlack: [40, 49],
		bgRed: [41, 49],
		bgGreen: [42, 49],
		bgYellow: [43, 49],
		bgBlue: [44, 49],
		bgMagenta: [45, 49],
		bgCyan: [46, 49],
		bgWhite: [47, 49],

		// Bright color
		bgBlackBright: [100, 49],
		bgGray: [100, 49], // Alias of `bgBlackBright`
		bgGrey: [100, 49], // Alias of `bgBlackBright`
		bgRedBright: [101, 49],
		bgGreenBright: [102, 49],
		bgYellowBright: [103, 49],
		bgBlueBright: [104, 49],
		bgMagentaBright: [105, 49],
		bgCyanBright: [106, 49],
		bgWhiteBright: [107, 49],
	},
};

Object.keys(styles$1.modifier);
const foregroundColorNames = Object.keys(styles$1.color);
const backgroundColorNames = Object.keys(styles$1.bgColor);
[...foregroundColorNames, ...backgroundColorNames];

function assembleStyles() {
	const codes = new Map();

	for (const [groupName, group] of Object.entries(styles$1)) {
		for (const [styleName, style] of Object.entries(group)) {
			styles$1[styleName] = {
				open: `\u001B[${style[0]}m`,
				close: `\u001B[${style[1]}m`,
			};

			group[styleName] = styles$1[styleName];

			codes.set(style[0], style[1]);
		}

		Object.defineProperty(styles$1, groupName, {
			value: group,
			enumerable: false,
		});
	}

	Object.defineProperty(styles$1, 'codes', {
		value: codes,
		enumerable: false,
	});

	styles$1.color.close = '\u001B[39m';
	styles$1.bgColor.close = '\u001B[49m';

	styles$1.color.ansi = wrapAnsi16();
	styles$1.color.ansi256 = wrapAnsi256();
	styles$1.color.ansi16m = wrapAnsi16m();
	styles$1.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
	styles$1.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
	styles$1.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);

	// From https://github.com/Qix-/color-convert/blob/3f0e0d4e92e235796ccb17f6e85c72094a651f49/conversions.js
	Object.defineProperties(styles$1, {
		rgbToAnsi256: {
			value(red, green, blue) {
				// We use the extended greyscale palette here, with the exception of
				// black and white. normal palette only has 4 greyscale shades.
				if (red === green && green === blue) {
					if (red < 8) {
						return 16;
					}

					if (red > 248) {
						return 231;
					}

					return Math.round(((red - 8) / 247) * 24) + 232;
				}

				return 16
					+ (36 * Math.round(red / 255 * 5))
					+ (6 * Math.round(green / 255 * 5))
					+ Math.round(blue / 255 * 5);
			},
			enumerable: false,
		},
		hexToRgb: {
			value(hex) {
				const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
				if (!matches) {
					return [0, 0, 0];
				}

				let [colorString] = matches;

				if (colorString.length === 3) {
					colorString = [...colorString].map(character => character + character).join('');
				}

				const integer = Number.parseInt(colorString, 16);

				return [
					/* eslint-disable no-bitwise */
					(integer >> 16) & 0xFF,
					(integer >> 8) & 0xFF,
					integer & 0xFF,
					/* eslint-enable no-bitwise */
				];
			},
			enumerable: false,
		},
		hexToAnsi256: {
			value: hex => styles$1.rgbToAnsi256(...styles$1.hexToRgb(hex)),
			enumerable: false,
		},
		ansi256ToAnsi: {
			value(code) {
				if (code < 8) {
					return 30 + code;
				}

				if (code < 16) {
					return 90 + (code - 8);
				}

				let red;
				let green;
				let blue;

				if (code >= 232) {
					red = (((code - 232) * 10) + 8) / 255;
					green = red;
					blue = red;
				} else {
					code -= 16;

					const remainder = code % 36;

					red = Math.floor(code / 36) / 5;
					green = Math.floor(remainder / 6) / 5;
					blue = (remainder % 6) / 5;
				}

				const value = Math.max(red, green, blue) * 2;

				if (value === 0) {
					return 30;
				}

				// eslint-disable-next-line no-bitwise
				let result = 30 + ((Math.round(blue) << 2) | (Math.round(green) << 1) | Math.round(red));

				if (value === 2) {
					result += 60;
				}

				return result;
			},
			enumerable: false,
		},
		rgbToAnsi: {
			value: (red, green, blue) => styles$1.ansi256ToAnsi(styles$1.rgbToAnsi256(red, green, blue)),
			enumerable: false,
		},
		hexToAnsi: {
			value: hex => styles$1.ansi256ToAnsi(styles$1.hexToAnsi256(hex)),
			enumerable: false,
		},
	});

	return styles$1;
}

const ansiStyles = assembleStyles();

// From: https://github.com/sindresorhus/has-flag/blob/main/index.js
/// function hasFlag(flag, argv = globalThis.Deno?.args ?? process.argv) {
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : process$1.argv) {
	const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
	const position = argv.indexOf(prefix + flag);
	const terminatorPosition = argv.indexOf('--');
	return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}

const {env} = process$1;

let flagForceColor;
if (
	hasFlag('no-color')
	|| hasFlag('no-colors')
	|| hasFlag('color=false')
	|| hasFlag('color=never')
) {
	flagForceColor = 0;
} else if (
	hasFlag('color')
	|| hasFlag('colors')
	|| hasFlag('color=true')
	|| hasFlag('color=always')
) {
	flagForceColor = 1;
}

function envForceColor() {
	if ('FORCE_COLOR' in env) {
		if (env.FORCE_COLOR === 'true') {
			return 1;
		}

		if (env.FORCE_COLOR === 'false') {
			return 0;
		}

		return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
	}
}

function translateLevel(level) {
	if (level === 0) {
		return false;
	}

	return {
		level,
		hasBasic: true,
		has256: level >= 2,
		has16m: level >= 3,
	};
}

function _supportsColor(haveStream, {streamIsTTY, sniffFlags = true} = {}) {
	const noFlagForceColor = envForceColor();
	if (noFlagForceColor !== undefined) {
		flagForceColor = noFlagForceColor;
	}

	const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;

	if (forceColor === 0) {
		return 0;
	}

	if (sniffFlags) {
		if (hasFlag('color=16m')
			|| hasFlag('color=full')
			|| hasFlag('color=truecolor')) {
			return 3;
		}

		if (hasFlag('color=256')) {
			return 2;
		}
	}

	// Check for Azure DevOps pipelines.
	// Has to be above the `!streamIsTTY` check.
	if ('TF_BUILD' in env && 'AGENT_NAME' in env) {
		return 1;
	}

	if (haveStream && !streamIsTTY && forceColor === undefined) {
		return 0;
	}

	const min = forceColor || 0;

	if (env.TERM === 'dumb') {
		return min;
	}

	if (process$1.platform === 'win32') {
		// Windows 10 build 10586 is the first Windows release that supports 256 colors.
		// Windows 10 build 14931 is the first release that supports 16m/TrueColor.
		const osRelease = os.release().split('.');
		if (
			Number(osRelease[0]) >= 10
			&& Number(osRelease[2]) >= 10_586
		) {
			return Number(osRelease[2]) >= 14_931 ? 3 : 2;
		}

		return 1;
	}

	if ('CI' in env) {
		if (['GITHUB_ACTIONS', 'GITEA_ACTIONS', 'CIRCLECI'].some(key => key in env)) {
			return 3;
		}

		if (['TRAVIS', 'APPVEYOR', 'GITLAB_CI', 'BUILDKITE', 'DRONE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
			return 1;
		}

		return min;
	}

	if ('TEAMCITY_VERSION' in env) {
		return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
	}

	if (env.COLORTERM === 'truecolor') {
		return 3;
	}

	if (env.TERM === 'xterm-kitty') {
		return 3;
	}

	if (env.TERM === 'xterm-ghostty') {
		return 3;
	}

	if (env.TERM === 'wezterm') {
		return 3;
	}

	if ('TERM_PROGRAM' in env) {
		const version = Number.parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

		switch (env.TERM_PROGRAM) {
			case 'iTerm.app': {
				return version >= 3 ? 3 : 2;
			}

			case 'Apple_Terminal': {
				return 2;
			}
			// No default
		}
	}

	if (/-256(color)?$/i.test(env.TERM)) {
		return 2;
	}

	if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
		return 1;
	}

	if ('COLORTERM' in env) {
		return 1;
	}

	return min;
}

function createSupportsColor(stream, options = {}) {
	const level = _supportsColor(stream, {
		streamIsTTY: stream && stream.isTTY,
		...options,
	});

	return translateLevel(level);
}

const supportsColor = {
	stdout: createSupportsColor({isTTY: tty.isatty(1)}),
	stderr: createSupportsColor({isTTY: tty.isatty(2)}),
};

// TODO: When targeting Node.js 16, use `String.prototype.replaceAll`.
function stringReplaceAll(string, substring, replacer) {
	let index = string.indexOf(substring);
	if (index === -1) {
		return string;
	}

	const substringLength = substring.length;
	let endIndex = 0;
	let returnValue = '';
	do {
		returnValue += string.slice(endIndex, index) + substring + replacer;
		endIndex = index + substringLength;
		index = string.indexOf(substring, endIndex);
	} while (index !== -1);

	returnValue += string.slice(endIndex);
	return returnValue;
}

function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
	let endIndex = 0;
	let returnValue = '';
	do {
		const gotCR = string[index - 1] === '\r';
		returnValue += string.slice(endIndex, (gotCR ? index - 1 : index)) + prefix + (gotCR ? '\r\n' : '\n') + postfix;
		endIndex = index + 1;
		index = string.indexOf('\n', endIndex);
	} while (index !== -1);

	returnValue += string.slice(endIndex);
	return returnValue;
}

const {stdout: stdoutColor, stderr: stderrColor} = supportsColor;

const GENERATOR = Symbol('GENERATOR');
const STYLER = Symbol('STYLER');
const IS_EMPTY = Symbol('IS_EMPTY');

// `supportsColor.level` → `ansiStyles.color[name]` mapping
const levelMapping = [
	'ansi',
	'ansi',
	'ansi256',
	'ansi16m',
];

const styles = Object.create(null);

const applyOptions = (object, options = {}) => {
	if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
		throw new Error('The `level` option should be an integer from 0 to 3');
	}

	// Detect level if not set manually
	const colorLevel = stdoutColor ? stdoutColor.level : 0;
	object.level = options.level === undefined ? colorLevel : options.level;
};

class Chalk {
	constructor(options) {
		// eslint-disable-next-line no-constructor-return
		return chalkFactory(options);
	}
}

const chalkFactory = options => {
	const chalk = (...strings) => strings.join(' ');
	applyOptions(chalk, options);

	Object.setPrototypeOf(chalk, createChalk.prototype);

	return chalk;
};

function createChalk(options) {
	return chalkFactory(options);
}

Object.setPrototypeOf(createChalk.prototype, Function.prototype);

for (const [styleName, style] of Object.entries(ansiStyles)) {
	styles[styleName] = {
		get() {
			const builder = createBuilder(this, createStyler(style.open, style.close, this[STYLER]), this[IS_EMPTY]);
			Object.defineProperty(this, styleName, {value: builder});
			return builder;
		},
	};
}

styles.visible = {
	get() {
		const builder = createBuilder(this, this[STYLER], true);
		Object.defineProperty(this, 'visible', {value: builder});
		return builder;
	},
};

const getModelAnsi = (model, level, type, ...arguments_) => {
	if (model === 'rgb') {
		if (level === 'ansi16m') {
			return ansiStyles[type].ansi16m(...arguments_);
		}

		if (level === 'ansi256') {
			return ansiStyles[type].ansi256(ansiStyles.rgbToAnsi256(...arguments_));
		}

		return ansiStyles[type].ansi(ansiStyles.rgbToAnsi(...arguments_));
	}

	if (model === 'hex') {
		return getModelAnsi('rgb', level, type, ...ansiStyles.hexToRgb(...arguments_));
	}

	return ansiStyles[type][model](...arguments_);
};

const usedModels = ['rgb', 'hex', 'ansi256'];

for (const model of usedModels) {
	styles[model] = {
		get() {
			const {level} = this;
			return function (...arguments_) {
				const styler = createStyler(getModelAnsi(model, levelMapping[level], 'color', ...arguments_), ansiStyles.color.close, this[STYLER]);
				return createBuilder(this, styler, this[IS_EMPTY]);
			};
		},
	};

	const bgModel = 'bg' + model[0].toUpperCase() + model.slice(1);
	styles[bgModel] = {
		get() {
			const {level} = this;
			return function (...arguments_) {
				const styler = createStyler(getModelAnsi(model, levelMapping[level], 'bgColor', ...arguments_), ansiStyles.bgColor.close, this[STYLER]);
				return createBuilder(this, styler, this[IS_EMPTY]);
			};
		},
	};
}

const proto = Object.defineProperties(() => {}, {
	...styles,
	level: {
		enumerable: true,
		get() {
			return this[GENERATOR].level;
		},
		set(level) {
			this[GENERATOR].level = level;
		},
	},
});

const createStyler = (open, close, parent) => {
	let openAll;
	let closeAll;
	if (parent === undefined) {
		openAll = open;
		closeAll = close;
	} else {
		openAll = parent.openAll + open;
		closeAll = close + parent.closeAll;
	}

	return {
		open,
		close,
		openAll,
		closeAll,
		parent,
	};
};

const createBuilder = (self, _styler, _isEmpty) => {
	// Single argument is hot path, implicit coercion is faster than anything
	// eslint-disable-next-line no-implicit-coercion
	const builder = (...arguments_) => applyStyle(builder, (arguments_.length === 1) ? ('' + arguments_[0]) : arguments_.join(' '));

	// We alter the prototype because we must return a function, but there is
	// no way to create a function with a different prototype
	Object.setPrototypeOf(builder, proto);

	builder[GENERATOR] = self;
	builder[STYLER] = _styler;
	builder[IS_EMPTY] = _isEmpty;

	return builder;
};

const applyStyle = (self, string) => {
	if (self.level <= 0 || !string) {
		return self[IS_EMPTY] ? '' : string;
	}

	let styler = self[STYLER];

	if (styler === undefined) {
		return string;
	}

	const {openAll, closeAll} = styler;
	if (string.includes('\u001B')) {
		while (styler !== undefined) {
			// Replace any instances already present with a re-opening code
			// otherwise only the part of the string until said closing code
			// will be colored, and the rest will simply be 'plain'.
			string = stringReplaceAll(string, styler.close, styler.open);

			styler = styler.parent;
		}
	}

	// We can move both next actions out of loop, because remaining actions in loop won't have
	// any/visible effect on parts we add here. Close the styling before a linebreak and reopen
	// after next line to fix a bleed issue on macOS: https://github.com/chalk/chalk/pull/92
	const lfIndex = string.indexOf('\n');
	if (lfIndex !== -1) {
		string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
	}

	return openAll + string + closeAll;
};

Object.defineProperties(createChalk.prototype, styles);

createChalk();
createChalk({level: stderrColor ? stderrColor.level : 0});

var main = {exports: {}};

var version = "17.2.3";
var require$$4 = {
	version: version};

var hasRequiredMain;

function requireMain () {
	if (hasRequiredMain) return main.exports;
	hasRequiredMain = 1;
	const fs$1 = fs;
	const path$1 = path;
	const os = require$$2$1;
	const crypto = require$$3$1;
	const packageJson = require$$4;

	const version = packageJson.version;

	// Array of tips to display randomly
	const TIPS = [
	  '🔐 encrypt with Dotenvx: https://dotenvx.com',
	  '🔐 prevent committing .env to code: https://dotenvx.com/precommit',
	  '🔐 prevent building .env in docker: https://dotenvx.com/prebuild',
	  '📡 add observability to secrets: https://dotenvx.com/ops',
	  '👥 sync secrets across teammates & machines: https://dotenvx.com/ops',
	  '🗂️ backup and recover secrets: https://dotenvx.com/ops',
	  '✅ audit secrets and track compliance: https://dotenvx.com/ops',
	  '🔄 add secrets lifecycle management: https://dotenvx.com/ops',
	  '🔑 add access controls to secrets: https://dotenvx.com/ops',
	  '🛠️  run anywhere with `dotenvx run -- yourcommand`',
	  '⚙️  specify custom .env file path with { path: \'/custom/path/.env\' }',
	  '⚙️  enable debug logging with { debug: true }',
	  '⚙️  override existing env vars with { override: true }',
	  '⚙️  suppress all logs with { quiet: true }',
	  '⚙️  write to custom object with { processEnv: myObject }',
	  '⚙️  load multiple .env files with { path: [\'.env.local\', \'.env\'] }'
	];

	// Get a random tip from the tips array
	function _getRandomTip () {
	  return TIPS[Math.floor(Math.random() * TIPS.length)]
	}

	function parseBoolean (value) {
	  if (typeof value === 'string') {
	    return !['false', '0', 'no', 'off', ''].includes(value.toLowerCase())
	  }
	  return Boolean(value)
	}

	function supportsAnsi () {
	  return process.stdout.isTTY // && process.env.TERM !== 'dumb'
	}

	function dim (text) {
	  return supportsAnsi() ? `\x1b[2m${text}\x1b[0m` : text
	}

	const LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;

	// Parse src into an Object
	function parse (src) {
	  const obj = {};

	  // Convert buffer to string
	  let lines = src.toString();

	  // Convert line breaks to same format
	  lines = lines.replace(/\r\n?/mg, '\n');

	  let match;
	  while ((match = LINE.exec(lines)) != null) {
	    const key = match[1];

	    // Default undefined or null to empty string
	    let value = (match[2] || '');

	    // Remove whitespace
	    value = value.trim();

	    // Check if double quoted
	    const maybeQuote = value[0];

	    // Remove surrounding quotes
	    value = value.replace(/^(['"`])([\s\S]*)\1$/mg, '$2');

	    // Expand newlines if double quoted
	    if (maybeQuote === '"') {
	      value = value.replace(/\\n/g, '\n');
	      value = value.replace(/\\r/g, '\r');
	    }

	    // Add to object
	    obj[key] = value;
	  }

	  return obj
	}

	function _parseVault (options) {
	  options = options || {};

	  const vaultPath = _vaultPath(options);
	  options.path = vaultPath; // parse .env.vault
	  const result = DotenvModule.configDotenv(options);
	  if (!result.parsed) {
	    const err = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
	    err.code = 'MISSING_DATA';
	    throw err
	  }

	  // handle scenario for comma separated keys - for use with key rotation
	  // example: DOTENV_KEY="dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=prod,dotenv://:key_7890@dotenvx.com/vault/.env.vault?environment=prod"
	  const keys = _dotenvKey(options).split(',');
	  const length = keys.length;

	  let decrypted;
	  for (let i = 0; i < length; i++) {
	    try {
	      // Get full key
	      const key = keys[i].trim();

	      // Get instructions for decrypt
	      const attrs = _instructions(result, key);

	      // Decrypt
	      decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);

	      break
	    } catch (error) {
	      // last key
	      if (i + 1 >= length) {
	        throw error
	      }
	      // try next key
	    }
	  }

	  // Parse decrypted .env string
	  return DotenvModule.parse(decrypted)
	}

	function _warn (message) {
	  console.error(`[dotenv@${version}][WARN] ${message}`);
	}

	function _debug (message) {
	  console.log(`[dotenv@${version}][DEBUG] ${message}`);
	}

	function _log (message) {
	  console.log(`[dotenv@${version}] ${message}`);
	}

	function _dotenvKey (options) {
	  // prioritize developer directly setting options.DOTENV_KEY
	  if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
	    return options.DOTENV_KEY
	  }

	  // secondary infra already contains a DOTENV_KEY environment variable
	  if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
	    return process.env.DOTENV_KEY
	  }

	  // fallback to empty string
	  return ''
	}

	function _instructions (result, dotenvKey) {
	  // Parse DOTENV_KEY. Format is a URI
	  let uri;
	  try {
	    uri = new URL(dotenvKey);
	  } catch (error) {
	    if (error.code === 'ERR_INVALID_URL') {
	      const err = new Error('INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development');
	      err.code = 'INVALID_DOTENV_KEY';
	      throw err
	    }

	    throw error
	  }

	  // Get decrypt key
	  const key = uri.password;
	  if (!key) {
	    const err = new Error('INVALID_DOTENV_KEY: Missing key part');
	    err.code = 'INVALID_DOTENV_KEY';
	    throw err
	  }

	  // Get environment
	  const environment = uri.searchParams.get('environment');
	  if (!environment) {
	    const err = new Error('INVALID_DOTENV_KEY: Missing environment part');
	    err.code = 'INVALID_DOTENV_KEY';
	    throw err
	  }

	  // Get ciphertext payload
	  const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
	  const ciphertext = result.parsed[environmentKey]; // DOTENV_VAULT_PRODUCTION
	  if (!ciphertext) {
	    const err = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
	    err.code = 'NOT_FOUND_DOTENV_ENVIRONMENT';
	    throw err
	  }

	  return { ciphertext, key }
	}

	function _vaultPath (options) {
	  let possibleVaultPath = null;

	  if (options && options.path && options.path.length > 0) {
	    if (Array.isArray(options.path)) {
	      for (const filepath of options.path) {
	        if (fs$1.existsSync(filepath)) {
	          possibleVaultPath = filepath.endsWith('.vault') ? filepath : `${filepath}.vault`;
	        }
	      }
	    } else {
	      possibleVaultPath = options.path.endsWith('.vault') ? options.path : `${options.path}.vault`;
	    }
	  } else {
	    possibleVaultPath = path$1.resolve(process.cwd(), '.env.vault');
	  }

	  if (fs$1.existsSync(possibleVaultPath)) {
	    return possibleVaultPath
	  }

	  return null
	}

	function _resolveHome (envPath) {
	  return envPath[0] === '~' ? path$1.join(os.homedir(), envPath.slice(1)) : envPath
	}

	function _configVault (options) {
	  const debug = parseBoolean(process.env.DOTENV_CONFIG_DEBUG || (options && options.debug));
	  const quiet = parseBoolean(process.env.DOTENV_CONFIG_QUIET || (options && options.quiet));

	  if (debug || !quiet) {
	    _log('Loading env from encrypted .env.vault');
	  }

	  const parsed = DotenvModule._parseVault(options);

	  let processEnv = process.env;
	  if (options && options.processEnv != null) {
	    processEnv = options.processEnv;
	  }

	  DotenvModule.populate(processEnv, parsed, options);

	  return { parsed }
	}

	function configDotenv (options) {
	  const dotenvPath = path$1.resolve(process.cwd(), '.env');
	  let encoding = 'utf8';
	  let processEnv = process.env;
	  if (options && options.processEnv != null) {
	    processEnv = options.processEnv;
	  }
	  let debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || (options && options.debug));
	  let quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || (options && options.quiet));

	  if (options && options.encoding) {
	    encoding = options.encoding;
	  } else {
	    if (debug) {
	      _debug('No encoding is specified. UTF-8 is used by default');
	    }
	  }

	  let optionPaths = [dotenvPath]; // default, look for .env
	  if (options && options.path) {
	    if (!Array.isArray(options.path)) {
	      optionPaths = [_resolveHome(options.path)];
	    } else {
	      optionPaths = []; // reset default
	      for (const filepath of options.path) {
	        optionPaths.push(_resolveHome(filepath));
	      }
	    }
	  }

	  // Build the parsed data in a temporary object (because we need to return it).  Once we have the final
	  // parsed data, we will combine it with process.env (or options.processEnv if provided).
	  let lastError;
	  const parsedAll = {};
	  for (const path of optionPaths) {
	    try {
	      // Specifying an encoding returns a string instead of a buffer
	      const parsed = DotenvModule.parse(fs$1.readFileSync(path, { encoding }));

	      DotenvModule.populate(parsedAll, parsed, options);
	    } catch (e) {
	      if (debug) {
	        _debug(`Failed to load ${path} ${e.message}`);
	      }
	      lastError = e;
	    }
	  }

	  const populated = DotenvModule.populate(processEnv, parsedAll, options);

	  // handle user settings DOTENV_CONFIG_ options inside .env file(s)
	  debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || debug);
	  quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || quiet);

	  if (debug || !quiet) {
	    const keysCount = Object.keys(populated).length;
	    const shortPaths = [];
	    for (const filePath of optionPaths) {
	      try {
	        const relative = path$1.relative(process.cwd(), filePath);
	        shortPaths.push(relative);
	      } catch (e) {
	        if (debug) {
	          _debug(`Failed to load ${filePath} ${e.message}`);
	        }
	        lastError = e;
	      }
	    }

	    _log(`injecting env (${keysCount}) from ${shortPaths.join(',')} ${dim(`-- tip: ${_getRandomTip()}`)}`);
	  }

	  if (lastError) {
	    return { parsed: parsedAll, error: lastError }
	  } else {
	    return { parsed: parsedAll }
	  }
	}

	// Populates process.env from .env file
	function config (options) {
	  // fallback to original dotenv if DOTENV_KEY is not set
	  if (_dotenvKey(options).length === 0) {
	    return DotenvModule.configDotenv(options)
	  }

	  const vaultPath = _vaultPath(options);

	  // dotenvKey exists but .env.vault file does not exist
	  if (!vaultPath) {
	    _warn(`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`);

	    return DotenvModule.configDotenv(options)
	  }

	  return DotenvModule._configVault(options)
	}

	function decrypt (encrypted, keyStr) {
	  const key = Buffer.from(keyStr.slice(-64), 'hex');
	  let ciphertext = Buffer.from(encrypted, 'base64');

	  const nonce = ciphertext.subarray(0, 12);
	  const authTag = ciphertext.subarray(-16);
	  ciphertext = ciphertext.subarray(12, -16);

	  try {
	    const aesgcm = crypto.createDecipheriv('aes-256-gcm', key, nonce);
	    aesgcm.setAuthTag(authTag);
	    return `${aesgcm.update(ciphertext)}${aesgcm.final()}`
	  } catch (error) {
	    const isRange = error instanceof RangeError;
	    const invalidKeyLength = error.message === 'Invalid key length';
	    const decryptionFailed = error.message === 'Unsupported state or unable to authenticate data';

	    if (isRange || invalidKeyLength) {
	      const err = new Error('INVALID_DOTENV_KEY: It must be 64 characters long (or more)');
	      err.code = 'INVALID_DOTENV_KEY';
	      throw err
	    } else if (decryptionFailed) {
	      const err = new Error('DECRYPTION_FAILED: Please check your DOTENV_KEY');
	      err.code = 'DECRYPTION_FAILED';
	      throw err
	    } else {
	      throw error
	    }
	  }
	}

	// Populate process.env with parsed values
	function populate (processEnv, parsed, options = {}) {
	  const debug = Boolean(options && options.debug);
	  const override = Boolean(options && options.override);
	  const populated = {};

	  if (typeof parsed !== 'object') {
	    const err = new Error('OBJECT_REQUIRED: Please check the processEnv argument being passed to populate');
	    err.code = 'OBJECT_REQUIRED';
	    throw err
	  }

	  // Set process.env
	  for (const key of Object.keys(parsed)) {
	    if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
	      if (override === true) {
	        processEnv[key] = parsed[key];
	        populated[key] = parsed[key];
	      }

	      if (debug) {
	        if (override === true) {
	          _debug(`"${key}" is already defined and WAS overwritten`);
	        } else {
	          _debug(`"${key}" is already defined and was NOT overwritten`);
	        }
	      }
	    } else {
	      processEnv[key] = parsed[key];
	      populated[key] = parsed[key];
	    }
	  }

	  return populated
	}

	const DotenvModule = {
	  configDotenv,
	  _configVault,
	  _parseVault,
	  config,
	  decrypt,
	  parse,
	  populate
	};

	main.exports.configDotenv = DotenvModule.configDotenv;
	main.exports._configVault = DotenvModule._configVault;
	main.exports._parseVault = DotenvModule._parseVault;
	main.exports.config = DotenvModule.config;
	main.exports.decrypt = DotenvModule.decrypt;
	main.exports.parse = DotenvModule.parse;
	main.exports.populate = DotenvModule.populate;

	main.exports = DotenvModule;
	return main.exports;
}

var mainExports = requireMain();

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Create chalk instance at runtime to ensure proper color detection
// (default export is evaluated at bundle time which may be non-TTY)
const chalk = new Chalk();
/**
 * Create a timestamped run directory for output files.
 * Structure: <baseOutputDir>/run-<timestamp-epoch>/
 * Also creates 'latest' symlink pointing to the new directory.
 *
 * Directory naming uses 'run-' prefix so 'latest' sorts first alphabetically.
 *
 * @param baseOutputDir Base output directory from config
 * @returns Path to the timestamped run directory
 */
function createRunDirectory(baseOutputDir) {
    // Ensure base output directory exists
    if (!fs__namespace.existsSync(baseOutputDir)) {
        fs__namespace.mkdirSync(baseOutputDir, { recursive: true });
    }
    // Create timestamped subdirectory with 'run-' prefix
    // This ensures 'latest' sorts first (l < r alphabetically)
    const timestamp = Date.now();
    const runDirName = `run-${timestamp}`;
    const runDir = path__namespace.join(baseOutputDir, runDirName);
    fs__namespace.mkdirSync(runDir, { recursive: true });
    // Create/update 'latest' symlink
    const latestLink = path__namespace.join(baseOutputDir, 'latest');
    try {
        // Remove existing symlink if it exists
        if (fs__namespace.existsSync(latestLink)) {
            fs__namespace.unlinkSync(latestLink);
        }
        // Create relative symlink to the timestamped directory
        fs__namespace.symlinkSync(runDirName, latestLink);
    }
    catch {
        // Symlink creation may fail on some systems (e.g., Windows without admin)
        // This is non-critical, so we just log a warning
        console.log(chalk.gray(`Note: Could not create 'latest' symlink`));
    }
    return runDir;
}
// Load environment variables
mainExports.config();
const program = new commanderExports.Command();
program.name('mm-tc').description('CLI for managing Mattermost test containers').version('0.1.0');
/**
 * Apply CLI options on top of resolved config.
 * CLI options have the highest priority in the configuration hierarchy:
 * 1. CLI flags (highest)
 * 2. Environment variables
 * 3. Config file
 * 4. Built-in defaults (lowest)
 */
function applyCliOverrides(config, options) {
    const result = {
        ...config,
        server: { ...config.server },
        images: { ...config.images },
        admin: config.admin ? { ...config.admin } : undefined,
    };
    // Server edition (CLI flag)
    if (options.edition) {
        const edition = options.edition.toLowerCase();
        if (edition === 'enterprise' || edition === 'fips' || edition === 'team') {
            result.server.edition = edition;
        }
    }
    // Server tag (CLI flag)
    if (options.tag) {
        result.server.tag = options.tag;
    }
    // Service environment (CLI flag)
    if (options.serviceEnv) {
        const env = options.serviceEnv.toLowerCase();
        if (env === 'test' || env === 'production' || env === 'dev') {
            result.server.serviceEnvironment = env;
        }
    }
    // Additional dependencies (CLI flag adds to existing)
    if (options.deps) {
        const additionalDeps = options.deps.split(',').map((s) => s.trim());
        result.dependencies = [...new Set([...result.dependencies, ...additionalDeps])];
    }
    // Output directory (CLI flag)
    if (options.outputDir) {
        result.outputDir = options.outputDir;
    }
    // HA mode (CLI flag)
    if (options.ha !== undefined) {
        result.server.ha = options.ha;
    }
    // Subpath mode (CLI flag)
    if (options.subpath !== undefined) {
        result.server.subpath = options.subpath;
    }
    // Entry tier (CLI flag)
    if (options.entry) {
        result.server.entry = true;
    }
    // Admin user (CLI flag)
    if (options.admin !== undefined) {
        const username = typeof options.admin === 'string' ? options.admin : print.DEFAULT_ADMIN.username;
        result.admin = {
            username,
            password: options.adminPassword || result.admin?.password || print.DEFAULT_ADMIN.password,
            email: `${username}@sample.mattermost.com`,
        };
    }
    // Rebuild server image after applying overrides
    result.server.image = `${print.MATTERMOST_EDITION_IMAGES[result.server.edition]}:${result.server.tag}`;
    return result;
}
/**
 * Build server environment variables from config, env file, and CLI options.
 * Priority (highest to lowest): CLI -E options > --env-file > config file server.env
 */
function buildServerEnv(config, options) {
    const serverEnv = {};
    // Layer 1: Config file server.env (lowest priority)
    if (config.server.env) {
        Object.assign(serverEnv, config.server.env);
    }
    // Layer 2: Env file (if provided)
    if (options.envFile) {
        if (!fs__namespace.existsSync(options.envFile)) {
            throw new Error(`Env file not found: ${options.envFile}`);
        }
        const envFileContent = fs__namespace.readFileSync(options.envFile, 'utf-8');
        const parsed = mainExports.parse(envFileContent);
        Object.assign(serverEnv, parsed);
    }
    // Layer 3: CLI -E options (highest priority)
    if (options.env) {
        for (const envVar of options.env) {
            const eqIndex = envVar.indexOf('=');
            if (eqIndex === -1) {
                throw new Error(`Invalid environment variable format: ${envVar}. Expected KEY=value`);
            }
            const key = envVar.substring(0, eqIndex);
            const value = envVar.substring(eqIndex + 1);
            serverEnv[key] = value;
        }
    }
    // Apply service environment with proper priority:
    // CLI -S option > CLI -E option > --env-file > config file > default based on mode
    if (options.serviceEnv) {
        serverEnv.MM_SERVICEENVIRONMENT = options.serviceEnv;
    }
    else if (!serverEnv.MM_SERVICEENVIRONMENT && config.server.serviceEnvironment) {
        serverEnv.MM_SERVICEENVIRONMENT = config.server.serviceEnvironment;
    }
    else if (!serverEnv.MM_SERVICEENVIRONMENT) {
        // Default based on mode: 'dev' for deps-only (local development), 'test' for container mode
        serverEnv.MM_SERVICEENVIRONMENT = options.depsOnly ? 'dev' : 'test';
    }
    return serverEnv;
}
const startCommand = program
    .command('start')
    .description('Start the Mattermost test environment')
    .argument('[command]', 'Use "help" to show help')
    .option('-c, --config <path>', 'Path to config file. Accepts .mjs or .jsonc extensions. Auto-discovers mm-tc.config.mjs or mm-tc.config.jsonc')
    .option('-e, --edition <edition>', 'Mattermost server edition: enterprise (default), fips, team')
    .option('-t, --tag <tag>', 'Mattermost server image tag (e.g., master, release-11.4)')
    .option('-S, --service-env <env>', 'Service environment: test, production, dev (sets MM_SERVICEENVIRONMENT)')
    .option('-E, --env <KEY=value>', 'Environment variable to pass to Mattermost server, can be specified multiple times', (value, previous) => previous.concat([value]), [])
    .option('--env-file <path>', 'Path to env file to load variables for Mattermost server')
    .option('-D, --deps <deps>', 'Additional dependencies to enable: openldap, keycloak, minio, elasticsearch, opensearch, redis, dejavu, prometheus, grafana, loki, promtail')
    .option('--deps-only', 'Start dependencies only (no Mattermost container)')
    .option('--ha', 'Run in high-availability mode (3-node cluster with nginx load balancer)')
    .option('--subpath', 'Run two Mattermost servers behind nginx with subpaths (/mattermost1, /mattermost2)')
    .option('--entry', 'Use Mattermost Entry tier (enterprise/fips only, ignores MM_LICENSE)')
    .option('--admin [username]', 'Create admin user (default username: sysadmin, email: <username>@sample.mattermost.com)')
    .option('--admin-password <password>', 'Admin user password')
    .option('-o, --output-dir <dir>', 'Output directory for logs/, .env.tc, and .tc.server.json', print.DEFAULT_OUTPUT_DIR)
    .option('-d, --detach', 'Start containers and exit (run in background)')
    .action(async (command, options) => {
    // Handle "mm-tc start help"
    if (command === 'help') {
        startCommand.help();
        return;
    }
    try {
        // Load and resolve config (applies: defaults → config file → env vars)
        const resolvedConfig = await print.discoverAndLoadConfig({ configFile: options.config });
        // Apply CLI overrides (highest priority)
        const config = applyCliOverrides(resolvedConfig, options);
        // Create timestamped run directory for this session
        // Structure: <outputDir>/<timestamp>/logs/, .env.tc, .tc.docker.json, etc.
        const runDir = createRunDirectory(config.outputDir);
        print.setOutputDir(runDir);
        console.log(chalk.gray(`Output directory: ${runDir}`));
        // Validate --deps-only cannot be used with --ha or --subpath
        if (options.depsOnly && (config.server.ha || config.server.subpath)) {
            console.error(chalk.red('--deps-only cannot be used with --ha or --subpath'));
            process.exit(1);
        }
        // Build server environment variables
        const serverEnv = buildServerEnv(config, {
            env: options.env,
            envFile: options.envFile,
            serviceEnv: options.serviceEnv,
            depsOnly: options.depsOnly,
        });
        // Log startup message
        const serviceEnvDisplay = serverEnv.MM_SERVICEENVIRONMENT;
        if (options.depsOnly) {
            console.log(chalk.blue(`Starting Mattermost dependencies (service env: ${serviceEnvDisplay})`));
            console.log(chalk.gray('Run the server separately to connect to these services.'));
        }
        else if (config.server.subpath && config.server.ha) {
            console.log(chalk.blue(`Starting Mattermost subpath + HA mode (2 servers x 3 nodes each, service env: ${serviceEnvDisplay})`));
        }
        else if (config.server.subpath) {
            console.log(chalk.blue(`Starting Mattermost subpath mode (2 servers at /mattermost1 and /mattermost2, service env: ${serviceEnvDisplay})`));
        }
        else if (config.server.ha) {
            console.log(chalk.blue(`Starting Mattermost HA cluster (3 nodes, cluster: mm_test_cluster, service env: ${serviceEnvDisplay})`));
        }
        else {
            console.log(chalk.blue(`Starting Mattermost test environment (service env: ${serviceEnvDisplay})`));
        }
        // Merge built serverEnv into config.server.env (CLI overrides take precedence)
        config.server.env = {
            ...config.server.env,
            ...serverEnv,
        };
        // Determine server mode: 'local' for deps-only, 'container' otherwise
        const serverMode = options.depsOnly ? 'local' : 'container';
        const env = new print.MattermostTestEnvironment(config, serverMode);
        await env.start();
        const info = env.getConnectionInfo();
        console.log(chalk.green('\n✓ Environment started successfully!\n'));
        console.log(chalk.cyan('Connection Information:'));
        console.log(chalk.cyan('======================='));
        // Display subpath, HA cluster, or single node info
        if (info.subpath) {
            console.log(`Mattermost:      ${chalk.yellow(info.subpath.url)} ${chalk.gray('(nginx with subpaths)')}`);
            console.log(`  Server 1:      ${chalk.yellow(info.subpath.server1Url)}`);
            console.log(chalk.gray(`    Direct: ${info.subpath.server1DirectUrl}`));
            console.log(`  Server 2:      ${chalk.yellow(info.subpath.server2Url)}`);
            console.log(chalk.gray(`    Direct: ${info.subpath.server2DirectUrl}`));
        }
        else if (info.haCluster) {
            console.log(`Mattermost HA:   ${chalk.yellow(info.haCluster.url)} ${chalk.gray('(nginx load balancer)')}`);
            console.log(chalk.gray(`  Cluster: ${info.haCluster.clusterName}`));
            for (const node of info.haCluster.nodes) {
                console.log(chalk.gray(`  ${node.nodeName}: ${node.url}`));
            }
        }
        else if (info.mattermost) {
            console.log(`Mattermost:      ${chalk.yellow(info.mattermost.url)}`);
        }
        console.log(`PostgreSQL:      ${chalk.yellow(info.postgres.connectionString)}`);
        if (info.inbucket) {
            console.log(`Inbucket:        ${chalk.yellow(`http://${info.inbucket.host}:${info.inbucket.webPort}`)}`);
        }
        if (info.openldap) {
            console.log(`OpenLDAP:        ${chalk.yellow(`ldap://${info.openldap.host}:${info.openldap.port}`)}`);
        }
        if (info.minio) {
            console.log(`MinIO API:       ${chalk.yellow(info.minio.endpoint)}`);
            console.log(`MinIO Console:   ${chalk.yellow(info.minio.consoleUrl)}`);
        }
        if (info.elasticsearch) {
            console.log(`Elasticsearch:   ${chalk.yellow(info.elasticsearch.url)}`);
        }
        if (info.opensearch) {
            console.log(`OpenSearch:      ${chalk.yellow(info.opensearch.url)}`);
        }
        if (info.keycloak) {
            console.log(`Keycloak:        ${chalk.yellow(info.keycloak.adminUrl)}`);
        }
        if (info.redis) {
            console.log(`Redis:           ${chalk.yellow(info.redis.url)}`);
        }
        if (info.dejavu) {
            console.log(`Dejavu:          ${chalk.yellow(info.dejavu.url)}`);
        }
        if (info.prometheus) {
            console.log(`Prometheus:      ${chalk.yellow(info.prometheus.url)}`);
        }
        if (info.grafana) {
            console.log(`Grafana:         ${chalk.yellow(info.grafana.url)}`);
        }
        if (info.loki) {
            console.log(`Loki API:        ${chalk.yellow(info.loki.url)} ${chalk.gray('(use Grafana to view logs)')}`);
        }
        if (info.promtail) {
            console.log(`Promtail API:    ${chalk.yellow(info.promtail.url)} ${chalk.gray('(metrics only)')}`);
        }
        // Write config files to run directory
        const envPath = print.writeEnvFile(info, runDir, { depsOnly: options.depsOnly });
        console.log(chalk.green(`\n✓ Environment variables written to ${envPath}`));
        const containerMetadata = env.getContainerMetadata();
        const dockerInfoPath = print.writeDockerInfo(info, containerMetadata, runDir);
        console.log(chalk.green(`✓ Docker container info written to ${dockerInfoPath}`));
        // Write setup documentation for enabled dependencies
        if (info.openldap) {
            const ldapSetupPath = print.writeOpenLdapSetup(info, runDir);
            if (ldapSetupPath) {
                console.log(chalk.green(`✓ OpenLDAP setup documentation written to ${ldapSetupPath}`));
            }
        }
        if (info.keycloak) {
            const keycloakSetupPath = print.writeKeycloakSetup(info, runDir);
            if (keycloakSetupPath) {
                console.log(chalk.green(`✓ Keycloak setup documentation written to ${keycloakSetupPath}`));
            }
        }
        // Create admin user if requested (container mode only)
        if (!options.depsOnly && config.admin && info.mattermost) {
            const adminResult = await env.createAdminUser();
            if (adminResult.success) {
                console.log(chalk.green(`✓ Admin user: ${adminResult.username} / ${adminResult.password} (${adminResult.email})`));
            }
            else {
                console.log(chalk.yellow(`⚠ Could not create admin user: ${adminResult.error}`));
            }
        }
        // Write Keycloak SAML certificate if keycloak is enabled
        if (info.keycloak) {
            const certPath = print.writeKeycloakCertificate(runDir);
            console.log(chalk.green(`✓ Keycloak SAML certificate written to ${certPath}`));
            // Print Keycloak test user credentials
            console.log(chalk.gray('  Keycloak admin: admin / admin'));
            console.log(chalk.gray('  Keycloak test users:'));
            console.log(chalk.gray('    - user-1 / Password1! (user-1@sample.mattermost.com)'));
            console.log(chalk.gray('    - user-2 / Password1! (user-2@sample.mattermost.com)'));
            // Configure SAML in Mattermost (container mode only)
            if (!options.depsOnly && info.mattermost) {
                try {
                    const uploadResult = await env.uploadSamlIdpCertificate();
                    if (uploadResult.success) {
                        console.log(chalk.green('✓ SAML configured and enabled with Keycloak'));
                    }
                    else {
                        console.log(chalk.yellow(`⚠ Could not configure SAML: ${uploadResult.error}`));
                        console.log(chalk.gray(`  Configure manually via System Console. Certificate: ${certPath}`));
                    }
                }
                catch {
                    console.log(chalk.yellow('⚠ Could not configure SAML'));
                    console.log(chalk.gray(`  Configure manually via System Console. Certificate: ${certPath}`));
                }
            }
        }
        // Write server config for container mode (get actual config from server via mmctl)
        if (!options.depsOnly && info.mattermost) {
            try {
                const mmctl = env.getMmctl();
                const result = await mmctl.exec('config show --json');
                if (result.exitCode === 0) {
                    const serverConfigJson = JSON.parse(result.stdout);
                    const configPath = print.writeServerConfig(serverConfigJson, runDir);
                    console.log(chalk.green(`✓ Server configuration written to ${configPath}`));
                }
                else {
                    console.log(chalk.yellow('⚠ Could not get server config via mmctl'));
                }
            }
            catch {
                console.log(chalk.yellow('⚠ Could not get server config via mmctl'));
            }
        }
        if (options.depsOnly) {
            console.log(chalk.gray(`  Usage: source ${envPath} && make run-server`));
        }
        // Detach mode: exit after starting
        if (options.detach) {
            console.log(chalk.gray('\nContainers are running in background. Use `mm-tc stop` to stop them.'));
        }
        else {
            // Default: run in foreground until Ctrl+C
            console.log(chalk.gray('\nPress Ctrl+C to stop the environment'));
            let isShuttingDown = false;
            process.on('SIGINT', async () => {
                if (isShuttingDown)
                    return;
                isShuttingDown = true;
                console.log(chalk.blue('\n\nStopping environment...'));
                try {
                    await env.stop();
                    console.log(chalk.green('Environment stopped.'));
                }
                catch {
                    // Containers may already be stopped
                    console.log(chalk.yellow('Environment cleanup completed (some containers may have already been stopped).'));
                }
                process.exit(0);
            });
            // Keep the process alive using setInterval
            // This prevents Node from exiting while waiting for Ctrl+C
            setInterval(() => { }, 1000 * 60 * 60); // 1 hour interval
            await new Promise(() => { }); // Never resolves
        }
    }
    catch (error) {
        console.error(chalk.red('Failed to start environment:'), error);
        process.exit(1);
    }
});
const stopCommand = program
    .command('stop')
    .description('Stop and remove all testcontainers')
    .argument('[command]', 'Use "help" to show help')
    .action(async (command) => {
    // Handle "mm-tc stop help"
    if (command === 'help') {
        stopCommand.help();
        return;
    }
    try {
        console.log(chalk.blue('Stopping testcontainers...'));
        // Use docker to find and stop containers with testcontainers labels
        const { execSync } = await import('child_process');
        // Find containers with testcontainers label
        try {
            const containers = execSync('docker ps -q --filter "label=org.testcontainers=true"', {
                encoding: 'utf-8',
            }).trim();
            if (containers) {
                console.log(chalk.gray('Stopping containers...'));
                execSync(`docker stop ${containers.split('\n').join(' ')}`, { stdio: 'inherit' });
                console.log(chalk.gray('Removing containers...'));
                execSync(`docker rm ${containers.split('\n').join(' ')}`, { stdio: 'inherit' });
            }
        }
        catch {
            // No containers found or docker not available
        }
        // Find and remove testcontainers networks
        try {
            const networks = execSync('docker network ls -q --filter "label=org.testcontainers=true"', {
                encoding: 'utf-8',
            }).trim();
            if (networks) {
                console.log(chalk.gray('Removing networks...'));
                for (const network of networks.split('\n')) {
                    try {
                        execSync(`docker network rm ${network}`, { stdio: 'inherit' });
                    }
                    catch {
                        // Network might be in use
                    }
                }
            }
        }
        catch {
            // No networks found
        }
        console.log(chalk.green('✓ Testcontainers stopped'));
    }
    catch (error) {
        console.error(chalk.red('Failed to stop testcontainers:'), error);
        process.exit(1);
    }
});
program
    .command('info')
    .description('Display available dependencies and configuration options')
    .action(() => {
    console.log(chalk.cyan('Available Dependencies:'));
    console.log(chalk.cyan('======================='));
    console.log('  postgres      - PostgreSQL database (required)');
    console.log('  inbucket      - Email testing server');
    console.log('  openldap      - LDAP authentication server');
    console.log('  minio         - S3-compatible object storage');
    console.log('  elasticsearch - Search engine');
    console.log('  opensearch    - OpenSearch engine');
    console.log('  keycloak      - Identity provider (SAML/OIDC)');
    console.log('  redis         - Cache server');
    console.log('  dejavu        - Elasticsearch UI');
    console.log('  prometheus    - Metrics server');
    console.log('  grafana       - Visualization dashboards');
    console.log('  loki          - Log aggregation');
    console.log('  promtail      - Log shipping agent');
    console.log(chalk.cyan('\nConfiguration Priority (highest to lowest):'));
    console.log(chalk.cyan('============================================'));
    console.log('  1. CLI flags (e.g., -e, -t, --ha)');
    console.log('  2. Environment variables (e.g., TC_EDITION, MM_SERVICEENVIRONMENT)');
    console.log('  3. Config file (mm-tc.config.mjs or mm-tc.config.jsonc)');
    console.log('  4. Built-in defaults');
    console.log(chalk.cyan('\nEnvironment Variables:'));
    console.log(chalk.cyan('======================'));
    console.log('  TC_EDITION             - Server edition (enterprise, fips, team)');
    console.log('  TC_SERVER_TAG          - Server image tag (e.g., master, release-11.4)');
    console.log('  TC_SERVER_IMAGE        - Full server image (overrides edition/tag)');
    console.log('  TC_DEPENDENCIES        - Dependencies (comma-separated)');
    console.log('  TC_OUTPUT_DIR          - Output directory');
    console.log('  TC_HA                  - HA mode (true/false)');
    console.log('  TC_SUBPATH             - Subpath mode (true/false)');
    console.log('  TC_ENTRY               - Entry tier mode (true/false) - enterprise/fips only');
    console.log('  TC_ADMIN_USERNAME      - Admin username (email: <username>@sample.mattermost.com)');
    console.log('  TC_ADMIN_PASSWORD      - Admin password');
    console.log('  TC_IMAGE_MAX_AGE_HOURS - Max age before pulling fresh image');
    console.log('  MM_SERVICEENVIRONMENT  - Service environment (test, production, dev)');
    console.log('  MM_LICENSE             - Enterprise license (base64 encoded)');
    console.log('  TC_<SERVICE>_IMAGE     - Override service image (e.g., TC_POSTGRES_IMAGE)');
    console.log(chalk.cyan('\nConfig File (mm-tc.config.mjs):'));
    console.log(chalk.cyan('==============================='));
    console.log("  import {defineConfig} from '@mattermost/testcontainers';");
    console.log('');
    console.log('  export default defineConfig({');
    console.log('    server: {');
    console.log('      edition: "enterprise",');
    console.log('      entry: false,  // true for Mattermost Entry tier');
    console.log('      tag: "master",');
    console.log('      serviceEnvironment: "test",');
    console.log('      imageMaxAgeHours: 24,');
    console.log('      ha: false,');
    console.log('      subpath: false,');
    console.log('      env: { MM_FEATUREFLAGS_TESTFEATURE: "true" },');
    console.log('      config: { ServiceSettings: { EnableOpenServer: false } },');
    console.log('    },');
    console.log('    dependencies: ["postgres", "inbucket", "minio"],');
    console.log('    outputDir: ".tc.out",');
    console.log('    admin: {');
    console.log('      username: "sysadmin",  // email: sysadmin@sample.mattermost.com');
    console.log('      password: "Sys@dmin-sample1",');
    console.log('    },');
    console.log('  });');
    console.log(chalk.cyan('\nConfig File (mm-tc.config.jsonc):'));
    console.log(chalk.cyan('=================================='));
    console.log('  {');
    console.log('    // Mattermost server configuration');
    console.log('    "server": {');
    console.log('      "edition": "enterprise",  // "enterprise", "fips", or "team"');
    console.log('      "tag": "master",          // e.g., "master", "release-11.4"');
    console.log('      "serviceEnvironment": "test",');
    console.log('      "imageMaxAgeHours": 24,');
    console.log('      "ha": false,');
    console.log('      "subpath": false,');
    console.log('      "env": { "MM_FEATUREFLAGS_TESTFEATURE": "true" },');
    console.log('      "config": { "ServiceSettings": { "EnableOpenServer": false } }');
    console.log('    },');
    console.log('    "dependencies": ["postgres", "inbucket", "minio"],');
    console.log('    "outputDir": ".tc.out",');
    console.log('    "admin": {');
    console.log('      "username": "sysadmin",  // email: sysadmin@sample.mattermost.com');
    console.log('      "password": "Sys@dmin-sample1"');
    console.log('    }');
    console.log('  }');
    console.log(chalk.cyan('\nOutput Directory Structure:'));
    console.log(chalk.cyan('==========================='));
    console.log('  <outputDir>/                    - Base output directory (default: .tc.out)');
    console.log('    latest -> run-<timestamp>     - Symlink to most recent run');
    console.log('    run-<timestamp>/              - Timestamped run directory (epoch ms)');
    console.log('      logs/                       - Container logs directory');
    console.log('        <service>.log             - Individual container logs');
    console.log('      .env.tc                     - Environment variables for local server');
    console.log('      .tc.docker.json             - Docker container metadata');
    console.log('      .tc.server.config.json      - Server configuration (container mode)');
    console.log('      openldap_setup.md           - OpenLDAP setup docs (if enabled)');
    console.log('      keycloak_setup.md           - Keycloak setup docs (if enabled)');
    console.log('      saml-idp.crt                - Keycloak SAML certificate (if enabled)');
    console.log(chalk.cyan('\nExamples:'));
    console.log(chalk.cyan('========='));
    console.log('  mm-tc start                           # Start with defaults (enterprise)');
    console.log('  mm-tc start -D minio,elasticsearch    # Add dependencies');
    console.log('  mm-tc start -t release-11.4           # Specific tag');
    console.log('  mm-tc start -e team                   # Team edition');
    console.log('  mm-tc start -e fips                   # FIPS edition');
    console.log('  mm-tc start --ha                      # HA cluster');
    console.log('  mm-tc start --subpath                 # Subpath mode');
    console.log('  mm-tc start --entry                   # Entry tier (ignores MM_LICENSE)');
    console.log('  mm-tc start --admin                   # Create admin user');
    console.log('  mm-tc start --deps-only               # Dependencies only');
    console.log('  mm-tc start -S production             # Production env');
    console.log('  mm-tc start -E KEY=value              # Pass env var');
    console.log('  mm-tc stop                            # Stop all containers');
});
program.parse();
//# sourceMappingURL=cli.js.map
