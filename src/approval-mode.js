export const approvalModes=[
 {value:'ask',label:'나에게 묻기 · 파일 편집과 셸 실행마다 확인'},
 {value:'delegate',label:'나 대신 승인 · 파일 편집 자동, 셸 실행은 확인'},
 {value:'auto',label:'자동 승인 · 파일 편집·셸 실행 허용 (셸은 프로젝트 밖 접근 가능)'}
];
export class ApprovalMode {
 constructor(args={}){this.write=Boolean(args.yes);this.shell=Boolean(args['allow-shell']);}
 get label(){return this.write&&this.shell?'자동 승인':this.write?'나 대신 승인':this.shell?'셸 자동 승인':'나에게 묻기';}
 set(mode){if(!approvalModes.some(item=>item.value===mode))throw new Error('/approval ask|delegate|auto');this.write=mode!=='ask';this.shell=mode==='auto';}
 allows(kind){return kind==='write'?this.write:kind==='shell'?this.shell:false;}
 async choose(ui,signal){
  const selected=await ui.choose(`승인 방식 · 현재: ${this.label} · 이 에이전트에만 적용`,[
   {value:'cancel',label:'돌아가기 · 현재 방식 유지'},...approvalModes
  ],{signal});
  if(selected!=='cancel')this.set(selected);
 }
}
