import {
  Atom, Expr, RacketNode, Parser, ParserStatus, racketNodeToString
} from './parser';

interface GeneralWarningList {
  kind: 'General'
  warnings: string[];
}

interface FunctionDesign {
  kind: 'FunctionDesign'
  name: string;
  purposeLines: number;
  tests: number;
  warnings: string[];
}

interface OutputWarningList {
  kind: 'Output'
  title: string;
  warnings: string[];
}

type WarningList = GeneralWarningList | FunctionDesign;

function emptyFunctionDesign(): FunctionDesign {
  return {
    kind: 'FunctionDesign',
    name: '',
    purposeLines: 0,
    tests: 0,
    warnings: []
  };
}

function isMatch(object: object, source: object): boolean {
  return Object.entries(source).every(([key, val]) => (object as any)[key] === val);
}

function tryParseSignature(node: RacketNode): FunctionDesign | false {
  if(node.kind === 'LineComment' && node.source.includes(':') && node.source.includes('->')) {
    const commentAsSig = `(${node.source.replace(/^[; ]+/, '').replace(':', ' : ')})`;
    const parser = new Parser(commentAsSig);
    while(parser.status === ParserStatus.InProgress) {
      parser.advance();
    }

    if(parser.status === ParserStatus.Done && parser.root.children.length > 0) {
      const parsedSig = parser.root.children[0];
      const colon: Atom = { kind: 'Variable', source: ':' };
      const arrow: Atom = { kind: 'Variable', source: '->' };

      if(parsedSig.kind === 'Expression' &&
          parsedSig.children.length > 3 &&
          parsedSig.children[0].kind === 'Variable' &&
          isMatch(parsedSig.children[1], colon)) {
        
        const arrowIndices = parsedSig.children.map((e, i) => isMatch(e, arrow) ? i : -1)
            .filter(n => (n >= 0));
        if(arrowIndices.length !== 1) {
          return false;
        }

        if(parsedSig.children[0].source.endsWith('-temp') &&
            parsedSig.children.some(c => (c.kind === 'Variable' && /^\?+$/.test(c.source)))) {
          // This signature is for a template, should not return a function design
          return false;
        }

        const fnDef = emptyFunctionDesign();
        fnDef.name = parsedSig.children[0].source;
        return fnDef;
      }
    }
  }

  return false;
}

function racketNodeIsConstant(node: RacketNode): boolean {
  const define: Atom = { kind: 'Variable', source: 'define' };

  return (node.kind === 'Expression' &&
      isMatch(node.children[0], define) &&
      node.children[1].kind === 'Variable' &&
      /^[A-Z0-9-]+$/.test(node.children[1].source));
}

function racketNodeHasTemplateVars(node: RacketNode): boolean {
  if(node.kind === 'Variable') {
    return /^\.{2,6}$/.test(node.source);
  } if(node.kind === 'Expression') {
    return (node.children.find(racketNodeHasTemplateVars) != null);
  }

  return false;
}

interface TestDef {
  actual: RacketNode;
}

const TEST_FUNCTION_NAMES = [
  'check-expect',
  'check-random',
  'check-satisfied',
  'check-within',
  'check-error',
  'check-member-of',
  'check-range'
];

function tryGetTestDef(node: RacketNode): TestDef | false {
  if(node.kind === 'Expression' &&
      node.children.length >= 3 &&
      node.children[0].kind === 'Variable' &&
      (TEST_FUNCTION_NAMES.includes(node.children[0].source))) {
    return {
      actual: node.children[1]
    };
  }

  return false;
}

interface FunctionDef {
  name: string;
  argNames: string[];
  isTemplate: boolean;
  body: RacketNode
}

interface FunctionCall {
  name: string,
  body: Expr
}

interface FunctionCallSearch {
  calls: FunctionCall[];
  stop: boolean
}

function searchRacketFunctionCalls(node: Expr, stopWhen: (c: FunctionCall) => boolean): FunctionCallSearch {
  
  const search: FunctionCallSearch = {
    calls: [],
    stop: false
  };
  let minChildWithCall = 0;
  if(node.children[0].kind === 'Variable') {
    const currentCall = {
      name: node.children[0].source,
      body: node
    };
    search.calls.push(currentCall);
    search.stop = stopWhen(currentCall);
    if(search.stop) {
      return search;
    }
    minChildWithCall = 1;
  }

  for(let i = minChildWithCall; i < node.children.length; i++) {
    const child = node.children[i];
    if(child.kind === 'Expression') {
      const dfs = searchRacketFunctionCalls(child, stopWhen);
      search.calls.push(...dfs.calls);
      search.stop = dfs.stop;
      if(search.stop) {
        return search;
      }
    }
  }

  return search;
}

