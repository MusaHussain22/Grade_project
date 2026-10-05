import axios from 'axios';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import { clean, parseGrades, readStudentName } from './parseGrades.js';
import { PortalError, resolvePortal } from './portal.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function cookieList(headers) {
  const value = headers?.['set-cookie'];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function rememberCookies(jar, setCookies, url) {
  for (const cookie of setCookies) {
    try {
      await jar.setCookie(cookie, url);
    } catch {
      // A proxy cookie we cannot store should not block sign-in.
    }
  }
}

async function request(jar, method, url, body, headers = {}) {
  let currentUrl = url;
  let currentMethod = method;
  let currentBody = body;
  let currentHeaders = { ...headers };

  for (let hop = 0; hop < 8; hop += 1) {
    const cookie = await jar.getCookieString(currentUrl);
    const response = await axios({
      method: currentMethod,
      url: currentUrl,
      data: currentBody,
      timeout: 25000,
      maxRedirects: 0,
      responseType: 'text',
      validateStatus: () => true,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        Cookie: cookie,
        ...currentHeaders,
      },
    });

    await rememberCookies(jar, cookieList(response.headers), currentUrl);

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { status: response.status, data: response.data, url: currentUrl };
    }

    const location = response.headers.location;
    if (!location) {
      return { status: response.status, data: response.data, url: currentUrl };
    }
    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.host !== new URL(currentUrl).host) {
      throw new PortalError('The portal redirected to an unexpected host.', 502);
    }
    const switchToGet = response.status === 303 || (response.status === 302 && currentMethod === 'POST');
    currentUrl = nextUrl.toString();
    currentMethod = switchToGet ? 'GET' : currentMethod;
    currentBody = currentMethod === 'GET' ? undefined : currentBody;
    currentHeaders = {};
  }

  throw new PortalError('The portal redirected too many times.', 502);
}

export async function loginToPortal({ portalUrl, username, password }) {
  const portal = resolvePortal(portalUrl);
  const jar = new CookieJar();
  const page = await request(jar, 'GET', portal.loginUrl);
  const html = String(page.data || '');
  const $ = cheerio.load(html);
  const form = $('form').first();
  if (!form.find('input[name="__RequestVerificationToken"]').length) {
    throw new PortalError('The portal login page did not include a verification token.', 502);
  }

  const params = new URLSearchParams();
  form.find('input').each((_, input) => {
    const name = $(input).attr('name');
    if (!name) return;
    const type = ($(input).attr('type') || 'text').toLowerCase();
    if (type === 'submit' || type === 'button') return;
    params.set(name, $(input).attr('value') ?? '');
  });
  params.set('LogOnDetails.UserName', username);
  params.set('LogOnDetails.Password', password);

  const action = form.attr('action') || portal.loginUrl;
  const postUrl = new URL(action, portal.loginUrl).toString();
  const response = await request(jar, 'POST', postUrl, params.toString(), {
    'Content-Type': 'application/x-www-form-urlencoded',
    Origin: portal.origin,
    Referer: portal.loginUrl,
  });
  const body = String(response.data || '');
  if (/name="LogOnDetails\.UserName"/i.test(body)) {
    const failure = cheerio.load(body);
    const message = clean(failure('.validation-summary-errors, .sg-login-validation-summary, .field-validation-error').text());
    throw new PortalError(message || 'The portal did not accept those credentials.', 401);
  }

  return {
    jar,
    portal,
    studentName: readStudentName(body) || username,
  };
}

export async function fetchGradeHtml(session) {
  const urls = [
    `${session.portal.base}/Content/Student/Assignments.aspx`,
    `${session.portal.base}/Classes/Classwork`,
  ];
  let fallback = '';
  for (const url of urls) {
    const response = await request(session.jar, 'GET', url);
    const html = String(response.data || '');
    fallback = html;
    if (/name="LogOnDetails\.UserName"/i.test(html)) {
      throw new PortalError('The portal session expired. Sign in again.', 401);
    }
    const parsed = parseGrades(html, { studentName: session.studentName, source: 'hac' });
    if (parsed.courses.length) return html;
  }
  return fallback;
}
