"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("./parser");
const linter_1 = require("./linter");
function lint(fileContent) {
    return new Promise((resolve, reject) => {
        const parser = new parser_1.Parser(fileContent);
        while (parser.status === parser_1.ParserStatus.InProgress) {
            parser.advance();
        }
        if (parser.status === parser_1.ParserStatus.Done) {
            resolve(linter_1.Linter.fromParser(parser).lint());
        }
        else if (parser.status === parser_1.ParserStatus.FoundTrailing) {
            reject('Syntax error in file: trailing characters');
        }
        else if (parser.status === parser_1.ParserStatus.FoundUnclosed) {
            reject('Syntax error in file: unmatched parenthesis or bracket');
        }
        else {
            reject('Unknown error');
        }
    });
}
exports.lint = lint;
//# sourceMappingURL=index.js.map