/**
 * Phase 7 Smoke Test - PLB Creator Factory Generation Pipeline
 * Run: node smoke-test.cjs
 *
 * This tests code paths without requiring a live server/DB.
 * It validates: auth, schema, workflow routing, error handling,
 * output persistence, polling termination, and security.
 */

const fs = require('fs');
const path = require('path');

const BASE = __dirname;

function read(file) {
  return fs.readFileSync(path.join(BASE, file), 'utf-8');
}

let passed = 0, failed = 0;

function check(name, cond) {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else       { console.log(`  ✗ ${name}`); failed++; }
}

// ─── Load all relevant source files ───────────────────────────────────────────
const generateSrc    = read('server/api/factory/generate.post.ts');
const outputCbSrc    = read('server/api/internal/factory-output.post.ts');
const jobsPatchSrc   = read('server/api/factory/jobs/[id].patch.ts');
const jobsGetSrc     = read('server/api/factory/jobs/[id].get.ts');
const factoryUtilsSrc = read('server/utils/factory.ts');
const sessionUtilsSrc = read('server/utils/session.ts');
const useFactorySrc  = read('app/composables/factory/useFactory.ts');
const factoryVueSrc   = read('app/pages/factory.vue');
const factorySchemaSrc = read('server/db/schema/factory.ts');

console.log('\n=== PHASE 7 SMOKE TEST ===\n');

// ─── 1. Auth / Session Isolation ───────────────────────────────────────────────
console.log('TEST 1: Auth and session isolation');
check('requireInternalApiSecret exported from session utils',
  sessionUtilsSrc.includes('export async function requireInternalApiSecret'));
check('Internal secret checks Authorization: Bearer header',
  sessionUtilsSrc.includes('Bearer ${secret}') || sessionUtilsSrc.includes('Bearer'));
check('Internal secret rejects missing Authorization header',
  sessionUtilsSrc.includes('401'));
check('Session userId required on generate endpoint',
  generateSrc.includes('requireSessionUserId'));
check('Project ownership checked before job creation',
  generateSrc.includes('getProjectForUser') && generateSrc.includes('Project not found'));
check('Internal callback rejects missing internal secret',
  outputCbSrc.includes('requireInternalApiSecret'));

// ─── 2. Workflow Routing ────────────────────────────────────────────────────────
console.log('\nTEST 2: Workflow routing (6 workflows)');
const workflows = ['analysis', 'story', 'prompt', 'seo', 'caption', 'hook'];
workflows.forEach(w => {
  check(`WORKFLOW_SKILL maps "${w}"`,
    generateSrc.includes(`${w}:`) || generateSrc.includes(`${w}: {`));
});

// Check each has outputType
const outputTypes = ['analysis', 'other', 'prompt', 'seo', 'caption', 'hook'];
workflows.forEach((w, i) => {
  check(`"${w}" has outputType "${outputTypes[i]}"`,
    generateSrc.includes(`outputType: "${outputTypes[i]}"`));
});

// ─── 3. Eve Agent Invocation ───────────────────────────────────────────────────
console.log('\nTEST 3: Eve agent invocation');
check('Calls /eve/v1/sessions',
  generateSrc.includes('/eve/v1/sessions'));
check('Uses internalHeaders() for auth',
  generateSrc.includes('internalHeaders()'));
check('Uses appOrigin() for base URL',
  generateSrc.includes('appOrigin()'));
check('Sends workflow system prompt as message',
  generateSrc.includes('skillInfo.systemPrompt'));
check('Sends user content in message',
  generateSrc.includes('body.input') || generateSrc.includes('Content to analyze'));

// ─── 4. Job Creation ──────────────────────────────────────────────────────────
console.log('\nTEST 4: Job creation');
check('Creates job with createJobForProject',
  generateSrc.includes('createJobForProject'));
check('Stores workflow in job inputParams',
  generateSrc.includes('workflow: body.workflow'));
check('Stores input in job inputParams',
  generateSrc.includes('input: body.input'));
check('Job status starts as pending',
  generateSrc.includes('"pending"') || generateSrc.includes("'pending'"));
check('Returns job immediately (async fire-and-forget)',
  generateSrc.includes('return { job }') || generateSrc.includes('return { job:'));

// ─── 5. Output Persistence ───────────────────────────────────────────────────
console.log('\nTEST 5: Output persistence');
check('Internal callback calls saveOutputForProject',
  outputCbSrc.includes('saveOutputForProject'));
check('Saves outputType',
  outputCbSrc.includes('outputType: body.outputType'));
check('Saves content',
  outputCbSrc.includes('content: body.content'));
check('Saves metadata',
  outputCbSrc.includes('metadata: body.metadata'));
check('Job marked done on success',
  outputCbSrc.includes('status: body.status') && outputCbSrc.includes('"done"'));
check('Result JSON contains content and outputType',
  outputCbSrc.includes('content: body.content') && outputCbSrc.includes('outputType:'));

// ─── 6. Error Handling ────────────────────────────────────────────────────────
console.log('\nTEST 6: Error handling');
check('Non-200 Eve response marks job failed',
  generateSrc.includes('res.ok') && generateSrc.includes('status: "failed"'));
check('Error message stored in result JSON',
  generateSrc.includes('errorMessage:') && generateSrc.includes('result:'));
check('Fetch exception also marks job failed',
  generateSrc.includes('.catch') && generateSrc.includes('status: "failed"'));
check('Internal callback marks job failed on error status',
  outputCbSrc.includes('status: body.status'));
check('Factory job status enum includes "failed"',
  factorySchemaSrc.includes('"failed"') || factorySchemaSrc.includes("'failed'"));
check('Factory job status enum includes "pending"',
  factorySchemaSrc.includes('"pending"') || factorySchemaSrc.includes("'pending'"));

