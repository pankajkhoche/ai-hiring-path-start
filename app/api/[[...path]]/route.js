import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { ask, askJson, resolveProvider, PROVIDERS } from '@/lib/llm';
import { hashPassword, verifyPassword, signToken, verifyToken, computeAccess, hasFeature } from '@/lib/auth';
import { gradeCodingProblem, gradeSqlTestCases } from '@/lib/judge0';
import { isConfigured as razorpayConfigured, createOrder as createRazorpayOrder, verifyPaymentSignature, keyId as razorpayKeyId } from '@/lib/razorpay';

export const runtime = 'nodejs';
// Full technical-assessment grading runs many Judge0 calls in sequence (rate-limited
// to stay under the free-tier requests/sec cap), which can take longer than the
// platform's default function timeout.
export const maxDuration = 60;

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
function json(data, status = 200) { return cors(NextResponse.json(data, { status })); }
function err(message, status = 400) { return json({ error: message }, status); }

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })); }

// ---------- Seed ----------
const PLANS = [
  { id: 'starter', name: 'Starter', price: 0, currency: 'INR', tagline: 'Free forever', features: ['ATS analysis (limited)', 'Basic resume analysis', 'Basic skill gap analysis', 'Limited AI interview sessions', 'Basic dashboard', 'Email support'] },
  { id: 'professional', name: 'Professional', price: 399, currency: 'INR', tagline: 'For serious job seekers', features: ['Everything in Starter', 'Resume builder', 'AI resume rewrite', 'Resume comparison', 'Advanced ATS analysis', 'Career roadmap', 'More AI interviews', 'Priority support'] },
  { id: 'premium', name: 'Premium', price: 599, currency: 'INR', popular: true, tagline: 'Everything unlocked', features: ['All features unlocked', 'Unlimited ATS analysis', 'Unlimited AI interviews', 'AI Career Coach unlimited', 'Portfolio builder', 'Advanced analytics', 'Recruiter visibility boost', 'Early access features', 'Premium support'] },
];

async function ensureSeed(db) {
  for (const p of PLANS) {
    await db.collection('plans').updateOne(
      { id: p.id },
      { $set: { name: p.name, price: p.price, currency: p.currency, tagline: p.tagline, features: p.features, popular: p.popular || false }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }
  const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@aihiringpath.in';
  const admin = await db.collection('users').findOne({ email: adminEmail });
  // Only ever fires on a fresh database -- the real admin account already exists and this
  // never overwrites it. ADMIN_SEED_PASSWORD must be set in the hosting platform's env vars,
  // never hardcoded here (this file is in a public repo).
  if (!admin && process.env.ADMIN_SEED_PASSWORD) {
    await db.collection('users').insertOne({
      id: uuidv4(), name: 'Super Admin', email: adminEmail,
      passwordHash: hashPassword(process.env.ADMIN_SEED_PASSWORD), role: 'SUPER_ADMIN',
      trialStartsAt: new Date(), trialEndsAt: new Date(Date.now() + 3650 * 86400000),
      subscription: null, manualGrant: null, createdAt: new Date(),
    });
  }
}

function publicUser(u) {
  if (!u) return null;
  const access = computeAccess(u);
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    createdAt: u.createdAt, trialEndsAt: u.trialEndsAt,
    subscription: u.subscription || null, manualGrant: u.manualGrant || null,
    access,
  };
}

async function getAuthUser(request, db) {
  const h = request.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.id) return null;
  return db.collection('users').findOne({ id: payload.id });
}

async function logActivity(db, userId, type, message, meta = {}) {
  await db.collection('activity_logs').insertOne({ id: uuidv4(), userId, type, message, meta, createdAt: new Date() });
}

// ---------- Assessment grading ----------
function gradeMcqSection(questions, answers) {
  let correct = 0;
  const perQuestion = (questions || []).map((q, i) => {
    const selected = answers && answers[i] !== undefined ? answers[i] : null;
    const isCorrect = selected === q.correct_index;
    if (isCorrect) correct++;
    return { question: q.question, selected, correct_index: q.correct_index, is_correct: isCorrect };
  });
  const total = (questions || []).length;
  return { score_pct: total ? Math.round((correct / total) * 100) : 0, correct, total, per_question: perQuestion };
}

async function gradeCodingSection(questions, codeAnswers) {
  let totalTc = 0, passedTc = 0;
  const perQuestion = [];
  for (let i = 0; i < (questions || []).length; i++) {
    const q = questions[i];
    const ans = codeAnswers && codeAnswers[i];
    const { results, passed, total } = await gradeCodingProblem(q.test_cases, ans?.language, ans?.source_code);
    totalTc += total; passedTc += passed;
    perQuestion.push({ title: q.title, language: ans?.language, passed_count: passed, total_count: total, test_case_results: results });
  }
  return { score_pct: totalTc ? Math.round((passedTc / totalTc) * 100) : 0, passed_count: passedTc, total_count: totalTc, per_question: perQuestion };
}

async function gradeSqlSection(sqlQuestion, sqlAnswer) {
  const { results, passed, total } = await gradeSqlTestCases(sqlQuestion?.test_cases || [], sqlAnswer?.source_code);
  return { score_pct: total ? Math.round((passed / total) * 100) : 0, passed_count: passed, total_count: total, test_case_results: results };
}

