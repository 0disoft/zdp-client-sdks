import {expect,test} from 'bun:test';
import {createServerCouponUsageClient,CouponUsageConfigurationError} from '../src/server-coupon-usage';
import type {ServerCouponUsageFetch} from '../src/server-coupon-usage';
const operation={usageRef:'usage_saved',holdRef:'hold_saved',failureRef:'failure_saved',requestId:'request_saved',traceId:'trace_saved',
  captureReceipt:{settlement_id:'settlement_saved',source_kind:'usage' as const,source_ref:'hold_saved',inventory_id:'inventory_saved',
    original_credit_unit:'9007199254740993',benefit_credit_unit:'200',settled_credit_unit:'9007199254740793',
    effect_ledger_transaction_id:'ledger_saved',bonus_credit_lot_id:null,replayed:false}};
const receipt={settlement_id:operation.captureReceipt.settlement_id,failure_ref:operation.failureRef,reversal_transaction_id:'reversal_saved',
  restored_credit_unit:operation.captureReceipt.settled_credit_unit,restored_benefit_credit_unit:operation.captureReceipt.benefit_credit_unit,replayed:false};
const response=(body:unknown=receipt,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-request-id':operation.requestId,'x-trace-id':operation.traceId}});
function client(fetch:ServerCouponUsageFetch,timeoutMs=1000) {
  return createServerCouponUsageClient({environment:'local',origin:'http://127.0.0.1:3004',getServiceCredential:async()=> 'fixture_service_credential_00000000000000',fetch,timeoutMs});
}

test('compensation sends only the saved failure and operation and preserves exact returned units on replay',async()=>{
  let calls=0;
  const sdk=client(async(url,init)=>{
    calls++;expect(url).toEndWith('/v1/internal/coupons/usage/compensate');
    expect(JSON.parse(String(init.body))).toEqual({hold_ref:operation.holdRef,usage_ref:operation.usageRef,failure_ref:operation.failureRef});
    expect(init.credentials).toBe('omit');expect(new Headers(init.headers).get('cookie')).toBeNull();
    return response({...receipt,replayed:calls>1});
  });
  for(let i=0;i<2;i++) {
    const result=await sdk.compensate(operation);expect(result.state).toBe('compensated');
    if(result.state==='compensated') {
      expect(result.receipt.restored_credit_unit).toBe('9007199254740793');expect(result.receipt.replayed).toBe(i>0);
    }
  }
  expect(calls).toBe(2);
});
test('an unknown capture, foreign receipt or caller amount cannot initiate compensation',async()=>{
  let calls=0;const sdk=client(async()=>{calls++;return response();});
  for(const changed of [
    {...operation,captureReceipt:undefined},
    {...operation,captureReceipt:{...operation.captureReceipt,source_ref:'foreign_hold'}},
    {...operation,amount:1000},
    {...operation,failureRef:'raw failure text'},
  ])expect(sdk.compensate(changed as typeof operation)).rejects.toBeInstanceOf(CouponUsageConfigurationError);
  await Bun.sleep(0);expect(calls).toBe(0);
});
test('compensation never accepts mismatched refunds and unknown outcomes trigger no automatic retry',async()=>{
  for(const change of [{settlement_id:'foreign_settlement'},{failure_ref:'other_failure'},{restored_credit_unit:'0'},
    {restored_benefit_credit_unit:'201'},{restored_credit_unit:9007199254740793},{account_id:'private_account'}])
    expect((await client(async()=>response({...receipt,...change})).compensate(operation)).state).toBe('unknown');
  let calls=0;
  const result=await client(async()=>{calls++;return new Promise<Response>(()=>{});},5).compensate(operation);
  expect(result).toEqual({state:'unknown',code:'compensation_result_unknown',retry:'same_operation'});expect(calls).toBe(1);
  expect(await client(async()=>response({code:'usage_compensation_conflict'},409)).compensate(operation))
    .toEqual({state:'rejected',status:409,code:'usage_compensation_conflict'});
});
test('full free usage restores no spendable balance and asynchronous input changes cannot redirect compensation',async()=>{
  const free={...operation,captureReceipt:{...operation.captureReceipt,original_credit_unit:'1000',benefit_credit_unit:'1000',settled_credit_unit:'0'}};
  expect((await client(async()=>response({...receipt,restored_credit_unit:'0',restored_benefit_credit_unit:'1000'})).compensate(free)).state).toBe('compensated');
  const mutable=structuredClone(operation);
  let release:((v:string)=>void)|undefined;
  const sdk=createServerCouponUsageClient({environment:'local',origin:'http://127.0.0.1:3004',
    getServiceCredential:()=>new Promise<string>(resolve=>{release=resolve;}),
    fetch:async(_url,init)=>{
      expect(JSON.parse(String(init.body)).failure_ref).toBe(operation.failureRef);return response();
    }});
  const pending=sdk.compensate(mutable);mutable.failureRef='changed_failure';mutable.captureReceipt.settled_credit_unit='0';
  release?.('fixture_service_credential_00000000000000');expect((await pending).state).toBe('compensated');
});
