import {
  createZdpGeneratedOperationDefinitions,
  createZdpGeneratedTypedFetchClient
} from './generated-operations';
import type {
  ZdpGeneratedOperationMetadataMap,
  ZdpGeneratedOperationRequest
} from './generated-operations';
import type { ZdpTypedFetchClientOptions } from './types';

export const ZDP_TYPED_FETCH_OPERATION_MAP = {
  'core.auth.registrations.create': {
    operationId: 'core.auth.registrations.create',
    method: 'POST',
    path: '/v1/auth/registrations',
    successStatuses: [202],
    requestSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthRegistrationCreateRequest',
    responseSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthRegistrationCreateResponse',
    authRequired: false,
    idempotency: 'required_idempotency_key',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: [
      'validation_failed',
      'identity_conflict',
      'rate_limited',
      'idempotency_conflict'
    ]
  },
  'core.auth.sessions.create': {
    operationId: 'core.auth.sessions.create',
    method: 'POST',
    path: '/v1/auth/sessions',
    successStatuses: [201],
    requestSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthSessionCreateRequest',
    responseSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthSessionCreateResponse',
    authRequired: false,
    idempotency: 'required_idempotency_key',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: [
      'validation_failed',
      'authentication_failed',
      'rate_limited',
      'session_policy_failed',
      'account_restricted',
      'idempotency_conflict'
    ]
  },
  'core.auth.sessions.refresh': {
    operationId: 'core.auth.sessions.refresh',
    method: 'POST',
    path: '/v1/auth/sessions/refresh',
    successStatuses: [200],
    requestSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthSessionRefreshRequest',
    responseSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthSessionRefreshResponse',
    authRequired: true,
    idempotency: 'required_idempotency_key',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: [
      'validation_failed',
      'authentication_failed',
      'session_revoked',
      'session_expired',
      'session_compromised',
      'account_restricted',
      'rate_limited',
      'idempotency_conflict'
    ]
  },
  'core.auth.sessions.revoke_current': {
    operationId: 'core.auth.sessions.revoke_current',
    method: 'DELETE',
    path: '/v1/auth/sessions/current',
    successStatuses: [204],
    requestSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthSessionRevokeCurrentRequest',
    responseSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthSessionRevokeCurrentResponse',
    authRequired: true,
    idempotency: 'required_idempotency_key',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: [
      'authentication_failed',
      'session_revoked',
      'session_expired',
      'session_compromised',
      'idempotency_conflict'
    ]
  },
  'core.auth.recovery_requests.create': {
    operationId: 'core.auth.recovery_requests.create',
    method: 'POST',
    path: '/v1/auth/recovery/requests',
    successStatuses: [202],
    requestSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthRecoveryRequestCreateRequest',
    responseSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthRecoveryRequestCreateResponse',
    authRequired: false,
    idempotency: 'required_idempotency_key',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: ['validation_failed', 'rate_limited', 'idempotency_conflict']
  },
  'core.auth.passkey_challenges.create': {
    operationId: 'core.auth.passkey_challenges.create',
    method: 'POST',
    path: '/v1/auth/passkey/challenges',
    successStatuses: [201],
    requestSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#PasskeyChallengeCreateRequest',
    responseSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#PasskeyChallengeCreateResponse',
    authRequired: false,
    idempotency: 'required_idempotency_key',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: ['validation_failed', 'rate_limited', 'idempotency_conflict']
  },
  'core.auth.passkey_assertions.verify': {
    operationId: 'core.auth.passkey_assertions.verify',
    method: 'POST',
    path: '/v1/auth/passkey/assertions',
    successStatuses: [201],
    requestSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#PasskeyAssertionVerifyRequest',
    responseSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#PasskeyAssertionVerifyResponse',
    authRequired: false,
    idempotency: 'required_idempotency_key',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: [
      'validation_failed',
      'authentication_failed',
      'passkey_challenge_expired',
      'account_restricted',
      'rate_limited',
      'idempotency_conflict'
    ]
  },
  'core.auth.oauth_callbacks.accept': {
    operationId: 'core.auth.oauth_callbacks.accept',
    method: 'POST',
    path: '/v1/auth/oauth/callbacks/{provider}',
    successStatuses: [201],
    requestSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#OAuthCallbackAcceptRequest',
    responseSchemaRef:
      'contracts/apis/core-api/auth-session.yaml#OAuthCallbackAcceptResponse',
    authRequired: false,
    idempotency: 'required_idempotency_key',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: [
      'validation_failed',
      'authentication_failed',
      'oauth_state_mismatch',
      'provider_unavailable',
      'account_restricted',
      'rate_limited',
      'idempotency_conflict'
    ]
  },
  'core.referral.uses.create': {
    operationId: 'core.referral.uses.create',
    method: 'POST',
    path: '/v1/referrals/uses',
    successStatuses: [202],
    requestSchemaRef:
      'contracts/apis/core-api/referral.yaml#ReferralUseCreateRequest',
    responseSchemaRef:
      'contracts/apis/core-api/referral.yaml#ReferralUseCreateResponse',
    authRequired: true,
    idempotency: 'required_idempotency_key',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: [
      'validation_failed',
      'authentication_failed',
      'account_restricted',
      'rate_limited',
      'idempotency_conflict'
    ]
  },
  'money.referral_rewards.status.get': {
    operationId: 'money.referral_rewards.status.get',
    method: 'GET',
    path: '/v1/referrals/uses/{referral_use_ref}/reward-status',
    successStatuses: [200],
    requestSchemaRef:
      'contracts/apis/money-api/referral-reward.yaml#ReferralRewardStatusGetRequest',
    responseSchemaRef:
      'contracts/apis/money-api/referral-reward.yaml#ReferralRewardStatusGetResponse',
    authRequired: true,
    idempotency: 'not_required',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: [
      'validation_failed',
      'authentication_failed',
      'account_restricted',
      'not_found'
    ]
  }
} as const satisfies ZdpGeneratedOperationMetadataMap;

export const zdpTypedFetchOperations =
  createZdpGeneratedOperationDefinitions(ZDP_TYPED_FETCH_OPERATION_MAP);

export type ZdpApiOperationId = keyof typeof ZDP_TYPED_FETCH_OPERATION_MAP;

export type ZdpApiOperationRequest = ZdpGeneratedOperationRequest;

export type ZdpApiOperationResponse = unknown;

export function createZdpApiClient(options: ZdpTypedFetchClientOptions) {
  return createZdpGeneratedTypedFetchClient(
    ZDP_TYPED_FETCH_OPERATION_MAP,
    options
  );
}
