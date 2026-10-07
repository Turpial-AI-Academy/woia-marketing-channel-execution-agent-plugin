# Real Estate publication boundary

Marketing channel execution is public, non-person and non-paid in the Real Estate assembly. Person-directed sends belong to Communications/Customer Service, and paid effects belong to Ads/Ads Platforms. No provider default, caller assertion or shared credential can bypass that split.

The existing `validate-execution-plan.mjs --file` interface remains a structural plan check for generic consumers. Its PASS never authorizes an effect. Real Estate integrations must call `dispatchRealEstatePublication` with host-resolved organization/department, a current accepted Source Authority Map binding, a competent expiring approval bound to the complete payload digest, and a durable idempotency reservation. They must never dispatch directly after a structural PASS. Context must be produced by the qualified host, never copied from an untrusted request. All payload fields participate in the digest; changing target, content or source invalidates approval.

The qualified adapter must atomically consume the exact reservation, preserve immutable original evidence and observed remote IDs, and transition submitted effects to confirmed, rejected or UNKNOWN. UNKNOWN/submitted/duplicate reservations cannot be replayed; reconciliation is mandatory before the host authorizes a fresh attempt. Remote publication observation is evidence, not competent acceptance of local Listing truth. This semantic helper neither supplies a durable store nor qualifies a live adapter.

Provider qualification covers deterministic guards and backward structural compatibility. Operator E2E and Production Ready remain later gates. Real Estate canonical relation schemas stay in `woia-re-domain-contracts`; this provider does not duplicate them or become a domain writer.
