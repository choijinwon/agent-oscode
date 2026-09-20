import {erpCsvCell,erpCleanView,erpReadView,erpDisplayColumns,erpRefreshViews,erpSnapshot,erpHistoryUi,erpErrorTargets,erpInit,erpRestore,erpProAction} from './design-erp-professional.js';
import {designMotion} from './design-motion.js';
import {adminAction} from './design-admin-behavior.js';
import {patternAction} from './design-pattern-behavior.js';
import {erpScale,erpParseAmount,erpFormatAmount,erpValidateJournal} from './design-erp-money.js';
import {erpAction,erpUpdateGrid,erpAppendRow,erpUpdateLedger} from './design-erp-behavior.js';
import {designAction} from './design-catalog.js';
// This frame only renders bundled markup. Imported team code never enters it.
export function mobilePreviewRuntime(parentOrigin) {
  const root = document.querySelector('.oc-design');
  if (!(root instanceof HTMLElement)) return;
  erpInit(root);
  let queued = false, modalOpen = false;
  function measure() {
    queued = false;
    const dialog = root.querySelector('dialog[open]'), scope = dialog || root;
    if(dialog&&!modalOpen)parent.postMessage({type:'oscode-mobile-dialog'},parentOrigin);
    modalOpen=Boolean(dialog);
    const controls = [...scope.querySelectorAll('button,input,a[href],select,textarea')].filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    });
    const smallTargets = controls.filter(el => {
      const label = el instanceof HTMLInputElement ? el.closest('label') : null;
      const rect = (label || el).getBoundingClientRect();
      return rect.width < 44 || rect.height < 44;
    }).length;
    const focused = document.activeElement;
    let obscured = null;
    if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) {
      const rect = focused.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      const top = document.elementFromPoint(x, y);
      obscured = rect.top < 0 || rect.bottom > innerHeight || rect.left < 0 || rect.right > innerWidth || top !== focused;
    }
    parent.postMessage({type:'oscode-mobile-observation', width:innerWidth, height:innerHeight,
      overflow:Math.max(0, document.documentElement.scrollWidth - innerWidth), smallTargets, obscured}, parentOrigin);
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(measure); } }
  for (const type of ['click','keydown','submit','input','change','focusin','focusout','mouseout','toggle','paste']) {
    root.addEventListener(type, event => {
      const emit=()=>parent.postMessage({type:'oscode-mobile-action'},parentOrigin);
      designAction(event,emit);adminAction(event,emit);patternAction(event,emit);erpProAction(event,emit);
      schedule();
    },type==='toggle');
  }
  addEventListener('resize', schedule);
  addEventListener('scroll', schedule, true);
  new ResizeObserver(schedule).observe(root);
  new MutationObserver(schedule).observe(root, {subtree:true, attributes:true, childList:true, characterData:true});
  schedule();
}

export function mobilePreviewHtml(markup, css, settings, nonce) {
  const config = JSON.stringify(settings.parentOrigin).replace(/</g, '\\u003c');
  // Keep the closing script token out of this function's source: it is also embedded in the gallery.
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>모바일 디자인 미리보기</title><style>
html{color-scheme:light;--oc-safe-bottom:${settings.safeArea ? 34 : 0}px}body{margin:0}*{box-sizing:border-box}
${css}
</style></head><body><section class="oc-design" data-variant="${settings.variant}" data-size="${settings.size}" data-motion="${settings.motion||'auto'}"${settings.mobile ? ' data-mobile="true"' : ''}${settings.admin ? ' data-admin="true"' : ''}${settings.interaction ? ' data-interaction="true"' : ''}${settings.erp ? ' data-erp="true"' : ''}>${markup.replaceAll('__id__','mobile')}</section><script nonce="${nonce}">${designAction.toString()}\n${designMotion.toString()}\n${adminAction.toString()}\n${patternAction.toString()}\nconst erpStates=new WeakMap();\n${[erpScale,erpParseAmount,erpFormatAmount,erpValidateJournal,erpUpdateGrid,erpAppendRow,erpUpdateLedger,erpAction,erpCsvCell,erpCleanView,erpReadView,erpDisplayColumns,erpRefreshViews,erpSnapshot,erpHistoryUi,erpErrorTargets,erpInit,erpRestore,erpProAction].map(fn=>fn.toString()).join('\n')}\n(${mobilePreviewRuntime.toString()})(${config});<` + '/script></body></html>';
}
