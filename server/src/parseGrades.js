import * as cheerio from 'cheerio';
import { letterFromPercent, round2 } from '../../shared/grades.mjs';

export function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function slug(name, index) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `${base || 'class'}-${index}`;
}

export function parseAverage(text) {
  const cleaned = clean(text);
  const percentMatch = cleaned.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  const letterMatch = cleaned.match(/\b([A-F][+-]?)\b/i);
  return {
    percent: percentMatch ? Number(percentMatch[1]) : null,
    letter: letterMatch ? letterMatch[1].toUpperCase() : null,
  };
}

export function readStudentName(html) {
  const $ = cheerio.load(html);
  const selectors = [
    '.sg-banner-student-name',
    '.sg-menu-element-identity span',
    '#StudentName',
    '[id*="lblStudentName"]',
  ];
  for (const selector of selectors) {
    const name = clean($(selector).first().text());
    if (name) return name;
  }
  return '';
}

function headerLabels($, table) {
  const marked = $(table).find('tr.sg-asp-table-header-row').first();
  const row = marked.length ? marked : $(table).find('tr').first();
  return row
    .find('th,td')
    .toArray()
    .map((cell) => clean($(cell).text()).toLowerCase());
}

function dataRows($, table) {
  const marked = $(table).find('tr.sg-asp-table-data-row');
  if (marked.length) return marked;
  return $(table).find('tr').filter((index, row) => {
    return index > 0 && !$(row).hasClass('sg-asp-table-header-row');
  });
}

function columnIndex(headers, needles) {
  return headers.findIndex((header) => needles.some((needle) => header.includes(needle)));
}

function classify(headers) {
  const hasWeight = headers.some((header) => header.includes('weight'));
  const hasAssignment = headers.some((header) => header.includes('assignment'));
  const hasScore = headers.some((header) => header.includes('score'));
  if (hasWeight && !hasAssignment) return 'category';
  if (hasAssignment || hasScore) return 'assignment';
  return 'unknown';
}

function cellText($, row, index) {
  if (index < 0) return '';
  return clean($(row).find('td').eq(index).text());
}

function parseScoreCell(text) {
  const value = clean(text);
  if (!value || value === '-' || value === '—') {
    return { score: null, status: 'pending', totalPoints: null };
  }
  const slash = value.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (slash) {
    return { score: Number(slash[1]), status: 'graded', totalPoints: Number(slash[2]) };
  }
  if (/^(ex|excused|exempt)$/i.test(value)) {
    return { score: null, status: 'excused', totalPoints: null };
  }
  if (/missing|ungraded/i.test(value)) {
    return { score: 0, status: 'missing', totalPoints: null };
  }
  const numeric = value.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(numeric)) {
    return { score: null, status: 'pending', totalPoints: null };
  }
  return { score: Number(numeric), status: 'graded', totalPoints: null };
}

function parseTotal(text) {
  const value = clean(text).replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(value)) return null;
  return Number(value);
}

function parseAssignmentRow($, row, headers, rowIndex, courseIndex) {
  const dueIndex = columnIndex(headers, ['due']);
  const assignedIndex = columnIndex(headers, ['assigned']);
  const nameIndex = columnIndex(headers, ['assignment']);
  const categoryIndex = columnIndex(headers, ['category']);
  const scoreIndex = columnIndex(headers, ['score']);
  const totalIndex = columnIndex(headers, ['total', 'possible', 'max']);
  const cells = $(row).find('td');
  const useFallback = nameIndex < 0 && cells.length >= 6;

  const name = cellText($, row, useFallback ? 2 : nameIndex);
  if (!name) return null;

  const scoreCell = parseScoreCell(cellText($, row, useFallback ? 4 : scoreIndex));
  const totalPoints = scoreCell.totalPoints ?? parseTotal(cellText($, row, useFallback ? 5 : totalIndex));

  return {
    id: `${courseIndex}-${rowIndex}`,
    name,
    dueDate: cellText($, row, useFallback ? 0 : dueIndex) || null,
    assignedDate: cellText($, row, useFallback ? 1 : assignedIndex) || null,
    score: scoreCell.score,
    totalPoints,
    category: cellText($, row, useFallback ? 3 : categoryIndex) || 'Uncategorized',
    status: scoreCell.status,
    mock: false,
  };
}

function parseWeight(text) {
  const value = clean(text).replace('%', '');
  if (!/^-?\d+(\.\d+)?$/.test(value)) return null;
  return Number(value);
}

