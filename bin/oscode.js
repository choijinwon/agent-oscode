#!/usr/bin/env node
import {McpHub} from '../src/mcp.js';
import {UiRepair} from '../src/ui-repair.js';
import {recordUi} from '../src/ui-recorder.js';
import {runStateBrowser} from '../src/state-browser.js';
import {inspectStates, statesText} from '../src/frontend-states.js';
import {architectureReport} from '../src/architecture.js';
import {deliveryReview,reviewText,reviewVerdict} from '../src/delivery-review.js';
import {taskReport,exportHandoff} from '../src/task-report.js';
import {repositoryMap} from '../src/repository-map.js';
import {ApprovalMode} from '../src/approval-mode.js';
import {readAppearance,saveAppearance,appearanceUI} from '../src/appearance.js';
import { ProjectSkills } from '../src/skills.js';
import { changePreview } from '../src/change-preview.js';
import {AgentTabs} from '../src/agent-tabs.js';
import {localUrl} from '../src/dev-server.js';
import {AutoWebPreview,openWebPreview} from '../src/web-preview.js';
import {workspacePath} from '../src/workspace-path.js';
import { settingsUI } from '../src/settings-ui.js';
import { listModels, chooseModel } from '../src/model-list.js';
import { SelectedContext } from '../src/selected-context.js';
import { RepairFlow } from '../src/repair.js';
import { ConsoleUI } from '../src/tui.js';
import { welcome, inputFrame, chatPrompt, renderAnswerHeading, toolStatus, turnFooter } from '../src/terminal-view.js';
import { createChatConsole } from '../src/chat-console.js';
import { setCredential, getCredential, defaultBase } from '../src/credentials.js';
import { endpoint } from '../src/providers.js';
import { configureAuth } from '../src/auth-cli.js';
import { accessClipboard, lastAnswer, PasteDraft } from '../src/clipboard.js';
import { estimateTokens } from '../src/context.js';
import { analysisCheckpointContext } from '../src/analysis-memory.js';
import { compareFrontendContext, frontendContext } from '../src/frontend-context.js';
import { verifyProject } from '../src/verify.js';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { approveBaseline } from '../src/ui-workflow.js';
import { storyRecipe } from '../src/frontend-quality.js';
import { componentRecipe } from '../src/components.js';
import { checkUi, uiSummary } from '../src/ui-check.js';
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
let screen = null;
const output = text => screen ? screen.append(clean(text)) : process.stdout.write(text);
const print = text => output(clean(text) + '\n');
const help = `oscode — 토큰 예산을 관리하는 터미널 코딩 에이전트

  oscode auth set                  모델 API 키 별도 저장 (숨김 입력)
  oscode auth status               키 저장 여부 확인
  oscode auth remove               저장된 키 삭제
  oscode verify --changed           변경 사항 통합 검사·로컬 HTML 보고서
  --start SCRIPT --url URL          개발 서버 시작 또는 기존 URL 검사
  --open                           검증 후 HTML 결과 열기
  oscode ui check URL               브라우저 화면 진단 (API 불필요)
  oscode --demo                     API 없이 읽기 전용 데모
  oscode --model MODEL               Claude API로 대화
  oscode --provider compatible --model MODEL
  oscode --prompt '요청' --plan      한 번 실행, 읽기 전용
  oscode --resume latest             마지막 세션 재개

대화 기능:
  /mcp                             MCP 서버 등록·연결·도구 선택
  /states record URL               화면 조작과 검증 조건 녹화
  /states run URL 파일.json         저장한 시나리오 검증
  /states fix URL 파일.json         실패 확인·AI 수정·동일 조건 재검증
  @src/Button.tsx 요청              선택 파일 첨부 (Tab/방향키 자동완성)
  /skills                          .oscode/skills 스킬 선택 · off 해제
  /context                         파일·대화 컨텍스트 관리
  /diagnose [script]                프로젝트 검사 실행
  /fix                             실패 수정 후 동일 검사 재실행

설정:
  --intranet                       명시한 내부 호환 API 사용 (외부 기본 주소·키 사용 안 함)
  --simple                         전체 화면 대신 기본 줄 단위 콘솔
  --ui-preview                     키 없이 콘솔 UI 예시 화면 확인
  --verbose                        모델 호출·도구 결과 상세 출력
  --copy-last                      저장된 마지막 완료 답변을 클립보드로 복사
  --analysis-notes                  저장된 분석 근거·다음 질문 확인 (API 불필요)
  --frontend-context PATH           컴포넌트와 직접 의존성 컨텍스트 확인
  --context-mode focused|standard   프론트엔드 컨텍스트·출력 요약 (기본 focused)
  --ab-context PATH                 A/B 입력 토큰 추정 비교·JSON 저장
  --ab-live                         동일 모델에 두 번 요청하여 실제 사용량 비교
  --cwd PATH                        프로젝트 폴더 (기본: 현재 폴더)
  --agent general|frontend          프론트엔드 전문 모드 (OSCODE_AGENT)
  --tokens                         Tailwind 토큰/임의 값 후보 진단
  --impact PATH                    변경 파일의 영향·테스트 후보 분석
  --story PATH                     React CSF 스토리 생성 미리보기
  --states PATH                    스토리 이름별 args JSON 파일
  --story-role ROLE --story-name NAME  스토리 가시성 검증 추가
  --scenario PATH                  UI 검사에서 실행할 단계 JSON
  --a11y                           UI 검사에 axe 접근성 검사 추가
  --baseline NAME                  승인된 이미지와 비교
  --approve-baseline RUN_ID         검토한 UI 실행을 --baseline 이름으로 승인
  --architecture                   프론트엔드 구조·의존성 후보 진단 (API 불필요)
  --component LIBRARY/NAME          react·vue·angular·svelte 및 UI 라이브러리 조회 (API 불필요)
  --output PATH                    조회한 스타터를 새 파일로 생성 (--yes 필요)
  --ui-check URL                    위 명령과 동일; 페이지 JS/네트워크 실행
  --viewport all|mobile|tablet|desktop  진단 화면 크기 (기본 all)
  --inspect-frontend                스택·스크립트·파일 진단 (API 불필요)
  --profile economy|balanced        기본: economy
  --model MODEL                     또는 OSCODE_MODEL
  --provider anthropic|compatible|chatgpt   또는 OSCODE_PROVIDER
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
웹 미리보기: /preview [http://localhost:포트]\n작업 폴더: /cwd · /workspace <폴더 경로> · /cd <폴더 경로>\n이미지·PDF: /ocr <파일> · @파일로 질문에 첨부\n복사·붙여넣기: /copy [code] /paste /draft /send /clear
/paste는 클립보드를 초안으로 읽고, /send로만 모델에 전송합니다. 여러 줄과 들여쓰기를 보존합니다.
명령: /status /verbose [on|off] /settings /key [status|remove] /files /connect /agent general|frontend /frontend [경로] /plan [요청|on|off|show|list] /apply /help /usage [all] /compact /model MODEL /budget N /diff /checkpoints /undo [ID] /config /test /exit
`;
async function main(raw = process.argv.slice(2), host) {
  let screen=null;
  const output=text=>screen?screen.append(clean(text)):process.stdout.write(text);
  const print=text=>output(clean(text)+'\n');
  const authAction = raw[0] === 'auth' ? (raw[1] || 'status') : null;
  const cliArgs = authAction ? raw.slice(2) : raw[0] === 'verify' ? ['--verify', ...raw.slice(1)] : raw[0] === 'ui' && raw[1] === 'check' ? ['--ui-check', ...raw.slice(2)] : raw;
  const { values: args } = parseArgs({ args: cliArgs, options: Object.fromEntries([
    ...['frontend-context', 'ab-context', 'context-mode', 'start', 'url', 'scenario', 'baseline', 'approve-baseline', 'impact', 'story', 'states', 'story-role', 'story-name', 'component', 'output', 'ui-check', 'viewport', 'agent', 'cwd', 'profile', 'model', 'provider', 'base-url', 'budget', 'max-input', 'max-output', 'max-steps', 'prompt', 'resume', 'loop-limit', 'undo'].map(k => [k, { type: 'string' }]),
    ...['intranet', 'intranet-stream', 'simple', 'ui-preview', 'verbose', 'key-stdin', 'copy-last', 'analysis-notes', 'ab-live', 'verify', 'changed', 'open', 'a11y', 'tokens', 'architecture', 'inspect-frontend', 'help', 'demo', 'plan', 'yes', 'allow-shell', 'init', 'usage', 'checkpoints', 'config', 'show-plan', 'apply-plan'].map(k => [k, { type: 'boolean' }])
  ]) });
  if (authAction) { await configureAuth(authAction, args); return; }
  if (args['key-stdin']) throw new Error('--key-stdin requires auth set.');
  if (args['ab-live'] && !args['ab-context']) throw new Error('--ab-live requires --ab-context.');
  if (args.help) { print(help); return; }
  if (args['ui-preview']) {
    process.stdout.write(welcome({ root: 'my-frontend-app', model: '미리보기', plan: false, connected: false, agent: 'frontend' }));
    print('  UI 미리보기 — 아래 대화는 예시입니다. API 호출·파일 수정 없음.\n\n  나 › 로그인 폼을 반응형 컴포넌트로 만들어줘');
    process.stdout.write(renderAnswerHeading());
    print('  기존 컴포넌트와 스타일을 확인한 뒤 구현하겠습니다.\n  모바일 레이아웃과 키보드 접근성도 함께 검토하겠습니다.');
    process.stdout.write(inputFrame({ plan: false, connected: false }) + chatPrompt + '\n');
    return;
  }
  const root = await workspacePath(args.cwd || '.');
  if (!(await fs.stat(root)).isDirectory()) throw new Error('cwd must be a directory.');
  const maintenance = ['copy-last', 'analysis-notes', 'frontend-context', 'ab-context', 'verify', 'tokens', 'impact', 'story', 'approve-baseline', 'architecture', 'component', 'ui-check', 'inspect-frontend', 'init', 'usage', 'checkpoints', 'config', 'undo', 'show-plan'].filter(key => args[key] !== undefined);
  if (maintenance.length > 1 || (maintenance.length && ((args.prompt && !args['ab-context']) || args.demo || args['apply-plan']))) throw new Error('Choose one maintenance action without --prompt or --demo.');
  if ((args.changed || args.start || args.url || args.open) && !args.verify) throw new Error('--changed/--start/--url/--open require verify.');
  if (args.verify && (args.scenario || args.a11y || args.baseline || args.viewport)) throw new Error('Use ui check for scenario/a11y/baseline/viewport options.');
  if (args.output && !args.component && !args.story) throw new Error('--output requires --component or --story.');
  if (args.init) { await initConfig(root); print('oscode.json 생성 완료. 모델과 예산을 설정할 수 있습니다.'); return; }
  if (args['apply-plan'] && (args.plan || args.prompt || args.demo)) throw new Error('--apply-plan은 --plan, --prompt, --demo와 함께 사용할 수 없습니다.');
  const project = await readProjectConfig(root);
  const config = resolveConfig(project, args);
  if (args['frontend-context']) {
    print(await frontendContext(new WorkspaceTools(root, { readOnly: true, outputLimit: 16000 }), args['frontend-context'])); return;
  }
  if (args['ab-context']) {
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.on('SIGINT', stop);
    try {
      const report = await compareFrontendContext({ tools: new WorkspaceTools(root, { readOnly: true }), target: args['ab-context'], prompt: args.prompt, config,
        provider: args['ab-live'] ? createProvider(config) : undefined, signal: controller.signal });
      print(JSON.stringify(report, null, 2));
    } finally { process.off('SIGINT', stop); }
    return;
  }
  const planLocked = Boolean(project.plan || args.demo);
  const readSaved = args.resume || (args['copy-last'] || args['analysis-notes'] || args.usage || args.checkpoints || args.undo || args['show-plan'] || args['apply-plan'] ? 'latest' : null);
  const session = readSaved ? await loadSession(root, readSaved) : newSession(root);
  if (session.mode === 'plan' && !args['apply-plan']) config.plan = true;
  if (!args.agent && !process.env.OSCODE_AGENT && !project.agent && ['general', 'frontend'].includes(session.agent)) config.agent = session.agent;
  if (args.verify) {
    const controller = new AbortController();
    const cancel = () => controller.abort(); process.on('SIGINT', cancel);
    const terminal = process.stdin.isTTY && process.stdout.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
    terminal?.on('SIGINT', cancel);
    try {
      const report = await verifyProject({ tools: new WorkspaceTools(root, { readOnly: true }), config, changed: args.changed, start: args.start, url: args.url, signal: controller.signal, emit: text => print(`→ ${text}`), approve: async (_kind, command, signal) => {
        if (args['allow-shell']) return true;
        print(command); if (!terminal) return false;
        try { return /^y(?:es)?$/i.test((await terminal.question('실행 허용? [y/N] ', { signal })).trim()); } catch { return false; }
      } });
      print(JSON.stringify({ status: report.status, changed: report.changed, steps: report.steps.map(({ name, status, reason }) => ({ name, status, reason })), report: report.file, html: report.html, ...(config.plan ? { plan: report } : {}) }, null, 2));
      process.exitCode = ['incomplete', 'cancelled'].includes(report.status) ? 1 : report.status === 'failed' ? 2 : 0;
      if (args.open && report.html) {
        const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? null : 'xdg-open';
        if (!command) print(`결과 열기: ${report.html}`);
        else { const child = spawn(command, [pathToFileURL(report.html).href], { stdio: 'ignore', detached: true }); child.on('error', () => print(`직접 열기: ${report.html}`)); child.unref(); }
      }
    } finally { terminal?.close(); process.removeListener('SIGINT', cancel); }
    return;
  }
  if ((args.scenario || args.a11y) && !args['ui-check']) throw new Error('--scenario/--a11y require ui check.');
  if (args.baseline && !args['ui-check'] && !args['approve-baseline']) throw new Error('--baseline requires ui check or --approve-baseline.');
  if ((args.states || args['story-role'] || args['story-name']) && !args.story) throw new Error('Story options require --story.');
  if (args['approve-baseline']) {
    if (!args.baseline) throw new Error('--approve-baseline requires --baseline NAME.');
    if (config.plan || config.permissions.write === 'deny') throw new Error('Baseline approval blocked by mode or write permissions.');
    print(await approveBaseline(root, args['approve-baseline'], args.baseline)); return;
  }
  if (args.tokens || args.impact) {
    const tool = new WorkspaceTools(root, { readOnly: true, outputLimit: config.outputLimit });
    const result = await tool.execute(args.tokens ? 'tailwind_tokens' : 'frontend_impact', args.tokens ? {} : { path: args.impact });
    print(result.content); if (result.is_error) process.exitCode = 1; return;
  }
  if (args.viewport && !args['ui-check']) throw new Error('--viewport requires --ui-check or ui check.');
  if (args['ui-check']) {
    if (config.plan || config.permissions.shell === 'deny') throw new Error('Browser check is blocked by plan mode or shell permissions.');
    const controller = new AbortController();
    const cancel = () => controller.abort(); process.on('SIGINT', cancel);
    try {
      const reader = new WorkspaceTools(root, { readOnly: true });
      const scenario = args.scenario ? JSON.parse(await reader.text(await reader.resolve(args.scenario))) : undefined;
      const report = await checkUi({ root, scenario, baseline: args.baseline, a11y: args.a11y, url: args['ui-check'], viewport: args.viewport || 'all', signal: controller.signal });
      print(uiSummary(report));
      if (report.incomplete) process.exitCode = 1; else if (report.findings) process.exitCode = 2;
    } finally { process.removeListener('SIGINT', cancel); }
    return;
  }
  if (args.architecture) {
    const result = await new WorkspaceTools(root, { readOnly: true, outputLimit: config.outputLimit }).execute('frontend_architecture', {});
    print(result.content); if (result.is_error) process.exitCode = 1; return;
  }
  if (args['inspect-frontend']) {
    const result = await new WorkspaceTools(root, { readOnly: true, outputLimit: config.outputLimit }).execute('frontend_inspect', {});
    print(result.content); if (result.is_error) process.exitCode = 1; return;
  }
  if (args.config) { print(JSON.stringify(config, null, 2)); return; }
  if (args['show-plan']) { print(renderPlan(session)); return; }
  if (args['apply-plan']) getApplicablePlan(session, { locked: planLocked });
  const checkpoints = new Checkpoints(session);
  if (args.story) {
    const tool = new WorkspaceTools(root, { readOnly: config.plan, permissions: config.permissions, checkpoints, onPreview: print, approve: async () => Boolean(args.yes) });
    const recipe = JSON.parse(await storyRecipe(tool, { path: args.story, states: args.states, role: args['story-role'], name: args['story-name'] }));
    print(JSON.stringify(recipe, null, 2));
    if (args.output) {
      if (path.resolve(root, args.output) !== path.resolve(root, recipe.output)) throw new Error(`Colocated output required: ${recipe.output}`);
      if (!args.yes) throw new Error('Review recipe and pass --yes to create the story.');
      const result = await tool.execute('write_file', { path: args.output, content: recipe.code });
      print(result.content); if (result.is_error) process.exitCode = 1;
    }
    return;
  }
  if (args.component) {
    const [library, component, extra] = args.component.split('/');
    if (extra !== undefined) throw new Error('Use --component mui/button, antd/card or bootstrap/dropdown.');
    const recipe = componentRecipe(library, component);
    const componentTools = new WorkspaceTools(root, { readOnly: config.plan, permissions: config.permissions, checkpoints, outputLimit: 16000, onPreview: print, approve: async () => Boolean(args.yes) });
    const report = await componentTools.execute('ui_component', { library, ...(component ? { component } : {}) });
    print(report.content); if (report.is_error) { process.exitCode = 1; return; }
    if (args.output) {
      if (JSON.parse(report.content).compatible === false) throw new Error('Project framework/version is incompatible with this starter.');
      if (!component) throw new Error('Select a component before generating a file.');
      if (path.extname(args.output) !== recipe.extension) throw new Error(`Starter output requires ${recipe.extension}; adapt it to your project after generation.`);
      if (!args.yes) throw new Error('Review the starter above, then use --yes to create it.');
      const result = await componentTools.execute('write_file', { path: args.output, content: recipe.code });
      print(result.content); if (result.is_error) process.exitCode = 1;
    }
    return;
  }
  const undo = async id => {
    if (config.plan || config.permissions.write === 'deny') throw new Error('현재 모드/권한에서 되돌리기를 허용하지 않습니다.');
    const result = await (host?host.exclusive(root,()=>checkpoints.undo(id)):checkpoints.undo(id));
    print(result);
  };
  if (args['copy-last']) { await accessClipboard('write', lastAnswer(session)); print('마지막 완료 답변을 클립보드에 복사했습니다.'); return; }
  if (args['analysis-notes']) { print(await analysisCheckpointContext(new WorkspaceTools(root, { readOnly: true }), session) || '저장된 분석 체크포인트가 없습니다.'); return; }
  if (args.usage) { print(usageReport(session, true)); return; }
  if (args.checkpoints) { print(checkpoints.list()); return; }
  if (args.undo) { await undo(args.undo); return; }
  const readyProvider = () => {
    if (config.provider !== 'demo' && !config.model) throw new Error('모델을 지정하세요: /model MODEL 또는 --model MODEL.');
    return createProvider(config);
  };
  const connectionStatus = () => { try { readyProvider(); return null; } catch (error) { return error.message; } };
  const connectHelp = () => {
    print('로컬 모드: API 키 없이 /files, /frontend, /help, /paste 등을 사용할 수 있습니다.');
    print('AI 자연어 분석·수정은 모델 연결이 필요합니다. 클립보드나 대화에 API 키를 입력하지 마세요.');
    print('/settings에서 ChatGPT 계정 로그인 또는 공급자·API 키 연결을 선택하세요.');
    print('로컬 모델: --provider compatible --base-url http://localhost:PORT/v1 --model MODEL (호환 서버가 실행 중이어야 합니다).');
    print(connectionStatus() || '모델 설정이 준비되었습니다. 실제 연결은 요청 시 확인합니다.');
  };
  const pasteDraft = new PasteDraft();
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const approvalMode=new ApprovalMode(args);
  const skills = new ProjectSkills(root);
  if (interactive && !args.simple && !args.demo && !args.prompt && !args['apply-plan']) {
    let style;try{style=await readAppearance(root);}catch(error){print(`화면 설정 읽기 실패: ${error.message} · 기본 스타일 사용`);}
    const uiOptions={ appearance:style, paste: () => accessClipboard('read'), copy: (kind, draft) => accessClipboard('write', kind === 'draft' ? draft : lastAnswer(session, kind === 'code')), status: () => ({ project: path.basename(root), approval:approvalMode.label, skill:skills.selected?.title, directory: root, mode: config.plan ? 'PLAN' : 'BUILD', model: config.model || 'LOCAL', budget: config.budget,
      usageEstimated: Boolean(session.turns.at(-1)?.usage.estimated), used: (session.turns.at(-1)?.usage.input || 0) + (session.turns.at(-1)?.usage.output || 0), estimate: screen ? estimateTokens(screen.buffer) : 0 }) };
    const childArgs=()=>['--cwd',root,'--agent',config.agent,'--provider',config.provider,'--budget',String(config.budget),...(config.model?['--model',config.model]:[]),...(config.baseUrl?['--base-url',config.baseUrl]:[]),...(config.intranet?['--intranet']:[]),...(config.intranetStream?['--intranet-stream']:[]),...(config.plan?['--plan']:[])];
    screen=host?host.createUI(uiOptions,childArgs):new ConsoleUI(uiOptions);
    if(readSaved)screen.restoreSession(session);
    if(session.latestReview){screen.reviewLabel=reviewVerdict(session.latestReview).label+' · 이전 검사';screen.render();}

  }
  const rl = screen || (interactive ? createChatConsole() : null);
  let active;
  const interrupt = () => { if (active) active.abort(); else rl?.close(); };
  if(!host)process.on('SIGINT', interrupt);
  rl?.on('SIGINT', interrupt);
  const tools = new WorkspaceTools(root, { readOnly: config.plan, outputLimit: config.outputLimit, checkpoints, permissions: config.permissions, verifyOptions: config.verify,
    onPreview: text => screen ? screen.preview(text) : print(text),
    approve: async (kind, target, signal) => {
      if (signal?.aborted) return false;
      if (approvalMode.allows(kind)) return true;
      if (!rl) return false;
      try { return /^y(?:es)?$/i.test((await rl.question(`${kind === 'shell' ? '셸 실행' : '변경 적용'} 승인 y / 취소 n: `, { signal })).trim()); }
      catch { return false; }
      finally { if (screen) screen.panel = '대화'; }
    }
  });
  tools.mcp=new McpHub(tools);
  if(host)tools.mcp.runExclusive=(run,signal)=>host.exclusive(root,run,signal);
  const originalPerform=tools.perform.bind(tools);
  tools.perform=async(name,input,signal)=>{
    if(screen&&screen.reviewLabel&&['write_file','edit_file','shell','verify_project'].includes(name)){screen.reviewLabel='작업 변경 · 재검사 필요';screen.render();}
    const result=await originalPerform(name,input,signal);
    if(['write_file','edit_file'].includes(name)){
      const before=name==='write_file'?'':input.old_text,after=name==='write_file'?input.content:input.new_text;
      const count=text=>text?text.split('\n').length-(text.endsWith('\n')?1:0):0;
      screen?.recordChange(input.path,changePreview(input.path,before,after),count(after),count(before));
    }
    return result;
  };
  if(host) {
    const perform=tools.perform.bind(tools);
    tools.perform=(name,input,signal)=>['edit_file','write_file','shell','ui_check','verify_project'].includes(name)
      ? host.exclusive(root,()=>perform(name,input,signal),signal) : perform(name,input,signal);
  }
  screen?.on('toggleMode', () => {
    if (active || !screen?.pending?.normal) return;
    try {
      screen.hint = switchMode(config, tools, session, !config.plan, planLocked);
      screen.render();
      saveSession(session).catch(error => print(`모드 저장 실패: ${error.message}`));
    } catch (error) { screen.hint = error.message; screen.render(); }
  });
  const selectedContext = new SelectedContext(tools);
  const repair = new RepairFlow(tools, config);
  let verbose = Boolean(args.verbose);
  let answerStarted = false;
  const autoPreview=new AutoWebPreview({onOpen:url=>print(`자동 미리보기: ${url}`)});
  if(host)autoPreview.opened=host.previewOpened;
  const showPreview=url=>{if(interactive&&!config.plan)void autoPreview.show(url);};
  const emit = (kind, data) => {
    if ((kind === 'delta' || kind === 'text') && !answerStarted) { if(!screen)output(interactive ? renderAnswerHeading() : '\noscode › '); answerStarted = true; }
    if (kind === 'request') { answerStarted = false; if (screen) { screen.setStage('분석 중'); screen.setCommunicating(true); } else if (interactive && !verbose) print('  · 응답 준비 중…'); }
    if (['tool', 'text', 'stream_end'].includes(kind)) screen?.setCommunicating(false);
    if (kind === 'tool' && screen) screen.setStage(`${['edit_file','write_file'].includes(data.name) ? '수정' : ['shell','ui_check','verify_project'].includes(data.name) ? '검증/실행' : '분석'} · ${data.input?.path || data.name}`);
    if (kind === 'delta') { if(screen)screen.appendAnswer(clean(data));else output(clean(data)); }
    if (kind === 'stream_end') { if(screen)screen.appendAnswer('\n');else print(''); }
    if (kind === 'text') { if(screen)screen.appendAnswer(clean(data)+'\n');else print(data); }
    if (kind === 'notice') print(data);
    if (kind === 'request' && (!interactive || verbose)) print(`  ↗ ${config.model} · 입력 추정 ${data.estimate} · 출력 한도 ${data.maxOutput} · ${data.step}/${config.maxSteps}`);
    if (kind === 'tool' && (!interactive || verbose)) print(`  → ${data.name}${data.input?.path ? ` ${data.input.path}` : ''}`);
    if (kind === 'result' && data.name==='shell' && !data.is_error) showPreview(localUrl(data.content||''));
    if (kind === 'result') { if (screen) screen.log(toolStatus(data), data.content); else print(interactive && !verbose ? toolStatus(data) : data.content); }
  };
  const execute = async (prompt, executionPlan = null, includeMentions = !executionPlan) => {
    active = new AbortController();
    screen?.clearFailure();
    const originalPrompt = prompt;
    const pastedPrompt = Boolean(screen?.lastInputWasPaste);
    try { const prepared = await selectedContext.prepare(prompt, active.signal, includeMentions); prompt = await skills.prepare(prepared.prompt,active.signal); const provider = readyProvider(); const result=await runTurn({ session, prompt, config, provider, tools, signal: active.signal, emit, save: saveSession, executionPlan }); showPreview(config.verify?.url); return result; }
    catch (e) { screen?.showFailure(originalPrompt,pastedPrompt); const restoredQueue=screen?.pauseQueuedPrompt(); if (active.signal.aborted && !restoredQueue) screen?.recoverPrompt(originalPrompt, pastedPrompt); print(`중단: ${e.message}`); if (!interactive || args.prompt || args.demo || args['apply-plan']) process.exitCode = 1; }
    finally { active = null; if (screen) { screen.setCommunicating(false); screen.stage = '대기'; screen.panel = '대화'; screen.render(); } if (session.turns.length) print(interactive && !verbose ? turnFooter(session.turns.at(-1).usage) : usageText(session.turns.at(-1).usage)); }
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
    config.agent = plan.agent ?? config.agent;
    print(switchMode(config, tools, session, false, planLocked));
    await execute(planExecutionPrompt(plan), plan);
  };
  if (interactive && !screen) process.stdout.write(welcome({ root, model: config.model, plan: config.plan, connected: !connectionStatus(), agent: config.agent, budget: config.budget }));
  else if (!screen) print(`oscode 0.9.1 · ${config.provider}/${config.model || '미설정'}`);
  showPreview(config.verify?.url);
  try {
    if (args['apply-plan']) { await apply(true); return; }
    if (args.demo) { await execute('프로젝트 파일을 보여줘'); return; }
    if (args.prompt) { await execute(args.prompt); return; }
    if (!rl) throw new Error('비대화형 실행은 --prompt를 지정하세요.');
    if (!screen) print('  Enter 전송 · 실행 중 Ctrl+C 취소');
    while (!rl.closed) {
      let input;
      if (screen) screen.files = await tools.files().catch(() => []);
      if (!screen) process.stdout.write(inputFrame({ model: config.model, plan: config.plan, connected: !connectionStatus(), draft: Boolean(pasteDraft.text) }));
      try { input = await rl.question(chatPrompt); } catch { break; }
      if (!input.trim()) continue;
      if (!screen?.lastInputWasPaste && input.trim().startsWith('/')) input = input.trim();
      if (screen?.lastInputWasPaste) { await execute(input); continue; }
      if(input==='/intranet'||input.startsWith('/intranet ')){
        const value=input.slice(9).trim();
        try{
          if(value==='check'){
            if(!config.intranet)throw Error('먼저 /intranet JSON으로 내부 주소와 모델을 지정하세요.');
            active=new AbortController();screen?.setStage('내부 LLM 연결 확인');
            const result=await createProvider(config).complete({model:config.model,maxOutput:32,system:'Reply briefly.',messages:[{role:'user',content:'Reply OK.'}],tools:[]},active.signal);
            print(`내부 모델 응답 수신: ${config.model} · 생성 ${result.usage.output} 토큰 · 도구 호출 지원 여부는 별도 확인이 필요합니다.`);
          }else if(value){
            const data=JSON.parse(value);
            if(!data||Object.keys(data).some(k=>!['baseUrl','model','intranetStream'].includes(k))||!data.baseUrl||!data.model)throw Error('baseUrl과 model을 지정하세요.');
            const next={...config,...data,provider:'compatible',intranet:true};
            endpoint(next.baseUrl,'chat/completions',true);createProvider(next);
            if(typeof data.model!=='string'||data.model.length>200||(data.intranetStream!==undefined&&typeof data.intranetStream!=='boolean'))throw Error('모델·스트리밍 설정을 확인하세요.');
            Object.assign(config,next);print('내부 LLM 설정을 현재 세션에 적용했습니다. /intranet check로 확인하세요. 영구 설정은 oscode.json에 저장하세요.');
          }else print(`내부 LLM: ${config.intranet?'사용 중':'미설정'}\n/intranet {"baseUrl":"http://10.0.0.10:8000/v1","model":"your-model"}\n연결 검사: /intranet check · 인증: OSCODE_INTRANET_API_KEY`);
        }catch(error){print(`내부 LLM: ${error.message}`);}finally{active=null;screen?.setStage('대기');}continue;
      }
      if(input==='/mcp'||input.startsWith('/mcp ')){
        active=new AbortController();screen?.setStage('MCP 연결 관리');
        try{print(await tools.mcp.command(input.slice(4),active.signal));}catch(error){print(`MCP: ${error.message}`);}
        finally{active=null;screen?.setStage('대기');}continue;
      }
      if (input === '/exit') break;
      if(input==='/preview'||input.startsWith('/preview ')) {
        try {
          let url=input.slice(8).trim()||config.verify?.url||'';
          if(!url)url=await rl.question('개발 서버 주소 (예: http://localhost:3000, 빈 입력 취소): ');
          if(!url.trim())continue;
          const opened=await openWebPreview(url.trim());
          autoPreview.opened.add(opened);
          print(`브라우저 미리보기: ${opened}\n연결되지 않으면 해당 프로젝트의 개발 서버를 먼저 실행하세요.`);
        }catch(error){print(`미리보기 실패: ${error.message}`);}
        continue;
      }
      if(input==='/cwd'){print(`작업 폴더: ${root}\n변경: /workspace <폴더 경로> · 파일 첨부: @상대경로`);continue;}
      if(input==='/workspace'||input.startsWith('/workspace ')||input.startsWith('/cd ')) {
        try {
          let target=input.startsWith('/cd ')?input.slice(4).trim():input.slice(10).trim();
          if(!target)target=await rl.question(`작업 폴더 경로 (현재 ${root}, 빈 입력 취소): `);
          if(!target.trim())continue;
          const next=await workspacePath(target,root);
          if(next===root){print('현재 작업 폴더와 같습니다.');continue;}
          // Validate the destination before closing the current session. Never carry approvals across projects.
          resolveConfig(await readProjectConfig(next),{});
          await saveSession(session);
          return ['--cwd',next,...(args.simple?['--simple']:[])];
        }catch(error){print(`폴더 변경 실패: ${error.message}`);}
        continue;
      }
      if (input === '/ocr' || input.startsWith('/ocr ')) {
        const raw=input.slice(4).trim();
        if (!raw) { print('사용법: /ocr 파일경로 · /ocr {"path":"문서.pdf","start":1,"pages":3,"language":"kor+eng"}\n이미지·PDF는 @파일로 질문에 첨부할 수도 있습니다. 프로젝트 내부 파일, 최대 20 MiB·5페이지.\n설치 macOS: brew install tesseract tesseract-lang poppler\nUbuntu: sudo apt install tesseract-ocr tesseract-ocr-kor poppler-utils\nWindows: Tesseract와 Poppler를 설치하고 PATH에 추가하세요.'); continue; }
        active=new AbortController();screen?.setStage('문서 텍스트 추출 중');
        try {
          const options=raw.startsWith('{') ? JSON.parse(raw) : {path:raw.startsWith('"') ? JSON.parse(raw) : raw};
          const result=await tools.execute('read_document',options,active.signal);print(result.content);
        } catch(error) { print(`문서 읽기 실패: ${error.message}`); }
        finally {active=null;screen?.setStage('대기');}
        continue;
      }
      if(input==='/states fix'||input.startsWith('/states fix ')){
        let flow;
        try{
          const match=/^\/states fix\s+(\S+)\s+(.+)$/.exec(input);
          if(!match)throw Error('사용법: /states fix URL 시나리오.json');
          const unavailable=connectionStatus();if(unavailable)throw Error(`AI 수정에 모델 연결이 필요합니다. /settings에서 연결하세요. 로컬 검사만 하려면 /states run을 사용하세요. ${unavailable}`);
          active=new AbortController();screen?.setStage('수정 전 화면 검증 중');
          flow=await new UiRepair(tools).begin(match[1],match[2],active.signal);
          print(`${flow.label} · 보고서: ${flow.html}`);
          if(flow.canFix){
            const turn=await execute(flow.prompt(),null,false);
            active=new AbortController();screen?.setStage('동일 조건 재검증 중');
            await flow.finish(turn?.status==='done',active.signal);
            print(`${flow.label}\n전후 보고서: ${flow.html}\n결과 데이터: ${flow.json}`);
          }
        }catch(error){print(`화면 수정 흐름 중단: ${error.message}`);}
        finally{active=null;screen?.setStage('대기');}
        continue;
      }
      if(input==='/states'||input.startsWith('/states ')){
        active=new AbortController();screen?.setStage('UI 상태 분석 중');
        try{const target=input.slice(7).trim();
          if(target==='record'||target.startsWith('record ')){screen?.setStage('브라우저 녹화 중');print(await recordUi(tools,target.slice(6).trim(),active.signal));}
          else if(target==='run'||target.startsWith('run ')){screen?.setStage('브라우저 상태 검증 중');print(await runStateBrowser(tools,target,active.signal));}
          else print(statesText(await inspectStates(tools,target,active.signal)));
        }
        catch(error){print(`UI 상태 분석 중단: ${error.message}`);}
        finally{active=null;screen?.setStage('대기');}
        continue;
      }
      if(input==='/architecture'||input.startsWith('/architecture ')){
        active=new AbortController();screen?.setStage('아키텍처 분석 중');
        try{const report=await architectureReport(tools,input.slice(13).trim()||'.',active.signal);print(report.text);print(`\n보고서: ${report.markdown}\n구조 데이터: ${report.json}`);}
        catch(error){print(`아키텍처 분석 중단: ${error.message}`);}
        finally{active=null;screen?.setStage('대기');}continue;
      }
      if(input==='/review'||input.startsWith('/review ')){
        const target=input.slice(7).trim();
        if(target==='show'){print(session.latestReview?reviewText(session.latestReview):'검증 기록이 없습니다. /review를 실행하세요.');continue;}
        active=new AbortController();screen?.setStage('프론트엔드 검증 중');
        if(screen)screen.reviewLabel='검증 진행 중';
        try{
          const run=()=>deliveryReview({tools,config,url:target||undefined,signal:active.signal,emit:message=>screen?screen.setStage(message):print(message)});
          const report=await (host?host.exclusive(root,run,active.signal):run());
          session.latestReview=report;await saveSession(session);print(reviewText(report));
          if(screen)screen.reviewLabel=reviewVerdict(report).label+' · 검사 당시';
        }catch(error){print(`검증 중단: ${error.message}`);if(screen)screen.reviewLabel='검증 중단 · 다시 실행 필요';}
        finally{active=null;screen?.setStage('대기');}continue;
      }
      if(input==='/summary'){print(taskReport(session));continue;}
      if(input==='/handoff'||input==='/handoff copy'){
        try{
          if(input==='/handoff copy'){await accessClipboard('write',taskReport(session,{handoff:true}));print('작업 인계 내용을 복사했습니다. 새 대화에 붙여넣고 다음 요청을 추가하세요.');}
          else{const report=await exportHandoff(session);print(`작업 인계 파일: ${report.file}\n약 ${report.estimatedTokens} 토큰 (추정) · 모델 추가 호출 없음\n복사: /handoff copy · 최근 결과 보기: /summary`);}
        }catch(error){print(`작업 인계 실패: ${error.message}`);}continue;
      }
      if(input==='/map'||input.startsWith('/map ')){
        active=new AbortController();screen?.setStage('코드 지도 생성 중');
        try{print(await repositoryMap(tools,input.slice(4).trim(),1600,active.signal));}
        catch(error){print(`코드 지도: ${error.message}`);}
        finally{active=null;screen?.setStage('대기');}continue;
      }
      if(input==='/approval'||input.startsWith('/approval ')){
        active=new AbortController();
        try{
          const mode=input.slice(9).trim();
          if(mode)approvalMode.set(mode);
          else if(screen)await approvalMode.choose(screen,active.signal);
          else print('/approval ask: 매번 확인 · delegate: 파일 편집 자동/셸 확인 · auto: 편집·셸 자동 (프로젝트 밖 접근 가능)');
          print(`승인 방식: ${approvalMode.label} · 현재 에이전트에 적용 · PLAN/프로젝트 금지 규칙 유지`);
        }catch(error){print(`승인 설정: ${error.message}`);}finally{active=null;screen?.render();}continue;
      }
      if(input==='/style'){
        if(!screen){print('스타일 선택은 전체 화면 콘솔에서 사용할 수 있습니다. --simple 없이 실행하세요.');continue;}
        active=new AbortController();
        try{await appearanceUI(screen,{signal:active.signal,save:value=>saveAppearance(root,value)});}
        catch(error){print(`스타일 설정 중단: ${error.message}`);}
        finally{active=null;}continue;
      }
      if (input === '/skills' || input.startsWith('/skills ')) {
        try {
          let id=input.slice(7).trim();
          if(!id||id==='list') {
            const available=await skills.list();
            if(!available.length){print('스킬이 없습니다. .oscode/skills/<이름>/SKILL.md 또는 .oscode/skills/<이름>.md 파일을 추가하세요.');continue;}
            if(id==='list'||!screen){print(available.map(item=>`${item.id}${skills.selected?.relative===item.relative?' ✓':''} · ${item.error||`${item.description||item.title} · 약 ${item.estimatedTokens} 토큰`}`).join('\n')+'\n선택: /skills <이름> · 해제: /skills off');continue;}
            id=await screen.choose('스킬 선택 · 검색 / ↑↓ / Enter',[
              {label:'돌아가기 · 현재 선택 유지',value:'cancel'},
              {label:'스킬 사용 안 함',value:'off'},
              ...available.map(item=>({label:`${skills.selected?.relative===item.relative?'✓ ':''}${item.id} · ${item.error||`${item.description||item.title} · 약 ${item.estimatedTokens} 토큰`}`,value:item.id}))
            ]);
          }
          if(id==='cancel')continue;
          await skills.select(id);
          print(skills.selected?`스킬 선택: ${skills.selected.title} · 다음 요청부터 적용\n.oscode/skills/${skills.selected.relative}`:'스킬 선택을 해제했습니다. 이전 대화에 포함된 지침까지 제외하려면 /context history off를 사용하세요.');
        }catch(error){print(`스킬 선택 실패: ${error.message}`);}
        screen?.render();continue;
      }
      if (input === '/context' || input.startsWith('/context ')) {
        try {
          const command = input.slice(8).trim();
          if (command.startsWith('add ')) await selectedContext.add(command.slice(4).trim());
          else if (command.startsWith('remove ')) selectedContext.selected.delete(command.slice(7).trim());
          else if (command === 'clear') selectedContext.selected.clear();
          else if (command === 'history off' || command === 'history on') { session.contextHistory = command === 'history on'; await saveSession(session); }
          else if (command) throw new Error('/context add|remove <path> · clear · history on|off');
          if (screen) screen.panel = '컨텍스트';
          print(JSON.stringify(await selectedContext.report(session), null, 2));
        } catch (error) { print(error.message); }
        continue;
      }
      if (input === '/diagnose' || input.startsWith('/diagnose ') || input === '/fix') {
        try {
          let script = input.slice(9).trim();
          if (input === '/fix') {
            const prompt = repair.prompt(); script = repair.last.script;
            const turn = await execute(prompt, null, false);
            if (turn?.status !== 'done') { print('수정이 완료되지 않아 재검사를 실행하지 않았습니다.'); continue; }
          }
          active = new AbortController();
          if (screen) screen.setStage('검증 중');
          const report = await repair.diagnose(script, active.signal, print);
          print(JSON.stringify({ status: report.status, steps: report.steps, report: report.file }, null, 2));
          if (report.status === 'failed') print('/fix로 수정 후 동일 검사를 한 번 다시 실행할 수 있습니다.');
        } catch (error) { print(error.message); }
        finally { active = null; if (screen) { screen.panel = '대화'; screen.setStage('대기'); } }
        continue;
      }
      if (input === '/status') {
        print(`${root}\n세션 ${session.id}\n${config.provider} · ${config.model || '모델 미설정'} · ${config.agent} · ${config.plan ? 'PLAN' : 'BUILD'}\n턴 예산 ${config.budget} · 상세 출력 ${verbose ? '켜짐' : '꺼짐'}`); continue;
      }
      if (input === '/verbose' || input === '/verbose on' || input === '/verbose off') {
        verbose = input === '/verbose' ? !verbose : input.endsWith(' on');
        print(`  상세 출력 ${verbose ? '켜짐' : '꺼짐'}`); continue;
      }
      if (input === '/settings' && config.intranet) {print('폐쇄망 모드입니다. /intranet JSON으로 내부 주소·모델을 변경하세요. 연결 확인: /intranet check');continue;}
      if (input === '/settings') {
        if (screen) screen.panel = '설정';
        active = new AbortController();
        try {
          if (!screen && config.provider==='chatgpt') { print('ChatGPT 설정은 --simple 없이 전체 화면의 /settings를 사용하세요.');continue; }
          if (screen) { const applied=await settingsUI(screen,config,active.signal,{approval:()=>approvalMode.choose(screen,active.signal),style:()=>appearanceUI(screen,{signal:active.signal,save:value=>saveAppearance(root,value)})});print(applied ? '설정을 적용했습니다.' : '설정 변경을 취소했습니다.');continue; }
          print('모델 설정 · Enter는 현재 값 유지 · Ctrl+C 취소');
          const provider = (await rl.question(`공급자 [${config.provider}]: `, { signal: active.signal })).trim() || config.provider;
          if (!['anthropic', 'compatible'].includes(provider)) throw new Error('anthropic 또는 compatible을 입력하세요.');
          const previousBase = provider === config.provider ? config.baseUrl : undefined;
          const base = (await rl.question(`API 주소 [${previousBase || defaultBase(provider)}]: `, { signal: active.signal })).trim() || previousBase || defaultBase(provider);
          endpoint(base, provider === 'anthropic' ? 'messages' : 'chat/completions');
          let models=[];
          print('사용 가능한 모델 목록을 조회합니다…');
          try { const result=await listModels({provider,baseUrl:base,signal:active.signal});models=result.models;if(result.partial)print('일부 모델만 표시됩니다. 목록에 없으면 직접 입력하세요.'); }
          catch(error) { if(active.signal.aborted)throw error;print(error.message); }
          const current=provider===config.provider && base===(config.baseUrl || defaultBase(config.provider)) ? config.model : '';
          let model=await chooseModel(rl,models,current,active.signal,print);
          if(!model) model=(await rl.question('모델 ID 직접 입력: ',{signal:active.signal})).trim();
          if (!model) throw new Error('모델 ID를 입력하세요.');
          config.provider = provider; config.baseUrl = base; config.model = model;
          print('현재 채팅의 모델 설정을 변경했습니다. /key로 키를 저장하거나 자연어 요청을 입력하세요.');
        } catch (error) { print(active.signal.aborted ? '설정을 취소했습니다.' : error.message); }
        finally { active = null; if (screen) { screen.panel = '대화'; screen.render(); } }
        continue;
      }
      if(config.intranet&&(input==='/key'||input.startsWith('/key '))){print('폐쇄망 인증은 OSCODE_INTRANET_API_KEY 환경변수를 사용합니다. 외부 공급자의 저장된 키는 전송하지 않습니다.');continue;}
      if (input === '/key' || input === '/key status' || input === '/key remove') {
        if(config.provider==='chatgpt') {print('ChatGPT 인증은 /settings의 로그인·연결 해제를 사용하세요.');continue;}
        active = new AbortController();
        try {
          if (input === '/key status') print(getCredential(config.provider, config.baseUrl) ? '키 저장됨 (값은 숨김)' : '저장된 키 없음');
          else if (input === '/key remove') { setCredential(config.provider, config.baseUrl, null); print('현재 공급자·주소의 저장된 키를 삭제했습니다.'); }
          else {
            const key = (await rl.questionHidden('API 키 (숨김 입력, Ctrl+C 취소): ', { signal: active.signal })).trim();
            setCredential(config.provider, config.baseUrl, key);
            print('키를 별도 사용자 설정에 저장했습니다. 이제 이 채팅에서 바로 사용할 수 있습니다.');
          }
        } catch (error) { print(active.signal.aborted ? '키 입력을 취소했습니다.' : error.message); }
        finally { active = null; if (screen) { screen.panel = '대화'; screen.render(); } }
        continue;
      }
      if (input === '/connect') { connectHelp(); continue; }
      if (input === '/files') { const result = await tools.execute('list_files', { path: '.' }); print(result.content); continue; }
      if (input === '/copy' || input === '/copy code') {
        try { await accessClipboard('write', lastAnswer(session, input === '/copy code')); print('클립보드에 복사했습니다.'); }
        catch (error) { print(error.message); }
        continue;
      }
      if (input === '/paste') {
        try {
          if (pasteDraft.text) { print('기존 초안이 있습니다. /send 또는 /clear 후 다시 붙여넣으세요.'); continue; }
          const text = pasteDraft.load(await accessClipboard('read'));
          print(`붙여넣기 초안: ${text.split('\n').length}줄 · 입력 추정 ${estimateTokens(text)} tokens. /draft 확인 · /send 전송 · /clear 취소`);
        } catch (error) { print(error.message); }
        continue;
      }
      if (input === '/draft') { print(pasteDraft.text || '붙여넣기 초안이 없습니다.'); continue; }
      if (input === '/clear') { pasteDraft.clear(); print('붙여넣기 초안을 지웠습니다.'); continue; }
      if (input === '/send') {
        try { await execute(pasteDraft.take()); } catch (error) { print(error.message); }
        continue;
      }
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
      if (input === '/agent' || input.startsWith('/agent ')) {
        const agent = input.slice(6).trim();
        if (!agent) print(`에이전트: ${config.agent}`);
        else if (!['general', 'frontend'].includes(agent)) print('사용법: /agent general|frontend');
        else { config.agent = agent; session.agent = agent; await saveSession(session); print(`에이전트: ${agent}`); }
        continue;
      }
      if (input === '/frontend' || input.startsWith('/frontend ')) {
        const result = await tools.execute('frontend_inspect', { path: input.slice(9).trim() || '.' });
        print(result.content); continue;
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
        finally { active = null; if (screen) { screen.panel = '대화'; screen.render(); } }
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
      if (connectionStatus()) { print('\n  OSCODE\n\n  아직 모델이 연결되지 않았습니다. /settings → /key 순서로 설정하세요.\n  로컬 탐색은 /files 또는 /frontend로 바로 사용할 수 있습니다.'); continue; }
      await execute(input);
    }
  } finally { await tools.mcp.close(); autoPreview.close(); rl?.close(); screen = null; process.removeListener('SIGINT', interrupt); }
}
async function run(){
 const args=process.argv.slice(2);
 const loop=async(raw,host)=>{let next=raw;while(next)next=await main(next,host);};
 if(process.stdin.isTTY&&process.stdout.isTTY&&!args.some(value=>['--simple','--prompt','--demo','--apply-plan'].includes(value)||value.startsWith('--prompt='))) {
  const manager=new AgentTabs({run:loop});await manager.launch(args);
  if(manager.lastError)throw new Error(manager.lastError);
 }else await loop(args);
}
run().catch(error => { print(`oscode: ${error.message}`); process.exitCode = 1; });
