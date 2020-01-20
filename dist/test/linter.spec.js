import * as assert from 'assert';
import { describe, it } from 'mocha';
import { ParserStatus, Parser, } from '../parser';
import { emptyFunctionDesign, tryParseSignature, racketNodeIsConstant, racketNodeHasTemplateVars, tryGetFunctionDef, Linter, tryGetTestDef } from '../linter';
const CONSTANT_GREETING = {
    kind: 'Expression',
    children: [
        { kind: 'Variable', source: 'define' },
        { kind: 'Variable', source: 'GREETING-1' },
        { kind: 'String', source: '"Hello"' }
    ]
};
const FUNCTION_DO_TO_ALL = {
    kind: 'Expression',
    children: [
        { kind: 'Variable', source: 'define' },
        {
            kind: 'Expression',
            children: [
                { kind: 'Variable', source: 'do-to-all' },
                { kind: 'Variable', source: 'f' },
                { kind: 'Variable', source: '..lox..' }
            ]
        },
        {
            kind: 'Expression',
            children: [
                { kind: 'Variable', source: 'map' },
                { kind: 'Variable', source: 'f' },
                { kind: 'Variable', source: '..lox..' }
            ]
        }
    ]
};
const FUNCTION_MY_ANIMATE = {
    kind: 'Expression',
    children: [
        { kind: 'Variable', source: 'define' },
        {
            kind: 'Expression',
            children: [
                { kind: 'Variable', source: 'my-animate' },
                { kind: 'Variable', source: 'f-to-draw' }
            ]
        },
        {
            kind: 'Expression',
            children: [
                { kind: 'Variable', source: 'big-bang' },
                {
                    kind: 'Expression',
                    children: [
                        { kind: 'Variable', source: 'to-draw' },
                        { kind: 'Variable', source: 'f-to-draw' }
                    ]
                },
                {
                    kind: 'Expression',
                    children: [
                        { kind: 'Variable', source: 'on-tick' },
                        { kind: 'Variable', source: 'add1' }
                    ]
                }
            ]
        }
    ]
};
const TEMPLATE_POINT_TEMP = {
    kind: 'Expression',
    children: [
        { kind: 'Variable', source: 'define' },
        {
            kind: 'Expression',
            children: [
                { kind: 'Variable', source: 'point-temp' },
                { kind: 'Variable', source: 'p' }
            ]
        },
        {
            kind: 'Expression',
            children: [
                {
                    kind: 'Expression',
                    children: [
                        { kind: 'Variable', source: 'posn-x' },
                        { kind: 'Variable', source: 'p' }
                    ]
                },
                { kind: 'Variable', source: '...' },
                {
                    kind: 'Expression',
                    children: [
                        { kind: 'Variable', source: 'posn-y' },
                        { kind: 'Variable', source: 'p' }
                    ]
                }
            ]
        }
    ]
};
const TEST_CHECK_EXPECT = {
    kind: 'Expression',
    children: [
        { kind: 'Variable', source: 'check-expect' },
        {
            kind: 'Expression',
            children: [
                { kind: 'Variable', source: 'nonsense' },
                { kind: 'String', source: '"xyz"' },
                { kind: 'Number', source: '3' },
                { kind: 'String', source: '"ab"' }
            ]
        },
        { kind: 'String', source: '"xyxyxy + ab"' }
    ]
};
const TEST_CHECK_WITHIN = {
    kind: 'Expression',
    children: [
        { kind: 'Variable', source: 'check-within' },
        {
            kind: 'Expression',
            children: [
                { kind: 'Variable', source: 'do-to-all' },
                { kind: 'Variable', source: 'sqrt' },
                {
                    kind: 'Expression',
                    children: [
                        { kind: 'Variable', source: 'list' },
                        { kind: 'Number', source: '4' },
                        { kind: 'Number', source: '9' }
                    ]
                }
            ]
        },
        {
            kind: 'Expression',
            children: [
                { kind: 'Variable', source: 'list' },
                { kind: 'Number', source: '2' },
                { kind: 'Number', source: '3' }
            ]
        },
        { kind: 'Number', source: '0.000001' }
    ]
};
describe('Internal function', () => {
    describe(tryParseSignature.name, () => {
        it('Should return false when given something other than a line comment', () => {
            const nonSignature = {
                kind: 'String',
                source: '""'
            };
            assert.strictEqual(tryParseSignature(nonSignature), false);
        });
        it('Should return false when the comment does not have a colon and arrow', () => {
            const nonSignature = {
                kind: 'LineComment',
                source: ';    \t'
            };
            assert.strictEqual(tryParseSignature(nonSignature), false);
        });
        it('Should return false when the comment does not have an arrow', () => {
            const nonSignature = {
                kind: 'LineComment',
                source: '; complete? : [X X -> X] [List-of Task]'
            };
            assert.strictEqual(tryParseSignature(nonSignature), false);
        });
        it('Should return false when the comment has mismatched parentheses', () => {
            const nonSignature = {
                kind: 'LineComment',
                source: '; read-syntax : (()(() -> '
            };
            assert.strictEqual(tryParseSignature(nonSignature), false);
        });
        it('Should return false when the comment has multiple words before the colon', () => {
            const nonSignature = {
                kind: 'LineComment',
                source: "; Ceci n'est pas un signature : A -> B"
            };
            assert.strictEqual(tryParseSignature(nonSignature), false);
        });
        it('Should return false when there is not exactly 1 arrow outside parentheses `->`', () => {
            const nonSignature = {
                kind: 'LineComment',
                source: '; Returns: (nothing->something Null)'
            };
            assert.strictEqual(tryParseSignature(nonSignature), false);
            const nonSignature2 = {
                kind: 'LineComment',
                source: '; chain: 1 -> 2 -> 3'
            };
            assert.strictEqual(tryParseSignature(nonSignature2), false);
        });
        it('Should return a new FunctionDesign for the "nonsense" example', () => {
            const signature = {
                kind: 'LineComment',
                source: '; nonsense : String Number String -> String\n'
            };
            const fnDesign = emptyFunctionDesign();
            fnDesign.name = 'nonsense';
            assert.deepStrictEqual(tryParseSignature(signature), fnDesign);
        });
        it('Should return a new FunctionDesign for the "draw-dot" example', () => {
            const signature = {
                kind: 'LineComment',
                source: ';draw-dot:(make-posn Real Real)-> Image\n'
            };
            const fnDesign = emptyFunctionDesign();
            fnDesign.name = 'draw-dot';
            assert.deepStrictEqual(tryParseSignature(signature), fnDesign);
        });
    });
    describe(racketNodeIsConstant.name, () => {
        it('Should return false for non-constants', () => {
            assert.strictEqual(racketNodeIsConstant(FUNCTION_DO_TO_ALL), false);
            assert.strictEqual(racketNodeIsConstant(TEST_CHECK_EXPECT), false);
            assert.strictEqual(racketNodeIsConstant(TEST_CHECK_WITHIN), false);
        });
        it('Should return true for constants', () => {
            assert.strictEqual(racketNodeIsConstant(CONSTANT_GREETING), true);
        });
    });
    describe(racketNodeHasTemplateVars.name, () => {
        it('Should return false for anything that does not contain template vars', () => {
            assert.strictEqual(racketNodeHasTemplateVars(FUNCTION_DO_TO_ALL), false);
            assert.strictEqual(racketNodeHasTemplateVars(TEST_CHECK_EXPECT), false);
            assert.strictEqual(racketNodeHasTemplateVars(TEMPLATE_POINT_TEMP.children[1]), false);
        });
        it('Should return true for template functions / function bodies', () => {
            assert.strictEqual(racketNodeHasTemplateVars(TEMPLATE_POINT_TEMP), true);
            assert.strictEqual(racketNodeHasTemplateVars(TEMPLATE_POINT_TEMP.children[2]), true);
        });
    });
    describe(tryGetTestDef.name, () => {
        it('Should return false for anything that is not a test', () => {
            assert.strictEqual(tryGetTestDef(FUNCTION_DO_TO_ALL), false);
            assert.strictEqual(tryGetTestDef(FUNCTION_MY_ANIMATE), false);
            assert.strictEqual(tryGetTestDef(TEMPLATE_POINT_TEMP), false);
        });
        it('Should return a new TestDef for the "check-expect" example', () => {
            const testDef = {
                actual: TEST_CHECK_EXPECT.children[1] // (nonsense "xyz" 3 "ab")
            };
            assert.deepStrictEqual(tryGetTestDef(TEST_CHECK_EXPECT), testDef);
        });
        it('Should return a new TestDef for the "check-within" example', () => {
            const testDef = {
                actual: TEST_CHECK_WITHIN.children[1] // (do-to-all sqrt (list 4 9))
            };
            assert.deepStrictEqual(tryGetTestDef(TEST_CHECK_WITHIN), testDef);
        });
    });
    describe(tryGetFunctionDef.name, () => {
        it('Should return false for anything that is not a function', () => {
            assert.strictEqual(tryGetFunctionDef(TEST_CHECK_EXPECT), false);
            assert.strictEqual(tryGetFunctionDef(TEST_CHECK_WITHIN), false);
            assert.strictEqual(tryGetFunctionDef(FUNCTION_MY_ANIMATE.children[2]), false);
        });
        it('Should return a new FunctionDef when given a template function', () => {
            const pointTempDef = {
                name: 'point-temp',
                argNames: ['p'],
                isTemplate: true,
                // ((posn-x p) ... (posn-y p))
                body: TEMPLATE_POINT_TEMP.children[2]
            };
            assert.deepStrictEqual(tryGetFunctionDef(TEMPLATE_POINT_TEMP), pointTempDef);
        });
        it('Should return a new FunctionDef for the "do-to-all" example', () => {
            const doToAllDef = {
                name: 'do-to-all',
                argNames: ['f', '..lox..'],
                isTemplate: false,
                // (map f ..lox..)
                body: FUNCTION_DO_TO_ALL.children[2]
            };
            assert.deepStrictEqual(tryGetFunctionDef(FUNCTION_DO_TO_ALL), doToAllDef);
        });
        it('Should return a new FunctionDef for the "my-animate" example', () => {
            const myAnimateDef = {
                name: 'my-animate',
                argNames: ['f-to-draw'],
                isTemplate: false,
                // (big-bang (to-draw f-to-draw) (on-tick add1))
                body: FUNCTION_MY_ANIMATE.children[2]
            };
            assert.deepStrictEqual(tryGetFunctionDef(FUNCTION_MY_ANIMATE), myAnimateDef);
        });
    });
});
describe('Linter class', () => {
    describe('Example 1', () => {
        const example = `
    ; do-to-all : (X Y) [X -> Y] [List-of X] -> [List-of Y]
    (check-expect (do-to-all sqrt empty) empty)
    (check-within (do-to-all sqrt (list 4 9)) (list 2 3) 0.000001)
    (define (do-to-all f ..lox..)
      (map f ..lox..))
    
    ; A Point is a (make-posn Real Real)
    ; representing a point in the x-y plane
    ; - x: the x-coordinate
    ; - y: the y-coordinate

    (define POINT-1 (make-posn 3 4))
    (define POINT-2 (make-posn 5 12))

    ; point-temp : Point -> ?
    (define (point-temp p)
      ((posn-x p) ...
      (posn-y p)))
    
    ; my-animate : [Nat -> Image] -> Nat
    ; Reimplements animate using big-bang
    (define (my-animate f-to-draw)
      (big-bang
        [to-draw f-to-draw]
        [on-tick add1]))
    `;
        const parser = new Parser(example);
        while (parser.status === ParserStatus.InProgress) {
            parser.advance();
        }
        const linter = Linter.fromParser(parser);
        const doToAllExpected = emptyFunctionDesign();
        it('Should find the signature for "do-to-all"', () => {
            doToAllExpected.name = 'do-to-all';
            linter.addSignature();
            assert.deepStrictEqual(linter.requireCurrentFunctionDesign(), doToAllExpected);
        });
        it('Should not find a purpose statement for "do-to-all"', () => {
            // doToAllExpected.purposeLines += 0;
            linter.addPurposeLines();
            assert.deepStrictEqual(linter.requireCurrentFunctionDesign(), doToAllExpected);
        });
        it('Should find two tests and a function definition for "do-to-all"', () => {
            doToAllExpected.tests = 2;
            linter.addTests();
            assert.deepStrictEqual(linter.requireCurrentFunctionDesign(), doToAllExpected);
        });
        it('Should generate warning for missing purpose statement for "do-to-all"', () => {
            doToAllExpected.warnings.push('no purpose statement');
            linter.finalize(linter.requireCurrentFunctionDesign());
            assert.deepStrictEqual(linter.requireCurrentFunctionDesign(), doToAllExpected);
        });
        it('Should find the template "point-temp"', () => {
            const pointTempDef = {
                name: 'point-temp',
                argNames: ['p'],
                isTemplate: true,
                body: TEMPLATE_POINT_TEMP.children[2]
            };
            assert.deepStrictEqual(linter.templates, [pointTempDef]);
        });
        const myAnimateExpected = emptyFunctionDesign();
        it('Should find the signature for "my-animate"', () => {
            myAnimateExpected.name = 'my-animate';
            linter.addSignature();
            assert.deepStrictEqual(linter.requireCurrentFunctionDesign(), myAnimateExpected);
        });
        it('Should find the purpose statement for "my-animate"', () => {
            myAnimateExpected.purposeLines = 1;
            linter.addPurposeLines();
            assert.deepStrictEqual(linter.requireCurrentFunctionDesign(), myAnimateExpected);
        });
        it('Should find a big-bang definition for "my-animate"', () => {
            myAnimateExpected.tests = 1000;
            linter.addTests();
            assert.deepStrictEqual(linter.requireCurrentFunctionDesign(), myAnimateExpected);
        });
        const generalWarnings = {
            kind: 'General',
            warnings: []
        };
        const completedExpected = [generalWarnings, doToAllExpected, myAnimateExpected];
        it('Should have completed', () => {
            assert.strictEqual(linter.remainingNodes.length, 0);
            linter.finalize(linter.requireCurrentFunctionDesign());
            assert.deepStrictEqual(linter.messages, completedExpected);
        });
        it('Should have the same output using lint()', () => {
            const linter2 = Linter.fromParser(parser);
            linter2.lint();
            assert.deepStrictEqual(linter2.messages, completedExpected);
        });
    });
    describe('Example 2 (locals)', () => {
        const example = `
    ; double-squares : Nat -> [List-of Nat]
    ; The first n double squares
    (check-expect (double-squares 0) empty)
    (check-expect (double-squares 4) (list 0 2 8 18))
    (define (double-squares n)
      (local [; Nat -> Nat
              ; Returns 2 times the given number squared
              ; if given 2, outputs 8
              ; if given 3, outputs 18
              (define (double-sqr x)
                (* 2 (sqr x)))]
        (build-list n double-sqr)))
    
    ; usd-to-euro : [List-of Number] Number -> [List-of Number]
    ; Converts all the currency values in the given list from USD to EUR,
    ; using the given number as the EUR/USD rate
    (check-expect (usd-to-euro empty 1.1) empty)
    (check-expect (usd-to-euro (list 2 4 6) 1.5) (list 3 6 9))
    (define (usd-to-euro lon rate)
      (local [; multiply-by-rate : Number -> Number
              (define (multiply-by-rate x)
                (* x rate))
              
              ; do-nothing/a: Any -> Any
              ; Accumulator: does nothing
              (define (do-nothing/a any)
                (if (zero? (random 10))
                    any
                    (do-nothing/a any)))]
        (map multiply-by-rate lon)))
    
    ; slope : Posn Posn -> Number
    ; Calculates the slope of the line between the two points
    (check-expect (slope (make-posn 1 2) (make-posn 0 0)) 2)
    (check-expect (slope (make-posn -1 -5) (make-posn 0 0)) 5)
    (define (slope p1 p2)
      (local [(define RISE (- (posn-y p1) (posn-y p2)))
              (define RUN (- (posn-x p1) (posn-x p2)))]
        (/ RISE RUN)))
        
    ; my-build-list : (X) Nat [Nat -> X] -> [List-of X]
    ; Reimplements build-list, generating a list of the form
    ; (list (f 0) (f 1) ... (f n))
    (check-expect (my-build-list 4 sqr) (list 0 1 4 9))
    (check-expect (my-build-list 0 identity) empty)
    (define (my-build-list num func)
      (local [; my-build-list/a : Nat [List-of X] -> [List-of X]
              ; Reimplements build-list, generating a list of the form
              ; Accumulator: the list of elements after this one in the list
              (define (my-build-list/a n lox)
                (cond
                  [(zero? n) lox]
                  [(positive? n) (my-build-list/a (sub1 n)
                                                  (cons (func (sub1 n)) lox))]))]
        (my-build-list/a num empty)))`;
        const parser = new Parser(example);
        while (parser.status === ParserStatus.InProgress) {
            parser.advance();
        }
        const linter = Linter.fromParser(parser);
        linter.lint();
        it('Should generate a warning for the local definition in "double-squares"', () => {
            const doubleSquaresExpected = {
                kind: 'FunctionDesign',
                name: 'double-squares',
                purposeLines: 1,
                tests: 2,
                warnings: [
                    'within local: unexpected function definition for double-sqr'
                ]
            };
            const doubleSquaresActual = linter.messages.find(e => (e.kind === 'FunctionDesign' && e.name === 'double-squares'));
            assert.deepStrictEqual(doubleSquaresActual, doubleSquaresExpected);
        });
        it('Should generate a warning for the local definition in "usd-to-euro"', () => {
            const usdToEuroExpected = {
                kind: 'FunctionDesign',
                name: 'usd-to-euro',
                purposeLines: 2,
                tests: 2,
                warnings: [
                    'within local def of multiply-by-rate: no purpose statement'
                ]
            };
            const usdToEuroActual = linter.messages.find(e => (e.kind === 'FunctionDesign' && e.name === 'usd-to-euro'));
            assert.deepStrictEqual(usdToEuroActual, usdToEuroExpected);
        });
        it('Should generate no warnings for the local definition in "slope"', () => {
            const slopeExpected = {
                kind: 'FunctionDesign',
                name: 'slope',
                purposeLines: 1,
                tests: 2,
                warnings: []
            };
            const slopeActual = linter.messages.find(e => (e.kind === 'FunctionDesign' && e.name === 'slope'));
            assert.deepStrictEqual(slopeActual, slopeExpected);
        });
        it('Should generate no warnings for the local definition in "my-build-list"', () => {
            const fnDesignExpected = {
                kind: 'FunctionDesign',
                name: 'my-build-list',
                purposeLines: 2,
                tests: 2,
                warnings: []
            };
            const fnDesignActual = linter.messages.find(e => (e.kind === 'FunctionDesign' && e.name === 'my-build-list'));
            assert.deepStrictEqual(fnDesignActual, fnDesignExpected);
        });
    });
    describe('Example 3 (multi-semicolon comments)', () => {
        const example = `
    ;; inlinks-count : String Wiki -> Nat
    ;; Count the number of inlinks in a given page
    (check-expect (inlinks-count "any" WIKI-EMPTY) 0)
    (check-expect (inlinks-count "NEU" WIKI-FULL) 3)
    (define (inlinks-count pagename wiki)
      (foldr (λ (wp sofar) (if (links-to-page? wp pagename) (add1 sofar) sofar)) 0 wiki))

    ;;; links-to-page? : WebPage String -> Boolean
    ;;; Does the given page link to a page with the given name?
    (check-expect (links-to-page? PAGE-KHOURY "Computers") false)
    (check-expect (links-to-page? PAGE-NEU "Boston") true)
    (define (links-to-page? wp pagename)
      (ormap (λ (neighbor) (string=? neighbor pagename)) (page-links wp)))`;
        const parser = new Parser(example);
        while (parser.status === ParserStatus.InProgress) {
            parser.advance();
        }
        const linter = Linter.fromParser(parser);
        linter.lint();
        it('Should generate no warnings for "inlinks-count"', () => {
            const fnDesignExpected = {
                kind: 'FunctionDesign',
                name: 'inlinks-count',
                purposeLines: 1,
                tests: 2,
                warnings: []
            };
            const fnDesignActual = linter.messages.find(e => (e.kind === 'FunctionDesign' && e.name === 'inlinks-count'));
            assert.deepStrictEqual(fnDesignActual, fnDesignExpected);
        });
        it('Should generate no warnings for "links-to-page?"', () => {
            const fnDesignExpected = {
                kind: 'FunctionDesign',
                name: 'links-to-page?',
                purposeLines: 1,
                tests: 2,
                warnings: []
            };
            const fnDesignActual = linter.messages.find(e => (e.kind === 'FunctionDesign' && e.name === 'links-to-page?'));
            assert.deepStrictEqual(fnDesignActual, fnDesignExpected);
        });
    });
});
//# sourceMappingURL=linter.spec.js.map