"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function racketNodeToString(node) {
    if (node.kind === 'Expression') {
        return `(${node.children.map(racketNodeToString).join(' ')})`;
    }
    return node.source;
}
exports.racketNodeToString = racketNodeToString;
// Returns true if the first pair starts before the second, or if they have
// the same start point but the first is at least as long as the second.
function compareStringIndices(indices1, indices2) {
    if (indices1 == null) {
        return false;
    }
    return (indices1.index < indices2.index) ||
        (indices1.index === indices2.index && indices1.length >= indices2.length);
}
exports.compareStringIndices = compareStringIndices;
function normalizeRegExpExec(rexec) {
    return {
        index: rexec.index,
        length: rexec[0].length,
        match: rexec[0]
    };
}
const regexps = new Map();
regexps.set('LineComment', /;.*?$/m);
regexps.set('BlockComment', /#\|.*?\|#/);
regexps.set('ExpressionStart', /[[(]/);
regexps.set('ExpressionEnd', /[\])]/);
regexps.set('String', /"(?:"|(?:[^"]+?)*(?:\\\\"|[^\\]"))/);
regexps.set('Number', /[-+]?(?:[0-9]+(?:\.?[0-9]*)?|\.[0-9]+)(?:e[-+]?[0-9]+)?/);
regexps.set('Symbol', /'[^\][(){}|\s ,`"'#][^\][(){}|\s ,`"'#]*/);
regexps.set('Variable', /[^\][(){}|\s ,`"'#][^\][(){}|\s ,`"'#]*/);
function findNearestRacketNode(code) {
    let stepFound;
    stepFound = false;
    let matchFound;
    matchFound = null;
    regexps.forEach((re, step) => {
        const rexec = re.exec(code);
        if (rexec != null) {
            const match = normalizeRegExpExec(rexec);
            if (!compareStringIndices(matchFound, match)) {
                matchFound = match;
                stepFound = step;
            }
        }
    });
    if (stepFound === false || matchFound == null) {
        return false;
    }
    return {
        step: stepFound,
        span: matchFound
    };
}
exports.findNearestRacketNode = findNearestRacketNode;
function emptyExpression() {
    return {
        kind: 'Expression',
        children: []
    };
}
var ParserStatus;
(function (ParserStatus) {
    ParserStatus[ParserStatus["InProgress"] = 0] = "InProgress";
    ParserStatus[ParserStatus["Done"] = 1] = "Done";
    ParserStatus[ParserStatus["FoundUnclosed"] = 2] = "FoundUnclosed";
    ParserStatus[ParserStatus["FoundTrailing"] = 3] = "FoundTrailing";
})(ParserStatus || (ParserStatus = {}));
exports.ParserStatus = ParserStatus;
/**
 * Class to incrementally parse the given Student Language string, and store
 * the syntax tree under `root`.
 */
class Parser {
    constructor(code) {
        this.code = code;
        this.root = emptyExpression();
        this.contextStack = [];
        this.context = this.root;
        this.status = ParserStatus.InProgress;
    }
    advance() {
        if (this.status !== ParserStatus.InProgress) {
            throw new Error('Parser can not advance past last context');
        }
        const token = findNearestRacketNode(this.code);
        if (token === false) {
            if (this.contextStack.length === 0) {
                // finished at top level
                this.status = ParserStatus.Done;
            }
            else {
                // finished, but the current expression is not closed
                this.status = ParserStatus.FoundUnclosed;
            }
            return;
        }
        if (token.step === 'ExpressionStart') {
            const nested = emptyExpression();
            this.context.children.push(nested);
            this.contextStack.push(this.context);
            this.context = nested;
        }
        else if (token.step === 'ExpressionEnd') {
            const parentCtx = this.contextStack.pop();
            if (parentCtx == null) {
                this.status = ParserStatus.FoundTrailing;
                return;
            }
            this.context = parentCtx;
        }
        else {
            // atom
            this.context.children.push({
                kind: token.step,
                source: token.span.match
            });
        }
        // consume the current token
        this.code = this.code.substring(token.span.index + token.span.length);
    }
    getLastRacketNode() {
        if (this.context.children.length > 0) {
            return this.context.children[this.context.children.length - 1];
        }
        return null;
    }
}
exports.Parser = Parser;
//# sourceMappingURL=parser.js.map