async function seedJobs(db) {
  const sample = [
    { title: 'Frontend Engineer', company: 'Razorpay', location: 'Bengaluru', type: 'Full-time', ctc: '₹18-28 LPA', skills: ['React', 'TypeScript', 'Tailwind'], description: 'Build and scale the merchant-facing dashboard used by hundreds of thousands of businesses. Own performance, accessibility and design-system consistency across the product.', applyUrl: 'https://razorpay.com/jobs/', match: 92, remote: true },
    { title: 'Backend Developer', company: 'Zerodha', location: 'Bengaluru', type: 'Full-time', ctc: '₹20-32 LPA', skills: ['Python', 'FastAPI', 'PostgreSQL'], description: 'Work on high-throughput trading and settlement systems where correctness and latency both matter. Design APIs consumed by millions of retail investors.', applyUrl: 'https://zerodha.com/careers/', match: 88, remote: false },
    { title: 'Data Scientist', company: 'Swiggy', location: 'Hyderabad', type: 'Full-time', ctc: '₹22-35 LPA', skills: ['ML', 'Python', 'SQL'], description: 'Build demand-forecasting and delivery-time-prediction models that directly shape the ordering experience for tens of millions of users.', applyUrl: 'https://careers.swiggy.com/', match: 81, remote: true },
    { title: 'Full Stack Engineer', company: 'CRED', location: 'Bengaluru', type: 'Full-time', ctc: '₹25-40 LPA', skills: ['Node', 'React', 'AWS'], description: 'End-to-end ownership of consumer-facing rewards and payments flows, from API design to pixel-perfect UI.', applyUrl: 'https://careers.cred.club/', match: 90, remote: true },
    { title: 'Product Designer', company: 'Zomato', location: 'Gurugram', type: 'Full-time', ctc: '₹16-26 LPA', skills: ['Figma', 'UX', 'Design Systems'], description: 'Shape the ordering and discovery experience for one of India’s largest consumer apps, partnering closely with product and engineering.', applyUrl: 'https://www.zomato.com/careers', match: 76, remote: false },
    { title: 'DevOps Engineer', company: 'PhonePe', location: 'Pune', type: 'Full-time', ctc: '₹19-30 LPA', skills: ['Kubernetes', 'AWS', 'CI/CD'], description: 'Operate and harden the infrastructure behind a payments platform processing billions of transactions, with a strong focus on reliability and security.', applyUrl: 'https://www.phonepe.com/careers/', match: 84, remote: true },
    { title: 'AI/ML Engineer', company: 'Freshworks', location: 'Chennai', type: 'Full-time', ctc: '₹24-38 LPA', skills: ['LLM', 'PyTorch', 'MLOps'], description: 'Build and ship applied ML features across the Freshworks product suite, from prototyping to production MLOps.', applyUrl: 'https://www.freshworks.com/company/careers/', match: 79, remote: true },
    { title: 'Mobile Engineer', company: 'Meesho', location: 'Bengaluru', type: 'Full-time', ctc: '₹18-29 LPA', skills: ['React Native', 'iOS', 'Android'], description: 'Build for the next 500 million users on a mobile-first commerce platform, optimizing for low-end devices and patchy networks.', applyUrl: 'https://careers.meesho.com/', match: 73, remote: false },
  ];
  await db.collection('jobs').insertMany(sample.map((j) => ({ id: uuidv4(), ...j, postedAt: new Date() })));
}

