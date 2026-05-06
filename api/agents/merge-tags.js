'use strict';
const YAML = require('yaml');
const fs = require('fs');

class MergeTags {
    constructor() {}

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
        throw new Error('no readable input introduction file found');
    }

    run(args) {
        const input = this.firstReadable(args.slice(2));
        const parsed = this.readFile(input);
        const tags = this.readFile('tags.yaml');

        if ('tags' in parsed) {
            parsed.tags.push(...tags.tags);
        }
        if ('x-tagGroups' in parsed) {
            parsed['x-tagGroups'].push(...tags['x-tagGroups']);
        }

        const yamlString = YAML.stringify(parsed, { lineWidth: 0 }).
            replace(/^paths:.*null.*$/mg, 'paths: ');
        fs.writeFileSync('merged-tags.yaml', yamlString);
        console.log('wrote file merged-tags.yaml');
    }
}

new MergeTags().run(process.argv);
