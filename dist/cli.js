#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const readline = require("readline");
const yargs = require("yargs");
const parser_1 = require("./parser");
const linter_1 = require("./linter");
function readFileOptional(path) {
    return new Promise((resolve) => {
        fs_1.readFile(path, { encoding: 'utf8' }, (err, data) => {
            if (err) {
                resolve(false);
                return;
            }
            resolve(data);
        });
    });
}
function printWarnings(list) {
    if (list.length === 0) {
        console.log('0 warnings');
        return;
    }
    const indentor = (str) => (' '.repeat(2) + str);
    list.forEach((wl) => {
        console.log(wl.title);
        console.log(wl.warnings.map(indentor).join('\n'));
        console.log('\n');
    });
}
function lint(fileContent) {
    const parser = new parser_1.Parser(fileContent);
    while (parser.status === parser_1.ParserStatus.InProgress) {
        parser.advance();
    }
    if (parser.status === parser_1.ParserStatus.Done) {
        printWarnings(linter_1.Linter.fromParser(parser).lint());
    }
    else if (parser.status === parser_1.ParserStatus.FoundTrailing) {
        console.log('Syntax error in file: trailing characters');
    }
    else if (parser.status === parser_1.ParserStatus.FoundUnclosed) {
        console.log('Syntax error in file: unmatched parenthesis or bracket');
    }
}
function lintFile(path) {
    return readFileOptional(path).then((fileContent) => {
        if (fileContent === false) {
            console.log('File not found');
            return false;
        }
        if (fileContent.includes('This file uses the GRacket editor format.')) {
            console.log('The GRacket editor format is not supported.');
            return false;
        }
        lint(fileContent);
        return true;
    });
}
function main(argv) {
    return __awaiter(this, void 0, void 0, function* () {
        let lastInputPath;
        lastInputPath = false;
        if (argv._.length > 0) {
            const found = yield lintFile(argv._[0]);
            if (found) {
                lastInputPath = argv._[0];
            }
        }
        else {
            // no file argument, enter interactive mode
            argv.i = true;
        }
        while (argv.i) {
            let prompt = 'Input path of file to check';
            if (typeof lastInputPath === 'string') {
                prompt += ` [${lastInputPath}]`;
            }
            prompt += ': ';
            lastInputPath = yield new Promise((resolve) => {
                const rl = readline.createInterface(process.stdin, process.stdout);
                rl.question(prompt, (answer) => {
                    rl.close();
                    const inputPath = (answer.length === 0 ? lastInputPath : answer);
                    if (inputPath === false || inputPath.length === 0) {
                        resolve(false);
                        return;
                    }
                    lintFile(inputPath).then((found) => {
                        resolve((found ? inputPath : lastInputPath));
                    });
                });
            });
            console.log('\n');
        }
    });
}
const argv = yargs
    .usage('$0 [-i] <file>')
    .option('i', {
    describe: 'Interactive mode',
    default: false,
    type: 'boolean'
})
    .argv;
main(argv).then(() => process.exit(0));
//# sourceMappingURL=cli.js.map