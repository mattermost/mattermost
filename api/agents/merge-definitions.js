'use strict';
const YAML = require('yaml');
const fs = require('fs');

class MergeDefinitions {
    constructor() {}

    writeFile(filename, data) {
        fs.writeFileSync(filename, YAML.stringify(data, { lineWidth: 0 }).trimEnd());
        console.log('wrote file ' + filename);
    }

    readFile(filename) {
        const rawYaml = fs.readFileSync(filename);
        console.log('read file ' + filename);
        return YAML.parse(rawYaml.toString());
    }

    firstReadable(filenames) {
        for (const filename of filenames) {
            if (filename && fs.existsSync(filename)) {
                return filename;
            }
        }
        throw new Error('no readable input definitions file found');
    }

    mergeSection(target, section, filename) {
        if (!fs.existsSync(filename)) {
            return;
        }
        const data = this.readFile(filename);
        target.components[section] = Object.assign(target.components[section] || {}, data || {});
    }

    run(args) {
        const input = this.firstReadable(args.slice(2));
        const parsed = this.readFile(input);

        if (!parsed.components) {
            parsed.components = {};
        }

        this.mergeSection(parsed, 'schemas', 'schemas.yaml');
        this.mergeSection(parsed, 'responses', 'responses.yaml');
        this.mergeSection(parsed, 'securitySchemes', 'securitySchemes.yaml');
        this.mergeSection(parsed, 'parameters', 'parameters.yaml');
        this.mergeSection(parsed, 'requestBodies', 'requestBodies.yaml');

        this.writeFile('merged-definitions.yaml', parsed);
    }
}

new MergeDefinitions().run(process.argv);
