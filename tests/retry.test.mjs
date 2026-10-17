import test from 'node:test';
import assert from 'node:assert/strict';
import retry from '../src/retry.cjs';
const q = { id: 'q1', type: 'single', text: 'choose', options: [{ key: 'A', text: 'one' }, { key: 'B', text: 'two' }, { key: 'C', text: 'three' }] };
const answer = choices => ({ id: q.id, choices, readable: true, confidence: 1, explanation: 'model' });
test('never repeat any recorded failed vector, not just the last five', () => {
    const attempts = ['A', 'B'].map(key => ({ questions: [q], answers: [answer([key])], finalScore: 0, maxScore: 1 }));
    const plan = retry.plan([q], attempts), result = retry.novel([q], [answer(['A'])], plan.forbidden);
    assert.deepEqual(result.answers[0].choices, ['C']); assert.equal(plan.repeated(result.answers), false);
    assert.equal(result.answers[0].noveltyAdjusted, true); assert(result.answers[0].confidence < 0.8);
});
test('question and option reordering do not turn the same semantic submission into a new vector', () => {
    const reordered = { ...q, options: [...q.options].reverse().map((o, i) => ({ ...o, key: ['A', 'B', 'C'][i] })) };
    const plan = retry.plan([reordered], [{ questions: [q], answers: [answer(['A'])], finalScore: 0, maxScore: 1 }]);
    assert.equal(plan.repeated([answer(['C'])]), true);
    assert.deepEqual(plan.history[0].answers[0].choices, ['C']);
});
test('keep verified answers; only vary unknown questions, or report the finite space exhausted', () => {
    const q2 = { ...q, id: 'q2', type: 'boolean', options: q.options.slice(0, 2) };
    const fixed = answer(['A']), proposed = { ...answer(['A']), id: 'q2' };
    const forbidden = [[fixed, proposed]];
    const next = retry.novel([q, q2], [fixed, proposed], forbidden, [fixed]);
    assert.deepEqual(next.answers[0], fixed); assert.deepEqual(next.answers[1].choices, ['B']);
    assert.equal(retry.novel([q, q2], next.answers, [...forbidden, next.answers], [fixed]).exhausted, true);
});
test('multiple choice candidates are nonempty and exhaust without repeats; BigInt covers large mixed spaces', () => {
    const multi = { ...q, type: 'multiple', options: q.options.slice(0, 2) }, tried = [];
    let candidate = [answer(['A'])];
    for (let i = 0; i < 3; i++) { const next = retry.novel([multi], candidate, tried); assert(!next.exhausted); candidate = next.answers; tried.push(candidate); }
    assert.equal(new Set(tried.map(a => retry.batchKey([multi], a))).size, 3);
    assert(retry.novel([multi], candidate, tried).exhausted);
    const many = Array.from({ length: 20 }, (_, i) => ({ ...q, id: `q${i}`, type: 'multiple', options: Array.from({ length: 20 }, (_, n) => ({ key: String.fromCharCode(65 + n), text: `option${n}` })) }));
    const answers = many.map(q => ({ ...answer(['A']), id: q.id }));
    assert.equal(retry.novel(many, answers, [answers]).changed, true);
});
test('changed image or option content never imports failed combinations from a different question', () => {
    const attempt = { questions: [{ ...q, imageKey: 'old' }], answers: [answer(['A'])], finalScore: 0, maxScore: 1 };
    assert.equal(retry.plan([{ ...q, imageKey: 'new' }], [attempt]).forbidden.length, 0);
});
test('unchanged forms with duplicate option text still block exactly repeated letters', () => {
    const repeatedText = { ...q, options: [{ key: 'A', text: 'same' }, { key: 'B', text: 'same' }] };
    const plan = retry.plan([repeatedText], [{ questions: [repeatedText], answers: [answer(['A'])], finalScore: 0, maxScore: 1 }]);
    assert(plan.repeated([answer(['A'])]));
    assert.deepEqual(retry.novel([repeatedText], [answer(['A'])], plan.forbidden).answers[0].choices, ['B']);
});
