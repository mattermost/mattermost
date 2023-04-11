module.exports = {
    "stories": [
        "../**/*.stories.mdx",
        "../**/*.stories.@(js|jsx|ts|tsx)"
    ],
    "addons": [
        "@storybook/addon-links",
        "@storybook/addon-essentials",
        "@storybook/addon-interactions"
    ],
    "framework": "@storybook/react",
    "webpackFinal": async (config) => {
        return {
            ...config,
            resolve: {
                ...config.resolve,
                alias: {
                    '@mui/styled-engine': '@mui/styled-engine-sc',
                },
            }
        };
    },
};
