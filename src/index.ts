import { Parser, ParserStatus } from './parser';
import { Linter, OutputWarningList } from './linter';

function lint(fileContent: string): Promise<OutputWarningList[]> {
  return new Promise((resolve, reject) => {
    const parser = new Parser(fileContent);
    while(parser.status === ParserStatus.InProgress) {
      parser.advance();
    }
    if(parser.status === ParserStatus.Done) {
      resolve(Linter.fromParser(parser).lint());
    } else if(parser.status === ParserStatus.FoundTrailing) {
      reject('Syntax error in file: trailing characters');
    } else if(parser.status === ParserStatus.FoundUnclosed) {
      reject('Syntax error in file: unmatched parenthesis or bracket');
    } else {
      reject('Unknown error');
    }
  });
}

export { OutputWarningList, lint }
