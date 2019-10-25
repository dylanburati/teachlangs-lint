import * as assert from 'assert';
import { describe, it } from 'mocha';
import { compareStringIndices, findNearestRacketNode, ParserStatus, Parser } from '../parser';
describe('Internal function', () => {
    describe(compareStringIndices.name, () => {
        it('Should return false when the first pair is null', () => {
            assert.strictEqual(compareStringIndices(null, { index: 1, length: 4 }), false);
        });
        it('Should return true when the first pair starts before the second', () => {
            assert.strictEqual(compareStringIndices({ index: 1, length: 4 }, { index: 2, length: 8 }), true);
        });
        it('Should return true when the second pair is a prefix of the first', () => {
            assert.strictEqual(compareStringIndices({ index: 1, length: 4 }, { index: 1, length: 2 }), true);
            assert.strictEqual(compareStringIndices({ index: 1, length: 4 }, { index: 1, length: 4 }), true);
        });
        it('Should return false when the first pair is a strict prefix of the second', () => {
            assert.strictEqual(compareStringIndices({ index: 1, length: 4 }, { index: 1, length: 5 }), false);
        });
        it('Should return false when the second pair starts before the first', () => {
            assert.strictEqual(compareStringIndices({ index: 1, length: 4 }, { index: 0, length: 2 }), false);
            assert.strictEqual(compareStringIndices({ index: 1, length: 4 }, { index: 0, length: 8 }), false);
        });
    });
    describe(findNearestRacketNode.name, () => {
        it('Should return false when the given string is empty or all whitespace', () => {
            assert.strictEqual(findNearestRacketNode(''), false);
            assert.strictEqual(findNearestRacketNode(' \t\r\n'), false);
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
            it(`Should find ${expected.step}`, () => {
                assert.deepStrictEqual(findNearestRacketNode(src), expected);
            });
        });
    });
});
describe('Parser class', () => {
    it('Should parse the "Done" example', () => {
        const parser = new Parser('(+ 2 2)');
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
        assert.strictEqual(parser.status, ParserStatus.Done);
    });
    it('Should parse the "Done" example with tricky strings', () => {
        const parser = new Parser('(string-append "hi\\"" "" (substring "bye\\\\" 2 2))');
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
        assert.strictEqual(parser.status, ParserStatus.Done);
    });
    it('Should parse the "FoundUnclosed" example', () => {
        const parser = new Parser('(cond [true empty]');
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
        assert.strictEqual(parser.status, ParserStatus.FoundUnclosed);
    });
});
//# sourceMappingURL=parser.spec.js.map