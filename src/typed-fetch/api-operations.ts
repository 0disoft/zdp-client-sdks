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
  "contracts/apis/core-api/access-decision.yaml#AccessAuthorizationDecisionCreateRequest": {
    "schemaRef": "contracts/apis/core-api/access-decision.yaml#AccessAuthorizationDecisionCreateRequest",
    "schemaId": "AccessAuthorizationDecisionCreateRequest",
    "sourceContract": "contracts/apis/core-api/access-decision.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "access",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "product_ref",
      "action",
      "resource_type",
      "resource_ref",
      "requested_scope_type",
      "requested_scope_ref"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": null
  },
  "contracts/apis/core-api/access-decision.yaml#AccessAuthorizationDecisionCreateResponse": {
    "schemaRef": "contracts/apis/core-api/access-decision.yaml#AccessAuthorizationDecisionCreateResponse",
    "schemaId": "AccessAuthorizationDecisionCreateResponse",
    "sourceContract": "contracts/apis/core-api/access-decision.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "access",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "decision_ref",
      "decision",
      "reason_code",
      "policy_version",
      "data_revision",
      "subject_ref",
      "session_ref",
      "product_ref",
      "action",
      "resource_type",
      "resource_ref",
      "scope_type",
      "scope_ref",
      "decided_at",
      "decision_expires_at",
      "session_expires_at",
      "obligations"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/core-api/auth-session-consumer.yaml#AuthSessionCurrentGetRequest": {
    "schemaRef": "contracts/apis/core-api/auth-session-consumer.yaml#AuthSessionCurrentGetRequest",
    "schemaId": "AuthSessionCurrentGetRequest",
    "sourceContract": "contracts/apis/core-api/auth-session-consumer.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": false,
    "requiredFields": [],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": null
  },
  "contracts/apis/core-api/auth-session-consumer.yaml#AuthSessionCurrentGetResponse": {
    "schemaRef": "contracts/apis/core-api/auth-session-consumer.yaml#AuthSessionCurrentGetResponse",
    "schemaId": "AuthSessionCurrentGetResponse",
    "sourceContract": "contracts/apis/core-api/auth-session-consumer.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "session_ref",
      "actor_ref",
      "tenant_ref",
      "expires_at"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/core-api/auth-session.yaml#AuthRecoveryRequestCreateRequest": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#AuthRecoveryRequestCreateRequest",
    "schemaId": "AuthRecoveryRequestCreateRequest",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "login_identifier",
      "locale"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": null
  },
  "contracts/apis/core-api/auth-session.yaml#AuthRecoveryRequestCreateResponse": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#AuthRecoveryRequestCreateResponse",
    "schemaId": "AuthRecoveryRequestCreateResponse",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "recovery_request_id",
      "next_step"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/core-api/auth-session.yaml#AuthRegistrationCreateRequest": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#AuthRegistrationCreateRequest",
    "schemaId": "AuthRegistrationCreateRequest",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": true,
    "requiredFields": [
      "login_id",
      "password",
      "terms_consent_ref"
    ],
    "optionalFields": [
      "locale"
    ],
    "secretFields": [
      "password"
    ],
    "sessionEffect": null
  },
  "contracts/apis/core-api/auth-session.yaml#AuthRegistrationCreateResponse": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#AuthRegistrationCreateResponse",
    "schemaId": "AuthRegistrationCreateResponse",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "registration_request_id",
      "next_step"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/core-api/auth-session.yaml#AuthSessionCreateRequest": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#AuthSessionCreateRequest",
    "schemaId": "AuthSessionCreateRequest",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": true,
    "requiredFields": [
      "login_identifier",
      "verifier"
    ],
    "optionalFields": [],
    "secretFields": [
      "verifier"
    ],
    "sessionEffect": null
  },
  "contracts/apis/core-api/auth-session.yaml#AuthSessionCreateResponse": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#AuthSessionCreateResponse",
    "schemaId": "AuthSessionCreateResponse",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "session_ref",
      "actor_ref",
      "tenant_ref",
      "expires_at"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "issue"
  },
  "contracts/apis/core-api/auth-session.yaml#AuthSessionRefreshRequest": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#AuthSessionRefreshRequest",
    "schemaId": "AuthSessionRefreshRequest",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": true,
    "requiredFields": [
      "session_ref",
      "rotation_proof"
    ],
    "optionalFields": [],
    "secretFields": [
      "rotation_proof"
    ],
    "sessionEffect": null
  },
  "contracts/apis/core-api/auth-session.yaml#AuthSessionRefreshResponse": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#AuthSessionRefreshResponse",
    "schemaId": "AuthSessionRefreshResponse",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "session_ref",
      "expires_at"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "refresh"
  },
  "contracts/apis/core-api/auth-session.yaml#AuthSessionRevokeCurrentRequest": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#AuthSessionRevokeCurrentRequest",
    "schemaId": "AuthSessionRevokeCurrentRequest",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "session_ref"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": null
  },
  "contracts/apis/core-api/auth-session.yaml#OAuthCallbackAcceptRequest": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#OAuthCallbackAcceptRequest",
    "schemaId": "OAuthCallbackAcceptRequest",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": true,
    "requiredFields": [
      "provider",
      "state_ref",
      "callback_code"
    ],
    "optionalFields": [],
    "secretFields": [
      "callback_code"
    ],
    "sessionEffect": null
  },
  "contracts/apis/core-api/auth-session.yaml#OAuthCallbackAcceptResponse": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#OAuthCallbackAcceptResponse",
    "schemaId": "OAuthCallbackAcceptResponse",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "session_ref",
      "actor_ref",
      "tenant_ref",
      "expires_at"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "issue"
  },
  "contracts/apis/core-api/auth-session.yaml#PasskeyAssertionVerifyRequest": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#PasskeyAssertionVerifyRequest",
    "schemaId": "PasskeyAssertionVerifyRequest",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": true,
    "requiredFields": [
      "challenge_ref",
      "assertion"
    ],
    "optionalFields": [],
    "secretFields": [
      "assertion"
    ],
    "sessionEffect": null
  },
  "contracts/apis/core-api/auth-session.yaml#PasskeyAssertionVerifyResponse": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#PasskeyAssertionVerifyResponse",
    "schemaId": "PasskeyAssertionVerifyResponse",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "session_ref",
      "actor_ref",
      "tenant_ref",
      "expires_at"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "issue"
  },
  "contracts/apis/core-api/auth-session.yaml#PasskeyChallengeCreateRequest": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#PasskeyChallengeCreateRequest",
    "schemaId": "PasskeyChallengeCreateRequest",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "ceremony",
      "login_identifier"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": null
  },
  "contracts/apis/core-api/auth-session.yaml#PasskeyChallengeCreateResponse": {
    "schemaRef": "contracts/apis/core-api/auth-session.yaml#PasskeyChallengeCreateResponse",
    "schemaId": "PasskeyChallengeCreateResponse",
    "sourceContract": "contracts/apis/core-api/auth-session.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "challenge_ref",
      "public_key_options_ref",
      "expires_at"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeCompleteRequest": {
    "schemaRef": "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeCompleteRequest",
    "schemaId": "ProductLinkChallengeCompleteRequest",
    "sourceContract": "contracts/apis/core-api/product-link.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "challenge_ref",
      "approval_decision"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": null
  },
  "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeCompleteResponse": {
    "schemaRef": "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeCompleteResponse",
    "schemaId": "ProductLinkChallengeCompleteResponse",
    "sourceContract": "contracts/apis/core-api/product-link.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "challenge_ref",
      "state",
      "expires_at"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeCreateRequest": {
    "schemaRef": "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeCreateRequest",
    "schemaId": "ProductLinkChallengeCreateRequest",
    "sourceContract": "contracts/apis/core-api/product-link.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "product_ref",
      "client_instance_ref",
      "client_correlation_ref",
      "proof_challenge",
      "requested_scope_refs"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": null
  },
  "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeCreateResponse": {
    "schemaRef": "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeCreateResponse",
    "schemaId": "ProductLinkChallengeCreateResponse",
    "sourceContract": "contracts/apis/core-api/product-link.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "challenge_ref",
      "verification_uri",
      "expires_at",
      "poll_interval_seconds"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeExchangeRequest": {
    "schemaRef": "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeExchangeRequest",
    "schemaId": "ProductLinkChallengeExchangeRequest",
    "sourceContract": "contracts/apis/core-api/product-link.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": true,
    "requiredFields": [
      "challenge_ref",
      "client_correlation_ref",
      "proof_verifier"
    ],
    "optionalFields": [],
    "secretFields": [
      "proof_verifier"
    ],
    "sessionEffect": null
  },
  "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeExchangeResponse": {
    "schemaRef": "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeExchangeResponse",
    "schemaId": "ProductLinkChallengeExchangeResponse",
    "sourceContract": "contracts/apis/core-api/product-link.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "link_receipt_ref",
      "subject_ref",
      "consent_receipt_ref",
      "verified_at"
    ],
    "optionalFields": [
      "workspace_ref"
    ],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/core-api/referral.yaml#ReferralUseCreateRequest": {
    "schemaRef": "contracts/apis/core-api/referral.yaml#ReferralUseCreateRequest",
    "schemaId": "ReferralUseCreateRequest",
    "sourceContract": "contracts/apis/core-api/referral.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "referral_code",
      "campaign_ref",
      "referred_account_ref"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": null
  },
  "contracts/apis/core-api/referral.yaml#ReferralUseCreateResponse": {
    "schemaRef": "contracts/apis/core-api/referral.yaml#ReferralUseCreateResponse",
    "schemaId": "ReferralUseCreateResponse",
    "sourceContract": "contracts/apis/core-api/referral.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "identity",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "referral_use_ref",
      "referral_status",
      "reward_status",
      "money_reward_status_ref"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/core-api/sensitive-action-authorization.yaml#SensitiveActionAuthorizationReceipt": {
    "schemaRef": "contracts/apis/core-api/sensitive-action-authorization.yaml#SensitiveActionAuthorizationReceipt",
    "schemaId": "SensitiveActionAuthorizationReceipt",
    "sourceContract": "contracts/apis/core-api/sensitive-action-authorization.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "access",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "receipt_ref",
      "authorization_request_ref",
      "issuer_ref",
      "subject_ref",
      "tenant_ref",
      "audience_product_ref",
      "action_ref",
      "resource_ref",
      "assurance_method_ref",
      "verified_at",
      "expires_at",
      "session_generation_ref",
      "policy_ref",
      "policy_version",
      "decision_revision",
      "issued_at",
      "audit_event_ref"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/core-api/sensitive-action-authorization.yaml#SensitiveActionAuthorizationReceiptVerifyRequest": {
    "schemaRef": "contracts/apis/core-api/sensitive-action-authorization.yaml#SensitiveActionAuthorizationReceiptVerifyRequest",
    "schemaId": "SensitiveActionAuthorizationReceiptVerifyRequest",
    "sourceContract": "contracts/apis/core-api/sensitive-action-authorization.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "access",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "receipt_ref",
      "audience_product_ref",
      "action_ref",
      "resource_ref"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": null
  },
  "contracts/apis/core-api/sensitive-action-authorization.yaml#SensitiveActionAuthorizationReceiptVerifyResponse": {
    "schemaRef": "contracts/apis/core-api/sensitive-action-authorization.yaml#SensitiveActionAuthorizationReceiptVerifyResponse",
    "schemaId": "SensitiveActionAuthorizationReceiptVerifyResponse",
    "sourceContract": "contracts/apis/core-api/sensitive-action-authorization.yaml",
    "serviceId": "core-api",
    "ownerBoundary": "access",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "receipt_ref",
      "issuer_state",
      "verification_result",
      "subject_ref",
      "tenant_ref",
      "audience_product_ref",
      "action_ref",
      "resource_ref",
      "assurance_method_ref",
      "verified_at",
      "expires_at",
      "session_generation_ref",
      "policy_ref",
      "policy_version",
      "decision_revision",
      "issued_at",
      "audit_event_ref"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/money-api/credit-purchase-read.yaml#CreditCheckoutIntentStatusGetRequest": {
    "schemaRef": "contracts/apis/money-api/credit-purchase-read.yaml#CreditCheckoutIntentStatusGetRequest",
    "schemaId": "CreditCheckoutIntentStatusGetRequest",
    "sourceContract": "contracts/apis/money-api/credit-purchase-read.yaml",
    "serviceId": "money-api",
    "ownerBoundary": "money",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "checkout_intent_ref"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": null
  },
  "contracts/apis/money-api/credit-purchase-read.yaml#CreditCheckoutIntentStatusGetResponse": {
    "schemaRef": "contracts/apis/money-api/credit-purchase-read.yaml#CreditCheckoutIntentStatusGetResponse",
    "schemaId": "CreditCheckoutIntentStatusGetResponse",
    "sourceContract": "contracts/apis/money-api/credit-purchase-read.yaml",
    "serviceId": "money-api",
    "ownerBoundary": "money",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "checkout_intent_ref",
      "operation_ref",
      "checkout_status",
      "payment_status",
      "credit_issuance_status",
      "return_receipt_status",
      "balance_refresh_required",
      "updated_at",
      "expires_at"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/money-api/credit-purchase-read.yaml#CreditPackCatalogProjectionGetRequest": {
    "schemaRef": "contracts/apis/money-api/credit-purchase-read.yaml#CreditPackCatalogProjectionGetRequest",
    "schemaId": "CreditPackCatalogProjectionGetRequest",
    "sourceContract": "contracts/apis/money-api/credit-purchase-read.yaml",
    "serviceId": "money-api",
    "ownerBoundary": "money",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "product_ref",
      "scope_type",
      "scope_ref",
      "environment",
      "locale"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": null
  },
  "contracts/apis/money-api/credit-purchase-read.yaml#CreditPackCatalogProjectionGetResponse": {
    "schemaRef": "contracts/apis/money-api/credit-purchase-read.yaml#CreditPackCatalogProjectionGetResponse",
    "schemaId": "CreditPackCatalogProjectionGetResponse",
    "sourceContract": "contracts/apis/money-api/credit-purchase-read.yaml",
    "serviceId": "money-api",
    "ownerBoundary": "money",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "projection_ref",
      "product_ref",
      "scope_type",
      "scope_ref",
      "environment",
      "locale",
      "catalog_version",
      "currency",
      "ship_tiers",
      "sales_status",
      "projected_at",
      "expires_at"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/money-api/credit-purchase.yaml#CreditCheckoutIntentCreateRequest": {
    "schemaRef": "contracts/apis/money-api/credit-purchase.yaml#CreditCheckoutIntentCreateRequest",
    "schemaId": "CreditCheckoutIntentCreateRequest",
    "sourceContract": "contracts/apis/money-api/credit-purchase.yaml",
    "serviceId": "money-api",
    "ownerBoundary": "money",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "product_ref",
      "ship_tier_id",
      "scope_type",
      "scope_ref",
      "environment",
      "locale",
      "return_target_id"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": null
  },
  "contracts/apis/money-api/credit-purchase.yaml#CreditCheckoutIntentCreateResponse": {
    "schemaRef": "contracts/apis/money-api/credit-purchase.yaml#CreditCheckoutIntentCreateResponse",
    "schemaId": "CreditCheckoutIntentCreateResponse",
    "sourceContract": "contracts/apis/money-api/credit-purchase.yaml",
    "serviceId": "money-api",
    "ownerBoundary": "money",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "checkout_intent_ref",
      "operation_ref",
      "checkout_status",
      "payment_status",
      "credit_issuance_status",
      "catalog_version",
      "price_snapshot_ref",
      "tax_snapshot_ref",
      "benefit_snapshot_ref",
      "return_target_id",
      "wallet_handoff_ref",
      "created_at",
      "expires_at"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/money-api/credit-purchase.yaml#CreditCheckoutReturnReceiptExchangeRequest": {
    "schemaRef": "contracts/apis/money-api/credit-purchase.yaml#CreditCheckoutReturnReceiptExchangeRequest",
    "schemaId": "CreditCheckoutReturnReceiptExchangeRequest",
    "sourceContract": "contracts/apis/money-api/credit-purchase.yaml",
    "serviceId": "money-api",
    "ownerBoundary": "money",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": true,
    "requiredFields": [
      "return_receipt",
      "product_ref",
      "return_target_id"
    ],
    "optionalFields": [],
    "secretFields": [
      "return_receipt"
    ],
    "sessionEffect": null
  },
  "contracts/apis/money-api/credit-purchase.yaml#CreditCheckoutReturnReceiptExchangeResponse": {
    "schemaRef": "contracts/apis/money-api/credit-purchase.yaml#CreditCheckoutReturnReceiptExchangeResponse",
    "schemaId": "CreditCheckoutReturnReceiptExchangeResponse",
    "sourceContract": "contracts/apis/money-api/credit-purchase.yaml",
    "serviceId": "money-api",
    "ownerBoundary": "money",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "checkout_intent_ref",
      "operation_ref",
      "checkout_status",
      "payment_status",
      "credit_issuance_status",
      "balance_refresh_required",
      "consumed_at"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  },
  "contracts/apis/money-api/referral-reward.yaml#ReferralRewardStatusGetRequest": {
    "schemaRef": "contracts/apis/money-api/referral-reward.yaml#ReferralRewardStatusGetRequest",
    "schemaId": "ReferralRewardStatusGetRequest",
    "sourceContract": "contracts/apis/money-api/referral-reward.yaml",
    "serviceId": "money-api",
    "ownerBoundary": "money",
    "status": "contract-only",
    "kind": "request",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "referral_use_ref"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": null
  },
  "contracts/apis/money-api/referral-reward.yaml#ReferralRewardStatusGetResponse": {
    "schemaRef": "contracts/apis/money-api/referral-reward.yaml#ReferralRewardStatusGetResponse",
    "schemaId": "ReferralRewardStatusGetResponse",
    "sourceContract": "contracts/apis/money-api/referral-reward.yaml",
    "serviceId": "money-api",
    "ownerBoundary": "money",
    "status": "contract-only",
    "kind": "response",
    "carriesSecretMaterial": false,
    "requiredFields": [
      "referral_use_ref",
      "reward_status",
      "reward_recipient",
      "eligible_settled_paid_amount_credit_unit",
      "excluded_refund_amount_credit_unit",
      "excluded_chargeback_amount_credit_unit",
      "abuse_review_status",
      "campaign_policy_version",
      "referral_reward_confirmation_ref"
    ],
    "optionalFields": [],
    "secretFields": [],
    "sessionEffect": "none"
  }
} as const satisfies ZdpGeneratedSchemaModelMap;

