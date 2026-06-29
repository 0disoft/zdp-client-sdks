import {
  createZdpGeneratedOperationDefinitions,
  createZdpGeneratedTypedFetchClient
} from './generated-operations';
import type {
  ZdpGeneratedOperationMetadataMap,
  ZdpGeneratedOperationRequest,
  ZdpGeneratedSchemaModel,
  ZdpGeneratedSchemaModelMap,
  ZdpGeneratedSchemaPayload
} from './generated-operations';
import type { ZdpTypedFetchClientOptions } from './types';

export const ZDP_API_SCHEMA_MODEL_MAP = {
  'contracts/apis/core-api/auth-session.yaml#AuthRegistrationCreateRequest': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthRegistrationCreateRequest',
    schemaId: 'AuthRegistrationCreateRequest',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'request',
    carriesSecretMaterial: false,
    requiredFields: ['email_or_external_identity', 'locale', 'terms_consent_ref'],
    secretFields: [],
    sessionEffect: null
  },
  'contracts/apis/core-api/auth-session.yaml#AuthRegistrationCreateResponse': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthRegistrationCreateResponse',
    schemaId: 'AuthRegistrationCreateResponse',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'response',
    carriesSecretMaterial: false,
    requiredFields: ['registration_request_id', 'next_step'],
    secretFields: [],
    sessionEffect: 'none'
  },
  'contracts/apis/core-api/auth-session.yaml#AuthSessionCreateRequest': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthSessionCreateRequest',
    schemaId: 'AuthSessionCreateRequest',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'request',
    carriesSecretMaterial: true,
    requiredFields: ['login_identifier', 'verifier'],
    secretFields: ['verifier'],
    sessionEffect: null
  },
  'contracts/apis/core-api/auth-session.yaml#AuthSessionCreateResponse': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthSessionCreateResponse',
    schemaId: 'AuthSessionCreateResponse',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'response',
    carriesSecretMaterial: false,
    requiredFields: ['session_ref', 'actor_ref', 'tenant_ref', 'expires_at'],
    secretFields: [],
    sessionEffect: 'issue'
  },
  'contracts/apis/core-api/auth-session.yaml#AuthSessionRefreshRequest': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthSessionRefreshRequest',
    schemaId: 'AuthSessionRefreshRequest',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'request',
    carriesSecretMaterial: true,
    requiredFields: ['session_ref', 'rotation_proof'],
    secretFields: ['rotation_proof'],
    sessionEffect: null
  },
  'contracts/apis/core-api/auth-session.yaml#AuthSessionRefreshResponse': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthSessionRefreshResponse',
    schemaId: 'AuthSessionRefreshResponse',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'response',
    carriesSecretMaterial: false,
    requiredFields: ['session_ref', 'expires_at'],
    secretFields: [],
    sessionEffect: 'refresh'
  },
  'contracts/apis/core-api/auth-session.yaml#AuthSessionRevokeCurrentRequest': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthSessionRevokeCurrentRequest',
    schemaId: 'AuthSessionRevokeCurrentRequest',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'request',
    carriesSecretMaterial: false,
    requiredFields: ['session_ref'],
    secretFields: [],
    sessionEffect: null
  },
  'contracts/apis/core-api/auth-session.yaml#AuthSessionRevokeCurrentResponse': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthSessionRevokeCurrentResponse',
    schemaId: 'AuthSessionRevokeCurrentResponse',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'response',
    carriesSecretMaterial: false,
    requiredFields: ['revoked'],
    secretFields: [],
    sessionEffect: 'revoke'
  },
  'contracts/apis/core-api/auth-session.yaml#AuthRecoveryRequestCreateRequest': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthRecoveryRequestCreateRequest',
    schemaId: 'AuthRecoveryRequestCreateRequest',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'request',
    carriesSecretMaterial: false,
    requiredFields: ['login_identifier', 'locale'],
    secretFields: [],
    sessionEffect: null
  },
  'contracts/apis/core-api/auth-session.yaml#AuthRecoveryRequestCreateResponse': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#AuthRecoveryRequestCreateResponse',
    schemaId: 'AuthRecoveryRequestCreateResponse',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'response',
    carriesSecretMaterial: false,
    requiredFields: ['recovery_request_id', 'next_step'],
    secretFields: [],
    sessionEffect: 'none'
  },
  'contracts/apis/core-api/auth-session.yaml#PasskeyChallengeCreateRequest': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#PasskeyChallengeCreateRequest',
    schemaId: 'PasskeyChallengeCreateRequest',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'request',
    carriesSecretMaterial: false,
    requiredFields: ['ceremony', 'login_identifier'],
    secretFields: [],
    sessionEffect: null
  },
  'contracts/apis/core-api/auth-session.yaml#PasskeyChallengeCreateResponse': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#PasskeyChallengeCreateResponse',
    schemaId: 'PasskeyChallengeCreateResponse',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'response',
    carriesSecretMaterial: false,
    requiredFields: ['challenge_ref', 'public_key_options_ref', 'expires_at'],
    secretFields: [],
    sessionEffect: 'none'
  },
  'contracts/apis/core-api/auth-session.yaml#PasskeyAssertionVerifyRequest': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#PasskeyAssertionVerifyRequest',
    schemaId: 'PasskeyAssertionVerifyRequest',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'request',
    carriesSecretMaterial: true,
    requiredFields: ['challenge_ref', 'assertion'],
    secretFields: ['assertion'],
    sessionEffect: null
  },
  'contracts/apis/core-api/auth-session.yaml#PasskeyAssertionVerifyResponse': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#PasskeyAssertionVerifyResponse',
    schemaId: 'PasskeyAssertionVerifyResponse',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'response',
    carriesSecretMaterial: false,
    requiredFields: ['session_ref', 'actor_ref', 'tenant_ref', 'expires_at'],
    secretFields: [],
    sessionEffect: 'issue'
  },
  'contracts/apis/core-api/auth-session.yaml#OAuthCallbackAcceptRequest': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#OAuthCallbackAcceptRequest',
    schemaId: 'OAuthCallbackAcceptRequest',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'request',
    carriesSecretMaterial: true,
    requiredFields: ['provider', 'state_ref', 'callback_code'],
    secretFields: ['callback_code'],
    sessionEffect: null
  },
  'contracts/apis/core-api/auth-session.yaml#OAuthCallbackAcceptResponse': {
    schemaRef:
      'contracts/apis/core-api/auth-session.yaml#OAuthCallbackAcceptResponse',
    schemaId: 'OAuthCallbackAcceptResponse',
    sourceContract: 'contracts/apis/core-api/auth-session.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'response',
    carriesSecretMaterial: false,
    requiredFields: ['session_ref', 'actor_ref', 'tenant_ref', 'expires_at'],
    secretFields: [],
    sessionEffect: 'issue'
  },
  'contracts/apis/core-api/referral.yaml#ReferralUseCreateRequest': {
    schemaRef: 'contracts/apis/core-api/referral.yaml#ReferralUseCreateRequest',
    schemaId: 'ReferralUseCreateRequest',
    sourceContract: 'contracts/apis/core-api/referral.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'request',
    carriesSecretMaterial: false,
    requiredFields: ['referral_code', 'campaign_ref', 'referred_account_ref'],
    secretFields: [],
    sessionEffect: null
  },
  'contracts/apis/core-api/referral.yaml#ReferralUseCreateResponse': {
    schemaRef: 'contracts/apis/core-api/referral.yaml#ReferralUseCreateResponse',
    schemaId: 'ReferralUseCreateResponse',
    sourceContract: 'contracts/apis/core-api/referral.yaml',
    serviceId: 'core-api',
    ownerBoundary: 'identity',
    status: 'contract-only',
    kind: 'response',
    carriesSecretMaterial: false,
    requiredFields: [
      'referral_use_ref',
      'referral_status',
      'reward_status',
      'money_reward_status_ref'
    ],
    secretFields: [],
    sessionEffect: 'none'
  },
  'contracts/apis/money-api/referral-reward.yaml#ReferralRewardStatusGetRequest': {
    schemaRef:
      'contracts/apis/money-api/referral-reward.yaml#ReferralRewardStatusGetRequest',
    schemaId: 'ReferralRewardStatusGetRequest',
    sourceContract: 'contracts/apis/money-api/referral-reward.yaml',
    serviceId: 'money-api',
    ownerBoundary: 'money',
    status: 'contract-only',
    kind: 'request',
    carriesSecretMaterial: false,
    requiredFields: ['referral_use_ref'],
    secretFields: [],
    sessionEffect: null
  },
  'contracts/apis/money-api/referral-reward.yaml#ReferralRewardStatusGetResponse': {
    schemaRef:
      'contracts/apis/money-api/referral-reward.yaml#ReferralRewardStatusGetResponse',
    schemaId: 'ReferralRewardStatusGetResponse',
    sourceContract: 'contracts/apis/money-api/referral-reward.yaml',
    serviceId: 'money-api',
    ownerBoundary: 'money',
    status: 'contract-only',
    kind: 'response',
    carriesSecretMaterial: false,
    requiredFields: [
      'referral_use_ref',
      'reward_status',
      'reward_recipient',
      'eligible_settled_paid_amount_credit_unit',
      'excluded_refund_amount_credit_unit',
      'excluded_chargeback_amount_credit_unit',
      'abuse_review_status',
      'campaign_policy_version',
      'referral_reward_confirmation_ref'
    ],
    secretFields: [],
    sessionEffect: 'none'
  }
} as const satisfies ZdpGeneratedSchemaModelMap;

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

export type ZdpApiSchemaRef = keyof typeof ZDP_API_SCHEMA_MODEL_MAP;

export type ZdpApiSchemaModel =
  (typeof ZDP_API_SCHEMA_MODEL_MAP)[ZdpApiSchemaRef];

export type ZdpApiSchemaPayload<SchemaRef extends ZdpApiSchemaRef> =
  ZdpGeneratedSchemaPayload<(typeof ZDP_API_SCHEMA_MODEL_MAP)[SchemaRef]>;

export function getZdpApiSchemaModel<SchemaRef extends ZdpApiSchemaRef>(
  schemaRef: SchemaRef
): (typeof ZDP_API_SCHEMA_MODEL_MAP)[SchemaRef] {
  return ZDP_API_SCHEMA_MODEL_MAP[schemaRef];
}

export function getZdpGeneratedSchemaPayloadFields(
  model: ZdpGeneratedSchemaModel
): readonly string[] {
  return model.requiredFields;
}

export function createZdpApiClient(options: ZdpTypedFetchClientOptions) {
  return createZdpGeneratedTypedFetchClient(
    ZDP_TYPED_FETCH_OPERATION_MAP,
    options
  );
}
