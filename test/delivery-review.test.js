import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryReview,reviewVerdict,reviewText} from '../src/delivery-review.js';
const report=()=>({status:'passed',created:'2026-09-18',changed:['src/Button.tsx'],steps:[{name:'lint',script:'lint',status:'passed'},{name:'browser',status:'passed'}],html:'/tmp/report.html'});
test('delivery gate never treats missing or skipped checks as complete',()=>{
 assert.equal(reviewVerdict(report()).status,'passed');
 for(const status of ['skipped','blocked','planned']){const r=report();r.steps[1].status=status;assert.equal(reviewVerdict(r).status,'incomplete');}
 const r=report();r.steps=r.steps.slice(1);assert.equal(reviewVerdict(r).status,'incomplete');
 r.steps[0].status='failed';assert.equal(reviewVerdict(r).status,'failed');r.status='cancelled';assert.equal(reviewVerdict(r).status,'cancelled');
 assert(reviewText(report()).includes('검사 당시'));assert(reviewText(report()).includes('src/Button.tsx'));
});
test('review forwards URL and existing approval policy and blocks PLAN/deny',async()=>{
 let calls=0;const approve=async()=>false,tools={approve};
 const verify=async options=>{calls++;assert.equal(options.changed,true);assert.equal(options.approve,approve);assert.equal(options.url,'http://localhost:3000');return report();};
 await deliveryReview({tools,config:{},url:'http://localhost:3000',verify});
 for(const config of [{plan:true},{permissions:{shell:'deny'}}])await assert.rejects(()=>deliveryReview({tools,config,verify}));
 assert.equal(calls,1);
});
