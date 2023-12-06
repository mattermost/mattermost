// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const Files: Record<string, string[]> = {
    AUDIO_TYPES: ['mp3', 'wav', 'wma', 'm4a', 'flac', 'aac', 'ogg'],
    CODE_TYPES: ['as', 'applescript', 'osascript', 'scpt', 'bash', 'sh', 'zsh', 'clj', 'boot', 'cl2', 'cljc', 'cljs', 'cljs.hl', 'cljscm', 'cljx', 'hic', 'coffee', '_coffee', 'cake', 'cjsx', 'cson', 'iced', 'cpp', 'c', 'cc', 'h', 'c++', 'h++', 'hpp', 'cs', 'csharp', 'css', 'd', 'di', 'dart', 'delphi', 'dpr', 'dfm', 'pas', 'pascal', 'freepascal', 'lazarus', 'lpr', 'lfm', 'diff', 'django', 'jinja', 'dockerfile', 'docker', 'erl', 'f90', 'f95', 'fsharp', 'fs', 'gcode', 'nc', 'go', 'groovy', 'handlebars', 'hbs', 'html.hbs', 'html.handlebars', 'hs', 'hx', 'java', 'jsp', 'js', 'jsx', 'json', 'jl', 'kt', 'ktm', 'kts', 'less', 'lisp', 'lua', 'mk', 'mak', 'md', 'mkdown', 'mkd', 'matlab', 'm', 'mm', 'objc', 'obj-c', 'ml', 'perl', 'pl', 'php', 'php3', 'php4', 'php5', 'php6', 'ps', 'ps1', 'pp', 'py', 'gyp', 'r', 'ruby', 'rb', 'gemspec', 'podspec', 'thor', 'irb', 'rs', 'scala', 'scm', 'sld', 'scss', 'st', 'sql', 'swift', 'tex', 'vbnet', 'vb', 'bas', 'vbs', 'v', 'veo', 'xml', 'html', 'xhtml', 'rss', 'atom', 'xsl', 'plist', 'yaml'],
    IMAGE_TYPES: ['jpg', 'gif', 'bmp', 'png', 'jpeg', 'tiff', 'tif'],
    PATCH_TYPES: ['patch'],
    PDF_TYPES: ['pdf'],
    PRESENTATION_TYPES: ['ppt', 'pptx'],
    SPREADSHEET_TYPES: ['xlsx', 'csv'],
    TEXT_TYPES: ['txt', 'rtf'],
    VIDEO_TYPES: ['mp4', 'avi', 'webm', 'mkv', 'wmv', 'mpg', 'mov', 'flv'],
    WORD_TYPES: ['doc', 'docx'],
};

export default Files;
