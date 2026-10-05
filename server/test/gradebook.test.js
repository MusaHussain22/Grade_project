import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import test from 'node:test';
import { averageGpa, calculateWeightedAverage, letterFromPercent } from '../../shared/grades.mjs';
import { createApp } from '../src/index.js';
import { parseGrades } from '../src/parseGrades.js';
import { resolvePortal } from '../src/portal.js';

const fixture = readFileSync(new URL('../fixtures/assignments.html', import.meta.url), 'utf8');

test('portal URLs stay on public HTTPS Home Access hosts', () => {
  const portal = resolvePortal('https://esp-has-1.psd202.org/HomeAccess/Account/LogOn?ReturnUrl=%2fhomeaccess%2f');
  assert.equal(portal.base, 'https://esp-has-1.psd202.org/HomeAccess');
  assert.equal(portal.loginUrl, 'https://esp-has-1.psd202.org/HomeAccess/Account/LogOn?ReturnUrl=%2fhomeaccess%2f');
  assert.throws(() => resolvePortal('http://esp-has-1.psd202.org/HomeAccess'), /HTTPS/);
  assert.throws(() => resolvePortal('https://127.0.0.1/HomeAccess'), /not allowed/);
  assert.throws(() => resolvePortal('https://localhost/HomeAccess'), /not allowed/);
});

test('parser reads classes, weights, and assignment rows', () => {
  const gradebook = parseGrades(fixture, { fetchedAt: '2026-10-05T00:00:00.000Z' });
  assert.equal(gradebook.studentName, 'Alex Rivera');
  assert.equal(gradebook.courses.length, 5);
  const english = gradebook.courses[0];
  assert.equal(english.id, 'eng101-english-i-0');
  assert.equal(english.teacher, 'Ms. Alvarez');
  assert.equal(english.percent, 94.1);
  assert.equal(english.letter, 'A');
  assert.equal(english.weightsPublished, true);
  assert.deepEqual(english.categories.map((category) => [category.name, category.weight]), [
    ['Formative', 30],
    ['Summative', 70],
  ]);
  assert.equal(english.assignments.length, 5);
  assert.equal(english.assignments[0].name, 'Reading quiz');
  assert.equal(english.assignments[0].score, 18);
  assert.equal(english.assignments[0].totalPoints, 20);
  assert.equal(english.assignments[2].status, 'excused');
  assert.equal(english.assignments[3].status, 'pending');
  assert.equal(gradebook.courses[3].assignments[1].score, 55);
  assert.equal(gradebook.courses[3].letter, 'F');
});

test('parser infers equal weights when the portal omits them', () => {
  const html = `
    <div class="AssignmentClass">
      <div class="sg-header">
        <a class="sg-header-heading" href="#">Choir</a>
        <span id="plnMain_rptAssigmnetsByCourse_lblHdrAverage_0">AVERAGE 90.00%</span>
      </div>
      <table class="sg-asp-table">
        <tr class="sg-asp-table-header-row">
          <td>Due Date</td><td>Date Assigned</td><td>Assignment</td><td>Category</td><td>Score</td><td>Total Points</td>
        </tr>
        <tr class="sg-asp-table-data-row">
          <td>10/01/2026</td><td>10/01/2026</td><td>Scale check</td><td>Performance</td><td>10</td><td>10</td>
        </tr>
        <tr class="sg-asp-table-data-row">
          <td>10/02/2026</td><td>10/02/2026</td><td>Written quiz</td><td>Written</td><td>8</td><td>10</td>
        </tr>
      </table>
    </div>`;
  const [course] = parseGrades(html).courses;
  assert.equal(course.weightsPublished, false);
  assert.deepEqual(course.categories.map((category) => category.weight), [50, 50]);
});

test('weighted average ignores excused and pending work', () => {
  const gradebook = parseGrades(fixture);
  const english = gradebook.courses[0];
  const result = calculateWeightedAverage(english.assignments, english.categories);
  assert.equal(result.percent, 94.1);
  assert.equal(result.letter, 'A');

  const withMock = calculateWeightedAverage(
    [...english.assignments, {
      name: 'Mock essay',
      category: 'Summative',
      score: 100,
      totalPoints: 100,
      status: 'graded',
    }],
    english.categories,
  );
  assert.equal(withMock.categories.find((category) => category.name === 'Summative').average, 97.5);
  assert.equal(withMock.percent, 95.85);

  const missing = calculateWeightedAverage(
    [{ category: 'Summative', score: 0, totalPoints: 100, status: 'missing' }],
    [{ name: 'Summative', weight: 100 }],
  );
  assert.equal(missing.percent, 0);
  assert.equal(missing.letter, 'F');

  const history = gradebook.courses[3];
  const rescued = calculateWeightedAverage(
    [...history.assignments, {
      category: 'Summative',
      score: 100,
      totalPoints: 100,
      status: 'graded',
    }],
    history.categories,
  );
  assert.equal(rescued.percent, 72.25);
  assert.equal(rescued.letter, 'C-');
});

test('letter grades map onto an unweighted 4.0 scale', () => {
  assert.equal(letterFromPercent(97), 'A+');
  assert.equal(letterFromPercent(93), 'A');
  assert.equal(letterFromPercent(90), 'A-');
  assert.equal(letterFromPercent(80), 'B-');
  assert.equal(letterFromPercent(59.9), 'F');
  const gradebook = parseGrades(fixture);
  assert.equal(averageGpa(gradebook.courses.map((course) => course.letter)), 2.6);
});

test('demo sign-in returns parsed grades and never requires the portal', async () => {
  const server = createApp().listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  try {
    const denied = await fetch(`http://127.0.0.1:${port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'student',
        password: 'secret',
        portalUrl: 'http://127.0.0.1/HomeAccess',
      }),
    });
    assert.equal(denied.status, 400);

    const demo = await fetch(`http://127.0.0.1:${port}/api/demo`, { method: 'POST' });
    const session = await demo.json();
    assert.equal(session.studentName, 'Alex Rivera');
    assert.equal(typeof session.token, 'string');

    const grades = await fetch(`http://127.0.0.1:${port}/api/grades`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    const body = await grades.json();
    assert.equal(body.source, 'demo');
    assert.equal(body.courses.length, 5);

    const missing = await fetch(`http://127.0.0.1:${port}/api/grades`);
    assert.equal(missing.status, 401);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