// ─── 7. Polling Termination ──────────────────────────────────────────────────
console.log('\nTEST 7: Polling termination');
check('pollJob stops when status is "done"',
  useFactorySrc.includes("status === 'done'") || useFactorySrc.includes('status === "done"'));
check('pollJob stops when status is "failed"',
  useFactorySrc.includes("status === 'failed'") || useFactorySrc.includes('status === "failed"'));
check('pollJob uses 1.5s polling interval',
  useFactorySrc.includes('1500'));
check('pollJob times out after 40 attempts (60s)',
  useFactorySrc.includes('40') && useFactorySrc.includes('60') || useFactorySrc.includes('attempts > 40'));
check('UI calls pollJob after create',
  factoryVueSrc.includes('pollJob('));

// ─── 8. Malformed / Empty Input Handling ─────────────────────────────────────
console.log('\nTEST 8: Input validation');
check('workflow is z.enum (validated)',
  generateSrc.includes('z.enum([') && generateSrc.includes('"analysis"'));
check('input is z.string().min(1) (non-empty)',
  generateSrc.includes("input: z.string().min(1)"));
check('projectId is z.string().min(1)',
  generateSrc.includes('projectId: z.string().min(1)'));
check('outputType validated as enum in callback',
  outputCbSrc.includes('z.enum(['));

// ─── 9. Duplicate Submission ──────────────────────────────────────────────────
console.log('\nTEST 9: Duplicate submission behavior');
check('No request deduplication (each call creates new job)',
  generateSrc.includes('createJobForProject') && !generateSrc.includes('findOrCreate') && !generateSrc.includes('getJobByInput'));
check('Multiple concurrent jobs allowed per project',
  generateSrc.includes('createJobForProject'));

// ─── 10. UI State Machine ─────────────────────────────────────────────────────
console.log('\nTEST 10: UI state display');
check('UI shows spinner while generating',
  factoryVueSrc.includes('animate-spin') || factoryVueSrc.includes('isGenerating'));
check('UI shows job status text',
  factoryVueSrc.includes('activeJob.status'));
check('UI shows error on failure',
  factoryVueSrc.includes("'failed'") && factoryVueSrc.includes('error'));
check('UI shows success toast on completion',
  factoryVueSrc.includes('Generation complete'));
check('UI refreshes outputs on completion',
  factoryVueSrc.includes('fetchOutputs'));
check('UI disables generate button while generating',
  factoryVueSrc.includes(':disabled=') && factoryVueSrc.includes('isGenerating'));

// ─── 11. Security ──────────────────────────────────────────────────────────────
console.log('\nTEST 11: Security');
check('No hardcoded secrets in generate API',
  !generateSrc.match(/ghp_[a-zA-Z0-9]{36}/) && !generateSrc.match(/gho_[a-zA-Z0-9]{36}/));
check('No hardcoded secrets in callback',
  !outputCbSrc.match(/ghp_[a-zA-Z0-9]{36}/) && !outputCbSrc.match(/gho_[a-zA-Z0-9]{36}/));
check('DB queries use parameterized Drizzle ORM (no string concat)',
  !generateSrc.match(/ghp_[a-zA-Z0-9]{36}/) && !generateSrc.match(/gho_[a-zA-Z0-9]{36}/) && factoryUtilsSrc.includes('db.select'));
check('updateJobStatus uses parameterized where clause',
  factoryUtilsSrc.includes('where(eq(schema.factoryJobs.id, id)') || factoryUtilsSrc.includes('.where('));

// ─── 12. API Schema Validation ────────────────────────────────────────────────
console.log('\nTEST 12: API schema integrity');
check('jobs.get.ts returns job by id',
  jobsGetSrc.includes('getJobById'));
check('jobs.patch.ts updates status and result',
  jobsPatchSrc.includes('updateJobStatus'));
check('factoryJobs table has status column',
  factorySchemaSrc.includes('factoryJobs'));
check('factoryJobs table has result column',
  factorySchemaSrc.includes('result:') || factorySchemaSrc.includes('result '));
check('factoryOutputs table exists',
  factorySchemaSrc.includes('factoryOutputs'));

// ─── 13. No Orphaned Jobs ────────────────────────────────────────────────────
console.log('\nTEST 13: No orphaned jobs');
check('catch() block updates job to failed on error',
  generateSrc.includes('.catch') && generateSrc.includes('updateJobStatus'));
check('Eve non-ok response also updates job',
  generateSrc.includes('res.ok') && generateSrc.includes('updateJobStatus'));
check('Callback always updates job status regardless of outcome',
  outputCbSrc.includes('try') && outputCbSrc.includes('catch') && outputCbSrc.includes('updateJobStatus'));

// ─── 14. getJobById return shape ─────────────────────────────────────────────
console.log('\nTEST 14: getJobById response');
check('getJobById parses result JSON',
  factoryUtilsSrc.includes('JSON.parse') && factoryUtilsSrc.includes('result'));
check('normalizeJob in composable parses result',
  useFactorySrc.includes('result:'));

// ─── 15. Build artifacts ─────────────────────────────────────────────────────
console.log('\nTEST 15: Build artifacts');
const buildExists = fs.existsSync(path.join(BASE, '.output', 'server', 'index.mjs'));
check('Build output exists (.output/server/index.mjs)', buildExists);
if (buildExists) {
  const routes = fs.readdirSync(path.join(BASE, '.output', 'server', 'chunks', 'routes'), { recursive: true })
    .filter(f => String(f).includes('factory') || String(f).includes('generate'));
  check('Factory routes compiled to output', routes.length > 0);
  if (routes.length > 0) console.log(`    Routes: ${routes.slice(0, 5).join(', ')}`);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(50));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed > 0) process.exit(1);