export const ZDP_TYPED_FETCH_OPERATION_MAP = {
  "core.auth.registrations.create": {
    "operationId": "core.auth.registrations.create",
    "method": "POST",
    "path": "/v1/auth/registrations",
    "successStatuses": [
      202
    ],
    "requestSchemaRef": "contracts/apis/core-api/auth-session.yaml#AuthRegistrationCreateRequest",
    "responseSchemaRef": "contracts/apis/core-api/auth-session.yaml#AuthRegistrationCreateResponse",
    "responseBodyMode": "schema",
    "authRequired": false,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "identity_conflict",
      "rate_limited",
      "idempotency_conflict"
    ]
  },
  "core.auth.sessions.create": {
    "operationId": "core.auth.sessions.create",
    "method": "POST",
    "path": "/v1/auth/sessions",
    "successStatuses": [
      201
    ],
    "requestSchemaRef": "contracts/apis/core-api/auth-session.yaml#AuthSessionCreateRequest",
    "responseSchemaRef": "contracts/apis/core-api/auth-session.yaml#AuthSessionCreateResponse",
    "responseBodyMode": "schema",
    "authRequired": false,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "authentication_failed",
      "rate_limited",
      "session_policy_failed",
      "account_restricted",
      "idempotency_conflict"
    ]
  },
  "core.auth.sessions.refresh": {
    "operationId": "core.auth.sessions.refresh",
    "method": "POST",
    "path": "/v1/auth/sessions/refresh",
    "successStatuses": [
      200
    ],
    "requestSchemaRef": "contracts/apis/core-api/auth-session.yaml#AuthSessionRefreshRequest",
    "responseSchemaRef": "contracts/apis/core-api/auth-session.yaml#AuthSessionRefreshResponse",
    "responseBodyMode": "schema",
    "authRequired": true,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "authentication_failed",
      "session_revoked",
      "session_expired",
      "session_compromised",
      "account_restricted",
      "rate_limited",
      "idempotency_conflict"
    ]
  },
  "core.auth.sessions.revoke_current": {
    "operationId": "core.auth.sessions.revoke_current",
    "method": "DELETE",
    "path": "/v1/auth/sessions/current",
    "successStatuses": [
      204
    ],
    "requestSchemaRef": "contracts/apis/core-api/auth-session.yaml#AuthSessionRevokeCurrentRequest",
    "responseSchemaRef": null,
    "responseBodyMode": "none",
    "authRequired": true,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "authentication_failed",
      "session_revoked",
      "session_expired",
      "session_compromised",
      "idempotency_conflict"
    ]
  },
  "core.auth.sessions.get_current": {
    "operationId": "core.auth.sessions.get_current",
    "method": "GET",
    "path": "/v1/auth/sessions/current",
    "successStatuses": [
      200
    ],
    "requestSchemaRef": "contracts/apis/core-api/auth-session-consumer.yaml#AuthSessionCurrentGetRequest",
    "responseSchemaRef": "contracts/apis/core-api/auth-session-consumer.yaml#AuthSessionCurrentGetResponse",
    "responseBodyMode": "schema",
    "authRequired": true,
    "idempotency": "not_required",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "authentication_failed",
      "session_revoked",
      "session_expired",
      "session_compromised",
      "account_restricted"
    ]
  },
  "core.access.authorization_decisions.create": {
    "operationId": "core.access.authorization_decisions.create",
    "method": "POST",
    "path": "/v1/access/authorization-decisions",
    "successStatuses": [
      201
    ],
    "requestSchemaRef": "contracts/apis/core-api/access-decision.yaml#AccessAuthorizationDecisionCreateRequest",
    "responseSchemaRef": "contracts/apis/core-api/access-decision.yaml#AccessAuthorizationDecisionCreateResponse",
    "responseBodyMode": "schema",
    "authRequired": true,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "authentication_failed",
      "session_revoked",
      "session_expired",
      "account_restricted",
      "policy_unavailable",
      "rate_limited",
      "idempotency_conflict"
    ]
  },
  "core.auth.product_link_challenges.create": {
    "operationId": "core.auth.product_link_challenges.create",
    "method": "POST",
    "path": "/v1/auth/product-link-challenges",
    "successStatuses": [
      201
    ],
    "requestSchemaRef": "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeCreateRequest",
    "responseSchemaRef": "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeCreateResponse",
    "responseBodyMode": "schema",
    "authRequired": false,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "product_not_allowed",
      "scope_not_allowed",
      "rate_limited",
      "idempotency_conflict"
    ]
  },
  "core.auth.product_link_challenges.complete": {
    "operationId": "core.auth.product_link_challenges.complete",
    "method": "POST",
    "path": "/v1/auth/product-link-challenges/{challenge_ref}/complete",
    "successStatuses": [
      200
    ],
    "requestSchemaRef": "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeCompleteRequest",
    "responseSchemaRef": "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeCompleteResponse",
    "responseBodyMode": "schema",
    "authRequired": true,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "authentication_failed",
      "challenge_invalid",
      "challenge_expired",
      "challenge_already_consumed",
      "account_restricted",
      "consent_required",
      "workspace_access_denied",
      "idempotency_conflict"
    ]
  },
  "core.auth.product_link_challenges.exchange": {
    "operationId": "core.auth.product_link_challenges.exchange",
    "method": "POST",
    "path": "/v1/auth/product-link-challenges/{challenge_ref}/exchange",
    "successStatuses": [
      200
    ],
    "requestSchemaRef": "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeExchangeRequest",
    "responseSchemaRef": "contracts/apis/core-api/product-link.yaml#ProductLinkChallengeExchangeResponse",
    "responseBodyMode": "schema",
    "authRequired": false,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "authorization_pending",
      "access_denied",
      "challenge_invalid",
      "challenge_expired",
      "challenge_already_consumed",
      "proof_verifier_mismatch",
      "correlation_mismatch",
      "slow_down",
      "rate_limited",
      "idempotency_conflict"
    ]
  },
  "core.auth.recovery_requests.create": {
    "operationId": "core.auth.recovery_requests.create",
    "method": "POST",
    "path": "/v1/auth/recovery/requests",
    "successStatuses": [
      202
    ],
    "requestSchemaRef": "contracts/apis/core-api/auth-session.yaml#AuthRecoveryRequestCreateRequest",
    "responseSchemaRef": "contracts/apis/core-api/auth-session.yaml#AuthRecoveryRequestCreateResponse",
    "responseBodyMode": "schema",
    "authRequired": false,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "rate_limited",
      "idempotency_conflict"
    ]
  },
  "core.auth.passkey_challenges.create": {
    "operationId": "core.auth.passkey_challenges.create",
    "method": "POST",
    "path": "/v1/auth/passkey/challenges",
    "successStatuses": [
      201
    ],
    "requestSchemaRef": "contracts/apis/core-api/auth-session.yaml#PasskeyChallengeCreateRequest",
    "responseSchemaRef": "contracts/apis/core-api/auth-session.yaml#PasskeyChallengeCreateResponse",
    "responseBodyMode": "schema",
    "authRequired": false,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "rate_limited",
      "idempotency_conflict"
    ]
  },
  "core.auth.passkey_assertions.verify": {
    "operationId": "core.auth.passkey_assertions.verify",
    "method": "POST",
    "path": "/v1/auth/passkey/assertions",
    "successStatuses": [
      201
    ],
    "requestSchemaRef": "contracts/apis/core-api/auth-session.yaml#PasskeyAssertionVerifyRequest",
    "responseSchemaRef": "contracts/apis/core-api/auth-session.yaml#PasskeyAssertionVerifyResponse",
    "responseBodyMode": "schema",
    "authRequired": false,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "authentication_failed",
      "passkey_challenge_expired",
      "account_restricted",
      "rate_limited",
      "idempotency_conflict"
    ]
  },
  "core.auth.oauth_callbacks.accept": {
    "operationId": "core.auth.oauth_callbacks.accept",
    "method": "POST",
    "path": "/v1/auth/oauth/callbacks/{provider}",
    "successStatuses": [
      201
    ],
    "requestSchemaRef": "contracts/apis/core-api/auth-session.yaml#OAuthCallbackAcceptRequest",
    "responseSchemaRef": "contracts/apis/core-api/auth-session.yaml#OAuthCallbackAcceptResponse",
    "responseBodyMode": "schema",
    "authRequired": false,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "authentication_failed",
      "oauth_state_mismatch",
      "provider_unavailable",
      "account_restricted",
      "rate_limited",
      "idempotency_conflict"
    ]
  },
  "core.referral.uses.create": {
    "operationId": "core.referral.uses.create",
    "method": "POST",
    "path": "/v1/referrals/uses",
    "successStatuses": [
      202
    ],
    "requestSchemaRef": "contracts/apis/core-api/referral.yaml#ReferralUseCreateRequest",
    "responseSchemaRef": "contracts/apis/core-api/referral.yaml#ReferralUseCreateResponse",
    "responseBodyMode": "schema",
    "authRequired": true,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "authentication_failed",
      "account_restricted",
      "rate_limited",
      "idempotency_conflict"
    ]
  },
  "money.referral_rewards.status.get": {
    "operationId": "money.referral_rewards.status.get",
    "method": "GET",
    "path": "/v1/referrals/uses/{referral_use_ref}/reward-status",
    "successStatuses": [
      200
    ],
    "requestSchemaRef": "contracts/apis/money-api/referral-reward.yaml#ReferralRewardStatusGetRequest",
    "responseSchemaRef": "contracts/apis/money-api/referral-reward.yaml#ReferralRewardStatusGetResponse",
    "responseBodyMode": "schema",
    "authRequired": true,
    "idempotency": "not_required",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "authentication_failed",
      "account_restricted",
      "not_found"
    ]
  },
  "money.credit_pack_catalog_projections.get": {
    "operationId": "money.credit_pack_catalog_projections.get",
    "method": "GET",
    "path": "/v1/credit-pack-catalog-projections/{product_ref}",
    "successStatuses": [
      200
    ],
    "requestSchemaRef": "contracts/apis/money-api/credit-purchase-read.yaml#CreditPackCatalogProjectionGetRequest",
    "responseSchemaRef": "contracts/apis/money-api/credit-purchase-read.yaml#CreditPackCatalogProjectionGetResponse",
    "responseBodyMode": "schema",
    "authRequired": true,
    "idempotency": "not_required",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "authentication_failed",
      "account_restricted",
      "scope_access_denied",
      "product_not_found",
      "catalog_unavailable",
      "sale_unavailable"
    ]
  },
  "money.credit_checkout_intents.create": {
    "operationId": "money.credit_checkout_intents.create",
    "method": "POST",
    "path": "/v1/credit-checkout-intents",
    "successStatuses": [
      201
    ],
    "requestSchemaRef": "contracts/apis/money-api/credit-purchase.yaml#CreditCheckoutIntentCreateRequest",
    "responseSchemaRef": "contracts/apis/money-api/credit-purchase.yaml#CreditCheckoutIntentCreateResponse",
    "responseBodyMode": "schema",
    "authRequired": true,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "authentication_failed",
      "account_restricted",
      "scope_access_denied",
      "product_not_found",
      "ship_tier_not_found",
      "sale_unavailable",
      "payment_unavailable",
      "risk_hold",
      "return_target_not_registered",
      "idempotency_conflict"
    ]
  },
  "money.credit_checkout_intents.status.get": {
    "operationId": "money.credit_checkout_intents.status.get",
    "method": "GET",
    "path": "/v1/credit-checkout-intents/{checkout_intent_ref}",
    "successStatuses": [
      200
    ],
    "requestSchemaRef": "contracts/apis/money-api/credit-purchase-read.yaml#CreditCheckoutIntentStatusGetRequest",
    "responseSchemaRef": "contracts/apis/money-api/credit-purchase-read.yaml#CreditCheckoutIntentStatusGetResponse",
    "responseBodyMode": "schema",
    "authRequired": true,
    "idempotency": "not_required",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "authentication_failed",
      "account_restricted",
      "scope_access_denied",
      "not_found"
    ]
  },
  "money.credit_checkout_return_receipts.exchange": {
    "operationId": "money.credit_checkout_return_receipts.exchange",
    "method": "POST",
    "path": "/v1/credit-checkout-return-receipts/exchange",
    "successStatuses": [
      200
    ],
    "requestSchemaRef": "contracts/apis/money-api/credit-purchase.yaml#CreditCheckoutReturnReceiptExchangeRequest",
    "responseSchemaRef": "contracts/apis/money-api/credit-purchase.yaml#CreditCheckoutReturnReceiptExchangeResponse",
    "responseBodyMode": "schema",
    "authRequired": true,
    "idempotency": "required_idempotency_key",
    "requestIdRequired": true,
    "traceIdRequired": true,
    "errorCodes": [
      "validation_failed",
      "authentication_failed",
      "account_restricted",
      "scope_access_denied",
      "receipt_invalid",
      "receipt_expired",
      "receipt_already_consumed",
      "product_mismatch",
      "return_target_mismatch",
      "idempotency_conflict"
    ]
  }
} as const satisfies ZdpGeneratedOperationMetadataMap;

