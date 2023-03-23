import {CodegenConfig} from '@graphql-codegen/cli';

const config: CodegenConfig = {
    overwrite: true,
    schema: '../server/api/schema.graphqls',
    documents: ['src/graphql/*.graphql', 'src/**/*.tsx', '!src/graphql/generated/**/*'],
    generates: {
        'src/graphql/generated/': {
            preset: 'client',
            plugins: [],
            presetConfig: {
                fragmentMasking: {unmaskFunctionName: 'getFragmentData'},
            },
        },
    },
    hooks: {
        afterAllFileWrite: 'eslint --fix',
    },
};

// ts-prune-ignore-next
export default config;
