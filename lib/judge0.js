// Judge0 CE via RapidAPI — same integration/approach as the sibling FastAPI project's
// backend/server.py (Piston's free API now requires whitelisting, self-hosting had its
// own reliability issues). Code submissions throw a 503 gracefully if RAPIDAPI_KEY is unset.
//
// The free RapidAPI Basic plan enforces a low requests-per-second cap. A single "run sample
// tests" click fires 3-5 test cases, and each grading pass loops over several problems, so
// calls are paced (minimum gap between requests) and serialized (one in flight at a time),
// with automatic retry-with-backoff specifically on 429 responses.

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com/submissions';
const MIN_INTERVAL_MS = 1100; // stay under a ~1 req/sec free-tier cap
const MAX_RETRIES = 4;

export const JUDGE0_LANGUAGE_IDS = {
  python: 71,     // Python 3.8.1
  javascript: 63, // JavaScript (Node.js 12.14.0)
  java: 62,       // Java (OpenJDK 13.0.1)
  c: 50,          // C (GCC 9.2.0)
  cpp: 54,        // C++ (GCC 9.2.0)
  sql: 82,        // SQL (SQLite 3.27.2)
};

// Strict single-flight queue with a minimum gap between dispatches -- caps both
// concurrency AND request rate against the shared RapidAPI quota.
class RateLimitedQueue {
  constructor(minIntervalMs) { this.minIntervalMs = minIntervalMs; this.lastRunAt = 0; this.chain = Promise.resolve(); }
  run(fn) {
    const result = this.chain.then(async () => {
      const wait = this.lastRunAt + this.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastRunAt = Date.now();
      return fn();
    });
    // Swallow so one failed task doesn't break the chain for subsequent tasks.
    this.chain = result.catch(() => {});
    return result;
  }
}
const judge0Queue = new RateLimitedQueue(MIN_INTERVAL_MS);

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function submitToJudge0(langId, sourceCode, stdin, rapidApiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const resp = await fetch(`${JUDGE0_API_URL}?base64_encoded=false&wait=true`, {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source_code: sourceCode, language_id: langId, stdin: stdin || '' }),
      signal: controller.signal,
    });
    if (resp.status === 429) {
      const retryAfter = Number(resp.headers.get('retry-after'));
      const e = new Error('rate limited');
      e.status = 429;
      e.retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null;
      throw e;
    }
    if (!resp.ok) throw new Error(`Judge0 responded with status ${resp.status}`);
    const data = await resp.json();
    return { stdout: data.stdout || '', stderr: data.stderr || '', compile_error: data.compile_output || null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runCode(language, sourceCode, stdin) {
  const langId = JUDGE0_LANGUAGE_IDS[language];
  if (!langId) throw { _status: 400, message: `Unsupported language '${language}'. Supported: ${Object.keys(JUDGE0_LANGUAGE_IDS).sort().join(', ')}` };
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) throw { _status: 503, message: "Code execution isn't configured yet. Add RAPIDAPI_KEY (Judge0 CE via RapidAPI) to enable this section." };

  return judge0Queue.run(async () => {
    let lastErr;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await submitToJudge0(langId, sourceCode, stdin, rapidApiKey);
      } catch (e) {
        lastErr = e;
        if (e?.status === 429 && attempt < MAX_RETRIES) {
          const backoff = e.retryAfterMs || Math.min(1500 * 2 ** attempt, 12000);
          await sleep(backoff);
          continue;
        }
        break;
      }
    }
    console.error('Judge0 execution failed:', lastErr?.message);
    throw { _status: 502, message: 'Code execution service is temporarily unavailable. Please try again shortly.' };
  });
}

export function gradeTestCase(run, expectedOutput) {
  const actual = (run.stdout || '').trim();
  const expected = (expectedOutput || '').trim();
  return {
    expected_output: expected,
    actual_output: actual,
    passed: run.compile_error == null && actual === expected,
    stderr: run.stderr || '',
    compile_error: run.compile_error,
  };
}

export function isConfigured() {
  return !!process.env.RAPIDAPI_KEY;
}

const NOT_CONFIGURED_MESSAGE = "Code execution isn't configured yet. Add RAPIDAPI_KEY (Judge0 CE via RapidAPI) to enable this section.";

function notConfiguredResults(testCases) {
  return (testCases || []).map((tc) => ({ expected_output: (tc.expected_output || '').trim(), actual_output: '', passed: false, stderr: '', compile_error: NOT_CONFIGURED_MESSAGE }));
}

// Runs `sourceCode` against every test case in `testCases` ([{input, expected_output}])
// for one problem and returns per-test-case pass/fail plus an aggregate count. Never throws --
// degrades to a clear "not configured" result per test case if RAPIDAPI_KEY is unset, so a
// whole assessment submission never fails just because this one section can't run code.
// Test cases run sequentially (via runCode's shared rate-limited queue), not in parallel.
export async function gradeCodingProblem(testCases, language, sourceCode) {
  if (!language || !(sourceCode || '').trim()) {
    return {
      results: (testCases || []).map((tc) => ({ expected_output: (tc.expected_output || '').trim(), actual_output: '', passed: false, stderr: '', compile_error: 'No solution submitted' })),
      passed: 0, total: (testCases || []).length,
    };
  }
  if (!isConfigured()) {
    const results = notConfiguredResults(testCases);
    return { results, passed: 0, total: results.length };
  }
  const results = [];
  for (const tc of testCases || []) {
    const run = await runCode(language, sourceCode, tc.input || '');
    results.push(gradeTestCase(run, tc.expected_output));
  }
  return { results, passed: results.filter((r) => r.passed).length, total: results.length };
}

// Same resilience as gradeCodingProblem, but for SQL: each test case supplies its own
// `setup_sql` (schema + seed data) that's prepended to the candidate's query before execution.
export async function gradeSqlTestCases(testCases, query) {
  const q = (query || '').trim();
  if (!q) {
    const results = (testCases || []).map((tc) => ({ expected_output: (tc.expected_output || '').trim(), actual_output: '', passed: false, stderr: '', compile_error: 'No solution submitted' }));
    return { results, passed: 0, total: results.length };
  }
  if (!isConfigured()) {
    const results = notConfiguredResults(testCases);
    return { results, passed: 0, total: results.length };
  }
  const results = [];
  for (const tc of testCases || []) {
    const run = await runCode('sql', `${tc.setup_sql}\n${q}`, '');
    results.push(gradeTestCase(run, tc.expected_output));
  }
  return { results, passed: results.filter((r) => r.passed).length, total: results.length };
}
