// Gallery chrome is separate from the portable component theme.
export const galleryStyles = `
*{box-sizing:border-box}
body{margin:0;color:#24303d;background:#f7f8fa;font:14px/1.6 Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;-webkit-font-smoothing:antialiased}
button,input,select{font:inherit}button{cursor:pointer}button:disabled{cursor:default}
button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #0f766e;outline-offset:3px}
.shell{display:grid;grid-template-columns:238px minmax(0,1fr);min-height:100vh}
.sidebar{position:sticky;top:0;align-self:start;display:flex;flex-direction:column;height:100dvh;min-width:0;padding:28px 16px 20px;background:#fff;border-right:1px solid #e8ecf0;overflow:hidden}
.brand{font-size:17px;font-weight:750;letter-spacing:-.7px;display:flex;align-items:center;gap:8px;margin:0 8px 8px}
.brand i{display:grid;place-items:center;background:#0f766e;width:30px;height:30px;border-radius:9px;box-shadow:0 2px 5px #0f766e20}
.brand i::before{content:'◫';color:#fff;font-size:22px;font-style:normal;font-weight:400}
.kicker{display:block;font-size:11px;color:#627180;letter-spacing:1.1px;text-transform:uppercase;margin:28px 10px 10px;font-weight:650}
.sidebar label.kicker{margin:2px 10px 6px;letter-spacing:0}
#search{width:100%;border:1px solid #e4e8ed;border-radius:8px;padding:10px 12px;background:#f8fafb;font-size:12px;margin-bottom:16px;color:#24303d}
#catalog{flex:1;overflow:auto;min-height:0;scrollbar-width:thin;scrollbar-color:#dce2e8 transparent}
.catalog-item{display:flex;align-items:start;gap:10px;text-align:left;width:100%;border:1px solid transparent;background:none;border-radius:9px;margin:3px 0;padding:12px 10px;color:#52616e}
.catalog-item:hover{background:#f6f8fa}
.catalog-item strong{font-size:12px;font-weight:600;line-height:1.5}
.catalog-item .catalog-copy{display:block;min-width:0}
.catalog-item .catalog-caption{display:block;font-size:11px;line-height:1.6;color:#627180;margin-top:3px;word-break:keep-all}
.catalog-item .catalog-icon{display:grid;place-items:center;flex:none;width:26px;height:26px;border:1px solid #e1e7ec;border-radius:7px;background:#fff;color:#71808e;font-size:17px}
.catalog-item[aria-pressed=true]{background:#eff7f5;border-color:#d9ebe6;color:#0b655c}
.catalog-item[aria-pressed=true] .catalog-icon{color:#0f766e;border-color:#c2e0d7;background:#f8fffc}
.catalog-item[aria-pressed=true] .catalog-caption{color:#516f67}
.library-note{margin:18px 8px 0;padding-top:16px;border-top:1px solid #edf0f3;color:#627180;font-size:11px}
.main{min-width:0;padding:32px 36px 48px;max-width:1600px;width:100%;margin:0 auto}
.main>.gallery-heading{display:flex;justify-content:space-between;gap:20px;align-items:start;margin-bottom:24px}
.eyebrow{font-size:11px;letter-spacing:1.5px;color:#627180;font-weight:650}
h1{font-size:28px;line-height:1.25;letter-spacing:-1.1px;margin:7px 0 10px;font-weight:700}
.gallery-heading p{font-size:12px;color:#627180;max-width:680px;margin:0}
.pill{display:inline-flex;align-items:center;gap:7px;border:1px solid #e3e9e7;border-radius:20px;padding:6px 11px;background:#fff;white-space:nowrap;font-size:11px;color:#5b746b}
.pill::before{content:'';width:5px;height:5px;border-radius:50%;background:#36a68c}
.toolbar{display:flex;flex-wrap:wrap;gap:18px;align-items:end;margin:0 0 20px;background:#fff;border:1px solid #e5e9ee;border-radius:12px;padding:16px 20px;box-shadow:0 2px 3px #20304002}
.control{display:grid;gap:7px;font-size:11px;font-weight:550;color:#627180;min-width:0}
.control select{min-height:36px;padding:7px 24px 7px 10px;border:1px solid #e2e7ec;border-radius:6px;background:#fff;color:#394955;font-size:12px}
.control input[type=color]{height:36px;width:42px;padding:3px;border:1px solid #e2e7ec;background:#fff;border-radius:7px}
.control input[type=range]{accent-color:#0f766e;max-width:108px}
#theme-reset{margin-left:auto;background:none;border:0;color:#697c77;padding:9px 0;font-size:11px}
.preview-controls{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin:18px 0 14px;font-size:11px;color:#627180}
.preview-controls select{font:inherit;min-height:34px;padding:6px 8px;border:1px solid #e2e7ed;border-radius:6px;background:#fff;color:#5b6976}
.preview-controls label{display:flex;align-items:center;gap:7px}.preview-controls input{accent-color:#0f766e}
.stage{border:1px solid #e6ebef;background:#f0f3f6;border-radius:14px;min-height:280px;padding:24px;display:grid;place-items:center}
.stage>.oc-design{width:min(100%,560px);box-shadow:0 8px 28px #23374709,0 1px 3px #23374705}
.stage>.oc-design[data-admin=true],.stage>.oc-design[data-erp=true]{width:100%;max-width:none}
.stage .team-notice{max-width:480px;background:#fff;padding:24px;border-radius:12px}
.section-heading{display:flex;justify-content:space-between;align-items:baseline;margin-top:32px;gap:16px}
.section-heading h2{font-size:14px;font-weight:650;letter-spacing:-.3px}.section-heading>span{font-size:11px;color:#627180}
.states{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.states:has([data-erp=true]){grid-template-columns:repeat(2,minmax(0,1fr))}
.states article{min-width:0;padding:16px;background:#fff;border:1px solid #e5eaf0;border-radius:12px}
.states h3{font-size:11px;font-weight:550;color:#627180;margin:0 0 14px;display:flex;align-items:center;gap:6px}
.states h3::before{content:'';width:5px;height:5px;border-radius:50%;background:#cbd5de}
.states .oc-design{font-size:12px;overflow:auto;min-height:94px}
.states .oc-mobile-screen{min-height:250px}
.preview-focus button:first-of-type,.preview-focus input:first-of-type{outline:3px solid var(--oc-accent);outline-offset:3px}
.footer{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:24px;padding:20px 0;border-top:1px solid #e2e8ed}
.footer p{font-size:12px;color:#627180;max-width:580px;margin:0}
#choose{border:1px solid #0d6c64;background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;font-weight:600;font-size:12px;white-space:nowrap;box-shadow:0 2px 3px #0f766e15}
#choose:hover{background:#0d6c64}#choose:disabled{opacity:.5}
.scope-note{font-size:11px;color:#627180;margin:12px 0 20px;line-height:1.7}
.device-scroll{width:100%;min-width:0;overflow:auto}
.device{width:max-content;margin:auto;border:2px solid #34434f;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 12px 30px #23374714}
.device-label{padding:8px 14px;background:#34434f;color:#dbe6ed;font-size:11px;letter-spacing:.04em}
.device iframe{display:block;border:0;max-width:none;background:#fff}
.keyboard-demo{height:240px;display:grid;place-items:center;color:#64736b;font-size:12px;background:repeating-linear-gradient(0deg,#e3e8e3 0 36px,#f4f6f2 36px 44px);border-top:1px solid #ccd7d2}
#mobile-observation{font-size:11px;color:#52756e;background:#ecf5f2;padding:12px;border-radius:8px}
/* Reuse tools belong to the gallery, never to generated app styles. */
.reuse-panel{margin-top:24px;border:1px solid #dfe6ed;border-radius:12px;background:#fff;padding:18px 20px}
.reuse-panel summary{cursor:pointer;font-size:13px;font-weight:600;color:#30434d;min-height:32px}.reuse-panel summary span{float:right;font:11px ui-monospace,monospace;color:#627180}
.reuse-panel>p{font-size:12px;color:#627180}.reuse-color{display:flex;gap:10px;align-items:center;font-size:12px;color:#627180}.reuse-color input{width:42px;height:34px;border:1px solid #dfe6ed;background:#fff;border-radius:6px;padding:3px}
.reuse-pages{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}.reuse-pages article{min-width:0;padding:18px;border:1px solid #e5eaf0;border-radius:10px;background:#f8fafb}.reuse-pages h3{font-size:13px;margin:0 0 4px}.reuse-pages p{font-size:11px;margin:0 0 16px;color:#627180}.reuse-pages .oc-design{width:100%}
.reuse-panel pre{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;font:12px/1.7 ui-monospace,monospace;color:#30434d}.reuse-code{border:1px solid #e5eaf0;background:#f7f9fb;padding:12px;border-radius:8px}.reuse-panel button{min-height:36px;border:1px solid #dfe6ed;border-radius:6px;background:white;padding:6px 10px;color:#43625c;font-size:12px}.reuse-example{margin-top:16px}.reuse-example summary{font-size:12px}.reuse-panel #reuse-status{margin-bottom:0}
@media(max-width:650px){.reuse-pages{grid-template-columns:1fr}.reuse-panel{padding:14px}.reuse-panel summary span{float:none;display:block;margin:6px 0}}
@media(max-width:1100px){.shell{grid-template-columns:212px minmax(0,1fr)}.main{padding:28px 24px}.stage{padding:18px}.states{grid-template-columns:repeat(2,minmax(0,1fr))}.toolbar{gap:12px;padding:14px}.catalog-item .catalog-icon{display:none}}
@media(max-width:650px){.shell{grid-template-columns:minmax(0,1fr)}.sidebar{position:static;height:auto;padding:16px;border-right:0;border-bottom:1px solid #e5eaf0;overflow:visible}.brand{margin-bottom:4px}.kicker{margin-top:12px}.library-note{display:none}#catalog{flex:none;display:flex;overflow:auto;gap:5px;max-height:150px}.catalog-item{min-width:150px;max-width:180px;padding:10px}.main{padding:22px 16px}.main>.gallery-heading{display:block}h1{font-size:25px}.pill{margin-top:12px}.toolbar{gap:12px}.control{flex:1;min-width:70px}#theme-reset{font-size:11px}.stage{padding:12px}.states,.states:has([data-erp=true]){grid-template-columns:1fr}.footer{flex-direction:column;align-items:stretch}.section-heading>span{display:none}.preview-controls{gap:10px}}
`;
