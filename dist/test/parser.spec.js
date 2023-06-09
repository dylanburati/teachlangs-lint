"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const mocha_1 = require("mocha");
const parser_1 = require("../parser");
mocha_1.describe('Internal function', () => {
    mocha_1.describe(parser_1.compareStringIndices.name, () => {
        mocha_1.it('Should return false when the first pair is null', () => {
            assert.strictEqual(parser_1.compareStringIndices(null, { index: 1, length: 4 }), false);
        });
        mocha_1.it('Should return true when the first pair starts before the second', () => {
            assert.strictEqual(parser_1.compareStringIndices({ index: 1, length: 4 }, { index: 2, length: 8 }), true);
        });
        mocha_1.it('Should return true when the second pair is a prefix of the first', () => {
            assert.strictEqual(parser_1.compareStringIndices({ index: 1, length: 4 }, { index: 1, length: 2 }), true);
            assert.strictEqual(parser_1.compareStringIndices({ index: 1, length: 4 }, { index: 1, length: 4 }), true);
        });
        mocha_1.it('Should return false when the first pair is a strict prefix of the second', () => {
            assert.strictEqual(parser_1.compareStringIndices({ index: 1, length: 4 }, { index: 1, length: 5 }), false);
        });
        mocha_1.it('Should return false when the second pair starts before the first', () => {
            assert.strictEqual(parser_1.compareStringIndices({ index: 1, length: 4 }, { index: 0, length: 2 }), false);
            assert.strictEqual(parser_1.compareStringIndices({ index: 1, length: 4 }, { index: 0, length: 8 }), false);
        });
    });
    mocha_1.describe(parser_1.findNearestRacketNode.name, () => {
        mocha_1.it('Should return false when the given string is empty or all whitespace', () => {
            assert.strictEqual(parser_1.findNearestRacketNode(''), false);
            assert.strictEqual(parser_1.findNearestRacketNode(' \t\r\n'), false);
        });
        const casesMap = new Map();
        casesMap.set('#| <> |#', {
            step: 'BlockComment',
            span: { index: 0, length: 8, match: '#| <> |#' }
        });
        casesMap.set(' ; (1)', {
            step: 'LineComment',
            span: { index: 1, length: 5, match: '; (1)' }
        });
        casesMap.set('(check-expect 0 0)', {
            step: 'ExpressionStart',
            span: { index: 0, length: 1, match: '(' }
        });
        casesMap.set('\t)', {
            step: 'ExpressionEnd',
            span: { index: 1, length: 1, match: ')' }
        });
        casesMap.set('"hi"', {
            step: 'String',
            span: { index: 0, length: 4, match: '"hi"' }
        });
        casesMap.set('.2', {
            step: 'Number',
            span: { index: 0, length: 2, match: '.2' }
        });
        casesMap.set("'sym", {
            step: 'Symbol',
            span: { index: 0, length: 4, match: "'sym" }
        });
        casesMap.set('check-expect 0 0)', {
            step: 'Variable',
            span: { index: 0, length: 12, match: 'check-expect' }
        });
        casesMap.forEach((expected, src) => {
            mocha_1.it(`Should find ${expected.step}`, () => {
                assert.deepStrictEqual(parser_1.findNearestRacketNode(src), expected);
            });
        });
    });
});
mocha_1.describe('Parser class', () => {
    mocha_1.it('Should parse the "Done" example', () => {
        const parser = new parser_1.Parser('(+ 2 2)');
        parser.advance();
        assert.strictEqual(parser.contextStack.length, 1);
        const plus = {
            kind: 'Variable',
            source: '+'
        };
        parser.advance();
        assert.deepStrictEqual(parser.getLastRacketNode(), plus);
        const two = {
            kind: 'Number',
            source: '2'
        };
        parser.advance();
        assert.deepStrictEqual(parser.getLastRacketNode(), two);
        parser.advance();
        assert.deepStrictEqual(parser.getLastRacketNode(), two);
        parser.advance();
        assert.strictEqual(parser.contextStack.length, 0);
        parser.advance();
        assert.strictEqual(parser.status, parser_1.ParserStatus.Done);
    });
    mocha_1.it('Should parse the "Done" example with tricky strings', () => {
        const parser = new parser_1.Parser('(string-append "hi\\"" "" (substring "bye\\\\" 2 2))');
        parser.advance();
        assert.strictEqual(parser.contextStack.length, 1);
        const stringAppend = {
            kind: 'Variable',
            source: 'string-append'
        };
        parser.advance();
        assert.deepStrictEqual(parser.getLastRacketNode(), stringAppend);
        const hi = {
            kind: 'String',
            source: '"hi\\""'
        };
        parser.advance();
        assert.deepStrictEqual(parser.getLastRacketNode(), hi);
        const emptyStr = {
            kind: 'String',
            source: '""'
        };
        parser.advance();
        assert.deepStrictEqual(parser.getLastRacketNode(), emptyStr);
        parser.advance();
        assert.strictEqual(parser.contextStack.length, 2);
        const substringRkt = {
            kind: 'Variable',
            source: 'substring'
        };
        parser.advance();
        assert.deepStrictEqual(parser.getLastRacketNode(), substringRkt);
        const bye = {
            kind: 'String',
            source: '"bye\\\\"'
        };
        parser.advance();
        assert.deepStrictEqual(parser.getLastRacketNode(), bye);
        const two = {
            kind: 'Number',
            source: '2'
        };
        parser.advance();
        assert.deepStrictEqual(parser.getLastRacketNode(), two);
        parser.advance();
        assert.deepStrictEqual(parser.getLastRacketNode(), two);
        parser.advance();
        assert.strictEqual(parser.contextStack.length, 1);
        parser.advance();
        assert.strictEqual(parser.contextStack.length, 0);
        parser.advance();
        assert.strictEqual(parser.status, parser_1.ParserStatus.Done);
    });
    mocha_1.it('Should parse the "FoundUnclosed" example', () => {
        const parser = new parser_1.Parser('(cond [true empty]');
        parser.advance();
        assert.strictEqual(parser.contextStack.length, 1);
        const cond = {
            kind: 'Variable',
            source: 'cond'
        };
        parser.advance();
        assert.deepStrictEqual(parser.getLastRacketNode(), cond);
        parser.advance();
        assert.strictEqual(parser.contextStack.length, 2);
        const hashTrue = {
            kind: 'Variable',
            source: 'true'
        };
        parser.advance();
        assert.deepStrictEqual(parser.getLastRacketNode(), hashTrue);
        const empty = {
            kind: 'Variable',
            source: 'empty'
        };
        parser.advance();
        assert.deepStrictEqual(parser.getLastRacketNode(), empty);
        parser.advance();
        assert.strictEqual(parser.contextStack.length, 1);
        parser.advance();
        assert.strictEqual(parser.status, parser_1.ParserStatus.FoundUnclosed);
    });
});
//# sourceMappingURL=parser.spec.js.map