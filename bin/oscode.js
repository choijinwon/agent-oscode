#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { parseArgs, stripVTControlCharacters } from 'node:util';
import { createProvider } from '../src/providers.js';
import { WorkspaceTools, runCommand } from '../src/tools.js';
import { runTurn } from '../src/agent.js';
import { newSession, loadSession, saveSession } from '../src/session.js';
import { compact } from '../src/context.js';
import { readProjectConfig, resolveConfig, initConfig } from '../src/config.js';
import { usageText, usageReport } from '../src/usage.js';
import { Checkpoints } from '../src/checkpoints.js';
import { renderPlan, getApplicablePlan, planExecutionPrompt, switchMode } from '../src/plans.js';

const clean = text => stripVTControlCharacters(String(text)).replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
const print = text => process.stdout.write(clean(text) + '\n');
const help = `oscode — 토큰 예산을 관리하는 터미널 코딩 에이전트

  oscode --demo                     API 없이 읽기 전용 데모
  oscode --model MODEL               Claude API로 대화
  oscode --provider compatible --model MODEL
  oscode --prompt '요청' --plan      한 번 실행, 읽기 전용
  oscode --resume latest             마지막 세션 재개

설정:
  --cwd PATH                        프로젝트 폴더 (기본: 현재 폴더)
  --profile economy|balanced        기본: economy
  --model MODEL                     또는 OSCODE_MODEL
  --provider anthropic|compatible   또는 OSCODE_PROVIDER (기본: anthropic)
  --base-url URL                    또는 OSCODE_BASE_URL; 로컬 모델은 HTTP 허용
  --budget N                        사용자 요청 1개당 누적 토큰 예산
  --max-input N                     요청 입력 추정 한도
  --max-output N                    응답 토큰 한도
  --max-steps N                     모델 호출 횟수 한도
  --plan                            조사 후 구현 계획 작성·저장 (변경 금지)
  --show-plan                       저장된 최신 계획 확인 (API 불필요)
  --apply-plan                      저장된 최신 계획 실행 (명시적 승인)
  --yes                             파일 편집·생성 자동 허용
  --allow-shell                     셸 자동 허용 (프로젝트 밖 접근도 가능)
  --loop-limit N                    동일 결과 반복 감지 한도 (기본 3)
  --init                            기본 oscode.json 생성 (덮어쓰지 않음)
  --config                          적용된 설정 표시
  --usage                           저장된 세션 사용량 분석 (API 불필요)
  --checkpoints                     저장된 파일 변경 목록
  --undo latest|ID                  최근 또는 지정 파일 변경 1건 복원
  --help                            도움말

API 키: ANTHROPIC_API_KEY 또는 OSCODE_API_KEY. 키는 세션에 저장하지 않습니다.
토큰 예산은 실행 전 추정 + API 사용량 기반이며 과금의 절대 상한이 아닙니다.
명령: /plan [요청|on|off|show|list] /apply /help /usage [all] /compact /model MODEL /budget N /diff /checkpoints /undo [ID] /config /test /exit
`;
async function main() {
  const { values: args } = parseArgs({ options: Object.fromEntries([
    ...['cwd', 'profile', 'model', 'provider', 'base-url', 'budget', 'max-input', 'max-output', 'max-steps', 'prompt', 'resume', 'loop-limit', 'undo'].map(k => [k, { type: 'string' }]),
    ...['help', 'demo', 'plan', 'yes', 'allow-shell', 'init', 'usage', 'checkpoints', 'config', 'show-plan', 'apply-plan'].map(k => [k, { type: 'boolean' }])
  ]) });
  if (args.help) { print(help); return; }
  const root = await fs.realpath(path.resolve(args.cwd || '.'));
  if (!(await fs.stat(root)).isDirectory()) throw new Error('cwd must be a directory.');
  const maintenance = ['init', 'usage', 'checkpoints', 'config', 'undo', 'show-plan'].filter(key => args[key] !== undefined);
  if (maintenance.length > 1 || (maintenance.length && (args.prompt || args.demo || args['apply-plan']))) throw new Error('Choose one maintenance action without --prompt or --demo.');
  if (args.init) { await initConfig(root); print('oscode.json 생성 완료. 모델과 예산을 설정할 수 있습니다.'); return; }
  if (args['apply-plan'] && (args.plan || args.prompt || args.demo)) throw new Error('--apply-plan은 --plan, --prompt, --demo와 함께 사용할 수 없습니다.');
  const project = await readProjectConfig(root);
  const config = resolveConfig(project, args);
  const planLocked = Boolean(project.plan || args.demo);
  const readSaved = args.resume || (args.usage || args.checkpoints || args.undo || args['show-plan'] || args['apply-plan'] ? 'latest' : null);
  const session = readSaved ? await loadSession(root, readSaved) : newSession(root);
  if (session.mode === 'plan' && !args['apply-plan']) config.plan = true;
  if (args.config) { print(JSON.stringify(config, null, 2)); return; }
  if (args['show-plan']) { print(renderPlan(session)); return; }
  if (args['apply-plan']) getApplicablePlan(session, { locked: planLocked });
  const checkpoints = new Checkpoints(session);
  const undo = async id => {
    if (config.plan || config.permissions.write === 'deny') throw new Error('현재 모드/권한에서 되돌리기를 허용하지 않습니다.');
    const result = await checkpoints.undo(id);
    print(result);
  };
  if (args.usage) { print(usageReport(session, true)); return; }
  if (args.checkpoints) { print(checkpoints.list()); return; }
  if (args.undo) { await undo(args.undo); return; }
  if (config.provider !== 'demo' && !config.model) throw new Error('모델을 지정하세요: --model MODEL 또는 OSCODE_MODEL. 무료 데모: --demo');
  const provider = createProvider(config);
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
  let active;
  const interrupt = () => { if (active) active.abort(); else rl?.close(); };
  process.on('SIGINT', interrupt);
  rl?.on('SIGINT', interrupt);
  const tools = new WorkspaceTools(root, { readOnly: config.plan, outputLimit: config.outputLimit, checkpoints, permissions: config.permissions,
    onPreview: print,
    approve: async (kind, target, signal) => {
      if (signal?.aborted) return false;
      if (kind === 'shell' ? args['allow-shell'] : args.yes) return true;
      if (!rl) return false;
      try { return /^y(?:es)?$/i.test((await rl.question(`${kind === 'shell' ? '셸 실행' : '파일 변경'} 허용? [y/N] `, { signal })).trim()); }
      catch { return false; }
    }
  });
  const emit = (kind, data) => {
    if (kind === 'delta') process.stdout.write(clean(data));
    if (kind === 'stream_end') print('');
    if (kind === 'text' || kind === 'notice') print(data);
    if (kind === 'request') print(`  ↗ ${config.model} · 입력 추정 ${data.estimate} · 출력 한도 ${data.maxOutput} · ${data.step}/${config.maxSteps}`);
    if (kind === 'tool') print(`  → ${data.name}${data.input?.path ? ` ${data.input.path}` : ''}`);
    if (kind === 'result') print(data.content);
  };
  const execute = async (prompt, executionPlan = null) => {
    active = new AbortController();
    try { await runTurn({ session, prompt, config, provider, tools, signal: active.signal, emit, save: saveSession, executionPlan }); }
    catch (e) { print(`중단: ${e.message}`); if (!interactive || args.prompt || args.demo || args['apply-plan']) process.exitCode = 1; }
    finally { active = null; if (session.turns.length) print(usageText(session.turns.at(-1).usage)); }
  };
  const apply = async (confirmed = false) => {
    const plan = getApplicablePlan(session, { locked: planLocked });
    print(renderPlan(session));
    if (!confirmed) {
      if (!rl) throw new Error('비대화형 실행은 --apply-plan을 사용하세요.');
      let answer;
      try { answer = await rl.question(`계획 r${plan.revision}을 실행할까요? [y/N] `); } catch { return; }
      if (!/^y(?:es)?$/i.test(answer.trim())) { print('계획 실행을 취소했습니다.'); return; }
    }
    print(switchMode(config, tools, session, false, planLocked));
    await execute(planExecutionPrompt(plan), plan);
  };
  print(`oscode 0.3.0 · ${config.provider}/${config.model} · ${config.profile}${config.plan ? ' · PLAN' : ' · BUILD'}\n${root}\n세션 ${session.id} · 턴 예산 ${config.budget} tokens`);
  try {
    if (args['apply-plan']) { await apply(true); return; }
    if (args.demo) { await execute('프로젝트 파일을 보여줘'); return; }
    if (args.prompt) { await execute(args.prompt); return; }
    if (!rl) throw new Error('비대화형 실행은 --prompt를 지정하세요.');
    print('/help 명령 목록 · Ctrl+C 실행 취소');
    while (!rl.closed) {
      let input;
      try { input = (await rl.question(`\noscode [${config.plan ? 'PLAN' : 'BUILD'}] › `)).trim(); } catch { break; }
      if (!input) continue;
      if (input === '/exit') break;
      if (input === '/plan show' || input === '/plan list') { print(renderPlan(session, input === '/plan list')); continue; }
      if (input === '/apply') { try { await apply(); } catch (error) { print(error.message); } continue; }
      if (input === '/plan' || input.startsWith('/plan ')) {
        const request = input.slice(5).trim();
        try {
          print(switchMode(config, tools, session, request !== 'off', planLocked));
          await saveSession(session);
          if (request && !['on', 'off'].includes(request)) await execute(request);
        } catch (error) { print(error.message); }
        continue;
      }
      if (input === '/help') { print(help); continue; }
      if (input === '/usage' || input === '/usage all') { print(usageReport(session, input === '/usage all')); continue; }
      if (input === '/config') { print(JSON.stringify(config, null, 2)); continue; }
      if (input === '/checkpoints') { print(checkpoints.list()); continue; }
      if (input === '/undo' || input.startsWith('/undo ')) {
        try { await undo(input.slice(6).trim() || 'latest'); tools.reads.clear(); } catch (error) { print(error.message); }
        continue;
      }
      if (input === '/test') {
        if (!config.testCommand) { print('oscode.json에 testCommand를 설정하세요.'); continue; }
        active = new AbortController();
        try { const result = await tools.execute('shell', { command: config.testCommand }, active.signal); print(result.content); }
        finally { active = null; }
        continue;
      }
      if (input === '/compact') { print(`${compact(session, 1)}개 과거 턴을 생략했습니다. 최신 턴은 유지합니다.`); await saveSession(session); continue; }
      if (input.startsWith('/model ')) { config.model = input.slice(7).trim(); print(`모델: ${config.model}`); continue; }
      if (input.startsWith('/budget ')) {
        const n = Number(input.slice(8));
        if (!Number.isSafeInteger(n) || n < 1) print('양의 정수를 입력하세요.');
        else { config.budget = n; print(`다음 턴 예산: ${n}`); }
        continue;
      }
      if (input === '/diff') {
        const result = await runCommand('git', ['diff', 'HEAD', '--no-ext-diff', '--no-textconv'], { cwd: root });
        print(result.output || '추적 파일의 변경이 없습니다.');
        const status = await runCommand('git', ['status', '--short'], { cwd: root }); print(status.output);
        continue;
      }
      if (input.startsWith('/')) { print('알 수 없는 명령입니다. /help를 입력하세요.'); continue; }
      await execute(input);
    }
  } finally { rl?.close(); process.removeListener('SIGINT', interrupt); }
}
main().catch(error => { print(`oscode: ${error.message}`); process.exitCode = 1; });