// ---------- Router ----------
async function handle(request, { params }) {
  const { path = [] } = await params;
  const route = '/' + path.join('/');
  const method = request.method;
  let body = {};
  const contentType = request.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');
  if (['POST', 'PUT', 'PATCH'].includes(method) && !isMultipart) { try { body = await request.json(); } catch { body = {}; } }

  try {
    const db = await getDb();
    await ensureSeed(db);

    if (route === '/' || route === '/root') return json({ status: 'ok', product: 'AI Hiring Path', providers: Object.keys(PROVIDERS) });

    // ===== Auth =====
    if (route === '/auth/register' && method === 'POST') {
      const { name, email, password, role } = body;
      if (!name || !email || !password) return err('name, email and password are required');
      const exists = await db.collection('users').findOne({ email: String(email).toLowerCase() });
      if (exists) return err('An account with this email already exists', 409);
      const allowedRoles = ['CANDIDATE', 'RECRUITER'];
      const now = new Date();
      const user = {
        id: uuidv4(), name, email: String(email).toLowerCase(), passwordHash: hashPassword(password),
        role: allowedRoles.includes(role) ? role : 'CANDIDATE',
        trialStartsAt: now, trialEndsAt: new Date(now.getTime() + 90 * 86400000),
        subscription: null, manualGrant: null, profile: {}, createdAt: now,
      };
      await db.collection('users').insertOne(user);
      await logActivity(db, user.id, 'account', 'Account created with 3-month Premium trial');
      const token = signToken({ id: user.id, role: user.role });
      return json({ token, user: publicUser(user) });
    }

    if (route === '/auth/login' && method === 'POST') {
      const { email, password } = body;
      if (!email || !password) return err('email and password are required');
      const user = await db.collection('users').findOne({ email: String(email).toLowerCase() });
      if (!user || !verifyPassword(password, user.passwordHash)) return err('Invalid email or password', 401);
      const token = signToken({ id: user.id, role: user.role });
      return json({ token, user: publicUser(user) });
    }

    if (route === '/auth/me' && method === 'GET') {
      const user = await getAuthUser(request, db);
      if (!user) return err('Unauthorized', 401);
      return json({ user: publicUser(user) });
    }

    // ===== Auth required below =====
    const authUser = await getAuthUser(request, db);
    const requireAuth = () => { if (!authUser) throw { _status: 401, message: 'Unauthorized' }; };
    const access = authUser ? computeAccess(authUser) : null;

    // ===== AI: ATS =====
    if (route === '/ai/ats' && method === 'POST') {
      requireAuth();
      const { resume, jobDescription, provider } = body;
      if (!resume || resume.trim().length < 40) return err('Please provide a resume with enough content to analyze');
      const jd = jobDescription && jobDescription.trim().length > 10 ? jobDescription : "General role in the candidate's field. Infer likely requirements.";
      const prompt = `Analyze this resume against the job description as a strict ATS system. Return ONLY JSON (no markdown) exactly:
{"overallScore":0,"matchRate":0,"matchedSkills":[],"missingSkills":[],"strengths":[],"improvements":[],"keywords":{"present":[],"missing":[]},"sectionScores":{"experience":0,"skills":0,"education":0,"formatting":0,"impact":0},"summary":""}
All scores 0-100. Be honest and specific.

RESUME:
${resume.slice(0, 8000)}

JOB DESCRIPTION:
${jd.slice(0, 4000)}`;
      const { data, provider: used, model } = await askJson({ provider, systemMessage: 'You are a conservative resume ATS evaluator. Never invent experience.', prompt, maxTokens: 2500 });
      const record = { id: uuidv4(), userId: authUser.id, ...data, provider: used, model, jobDescription: jd.slice(0, 500), createdAt: new Date() };
      await db.collection('ats_reports').insertOne(record);
      await logActivity(db, authUser.id, 'ats', `ATS analysis completed — score ${data.overallScore}`, { score: data.overallScore });
      const { _id, provider: _p, model: _m, ...clean } = record;
      return json(clean);
    }

    if (route === '/ai/ats/history' && method === 'GET') {
      requireAuth();
      const rows = await db.collection('ats_reports').find({ userId: authUser.id }).sort({ createdAt: -1 }).limit(50).toArray();
      return json(rows.map(({ _id, provider, model, ...r }) => r));
    }

    // ===== Resume file extraction (PDF/DOCX/TXT) =====
    if (route === '/ai/resume/extract' && method === 'POST') {
      requireAuth();
      const form = await request.formData();
      const file = form.get('file');
      if (!file || typeof file === 'string') return err('No file uploaded');
      const name = (file.name || 'resume').toLowerCase();
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length > 8 * 1024 * 1024) return err('File too large (max 8MB)');
      let text = '';
      try {
        if (name.endsWith('.pdf') || file.type === 'application/pdf') {
          // pdf-parse@1.x is a plain function with no native/canvas dependency --
          // pdf-parse@2.x pulls in pdfjs-dist + @napi-rs/canvas, whose Linux serverless
          // binary doesn't get bundled correctly by Vercel, crashing with "DOMMatrix is
          // not defined" at runtime (only a Windows binary was present in node_modules).
          const pdfParse = (await import('pdf-parse')).default;
          const res = await pdfParse(buf);
          text = res?.text || '';
        } else if (name.endsWith('.docx') || file.type?.includes('officedocument.wordprocessingml')) {
          const mammoth = await import('mammoth');
          text = (await mammoth.extractRawText({ buffer: buf })).value || '';
        } else if (name.endsWith('.txt') || file.type === 'text/plain') {
          text = buf.toString('utf8');
        } else {
          return err('Unsupported file type. Please upload a PDF, DOCX or TXT file.');
        }
      } catch (e) {
        console.error('extract error:', e?.message);
        return err('Could not read that file. Try a different export or paste the text manually.');
      }
      text = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
      if (text.length < 30) return err('We could not extract enough text (scanned image PDFs are not supported). Please paste your resume text.');
      return json({ text, chars: text.length, filename: file.name });
    }

    // ===== LinkedIn profile optimizer =====
    if (route === '/ai/linkedin/optimize' && method === 'POST') {
      requireAuth();
      const { url, profileText, targetRole, provider } = body;
      if (!profileText || profileText.trim().length < 30) return err('Paste your headline/about/experience text to optimize -- LinkedIn blocks automated scraping, so a URL alone is not enough for an accurate result.');
      const prompt = `You are a LinkedIn profile optimization expert. Optimize this profile${targetRole ? ` for the target role: ${targetRole}` : ''}.
Profile URL: ${url || 'not provided'}
Profile content pasted by user:
"""
${(profileText || '').slice(0, 6000)}
"""
Return ONLY JSON:
{"profileScore":0,"headlineOptions":["","",""],"optimizedAbout":"","keywordsToAdd":[],"sectionTips":[{"section":"","tip":""}],"quickWins":[],"summary":""}
profileScore is 0-100. Provide 3 punchy headline options (max ~120 chars each). optimizedAbout is a compelling first-person About section. Be specific and India-market aware.`;
      const { data, provider: used } = await askJson({ provider, systemMessage: 'You are a top LinkedIn personal-branding strategist.', prompt, maxTokens: 2200 });
      await db.collection('linkedin_reports').insertOne({ id: uuidv4(), userId: authUser.id, url: url || null, ...data, provider: used, createdAt: new Date() });
      await logActivity(db, authUser.id, 'linkedin', `LinkedIn profile optimized \u2014 score ${data.profileScore}`, { score: data.profileScore });
      return json({ ...data });
    }

    // ===== AI: Resume rewrite =====
    if (route === '/ai/resume/rewrite' && method === 'POST') {
      requireAuth();
      if (!hasFeature(access, 'resume_rewrite')) return err('Resume rewrite requires the Professional plan or higher', 402);
      const { resume, targetRole, provider } = body;
      if (!resume) return err('resume is required');
      const prompt = `Rewrite/optimize this resume for ATS and impact${targetRole ? ` targeting the role: ${targetRole}` : ''}. Use strong action verbs, quantify achievements, and ATS-friendly formatting. Return the improved resume as clean plain text.\n\nRESUME:\n${resume.slice(0, 8000)}`;
      const { text } = await ask({ provider, systemMessage: 'You are an expert resume writer.', prompt, temperature: 0.5, maxTokens: 2500 });
      await logActivity(db, authUser.id, 'resume', 'AI resume rewrite generated');
      return json({ rewritten: text });
    }

    // ===== AI: Career Coach =====
    if (route === '/ai/chat' && method === 'POST') {
      requireAuth();
      const { message, provider } = body;
      let { sessionId } = body;
      if (!message) return err('message is required');
      if (!sessionId) {
        sessionId = uuidv4();
        await db.collection('chat_sessions').insertOne({ id: sessionId, userId: authUser.id, title: message.slice(0, 60), provider: resolveProvider(provider).provider, createdAt: new Date() });
      }
      const previous = await db.collection('chat_messages').find({ sessionId }, { projection: { _id: 0, role: 1, content: 1 } }).sort({ createdAt: 1 }).limit(30).toArray();
      await db.collection('chat_messages').insertOne({ id: uuidv4(), sessionId, userId: authUser.id, role: 'user', content: message, createdAt: new Date() });
      const { text, provider: used } = await ask({
        provider, sessionId, history: previous, prompt: message, temperature: 0.6, maxTokens: 1800,
        systemMessage: "You are AI Hiring Path's expert Career Coach. Help with resumes, interviews, career guidance, salary negotiation (India context, INR), skill planning and project suggestions. Be practical, encouraging and concise. Use bullet points where helpful.",
      });
      await db.collection('chat_messages').insertOne({ id: uuidv4(), sessionId, userId: authUser.id, role: 'assistant', content: text, createdAt: new Date() });
      return json({ sessionId, reply: text });
    }

    if (route === '/ai/chat/sessions' && method === 'GET') {
      requireAuth();
      const rows = await db.collection('chat_sessions').find({ userId: authUser.id }).sort({ createdAt: -1 }).limit(50).toArray();
      return json(rows.map(({ _id, provider, ...r }) => r));
    }
    if (route.startsWith('/ai/chat/session/') && method === 'GET') {
      requireAuth();
      const sessionId = path[path.length - 1];
      const rows = await db.collection('chat_messages').find({ sessionId, userId: authUser.id }, { projection: { _id: 0, role: 1, content: 1, createdAt: 1 } }).sort({ createdAt: 1 }).toArray();
      return json(rows);
    }

    // ===== AI: Interview =====
    if (route === '/ai/interview/generate' && method === 'POST') {
      requireAuth();
      const { role, type = 'technical', count = 6, provider } = body;
      if (!role) return err('role is required');
      const prompt = `Generate ${count} ${type} interview questions for the role "${role}". Return ONLY JSON:
{"questions":[{"id":1,"question":"","difficulty":"easy|medium|hard","category":"","idealSignals":""}]}`;
      const { data, provider: used } = await askJson({ provider, systemMessage: 'You are an expert technical/HR interviewer.', prompt, maxTokens: 2000 });
      const interviewId = uuidv4();
      await db.collection('interviews').insertOne({ id: interviewId, userId: authUser.id, role, type, questions: data.questions || [], status: 'in_progress', provider: used, createdAt: new Date() });
      await logActivity(db, authUser.id, 'interview', `Started ${type} interview for ${role}`);
      return json({ interviewId, role, type, questions: data.questions || [] });
    }

    if (route === '/ai/interview/evaluate' && method === 'POST') {
      requireAuth();
      const { role, question, answer, provider, interviewId } = body;
      if (!question || !answer) return err('question and answer are required');
      const prompt = `Evaluate this interview answer for role "${role || 'the role'}". Return ONLY JSON:
{"score":0,"strengths":[],"gaps":[],"betterAnswer":"","tip":""}
Score 0-100.
QUESTION: ${question}
CANDIDATE ANSWER: ${answer}`;
      const { data, provider: used } = await askJson({ provider, systemMessage: 'You are a fair, insightful interview evaluator.', prompt, maxTokens: 1500 });
      if (interviewId) {
        await db.collection('interview_feedback').insertOne({ id: uuidv4(), interviewId, userId: authUser.id, question, answer, ...data, provider: used, createdAt: new Date() });
      }
      return json({ ...data });
    }

    if (route === '/ai/interview/complete' && method === 'POST') {
      requireAuth();
      const { interviewId, avgScore, proctoring } = body;
      if (interviewId) await db.collection('interviews').updateOne({ id: interviewId, userId: authUser.id }, { $set: { status: 'completed', avgScore, proctoring: proctoring || null, completedAt: new Date() } });
      await logActivity(db, authUser.id, 'interview', `Completed interview — avg score ${avgScore ?? 'n/a'}`, { score: avgScore });
      return json({ ok: true });
    }

    if (route === '/ai/interview/history' && method === 'GET') {
      requireAuth();
      const rows = await db.collection('interviews').find({ userId: authUser.id }).sort({ createdAt: -1 }).limit(50).toArray();
      return json(rows.map(({ _id, provider, ...r }) => r));
    }

    // ===== Assessments (Aptitude / Communication / Technical) =====
    if (route === '/assessments/start' && method === 'POST') {
      requireAuth();
      const { category } = body;
      if (!['aptitude', 'communication', 'technical'].includes(category)) return err('category must be aptitude, communication or technical');

      const doc = { id: uuidv4(), userId: authUser.id, category, status: 'in_progress', createdAt: new Date() };
      let publicPayload = {};

      if (category === 'aptitude') {
        const prompt = `Generate exactly 15 aptitude test questions (logical reasoning, numerical reasoning, and problem-solving) at medium difficulty for a job-seeking candidate. Return ONLY JSON:
{"questions":[{"id":1,"question":"","options":["","","",""],"correct_index":0}]}
Each question must have exactly 4 options with exactly one unambiguously correct answer (correct_index 0-3). Return ONLY the JSON.`;
        const { data } = await askJson({ systemMessage: 'You are an expert aptitude-test designer.', prompt, maxTokens: 3000 });
        doc.questions = (data.questions || []).slice(0, 15);
        doc.time_limit_seconds = 20 * 60;
        publicPayload = {
          questions: doc.questions.map((q) => ({ id: q.id, question: q.question, options: q.options })),
          time_limit_seconds: doc.time_limit_seconds,
        };
      }

      if (category === 'communication') {
        const mcqPrompt = `Generate exactly 10 English grammar and verbal-ability questions (fill-in-the-blank, error-spotting, vocabulary/synonyms) for a job-readiness communication assessment, medium difficulty. Return ONLY JSON:
{"questions":[{"id":1,"question":"","options":["","","",""],"correct_index":0}]}
Each question must have exactly 4 options with exactly one correct answer. Return ONLY the JSON.`;
        const passagesPrompt = `Generate exactly 2 short paragraphs (35-55 words each) of general professional/workplace English, suitable for a candidate to read aloud to assess spoken fluency. Vary vocabulary and sentence structure between the two. Return ONLY JSON:
{"passages":[{"id":1,"text":""}]}
Return ONLY the JSON.`;
        const [{ data: mcqData }, { data: passageData }] = await Promise.all([
          askJson({ systemMessage: 'You are an expert English-language assessment designer.', prompt: mcqPrompt, maxTokens: 2200 }),
          askJson({ systemMessage: 'You are an expert English-language assessment designer.', prompt: passagesPrompt, maxTokens: 900 }),
        ]);
        doc.questions = (mcqData.questions || []).slice(0, 10);
        doc.passages = (passageData.passages || []).slice(0, 2);
        doc.mcq_time_limit_seconds = 12 * 60;
        doc.passage_time_limit_seconds = 90;
        publicPayload = {
          questions: doc.questions.map((q) => ({ id: q.id, question: q.question, options: q.options })),
          passages: doc.passages,
          mcq_time_limit_seconds: doc.mcq_time_limit_seconds,
          passage_time_limit_seconds: doc.passage_time_limit_seconds,
        };
      }

      if (category === 'technical') {
        const mcqPrompt = `Generate exactly 15 multiple-choice questions covering core programming, computer-science fundamentals and databases (common languages like JavaScript/Python/Java/C/C++, plus SQL basics) for a technical screening assessment, medium difficulty. These are conceptual/output-prediction questions, not hands-on coding. Return ONLY JSON:
{"questions":[{"id":1,"question":"","options":["","","",""],"correct_index":0}]}
Each question must have exactly 4 options with exactly one correct answer. Return ONLY the JSON.`;
        const codingPrompt = `Generate exactly 3 original coding problems at medium difficulty for a technical assessment. Each problem must be language-agnostic: the solution reads input from stdin and writes the answer to stdout (no function signatures, no starter code -- candidates write a full program). State the exact input format and output format in the description so it's unambiguous. Provide exactly 10 test cases per problem covering typical cases and edge cases. expected_output must be the EXACT stdout text (trailing whitespace is stripped before comparison, but nothing else is normalized). Return ONLY JSON:
{"questions":[{"id":1,"title":"","description":"","constraints":"","test_cases":[{"input":"","expected_output":""}]}]}
Each "questions" item must have exactly 10 "test_cases". Return ONLY the JSON.`;
        const sqlPrompt = `Generate exactly 1 SQL problem for a technical assessment, testing SELECT queries (joins, aggregation, filtering, or subqueries) against a small schema. Provide exactly 5 test cases, each with its OWN "setup_sql" (SQLite-compatible CREATE TABLE + INSERT statements defining the schema and seed data for that case -- vary the data between cases so a hardcoded answer can't pass) and the "expected_output" (the EXACT stdout produced by running "<setup_sql>; <the correct query>;" through the sqlite3 CLI in default mode -- rows separated by newlines, columns separated by '|', trailing whitespace stripped before comparison but nothing else normalized). The candidate will submit only the SELECT query; do not include it in setup_sql. Return ONLY JSON:
{"title":"","description":"","test_cases":[{"setup_sql":"","expected_output":""}]}
Return ONLY the JSON.`;
        const [{ data: mcqData }, { data: codingData }, { data: sqlData }] = await Promise.all([
          askJson({ systemMessage: 'You are an expert technical assessment designer.', prompt: mcqPrompt, maxTokens: 3000 }),
          askJson({ systemMessage: 'You are an expert technical interviewer creating a coding assessment.', prompt: codingPrompt, maxTokens: 4000 }),
          askJson({ systemMessage: 'You are an expert SQL assessment designer. Be precise about exact sqlite3 CLI output formatting.', prompt: sqlPrompt, maxTokens: 2200 }),
        ]);
        doc.mcq_questions = (mcqData.questions || []).slice(0, 15);
        doc.coding_questions = (codingData.questions || []).slice(0, 3);
        doc.sql_question = sqlData || {};
        doc.mcq_time_limit_seconds = 15 * 60;
        publicPayload = {
          mcq_questions: doc.mcq_questions.map((q) => ({ id: q.id, question: q.question, options: q.options })),
          coding_questions: doc.coding_questions.map((q) => ({ id: q.id, title: q.title, description: q.description, constraints: q.constraints, sample_test_cases: (q.test_cases || []).slice(0, 5) })),
          sql_question: { title: doc.sql_question.title, description: doc.sql_question.description, sample_test_cases: (doc.sql_question.test_cases || []).slice(0, 3) },
          mcq_time_limit_seconds: doc.mcq_time_limit_seconds,
        };
      }

      await db.collection('assessments').insertOne(doc);
      await logActivity(db, authUser.id, 'assessment', `Started ${category} assessment`);
      return json({ assessment_id: doc.id, category, ...publicPayload });
    }

    if (route === '/assessments/run-code' && method === 'POST') {
      requireAuth();
      const { assessment_id, section, question_index = 0, language, source_code } = body;
      const a = await db.collection('assessments').findOne({ id: assessment_id, userId: authUser.id });
      if (!a) return err('Assessment not found', 404);
      if (section === 'coding') {
        const q = (a.coding_questions || [])[question_index];
        if (!q) return err('Invalid question_index');
        const samples = (q.test_cases || []).slice(0, 5);
        const { results } = await gradeCodingProblem(samples, language, source_code);
        return json({ results });
      }
      if (section === 'sql') {
        const samples = (a.sql_question?.test_cases || []).slice(0, 3);
        const { results } = await gradeSqlTestCases(samples, source_code);
        return json({ results });
      }
      return err('section must be "coding" or "sql"');
    }

    if (route === '/assessments/submit' && method === 'POST') {
      requireAuth();
      const { assessment_id, answers, mcq_answers, passage_results, coding_answers, sql_answer, proctoring } = body;
      const a = await db.collection('assessments').findOne({ id: assessment_id, userId: authUser.id });
      if (!a) return err('Assessment not found', 404);
      if (a.status === 'completed') return err('Assessment already submitted', 409);

      let result = {};
      if (a.category === 'aptitude') {
        const mcq = gradeMcqSection(a.questions, answers || []);
        result = { score_pct: mcq.score_pct, mcq };
      } else if (a.category === 'communication') {
        const mcq = gradeMcqSection(a.questions, mcq_answers || []);
        const passageScores = (passage_results || []).map((p) => Number(p.score) || 0);
        const avgPassage = passageScores.length ? Math.round(passageScores.reduce((s, v) => s + v, 0) / passageScores.length) : 0;
        const score_pct = passageScores.length ? Math.round((mcq.score_pct + avgPassage) / 2) : mcq.score_pct;
        result = { score_pct, mcq, passage_results: passage_results || [], avg_passage_score: avgPassage };
      } else if (a.category === 'technical') {
        const mcq = gradeMcqSection(a.mcq_questions, mcq_answers || []);
        const coding = await gradeCodingSection(a.coding_questions, coding_answers || []);
        const sql = await gradeSqlSection(a.sql_question, sql_answer || {});
        const score_pct = Math.round(mcq.score_pct * 0.3 + coding.score_pct * 0.5 + sql.score_pct * 0.2);
        result = { score_pct, sections: { mcq, coding, sql } };
      }

      await db.collection('assessments').updateOne({ id: assessment_id }, { $set: { status: 'completed', result, proctoring: proctoring || null, completedAt: new Date() } });
      await logActivity(db, authUser.id, 'assessment', `Completed ${a.category} assessment — score ${result.score_pct}`, { score: result.score_pct });
      return json({ assessment_id, category: a.category, proctoring: proctoring || null, ...result });
    }

    if (route === '/assessments/history' && method === 'GET') {
      requireAuth();
      const rows = await db.collection('assessments').find({ userId: authUser.id, status: 'completed' }).sort({ completedAt: -1 }).limit(50).toArray();
      return json(rows.map(({ _id, questions, mcq_questions, coding_questions, sql_question, passages, ...r }) => r));
    }

    // ===== AI: Pronunciation (Communication assessment read-aloud scoring) =====
    if (route === '/ai/pronunciation/score' && method === 'POST') {
      requireAuth();
      const { referenceText, transcript, wpm } = body;
      if (!referenceText || !transcript) return err('referenceText and transcript are required');
      const refWords = referenceText.toLowerCase().replace(/[^a-z0-9\s']/g, '').split(/\s+/).filter(Boolean);
      const gotWords = (transcript || '').toLowerCase().replace(/[^a-z0-9\s']/g, '').split(/\s+/).filter(Boolean);
      const refSet = new Map();
      refWords.forEach((w) => refSet.set(w, (refSet.get(w) || 0) + 1));
      let matched = 0;
      gotWords.forEach((w) => { if (refSet.get(w) > 0) { matched++; refSet.set(w, refSet.get(w) - 1); } });
      const matchPct = refWords.length ? Math.round((matched / refWords.length) * 100) : 0;
      const prompt = `A candidate was asked to read this paragraph aloud:
"""
${referenceText}
"""
Speech-to-text captured this transcript of what they said:
"""
${transcript}
"""
They spoke at approximately ${wpm || 'an unknown'} words per minute (natural conversational pace is ~130-160 wpm).
Word-match against the reference: ${matchPct}%.
Based ONLY on the transcript, word-match and pace, give a holistic clarity/fluency score and brief tips. Note explicitly that this is a transcript-based estimate, not true phoneme-level pronunciation analysis. Return ONLY JSON:
{"score":0,"feedback":"","tips":[""]}
score is 0-100.`;
      const { data } = await askJson({ systemMessage: 'You are a supportive spoken-English fluency coach.', prompt, maxTokens: 700 });
      return json({ score: data.score ?? matchPct, matchPct, wpm: wpm || null, feedback: data.feedback || '', tips: data.tips || [] });
    }

    // ===== AI: Career Roadmap =====
    if (route === '/ai/roadmap/generate' && method === 'POST') {
      requireAuth();
      const { domain, role, experienceLevel, yearsOfExperience, timelineMonths } = body;
      if (!domain || !role) return err('domain and role are required');
      const months = [3, 6, 12].includes(Number(timelineMonths)) ? Number(timelineMonths) : 6;
      const expLine = experienceLevel === 'experienced'
        ? `an experienced professional with ${yearsOfExperience || 'several'} years of experience`
        : 'a fresher with little to no professional experience';
      const prompt = `Build a ${months}-month career roadmap for ${expLine}, in the "${domain}" domain, targeting the role "${role}". Break it into monthly milestones with weekly focus areas, concrete resources/topics, and a project or portfolio milestone per month. Calibrate difficulty and starting point to their experience level. Return ONLY JSON:
{"summary":"","months":[{"month":1,"theme":"","weeks":[{"week":1,"focus":"","resources":[""]}],"milestone":""}]}
Provide exactly ${months} "months" entries. Return ONLY the JSON.`;
      const { data } = await askJson({ systemMessage: 'You are an expert career-development strategist.', prompt, maxTokens: 3500 });
      const record = { id: uuidv4(), userId: authUser.id, domain, role, experienceLevel: experienceLevel || 'fresher', yearsOfExperience: yearsOfExperience || null, timelineMonths: months, ...data, createdAt: new Date() };
      await db.collection('roadmaps').insertOne(record);
      await logActivity(db, authUser.id, 'roadmap', `Generated ${months}-month roadmap for ${role}`);
      const { _id, ...clean } = record;
      return json(clean);
    }

    if (route === '/ai/roadmap/history' && method === 'GET') {
      requireAuth();
      const rows = await db.collection('roadmaps').find({ userId: authUser.id }).sort({ createdAt: -1 }).limit(20).toArray();
      return json(rows.map(({ _id, ...r }) => r));
    }

    // ===== Skill Gap =====
    if (route === '/ai/skills/gap' && method === 'POST') {
      requireAuth();
      const { currentSkills, targetRole, provider } = body;
      if (!targetRole) return err('targetRole is required');
      const prompt = `The candidate wants to become a "${targetRole}". Current skills: ${currentSkills || 'unknown'}. Return ONLY JSON:
{"targetRole":"","haveSkills":[],"missingSkills":[{"skill":"","importance":"high|medium|low","weeksToLearn":0}],"radar":[{"area":"","current":0,"required":0}],"roadmap":[{"week":1,"focus":"","resources":[""]}],"summary":""}
radar areas should have 5-6 entries with values 0-100.`;
      const { data, provider: used } = await askJson({ provider, systemMessage: 'You are a career skills strategist.', prompt, maxTokens: 2500 });
      await db.collection('skill_analyses').insertOne({ id: uuidv4(), userId: authUser.id, ...data, provider: used, createdAt: new Date() });
      await logActivity(db, authUser.id, 'skills', `Skill gap analysis for ${targetRole}`);
      return json({ ...data });
    }

    // ===== Jobs =====
    if (route === '/jobs' && method === 'GET') {
      requireAuth();
      let jobs = await db.collection('jobs').find({}).limit(60).toArray();
      if (jobs.length === 0) { await seedJobs(db); jobs = await db.collection('jobs').find({}).limit(60).toArray(); }
      const saved = await db.collection('saved_jobs').find({ userId: authUser.id }, { projection: { jobId: 1 } }).toArray();
      const savedSet = new Set(saved.map((s) => s.jobId));
      return json(jobs.map(({ _id, ...j }) => ({ ...j, saved: savedSet.has(j.id) })));
    }
    if (route === '/jobs/save' && method === 'POST') {
      requireAuth();
      const { jobId } = body; if (!jobId) return err('jobId required');
      const ex = await db.collection('saved_jobs').findOne({ userId: authUser.id, jobId });
      if (ex) { await db.collection('saved_jobs').deleteOne({ userId: authUser.id, jobId }); return json({ saved: false }); }
      await db.collection('saved_jobs').insertOne({ id: uuidv4(), userId: authUser.id, jobId, createdAt: new Date() });
      return json({ saved: true });
    }

    // ===== Dashboard =====
    if (route === '/dashboard/stats' && method === 'GET') {
      requireAuth();
      const ats = await db.collection('ats_reports').find({ userId: authUser.id }).sort({ createdAt: 1 }).limit(20).toArray();
      const interviews = await db.collection('interviews').find({ userId: authUser.id, status: 'completed' }).sort({ createdAt: 1 }).limit(20).toArray();
      const skills = await db.collection('skill_analyses').find({ userId: authUser.id }).sort({ createdAt: -1 }).limit(1).toArray();
      const activity = await db.collection('activity_logs').find({ userId: authUser.id }).sort({ createdAt: -1 }).limit(8).toArray();
      const latestAts = ats[ats.length - 1];
      const atsTrend = ats.map((a, i) => ({ name: `#${i + 1}`, score: a.overallScore }));
      const interviewTrend = interviews.map((a, i) => ({ name: `#${i + 1}`, score: a.avgScore || 0 }));
      const radar = skills[0]?.radar || [];
      const weekly = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => ({ day: d, actions: 0 }));
      activity.forEach((a) => { const idx = new Date(a.createdAt).getDay(); const map = [6, 0, 1, 2, 3, 4, 5]; weekly[map[idx]].actions += 1; });
      const avgInterview = interviews.length ? (interviews.reduce((s, i) => s + (i.avgScore || 0), 0) / interviews.length) : 0;
      const readiness = Math.round(((latestAts?.overallScore || 0) * 0.5) + (avgInterview * 0.5));
      return json({
        atsScore: latestAts?.overallScore || null,
        resumeHealth: latestAts ? Math.round(((latestAts.sectionScores?.formatting || 0) + (latestAts.sectionScores?.skills || 0)) / 2) : null,
        interviewReadiness: readiness,
        interviewsTaken: interviews.length,
        atsTrend, interviewTrend, radar, weekly,
        recentActivity: activity.map(({ _id, ...a }) => a),
      });
    }

    if (route === '/dashboard/recommendations' && method === 'GET') {
      requireAuth();
      const ats = await db.collection('ats_reports').find({ userId: authUser.id }).sort({ createdAt: -1 }).limit(1).toArray();
      const context = ats[0] ? `Latest ATS score ${ats[0].overallScore}, missing skills: ${(ats[0].missingSkills || []).join(', ')}` : 'No analyses yet.';
      const prompt = `Give 4 short, personalized career action recommendations for this candidate. Context: ${context}. Return ONLY JSON: {"recommendations":[{"title":"","detail":"","action":""}]}`;
      const { data } = await askJson({ provider: 'gemini', systemMessage: 'You are a career advisor.', prompt, maxTokens: 900 });
      return json(data);
    }

    // ===== Billing =====
    if (route === '/billing/plans' && method === 'GET') {
      const plans = await db.collection('plans').find({}).toArray();
      return json(plans.map(({ _id, ...p }) => p));
    }
    if (route === '/billing/me' && method === 'GET') {
      requireAuth();
      const payments = await db.collection('payments').find({ userId: authUser.id }).sort({ createdAt: -1 }).limit(20).toArray();
      return json({ access, subscription: authUser.subscription || null, trialEndsAt: authUser.trialEndsAt, payments: payments.map(({ _id, ...p }) => p) });
    }
    if (route === '/billing/checkout' && method === 'POST') {
      requireAuth();
      const { plan: planId } = body; if (!planId) return err('plan required');
      const plan = await db.collection('plans').findOne({ id: planId });
      if (!plan) return err('Invalid plan', 400);
      if (plan.price === 0) return err('Free plan needs no checkout', 400);
      if (!razorpayConfigured()) {
        return json({ status: 'payment_not_configured', message: 'Razorpay is not yet connected. Add your Razorpay keys to enable live checkout. Your 3-month Premium trial is already active.' }, 200);
      }
      const order = await createRazorpayOrder({
        amountInRupees: plan.price,
        currency: plan.currency || 'INR',
        receipt: `${authUser.id}_${plan.id}_${Date.now()}`.slice(0, 40),
        notes: { userId: authUser.id, plan: plan.id },
      });
      return json({
        status: 'created', orderId: order.id, amount: order.amount, currency: order.currency,
        keyId: razorpayKeyId, plan: plan.id, planName: plan.name,
        userName: authUser.name, userEmail: authUser.email,
      });
    }
    if (route === '/billing/verify' && method === 'POST') {
      requireAuth();
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan: planId } = body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId) return err('Missing payment details');
      const valid = verifyPaymentSignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature });
      if (!valid) return err('Payment verification failed', 400);
      const plan = await db.collection('plans').findOne({ id: planId });
      if (!plan) return err('Invalid plan', 400);
      const currentPeriodEnd = new Date(Date.now() + 30 * 86400000);
      await db.collection('users').updateOne({ id: authUser.id }, { $set: {
        subscription: { plan: plan.id, status: 'active', currentPeriodEnd, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id },
      } });
      await db.collection('payments').insertOne({
        id: uuidv4(), userId: authUser.id, plan: plan.id, amount: plan.price, currency: plan.currency || 'INR',
        razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, status: 'success', createdAt: new Date(),
      });
      return json({ status: 'success' });
    }

    // ===== Admin =====
    const isAdmin = authUser && ['SUPER_ADMIN', 'ADMIN'].includes(authUser.role);
    if (route.startsWith('/admin')) {
      requireAuth();
      if (!isAdmin) return err('Forbidden — admin only', 403);

      if (route === '/admin/users' && method === 'GET') {
        const users = await db.collection('users').find({}).sort({ createdAt: -1 }).limit(500).toArray();
        return json(users.map((u) => publicUser(u)));
      }
      if (route === '/admin/grant-access' && method === 'POST') {
        const { email, plan, expiresAt, note } = body;
        if (!email || !plan) return err('email and plan are required');
        const target = await db.collection('users').findOne({ email: String(email).toLowerCase() });
        if (!target) return err('No user found with that email', 404);
        const grant = { plan, expiresAt: expiresAt || null, note: note || '', grantedBy: authUser.email, grantedAt: new Date() };
        await db.collection('users').updateOne({ id: target.id }, { $set: { manualGrant: grant } });
        await db.collection('manual_access_grants').insertOne({ id: uuidv4(), userId: target.id, ...grant });
        return json({ ok: true, email, plan });
      }
      if (route === '/admin/revoke-access' && method === 'POST') {
        const { email } = body;
        const target = await db.collection('users').findOne({ email: String(email).toLowerCase() });
        if (!target) return err('No user found', 404);
        await db.collection('users').updateOne({ id: target.id }, { $set: { manualGrant: null } });
        return json({ ok: true });
      }
      if (route === '/admin/subscriptions' && method === 'GET') {
        const users = await db.collection('users').find({}).toArray();
        let trial = 0, paid = 0, free = 0, granted = 0, expiring = 0;
        const planDist = { starter: 0, professional: 0, premium: 0, free: 0 };
        users.forEach((u) => {
          const a = computeAccess(u);
          if (a.source === 'trial') { trial++; if (a.trialDaysLeft <= 7) expiring++; }
          else if (a.source === 'subscription') paid++;
          else if (a.source === 'manual_grant') granted++;
          else if (a.source === 'free') free++;
          planDist[a.tier] = (planDist[a.tier] || 0) + 1;
        });
        const mrr = paid * 499;
        return json({
          totalUsers: users.length, trial, paid, free, granted, expiring,
          mrr, arr: mrr * 12,
          planDistribution: Object.entries(planDist).map(([name, value]) => ({ name, value })),
        });
      }

      // ---- Jobs management ----
      if (route === '/admin/jobs' && method === 'GET') {
        const jobs = await db.collection('jobs').find({}).sort({ postedAt: -1 }).limit(200).toArray();
        return json(jobs.map(({ _id, ...j }) => j));
      }
      if (route === '/admin/jobs' && method === 'POST') {
        const { title, company, location, type, ctc, skills, description, applyUrl, remote } = body;
        if (!title || !company || !applyUrl) return err('title, company and applyUrl are required');
        const job = {
          id: uuidv4(), title, company, location: location || '', type: type || 'Full-time',
          ctc: ctc || '', skills: Array.isArray(skills) ? skills : String(skills || '').split(',').map((s) => s.trim()).filter(Boolean),
          description: description || '', applyUrl, remote: !!remote, match: null,
          postedAt: new Date(), createdBy: authUser.email,
        };
        await db.collection('jobs').insertOne(job);
        const { _id, ...clean } = job;
        return json(clean, 201);
      }
      if (path[0] === 'admin' && path[1] === 'jobs' && path[2] && method === 'PUT') {
        const jobId = path[2];
        const { title, company, location, type, ctc, skills, description, applyUrl, remote } = body;
        const update = { title, company, location, type, ctc, description, applyUrl, remote: !!remote };
        if (skills !== undefined) update.skills = Array.isArray(skills) ? skills : String(skills || '').split(',').map((s) => s.trim()).filter(Boolean);
        Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);
        const res = await db.collection('jobs').findOneAndUpdate({ id: jobId }, { $set: update }, { returnDocument: 'after' });
        if (!res) return err('Job not found', 404);
        const { _id, ...clean } = res;
        return json(clean);
      }
      if (path[0] === 'admin' && path[1] === 'jobs' && path[2] && method === 'DELETE') {
        const jobId = path[2];
        await db.collection('jobs').deleteOne({ id: jobId });
        await db.collection('saved_jobs').deleteMany({ jobId });
        return json({ ok: true });
      }
    }

    return err(`Route ${route} not found`, 404);
  } catch (e) {
    if (e && e._status) return err(e.message, e._status);
    console.error('API error:', e?.message, e?.stack);
    const msg = String(e?.message || '');
    if (/budget/i.test(msg)) return err('AI usage limit reached for this key. Please add credit / a higher-budget key to continue using AI features.', 402);
    if (/rate.?limit|429/i.test(msg)) return err('AI service is busy right now, please retry in a few seconds.', 429);
    if (msg.includes('JSON')) return err('AI returned an unexpected format, please retry', 502);
    return err('Internal server error', 500);
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
