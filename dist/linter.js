import { isMatch, matches } from 'lodash';
import { Parser, ParserStatus, racketNodeToString } from './parser';
function emptyFunctionDesign() {
    return {
        kind: 'FunctionDesign',
        name: '',
        purposeLines: 0,
        tests: 0,
        warnings: []
    };
}
function tryParseSignature(node) {
    if (node.kind === 'LineComment' && node.source.includes(':') && node.source.includes('->')) {
        const commentAsSig = `(${node.source.replace(';', '').replace(':', ' : ')})`;
        const parser = new Parser(commentAsSig);
        while (parser.status === ParserStatus.InProgress) {
            parser.advance();
        }
        if (parser.status === ParserStatus.Done && parser.root.children.length > 0) {
            const parsedSig = parser.root.children[0];
            const colon = { kind: 'Variable', source: ':' };
            const arrow = { kind: 'Variable', source: '->' };
            if (parsedSig.kind === 'Expression' &&
                parsedSig.children.length > 3 &&
                parsedSig.children[0].kind === 'Variable' &&
                isMatch(parsedSig.children[1], colon)) {
                const arrowIndices = parsedSig.children.map(matches(arrow));
                const arrowIdx = arrowIndices.indexOf(true);
                if (arrowIdx !== arrowIndices.lastIndexOf(true)) {
                    return false;
                }
                if (parsedSig.children[0].source.endsWith('-temp') &&
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
function racketNodeIsConstant(node) {
    const define = { kind: 'Variable', source: 'define' };
    return (node.kind === 'Expression' &&
        isMatch(node.children[0], define) &&
        node.children[1].kind === 'Variable' &&
        /^[A-Z0-9-]+$/.test(node.children[1].source));
}
function racketNodeHasTemplateVars(node) {
    if (node.kind === 'Variable') {
        return /^\.{2,6}$/.test(node.source);
    }
    if (node.kind === 'Expression') {
        return (node.children.find(racketNodeHasTemplateVars) != null);
    }
    return false;
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
function tryGetTestDef(node) {
    if (node.kind === 'Expression' &&
        node.children.length >= 3 &&
        node.children[0].kind === 'Variable' &&
        (TEST_FUNCTION_NAMES.includes(node.children[0].source))) {
        return {
            actual: node.children[1]
        };
    }
    return false;
}
function searchRacketFunctionCalls(node, stopWhen) {
    const search = {
        calls: [],
        stop: false
    };
    let minChildWithCall = 0;
    if (node.children[0].kind === 'Variable') {
        const currentCall = {
            name: node.children[0].source,
            body: node
        };
        search.calls.push(currentCall);
        search.stop = stopWhen(currentCall);
        if (search.stop) {
            return search;
        }
        minChildWithCall = 1;
    }
    for (let i = minChildWithCall; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.kind === 'Expression') {
            const dfs = searchRacketFunctionCalls(child, stopWhen);
            search.calls.push(...dfs.calls);
            search.stop = dfs.stop;
            if (search.stop) {
                return search;
            }
        }
    }
    return search;
}
function getRacketFunctionCalls(node) {
    if (node.kind !== 'Expression') {
        return [];
    }
    return searchRacketFunctionCalls(node, () => false).calls;
}
function findRacketFunctionCall(node, predicate) {
    if (node.kind !== 'Expression') {
        return null;
    }
    const search = searchRacketFunctionCalls(node, predicate);
    if (!search.stop || search.calls.length === 0) {
        return null;
    }
    return search.calls[search.calls.length - 1];
}
function tryGetFunctionDef(node) {
    const define = { kind: 'Variable', source: 'define' };
    if (node.kind === 'Expression' &&
        node.children.length === 3 &&
        isMatch(node.children[0], define) &&
        node.children[1].kind === 'Expression' &&
        node.children[1].children.length > 0) {
        const shorthand = node.children[1];
        for (let i = 0; i < shorthand.children.length; i++) {
            if (shorthand.children[i].kind !== 'Variable') {
                return false;
            }
        }
        const names = shorthand.children.map(e => e.source);
        return {
            name: names[0],
            argNames: names.slice(1),
            isTemplate: racketNodeHasTemplateVars(node),
            body: node.children[2]
        };
    }
    return false;
}
class ChainedCond {
    constructor(predicate, action) {
        this.actionArg = predicate();
        if (this.actionArg !== false) {
            this.result = action(this.actionArg);
        }
        else {
            this.result = false;
        }
    }
    or(predicate, action) {
        if (this.actionArg !== false) {
            return this;
        }
        return new ChainedCond(predicate, action);
    }
}
class Linter {
    constructor(nodeList, options) {
        this.remainingNodes = nodeList;
        this.messages = [
            {
                kind: 'General',
                warnings: []
            }
        ];
        this.templates = [];
        this.testThreshold = 2;
        if (options != null && options.testThreshold != null) {
            this.testThreshold = options.testThreshold;
        }
    }
    static fromParser(parser) {
        if (parser.status !== ParserStatus.Done) {
            throw new Error("Can't create linter for unfinished parser");
        }
        return new Linter(parser.root.children.slice());
    }
    requireCurrentFunctionDesign() {
        const fnd = this.messages[this.messages.length - 1];
        if (fnd.kind !== 'FunctionDesign') {
            throw new Error('The warning list at the current position is not a FunctionDesign');
        }
        return fnd;
    }
    /**
     *
     */
    getOutputWarningLists() {
        const foundWarnings = this.messages.filter((wl) => (wl.warnings.length > 0));
        return foundWarnings.map((wl) => {
            const o = {
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
    lint() {
        while (this.remainingNodes.length > 0) {
            this.addSignature();
            if (this.remainingNodes.length > 0) {
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
    finalize(fnDesign) {
        if (fnDesign.purposeLines < 1) {
            fnDesign.warnings.push('no purpose statement');
        }
        if (fnDesign.tests < this.testThreshold) {
            fnDesign.warnings.push(`only ${fnDesign.tests} tests`);
        }
    }
    /**
     * Generate warnings for a function body
     *
     * @param fnDef The function definition
     */
    getBodyWarnings(fnDef) {
        const calls = getRacketFunctionCalls(fnDef.body);
        const bodyWarnings = [];
        calls.filter(c => (c.name === 'local')).forEach((c, i) => {
            if (c.body.children.length >= 2 &&
                c.body.children[1].kind === 'Expression') {
                const localLinter = new Linter(c.body.children[1].children.slice(), { testThreshold: 0 });
                localLinter.lint();
                localLinter.messages.filter((wl) => (wl.warnings.length > 0))
                    .forEach(wl => {
                    const prependor = (str) => {
                        const secondPart = str.replace(/^within local .*: /, '');
                        if (wl.kind === 'FunctionDesign') {
                            return `within local def of ${wl.name}: ${secondPart}`;
                        }
                        else {
                            return `within local: ${secondPart}`;
                        }
                    };
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
    addSignature() {
        while (this.remainingNodes.length > 0) {
            // always removes
            const [node] = this.remainingNodes.splice(0, 1);
            const warningList = this.messages[this.messages.length - 1];
            const fnDesign = tryParseSignature(node);
            if (fnDesign !== false) {
                this.messages.push(fnDesign);
                return;
            }
            new ChainedCond(() => tryGetFunctionDef(node), (fnDef) => {
                if (fnDef.isTemplate) {
                    this.templates.push(fnDef);
                }
                else {
                    warningList.warnings.push(`unexpected function definition for ${fnDef.name}`);
                    warningList.warnings.push(...this.getBodyWarnings(fnDef));
                }
            })
                .or(() => tryGetTestDef(node), (testDef) => {
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
    addPurposeLines() {
        const fnDesign = this.requireCurrentFunctionDesign();
        while (this.remainingNodes.length > 0) {
            const node = this.remainingNodes[0];
            if (node.kind === 'LineComment' || node.kind === 'BlockComment') {
                fnDesign.purposeLines += 1;
                this.remainingNodes.splice(0, 1);
            }
            else if (racketNodeIsConstant(node)) {
                this.remainingNodes.splice(0, 1);
            }
            else {
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
    addTests() {
        const fnDesign = this.requireCurrentFunctionDesign();
        while (this.remainingNodes.length > 0) {
            const node = this.remainingNodes[0];
            const nextFnDesign = tryParseSignature(node);
            if (nextFnDesign !== false) {
                return;
            }
            this.remainingNodes.splice(0, 1);
            new ChainedCond(() => tryGetFunctionDef(node), (fnDef) => {
                if (fnDef.isTemplate) {
                    this.templates.push(fnDef);
                }
                else {
                    if (findRacketFunctionCall(fnDef.body, (fnCall) => (fnCall.name === 'big-bang')) != null) {
                        // ignore test count warning for big bang
                        fnDesign.tests = 1000;
                    }
                    if (fnDef.name !== fnDesign.name) {
                        fnDesign.warnings.push(`unexpected function definition for ${fnDef.name}`);
                    }
                    fnDesign.warnings.push(...this.getBodyWarnings(fnDef));
                }
            })
                .or(() => tryGetTestDef(node), (testDef) => {
                fnDesign.tests += 1;
                if (findRacketFunctionCall(testDef.actual, (fnCall) => (fnCall.name === fnDesign.name)) == null) {
                    fnDesign.warnings.push(`expected test to call ${fnDesign.name}: ${racketNodeToString(node)}`);
                }
            });
        }
    }
}
export { emptyFunctionDesign, tryParseSignature, racketNodeIsConstant, racketNodeHasTemplateVars, tryGetTestDef, tryGetFunctionDef, Linter, };
//# sourceMappingURL=linter.js.map