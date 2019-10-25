module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "extends": [
        "airbnb-base"
    ],
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": 2018,
        "sourceType": "module"
    },
    "plugins": [
        "@typescript-eslint"
    ],
    "rules": {
        "linebreak-style": "off",
        "quotes": ["error", "single", { avoidEscape: true }],
        "comma-dangle": "off",
        "lines-between-class-members": ["error", "always", { exceptAfterSingleLine: true }],
        "no-multi-spaces": ["error", { ignoreEOLComments: true }],
        "keyword-spacing": ["error", { "overrides": {
            "if": { "after": false },
            "for": { "after": false },
            "while": { "after": false },
            "catch": { "after": false }
        } }],
        "operator-linebreak": ["error", "after"],
        "no-plusplus": ["error", { "allowForLoopAfterthoughts": true }]
    }
};