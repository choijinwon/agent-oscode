// Small, non-blocking feedback. No layout/data updates depend on animation finishing.
export function designMotion(root,node) {
  if(!(root instanceof HTMLElement)||!(node instanceof HTMLElement)||!node.isConnected||typeof node.animate!=='function')return;
  for(const animation of node.getAnimations())if(animation.id==='oscode-feedback')animation.cancel();
  if(root.dataset.motion==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const subtle=root.dataset.motion==='reduced';
  const frames=subtle?[{opacity:.65},{opacity:1}]:[
    {opacity:.65,transform:node.matches('.oc-admin-detail')?'translateX(16px)':'translateY(4px)'},
    {opacity:1,transform:'none'}
  ];
  const animation=node.animate(frames,{duration:subtle?100:180,easing:'ease-out'});
  animation.id='oscode-feedback';
}

export const designMotionStyles = `
.oc-design button:not(:disabled){touch-action:manipulation}
.oc-design button:focus-visible,.oc-design input:focus-visible,.oc-design select:focus-visible{outline:3px solid var(--oc-accent);outline-offset:3px}
@media(prefers-reduced-motion:no-preference){
 .oc-design:not([data-motion=off]) button{transition:background-color 140ms ease,color 140ms ease,border-color 140ms ease,box-shadow 140ms ease}
 .oc-design:not([data-motion=off]):not([data-motion=reduced]) button{transition:background-color 140ms ease,color 140ms ease,border-color 140ms ease,box-shadow 140ms ease,transform 140ms ease}
 .oc-design:not([data-motion=off]):not([data-motion=reduced]) button:not(:disabled):active{transform:scale(.98)}
 .oc-design:not([data-motion=off]) [data-admin-row]{transition:background-color 140ms ease}
}
@media(hover:hover) and (prefers-reduced-motion:no-preference){
 .oc-design:not([data-motion=off]):not([data-motion=reduced]) button:not(:disabled):hover{box-shadow:0 3px 10px color-mix(in srgb,var(--oc-text) 12%,transparent)}
}
`;