export const zdpTypedFetchOperations =
  createZdpGeneratedOperationDefinitions(
    ZDP_TYPED_FETCH_OPERATION_MAP,
    ZDP_API_SCHEMA_MODEL_MAP
  );

export type ZdpApiOperationId = keyof typeof ZDP_TYPED_FETCH_OPERATION_MAP;

export type ZdpApiOperationRequest<
  OperationId extends ZdpApiOperationId = ZdpApiOperationId
> = ZdpGeneratedOperationRequest<
  (typeof ZDP_TYPED_FETCH_OPERATION_MAP)[OperationId],
  typeof ZDP_API_SCHEMA_MODEL_MAP
>;

export type ZdpApiOperationResponse<
  OperationId extends ZdpApiOperationId = ZdpApiOperationId
> = (typeof zdpTypedFetchOperations)[OperationId] extends {
  readonly decodeResponse: (response: unknown) => infer Response;
}
  ? Response
  : unknown;

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

export function getZdpGeneratedSchemaOptionalPayloadFields(
  model: ZdpGeneratedSchemaModel
): readonly string[] {
  return model.optionalFields;
}

export function createZdpApiClient(options: ZdpTypedFetchClientOptions) {
  return createZdpGeneratedTypedFetchClient(
    ZDP_TYPED_FETCH_OPERATION_MAP,
    ZDP_API_SCHEMA_MODEL_MAP,
    options
  );
}
