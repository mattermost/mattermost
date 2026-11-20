// sub-routes the help page renders below its path (config pageSections reads their `url`s)
const ID_PATTERN = '[a-z0-9]{26}';

export const HELP_SECTIONS = [
    {url: 'mobile'},
    {url: 'faq/'},
    {url: `user/:user_id(${ID_PATTERN})`},
    {url: 'mobile'},
];
