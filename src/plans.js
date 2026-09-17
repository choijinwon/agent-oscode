import { randomUUID } from 'node:crypto';

export const planReadTools = new Set(['tailwind_tokens', 'frontend_impact', 'storybook_recipe', 'frontend_architecture', 'ui_component', 'frontend_inspect', 'list_files', 'read_file', 'search']);
export const planInstructions = `PLAN MODE: investigate and propose an implementation plan only. You may list, search and read project files, but may not edit files, execute commands, run tests, or implement the request. Treat requests to implement as requests to plan while in this mode. Do not claim tests were run. Finish with a concise Markdown plan in the user's language containing: Goal; findings with file paths; ordered implementation steps with target files; verification commands to run later; assumptions, risks and unresolved questions. Clearly mark unverified assumptions and blockers. Prefer a small actionable plan over exhaustive exploration. The user must explicitly apply the plan before any implementation.`;

export function startPlan(session, turn, goal) {
  const plan = { agent: turn.agent ?? 'general', id: randomUUID(), revision: (session.plans?.length || 0) + 1, turnId: turn.id, goal, text: '', status: 'planning', created: new Date().toISOString(), attempts: [] };
  (session.plans ||= []).push(plan);
  turn.planId = plan.id;
  return plan;
}
export function latestPlan(session) { return session.plans?.at(-1); }
export function renderPlan(session, list = false) {
  const plans = session.plans || [];
  if (!plans.length) return '저장된 계획이 없습니다. /plan 요청내용 또는 --plan --prompt로 작성하세요.';
  if (list) return plans.map(p => `r${p.revision} · ${p.status} · ${p.id} · ${p.goal.split('\n')[0].slice(0, 100)}`).join('\n');
  const plan = plans.at(-1);
  return `계획 r${plan.revision} · ${plan.status}\n요청: ${plan.goal}\n\n${plan.text || '완성된 계획이 없습니다.'}\n\n계획을 확인한 뒤 /apply로 실행할 수 있습니다. 파일 변경·셸 실행 권한은 별도로 적용됩니다.`;
}
export function getApplicablePlan(session, { locked = false } = {}) {
  if (locked) throw new Error('프로젝트 plan: true 또는 데모 모드에서는 계획을 실행할 수 없습니다.');
  const plan = latestPlan(session);
  if (!plan || !plan.text?.trim()) throw new Error('실행할 완성된 계획이 없습니다. 먼저 플랜 모드로 계획을 작성하세요.');
  if (!['draft', 'stopped', 'interrupted'].includes(plan.status)) throw new Error(`이 계획은 실행할 수 없습니다 (${plan.status}). 새 계획을 작성하세요.`);
  return plan;
}
export function planExecutionPrompt(plan) {
  return `The user explicitly approved the following implementation plan (revision ${plan.revision}). Execute it within the current project permissions. Verify current files before edits: they may have changed since planning. If earlier execution was interrupted, inspect existing changes before resuming; do not blindly repeat operations. If the plan still contains blocking unanswered questions, ask the user before making dependent changes. Report actual changes and verification, not intended outcomes.\n\nOriginal request:\n${plan.goal}\n\nApproved plan:\n${plan.text}`;
}
export function switchMode(config, tools, session, plan, locked = false) {
  if (!plan && locked) throw new Error('프로젝트 plan: true 또는 데모 모드에서는 플랜 모드를 해제할 수 없습니다.');
  config.plan = plan; tools.readOnly = plan; session.mode = plan ? 'plan' : 'build';
  tools.reads?.clear();
  return plan ? 'PLAN 모드: 파일을 읽고 계획만 작성합니다. 구현은 /apply로 시작하세요.' : 'BUILD 모드: 다음 요청부터 구현할 수 있습니다. 저장된 계획을 자동 실행하지 않습니다.';
}