function parseCategoryRow($, row, headers) {
  const name = cellText($, row, columnIndex(headers, ['category']));
  if (!name || /weight/i.test(name)) return null;
  const weight = parseWeight(cellText($, row, columnIndex(headers, ['weight'])));
  const published = parseWeight(cellText($, row, columnIndex(headers, ['percent', 'average'])));
  if (weight == null && published == null) return null;
  return {
    name,
    weight: weight ?? 0,
    publishedAverage: published,
  };
}

function normalizeWeights(categories) {
  const sum = categories.reduce((total, category) => total + category.weight, 0);
  const fractional = sum > 0 && sum <= 1.5 && categories.every((category) => category.weight <= 1);
  if (!fractional) return categories;
  return categories.map((category) => ({ ...category, weight: round2(category.weight * 100) }));
}

function equalWeights(count) {
  if (count <= 0) return [];
  const base = Math.floor(10000 / count) / 100;
  const weights = Array.from({ length: count }, () => base);
  const drift = round2(100 - weights.reduce((total, weight) => total + weight, 0));
  weights[0] = round2(weights[0] + drift);
  return weights;
}

function parseCourse($, classNode, index) {
  const $class = $(classNode);
  const headings = $class.find('.sg-header-heading');
  const name = clean(headings.first().text()) || `Class ${index + 1}`;
  const headerText = clean($class.find('.sg-header').text());
  let teacher = '';
  const labeledTeacher = headerText.match(/Teacher\s*:\s*(.+?)(?=\s+Last Updated|\s+Nine Weeks|\s+Average|$)/i);
  if (labeledTeacher) {
    teacher = clean(labeledTeacher[1]);
  } else if (headings.length > 1) {
    const candidate = clean($(headings[1]).text());
    if (candidate && !/%|average/i.test(candidate)) teacher = candidate;
  }

  let percent = null;
  let letter = null;
  let lastUpdated = null;
  $class.find('span').each((_, span) => {
    const id = $(span).attr('id') || '';
    const text = clean($(span).text());
    if (/lblHdrAverage/i.test(id)) {
      const parsed = parseAverage(text);
      percent = parsed.percent;
      letter = parsed.letter;
    }
    if (/lblLastUpdDate/i.test(id)) {
      lastUpdated = text.replace(/^\(|\)$/g, '').replace(/^Last Updated:\s*/i, '');
    }
  });

  if (percent == null) {
    const parsed = parseAverage(headerText);
    percent = parsed.percent;
    letter = letter || parsed.letter;
  }
  if (!lastUpdated) {
    const updated = headerText.match(/Last Updated:\s*([^)]+)/i);
    if (updated) lastUpdated = clean(updated[1]);
  }

  const assignments = [];
  let categories = [];
  let sawCategoryTable = false;

  $class.find('table.sg-asp-table').each((_, table) => {
    const headers = headerLabels($, table);
    const kind = classify(headers);
    const rows = dataRows($, table);
    if (kind === 'category') {
      sawCategoryTable = true;
      rows.each((__, row) => {
        const category = parseCategoryRow($, row, headers);
        if (category) categories.push(category);
      });
      return;
    }
    if (kind === 'assignment' || kind === 'unknown') {
      rows.each((_, row) => {
        const assignment = parseAssignmentRow($, row, headers, assignments.length, index);
        if (assignment) assignments.push(assignment);
      });
    }
  });

  categories = normalizeWeights(categories);
  const weightsPublished = sawCategoryTable && categories.some((category) => category.weight > 0);
  if (!sawCategoryTable) {
    const names = [];
    for (const assignment of assignments) {
      if (!names.includes(assignment.category)) names.push(assignment.category);
    }
    const weights = equalWeights(names.length);
    categories = names.map((categoryName, categoryIndex) => ({
      name: categoryName,
      weight: weights[categoryIndex],
      publishedAverage: null,
    }));
  }

  return {
    id: slug(name, index),
    name,
    teacher: teacher || 'Teacher unavailable',
    percent,
    letter: letter || (percent == null ? null : letterFromPercent(percent)),
    lastUpdated,
    categories,
    assignments,
    weightsPublished,
  };
}

export function parseGrades(html, options = {}) {
  const $ = cheerio.load(html);
  const courses = [];
  $('div.AssignmentClass').each((index, element) => {
    courses.push(parseCourse($, element, index));
  });

  return {
    studentName: options.studentName || readStudentName(html) || 'Student',
    fetchedAt: options.fetchedAt || new Date().toISOString(),
    source: options.source || 'hac',
    courses,
    warning: courses.length ? null : 'no-courses',
  };
}
