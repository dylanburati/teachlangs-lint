#!/usr/bin/env node

import { readFile } from 'fs';
import * as readline from 'readline';
import * as yargs from 'yargs';
import { Parser, ParserStatus } from './parser';
import { Linter, OutputWarningList } from './linter';

function readFileOptional(path: string): Promise<string|false> {
  return new Promise((resolve) => {
    readFile(path, { encoding: 'utf8' }, (err, data) => {
      if(err) {
        resolve(false);
        return;
      }

      resolve(data);
    });
  });
}

function printWarnings(list: OutputWarningList[]): void {
  if(list.length === 0) {
    console.log('0 warnings');
    return;
  }

  const indentor = (str: string) => (' '.repeat(2) + str);
  list.forEach((wl: OutputWarningList) => {
    console.log(wl.title);
    console.log(wl.warnings.map(indentor).join('\n'));
    console.log('\n');
  });
}

function lint(fileContent: string): void {
  const parser = new Parser(fileContent);
  while(parser.status === ParserStatus.InProgress) {
    parser.advance();
  }
  if(parser.status === ParserStatus.Done) {
    printWarnings(Linter.fromParser(parser).lint());
  } else if(parser.status === ParserStatus.FoundTrailing) {
    console.log('Syntax error in file: trailing characters');
  } else if(parser.status === ParserStatus.FoundUnclosed) {
    console.log('Syntax error in file: unmatched parenthesis or bracket');
  }
}

function lintFile(path: string): Promise<boolean> {
  return readFileOptional(path).then((fileContent: string|false) => {
    if(fileContent === false) {
      console.log('File not found');
      return false;
    }

    if(fileContent.includes('This file uses the GRacket editor format.')) {
      console.log('The GRacket editor format is not supported.');
      return false;
    }

    lint(fileContent);
    return true;
  });
}

interface CLIArguments {
  i: boolean,
  _: string[]
}

async function main(argv: CLIArguments): Promise<void> {
  let lastInputPath: string|false;
  lastInputPath = false;

  if(argv._.length > 0) {
    const found = await lintFile(argv._[0]);
    if(found) {
      lastInputPath = argv._[0];
    }
  } else {
    // no file argument, enter interactive mode
    argv.i = true;
  }

  while(argv.i) {
    let prompt = 'Input path of file to check';
    if(typeof lastInputPath === 'string') {
      prompt += ` [${lastInputPath}]`;
    }
    prompt += ': ';

    lastInputPath = await new Promise((resolve) => {
      const rl = readline.createInterface(process.stdin, process.stdout);
      rl.question(prompt, (answer) => {
        rl.close();
        const inputPath = (answer.length === 0 ? lastInputPath : answer);
        if(inputPath === false || inputPath.length === 0) {
          resolve(false);
          return;
        }

        lintFile(inputPath).then((found: boolean) => {       
          resolve((found ? inputPath : lastInputPath));
        });
      });
    });

    console.log('\n');
  }
}

const argv: CLIArguments = yargs
  .usage('$0 [-i] <file>')
  .option('i', {
    describe: 'Interactive mode',
    default: false,
    type: 'boolean'
  })
  .argv;

main(argv).then(() => process.exit(0));