function getRacketFunctionCalls(node: RacketNode): FunctionCall[] {
  if(node.kind !== 'Expression') {
    return [];
  }

  return searchRacketFunctionCalls(node, () => false).calls;
}

function findRacketFunctionCall(node: RacketNode, predicate: (c: FunctionCall) => boolean): FunctionCall | null {
  if(node.kind !== 'Expression') {
    return null;
  }

  const search = searchRacketFunctionCalls(node, predicate);
  if(!search.stop || search.calls.length === 0) {
    return null;
  }
  return search.calls[search.calls.length - 1];
}

function tryGetFunctionDef(node: RacketNode): FunctionDef | false {
  const define: Atom = { kind: 'Variable', source: 'define' };

  if(node.kind === 'Expression' &&
      node.children.length === 3 &&
      isMatch(node.children[0], define) &&
      node.children[1].kind === 'Expression' &&
      node.children[1].children.length > 0) {
    
    const shorthand = node.children[1];
    for(let i = 0; i < shorthand.children.length; i++) {
      if(shorthand.children[i].kind !== 'Variable') {
        return false;
      }
    }
    const names = (shorthand.children as Atom[]).map(e => e.source);

    return {
      name: names[0],
      argNames: names.slice(1),
      isTemplate: racketNodeHasTemplateVars(node),
      body: node.children[2]
    };
  }

  return false;
}

class ChainedCond<T, R> {
  actionArg: T | false;
  result: R | false;

  constructor(predicate: () => T | false, action: (actionArg: T) => R) {
    this.actionArg = predicate();
    if(this.actionArg !== false) {
      this.result = action(this.actionArg);
    } else {
      this.result = false;
    }
  }

  or<T2, R2>(predicate: () => T2 | false, action: (actionArg: T2) => R2):
  ChainedCond<T, R> | ChainedCond<T2, R2> {
    
    if(this.actionArg !== false) {
      return this;
    }
    return new ChainedCond(predicate, action);
  }
}

class Linter {
  remainingNodes: RacketNode[];
  messages: [WarningList, ...WarningList[]];
  templates: FunctionDef[];
  testThreshold: number;

  static fromParser(parser: Parser) {
    if(parser.status !== ParserStatus.Done) {
      throw new Error("Can't create linter for unfinished parser");
    }
    return new Linter(parser.root.children.slice());
  }

  constructor(nodeList: RacketNode[], options?: { testThreshold?: number }) {
    this.remainingNodes = nodeList;
    this.messages = [
      {
        kind: 'General',
        warnings: []
      }
    ];
    this.templates = [];
    this.testThreshold = 2;
    if(options != null && options.testThreshold != null) {
      this.testThreshold = options.testThreshold;
    }
  }

  requireCurrentFunctionDesign(): FunctionDesign {
    const fnd = this.messages[this.messages.length - 1];
    if(fnd.kind !== 'FunctionDesign') {
      throw new Error('The warning list at the current position is not a FunctionDesign');
    }
    return fnd;
  }

  /**
   * 
   */
  getOutputWarningLists(): OutputWarningList[] {
    const foundWarnings = this.messages.filter((wl: WarningList) => (wl.warnings.length > 0));
    return foundWarnings.map((wl: WarningList) => {
      const o: OutputWarningList = {
        kind: 'Output',
        title: (wl.kind === 'FunctionDesign' ? `In function design for ${wl.name}` : 'Before first function design'),
        warnings: wl.warnings
      };
      return o;
    });
  }

  /**
   * Iterate over `remainingNodes`, and return all the non-empty warning lists
   * 
   */
  lint(): OutputWarningList[] {
    while(this.remainingNodes.length > 0) {
      this.addSignature();
      if(this.remainingNodes.length > 0) {
        this.addPurposeLines();
        this.addTests();
        this.finalize(this.requireCurrentFunctionDesign());
      }
    }

    return this.getOutputWarningLists();
  }

  /**
   * Generate the final warnings for the given function design.
   *
   * @param fnDesign The FunctionDesign
   */
  finalize(fnDesign: FunctionDesign): void {
    if(fnDesign.purposeLines < 1) {
      fnDesign.warnings.push('no purpose statement');
    }
    if(fnDesign.tests < this.testThreshold) {
      fnDesign.warnings.push(`only ${fnDesign.tests} tests`);
    }
  }

