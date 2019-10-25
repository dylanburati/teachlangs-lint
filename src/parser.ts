// Represents the type of a Racket atom or expression
type AtomType = 'LineComment' |
    'BlockComment' |
    'String' |
    'Number' |
    'Symbol' |
    'Variable';

type RacketParserStep = AtomType | 'ExpressionStart' | 'ExpressionEnd';

interface Atom {
  kind: AtomType;
  source: string;
}

interface Expr {
  kind: 'Expression';
  children: RacketNode[];
}

type RacketNode = Atom | Expr;

function racketNodeToString(node: RacketNode): string {
  if(node.kind === 'Expression') {
    return `(${node.children.map(racketNodeToString).join(' ')})`;
  }

  return node.source;
}

interface StringIndices {
  index: number,
  length: number
}

interface StringMatch {
  index: number,
  length: number,
  match: string
}

interface Token {
  step: RacketParserStep,
  span: StringMatch
}

// Returns true if the first pair starts before the second, or if they have
// the same start point but the first is at least as long as the second.
function compareStringIndices(indices1: StringIndices | null, indices2: StringIndices): boolean {
  if(indices1 == null) {
    return false;
  }

  return (indices1.index < indices2.index) ||
      (indices1.index === indices2.index && indices1.length >= indices2.length);
}

function normalizeRegExpExec(rexec: RegExpExecArray): StringMatch {
  return {
    index: rexec.index,
    length: rexec[0].length,
    match: rexec[0]
  };
}

const regexps: Map<RacketParserStep, RegExp> = new Map();
regexps.set('LineComment', /;.*?$/m);
regexps.set('BlockComment', /#\|.*?\|#/);
regexps.set('ExpressionStart', /[[(]/);
regexps.set('ExpressionEnd', /[\])]/);
regexps.set('String', /"(?:"|(?:[^"]+?)*(?:\\\\"|[^\\]"))/);
regexps.set('Number', /[-+]?(?:[0-9]+(?:\.?[0-9]*)?|\.[0-9]+)(?:e[-+]?[0-9]+)?/);
regexps.set('Symbol', /'[^\][(){}|\s ,`"'#][^\][(){}|\s ,`"'#]*/);
regexps.set('Variable', /[^\][(){}|\s ,`"'#][^\][(){}|\s ,`"'#]*/);

function findNearestRacketNode(code: string): Token | false {
  let stepFound: RacketParserStep | false;
  stepFound = false;
  let matchFound: StringMatch | null;
  matchFound = null;

  regexps.forEach((re: RegExp, step: RacketParserStep) => {
    const rexec = re.exec(code);
    if(rexec != null) {
      const match = normalizeRegExpExec(rexec);
      if(!compareStringIndices(matchFound, match)) {
        matchFound = match;
        stepFound = step;
      }
    }
  });

  if(stepFound === false || matchFound == null) {
    return false;
  }

  return {
    step: stepFound,
    span: matchFound
  };
}

function emptyExpression(): Expr {
  return {
    kind: 'Expression',
    children: []
  };
}

enum ParserStatus {
  InProgress,
  Done,
  FoundUnclosed,
  FoundTrailing
}

/**
 * Class to incrementally parse the given Student Language string, and store
 * the syntax tree under `root`.
 */
class Parser {
  code: string;
  root: Expr;
  contextStack: Expr[];
  context: Expr;
  status: ParserStatus;

  constructor(code: string) {
    this.code = code;
    this.root = emptyExpression();
    this.contextStack = [];
    this.context = this.root;
    this.status = ParserStatus.InProgress;
  }

  advance(): void {
    if(this.status !== ParserStatus.InProgress) {
      throw new Error('Parser can not advance past last context');
    }

    const token = findNearestRacketNode(this.code);
    if(token === false) {
      if(this.contextStack.length === 0) {
        // finished at top level
        this.status = ParserStatus.Done;
      } else {
        // finished, but the current expression is not closed
        this.status = ParserStatus.FoundUnclosed;
      }
      return;
    }

    if(token.step === 'ExpressionStart') {
      const nested = emptyExpression();
      this.context.children.push(nested);
      this.contextStack.push(this.context);
      this.context = nested;
    } else if(token.step === 'ExpressionEnd') {
      const parentCtx = this.contextStack.pop();
      if(parentCtx == null) {
        this.status = ParserStatus.FoundTrailing;
        return;
      }

      this.context = parentCtx;
    } else {
      // atom
      this.context.children.push({
        kind: token.step,
        source: token.span.match
      });
    }

    // consume the current token
    this.code = this.code.substring(token.span.index + token.span.length);
  }

  getLastRacketNode(): RacketNode | null {
    if(this.context.children.length > 0) {
      return this.context.children[this.context.children.length - 1];
    }
    return null;
  }
}

export {
  racketNodeToString,
  compareStringIndices,
  findNearestRacketNode,
  Atom,
  Expr,
  RacketNode,
  Token,
  ParserStatus,
  Parser
};