  /**
   * Generate warnings for a function body
   * 
   * @param fnDef The function definition
   */
  getBodyWarnings(fnDef: FunctionDef): string[] {
    const calls = getRacketFunctionCalls(fnDef.body);
    const bodyWarnings: string[] = [];
    calls.filter(c => (c.name === 'local')).forEach((c, i) => {
      if(c.body.children.length >= 2 &&
        c.body.children[1].kind === 'Expression') {

        const localLinter = new Linter(c.body.children[1].children.slice(), { testThreshold: 0 });
        localLinter.lint();
        localLinter.messages.filter((wl: WarningList) => (wl.warnings.length > 0))
          .forEach(wl => {
            const prependor = (str: string) => {
              const secondPart = str.replace(/^within local .*: /, '');
              if(wl.kind === 'FunctionDesign') {
                return `within local def of ${wl.name}: ${secondPart}`;
              } else {
                return `within local: ${secondPart}`;
              }
            }
            bodyWarnings.push(...wl.warnings.map(prependor));
          });
      }
    });

    return bodyWarnings;
  }

  /**
   * Take nodes from `remainingNodes` until the next signature,
   * then set the current function design.
   *
   * - is a signature -> consume, return
   * - is a test -> warning, skip
   * - is a function definition -> warning, skip
   * - else skip
   */
  addSignature(): void {
    while(this.remainingNodes.length > 0) {
      // always removes
      const [node] = this.remainingNodes.splice(0, 1);
      const warningList = this.messages[this.messages.length - 1];

      const fnDesign = tryParseSignature(node);
      if(fnDesign !== false) {
        this.messages.push(fnDesign);
        return;
      }

      new ChainedCond(
        () => tryGetFunctionDef(node), (fnDef: FunctionDef) => {
          if(fnDef.isTemplate) {
            this.templates.push(fnDef);
          } else {
            warningList.warnings.push(`unexpected function definition for ${fnDef.name}`);
            warningList.warnings.push(...this.getBodyWarnings(fnDef));
          }
        })
        .or(() => tryGetTestDef(node), (testDef: TestDef) => {
          warningList.warnings.push(`unexpected test: ${racketNodeToString(node)}`);
        });
    }
  }

  /**
   * Take nodes from `remainingNodes` until the end of the purpose lines,
   * updating the purpose lines field of the current function design.
   *
   * - LineComment or BlockComment -> consume
   * - is a constant -> skip
   * - else return
   */
  addPurposeLines(): void {
    const fnDesign = this.requireCurrentFunctionDesign();

    while(this.remainingNodes.length > 0) {
      const node = this.remainingNodes[0];

      if(node.kind === 'LineComment' || node.kind === 'BlockComment') {
        fnDesign.purposeLines += 1;
        this.remainingNodes.splice(0, 1);
      } else if(racketNodeIsConstant(node)) {
        this.remainingNodes.splice(0, 1);
      } else {
        return;
      }
    }
  }

  /**
   * Take nodes from `remainingNodes` until the end of the function design (the start of the
   * next signature). Updates the tests field of the current function design.
   *
   * - is a test -> consume
   * - is a function definition -> conditional warning, skip
   * - is a signature -> return
   * - else skip
   */
  addTests(): void {
    const fnDesign = this.requireCurrentFunctionDesign();

    while(this.remainingNodes.length > 0) {
      const node = this.remainingNodes[0];
      const nextFnDesign = tryParseSignature(node);
      if(nextFnDesign !== false) {
        return;
      }

      this.remainingNodes.splice(0, 1);
      new ChainedCond(
        () => tryGetFunctionDef(node), (fnDef: FunctionDef) => {
          if(fnDef.isTemplate) {
            this.templates.push(fnDef);
          } else {
            if(findRacketFunctionCall(fnDef.body, (fnCall) => (fnCall.name === 'big-bang')) != null) {
              // ignore test count warning for big bang
              fnDesign.tests = 1000;
            }
    
            if(fnDef.name !== fnDesign.name) {
              fnDesign.warnings.push(`unexpected function definition for ${fnDef.name}`);
            }
            fnDesign.warnings.push(...this.getBodyWarnings(fnDef));
          }
        })
        .or(() => tryGetTestDef(node), (testDef: TestDef) => {
          fnDesign.tests += 1;
          if(findRacketFunctionCall(testDef.actual, (fnCall) => (fnCall.name === fnDesign.name)) == null) {
            fnDesign.warnings.push(
              `expected test to call ${fnDesign.name}: ${racketNodeToString(node)}`
            );
          }
        });
    }
  }
}

export {
  GeneralWarningList, FunctionDesign, emptyFunctionDesign, OutputWarningList,
  tryParseSignature, racketNodeIsConstant, racketNodeHasTemplateVars, TestDef, tryGetTestDef,
  FunctionDef, tryGetFunctionDef, Linter,
};
