# JWT Implementation Guide

Reference guide for JWT-based authentication in a multiservice e-commerce platform. Covers token design, login state management, PostgreSQL-backed security infrastructure, cookie strategy, and customer tracking.

## 1. Introduction and Scope

Two concerns that must be kept separate:

- **JWT Session Token (access token):** Stateless, short-lived, validated by signature + `exp` only — no DB lookup per request.
- **Login State Management (refresh token):** Stateful, DB-backed, revocable by deleting a row.

**What the `dca-ecommerce-sample-java` has today:**
- `JwtTokenService` — signs/verifies tokens using **HS256** (symmetric)
- `JwtIdentitySession` — manages a visitor cookie (`shop-identity`) and access cookie; `Secure=false` hardcoded
- `JwtAuthenticationFilter` — validates the access token per request
- No refresh token, no brute-force protection, no attempt tracking, no cookie path-scoping

**What changes in a multiservice platform vs a monolith:**
With HS256, every verifying service must share the signing secret. One leaked service secret compromises all services. The solution is asymmetric signing (ES256/RS256) — only the auth service holds the private key; all other services verify using the public key.

---

## 2. Core Concepts: Two Separate Concerns

### 2.1 The Session Token (Access Token)

- Stateless — services validate by signature + `exp`, no DB lookup
- Short-lived (15 min) — limits blast radius if stolen; invisible to user with silent refresh
- Asymmetrically signed — services verify with public key, cannot mint new tokens
- Contains: `sub` (userId), `email`, `roles`, `jti` (UUID, unique per token), `aud`, `exp`

### 2.2 The Login Gate (Refresh Token + Login State)

- Stateful — every use requires a DB row lookup
- Opaque random bytes (256-bit) — claims live in the DB row, not the token
- Revocable by deleting or marking the row revoked
- Scoped by cookie path so it is never sent to product/cart/checkout services

### 2.3 Why They Must Never Be Merged

| Approach | Risk |
|----------|------|
| Long-lived JWT (7+ days) | No revocation without a denylist — cancels the stateless benefit |
| HS256 with shared secret | One compromised service exposes all services |
| Short access token + DB-backed refresh | Revocation cost is always O(1) regardless of service count |

---

## 3. Token Types and Their Roles

| Token | Type | Signed | Stored | Lifetime | Revocable | Purpose |
|-------|------|--------|--------|----------|-----------|---------|
| Visitor token | JWT (anonymous) | ES256 | Cookie only | 30 days | No | Cart persistence for anonymous shoppers |
| Access token | JWT (registered) | ES256 | Cookie only | 15 min | No | Authenticate requests to all services |
| Refresh token | Opaque random | N/A | PostgreSQL | 30 days sliding | Yes (delete row) | Issue new access tokens; tracks login sessions |

### Visitor Token (`shop-identity`)

Purpose: persists an anonymous `UserId` so the shopping cart survives browser restarts without requiring an account. Preserved through login and through session expiry; rotated on explicit logout (see Section 13).

Contains: `sub` (random UUID), `iat`, `exp`. No PII.

### Access Token (`shop-session`)

Purpose: proves identity to every service on every request. Validated locally by each service using the JWKS public key — no auth service round-trip.

Contains: `sub`, `email`, `given_name`, `family_name`, `cid`, `roles`, `jti`, `aud`, `iat`, `exp` — see Section 6 for full claims reference.

### Refresh Token (`shop-refresh`)

Purpose: issues new access tokens after the 15-minute window expires; tracks active login sessions per device.

Raw value: 256-bit `SecureRandom` bytes, Base64-encoded. Stored in PostgreSQL as SHA-256 hash only. The raw value lives only in memory and in the `HttpOnly` cookie.

### Authentication Levels

Real ecommerce platforms commonly operate with three authentication levels rather than a simple binary anonymous/authenticated split:

| Level | Token present | `loginTyp` claim | User identifier claim | Description |
|-------|--------------|------------------|-----------------------|-------------|
| Anonymous | Visitor token only | — | `sub` (visitor UUID) | No account; cart persists via visitor cookie |
| Soft login | Access token with `loginTyp: "SOFT"` | `"SOFT"` | `softLoginId` | Remembered device; no password re-entry; limited capabilities |
| Full login | Access token with `loginTyp: "FULL"` | `"FULL"` | `sub` (user UUID) | Password verified this session; full capabilities |

**Key structural differences between soft and full login tokens:**
- Soft login token: **no `sub` claim**; the effective user identifier is carried in `softLoginId`
- Full login token: has `sub` claim; `softLoginId` is absent

Services that require full authentication (e.g. order placement, payment) MUST reject tokens where `loginTyp == "SOFT"`. Services that accept soft login MUST read the user identity from `softLoginId` when `loginTyp == "SOFT"` and from `sub` when `loginTyp == "FULL"`.

**Capability matrix:**

| Capability | Anonymous | Soft Login | Full Login |
|------------|:---------:|:----------:|:----------:|
| Browse catalogue | Yes | Yes | Yes |
| Add to cart | Yes | Yes | Yes |
| View saved addresses | No | Yes | Yes |
| Initiate checkout | No | Yes (limited) | Yes |
| Place order / pay | No | No | Yes |
| Manage account settings | No | No | Yes |
| Access order history | No | Read-only | Full |

---

## 4. Token Lifetime Strategy

| Token | Lifetime | Rationale |
|-------|----------|-----------|
| Visitor JWT | 30 days | Cart business requirement; no sensitive data |
| Access JWT | 15 min | Limits blast radius; invisible with silent refresh |
| Refresh token | 30 days (sliding) | Natural re-engagement cycle |
| Absolute refresh limit | 90 days | Hard cut-off regardless of rotation frequency |

**Why the current 7-day access token lifetime is insufficient:**
- A leaked token grants a 7-day attack window with no recourse
- With HS256, a compromised signing secret invalidates all services simultaneously
- Switching to a 15-minute access token + refresh rotation costs nothing for the user and dramatically reduces risk

---

## 5. Asymmetric Signing (ES256) for Multiservice

### The HS256 Problem

With a shared symmetric key, any service that can verify tokens can also mint them. A compromised service exposes the entire platform.

### ES256 / RS256 Approach

- Auth service holds the **private key** (sign only)
- All other services hold the **public key** (verify only, cannot mint)
- Key material never appears in `application.yml` — loaded from vault or secret manager at startup

**Prefer ES256 over RS256:** smaller tokens (64 bytes vs 256 bytes for the signature), same security level, faster operations.

### JWKS Endpoint

Publish public keys at `GET /.well-known/jwks.json`:

```json
{
  "keys": [
    {
      "kty": "EC",
      "crv": "P-256",
      "kid": "2024-01",
      "use": "sig",
      "alg": "ES256",
      "x": "...",
      "y": "..."
    }
  ]
}
```

Services fetch and cache the JWKS on startup; refresh on cache miss for unknown `kid`.

### Consumer-Side JWKS Caching

Verifying services should resolve the public key for a token's `kid` against a local in-memory cache rather than fetching the JWKS per request:

```
getPublicKey(kid):
    if cache.has(kid): return cache[kid]          // fast path, no lock
    synchronized:
        if cache.has(kid): return cache[kid]      // double-check
        refreshFromJwksEndpoint()                 // one fetch, not N
        if cache.has(kid): return cache[kid]
        throw UnknownKeyId                        // token fails verification
```

- **Cache hit** — return immediately, no lock, no network call. Token verification stays purely local.
- **Cache miss** — a single thread fetches and parses the JWKS document inside a synchronized block with a double-check; concurrent requests for a new `kid` trigger one fetch, not a thundering herd.
- **Still missing after refresh** — the `kid` is unknown to the issuer; that token's verification fails.

The cache is **lazy, accumulative, and has no TTL**: keys are only ever added. A new `kid` is discovered on the first token that carries it; a retired `kid` lingers harmlessly until process restart. This works because possessing a retired *public* key is not a risk — it can verify old tokens (which have expired anyway) but never forge new ones.

### Key Rotation Procedure

The rotation uses explicit modes to eliminate the validation gap during transition:

| Mode | JWKS contains | Services verify against |
|------|--------------|-------------------------|
| `OLD` | Old public key only | Old key only |
| `BOTH` | Old + new public key | Either key (try new first, fall back to old) |
| `NEW` | New public key only | New key only |

**Step-by-step:**
1. Start in `OLD` mode — only the current key is published
2. Generate new key pair; assign a new `kid`
3. Switch to `BOTH` mode — publish both keys in JWKS; start signing new tokens with the new private key
4. Wait for all tokens signed by the old key to expire (maximum = access token lifetime = 15 min)
5. Switch to `NEW` mode — remove the old public key from JWKS; decommission the old private key

The `BOTH` mode eliminates the risk of in-flight tokens (signed by the old key) failing validation during the transition window. The `kid` claim in the JWT header identifies which key to use; services in `BOTH` mode try the matching key by `kid`, then fall back to the other.

---

## 6. JWT Claims Design

### Why OIDC Standard Claim Names Matter

Two standards define JWT claim names:
- **RFC 7519** — The JWT spec itself: `iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, `jti`
- **OpenID Connect Core 1.0** — Profile claims: `given_name`, `family_name`, `email`, `email_verified`, `name`

Using these names instead of ad-hoc equivalents (`userId`, `firstName`, `customerId`) has concrete consequences:

| Benefit | Explanation |
|---------|-------------|
| **Framework auto-mapping** | Spring Security's `JwtAuthenticationConverter` maps `sub`, `given_name`, `email` to `Authentication` attributes automatically; custom names require explicit `claimSetConverter` configuration |
| **Library constants** | Nimbus JOSE+JWT, JJWT, and auth0-java-jwt ship with `JWTClaimNames` / `RegisteredClaimNames` constants — no string literals scattered across services |
| **IdP compatibility** | If you later add Keycloak, Auth0, Cognito, or Google as an identity provider, they all emit the same OIDC claim names — no mapping layer needed in each downstream service |
| **API gateway policies** | Kong, AWS API Gateway, and Nginx JWT modules extract `sub`, `email`, `given_name` without custom configuration |
| **Tooling** | `jwt.io`, security scanners, and log-analysis tools recognise OIDC claims and render them meaningfully |
| **Inter-team consistency** | `given_name` is unambiguous; `firstName` vs `first_name` vs `fname` creates divergence across service teams over time |

### Standard Claim Reference

**RFC 7519 registered claims — always include in access tokens:**

| Claim | Type | Description |
|-------|------|-------------|
| `iss` | String | Issuer — auth service base URL |
| `sub` | String | Subject — stable, immutable user identifier (`UserId`); absent in soft login tokens |
| `aud` | String[] | Audience — which services may accept this token |
| `exp` | NumericDate | Expiration — Unix timestamp |
| `iat` | NumericDate | Issued at — Unix timestamp |
| `jti` | String | JWT ID — UUID, unique per token (enables denylist lookups) |

**OIDC Core profile claims — embed selectively (see below):**

| Claim | Type | Example |
|-------|------|---------|
| `email` | String | `"jane@example.com"` |
| `email_verified` | Boolean | `true` |
| `given_name` | String | `"Jane"` |
| `family_name` | String | `"Doe"` |
| `name` | String | `"Jane Doe"` — only if services need the pre-computed full name |
| `preferred_username` | String | Handle or username if distinct from email |
| `locale` | String | `"en-GB"` |

**Application-specific custom claims — use short, lowercase names:**

| Claim | Type | Description |
|-------|------|-------------|
| `cid` | String | Customer ID — the business-facing identifier used on orders and invoices |
| `roles` | String[] | Coarse-grained roles: `CUSTOMER`, `BACKOFFICE_AGENT` |
| `loginTyp` | String | Authentication level: `"FULL"` (password verified this session) or `"SOFT"` (remembered device, no password re-entry) |
| `softLoginId` | String | Effective user identifier in soft login tokens — present only when `loginTyp == "SOFT"` |
| `tenant` | String | Tenant/country scope (e.g. `"DE"`, `"AT"`, `"CH"`). Required for multi-country platforms. Verifying services MUST reject tokens whose `tenant` value does not match the service's configured scope |

**`cid` vs `sub`:** `sub` is the immutable technical identity (a UUID that never changes, even if the email changes). `cid` is the customer-facing identifier that may appear on order confirmations and support tickets. In the `dca-ecommerce-sample-java`, `UserId` currently serves both roles; a production system may issue them separately.

**`tenant` / multi-country:** In platforms serving multiple countries or storefronts, the `tenant` claim (sometimes called `mandant`) prevents a token issued for one country's shop from being accepted by another country's services. Validation logic: `if (!token.tenant().equals(serviceConfig.tenant())) throw new InvalidTenantException()`.

### What to Embed

**Embed claims that are:** stable (rarely changes), non-sensitive (safe if logged or observed), and read-heavy (most services need it without a DB call).

| Claim | Embed? | Reason |
|-------|--------|--------|
| `sub` (userId) | Always (full login) | Required for all authorization decisions |
| `email` | Yes | Personalization, notification routing, support lookup |
| `given_name` | Yes | "Hello, Jane" — needed by most UI-facing services |
| `family_name` | Yes | Full name display, shipping label generation |
| `cid` (customerId) | Yes | Checkout, order management, account context |
| `roles` | Yes | Coarse-grained gatekeeping without a DB call |
| `email_verified` | Yes, if needed | Gate features (e.g., checkout) on verified email |
| `loginTyp` | Yes | Encoding the authentication level in the token |
| `tenant` | Yes, if multi-country | Required for tenant-scoped validation |
| Shipping address | No | Changes frequently; fetch from Account service on demand |
| Payment methods | No | Sensitive; never embed in a token |
| Loyalty points / balance | No | Changes too frequently; always stale |
| Fine-grained permissions | No | Services own their own authorization logic |

### Reference Access Token Payload

```json
{
  "iss": "https://auth.shop.example.com",
  "sub": "usr_01HXYZ123",
  "aud": ["shop-api"],
  "exp": 1704068100,
  "iat": 1704067200,
  "jti": "tok_01HABC456",
  "email": "jane@example.com",
  "email_verified": true,
  "given_name": "Jane",
  "family_name": "Doe",
  "cid": "cust_01HDEF789",
  "roles": ["CUSTOMER"],
  "loginTyp": "FULL",
  "tenant": "DE"
}
```

Total payload: ~350 bytes. With an ES256 signature (64 bytes) and a compact header, the full encoded token is well under 1 KB and fits comfortably in a cookie.

### Claim Freshness

Claims embedded in the token are valid for its lifetime (15 min). For most profile data this is the accepted tradeoff.

| Event | Staleness Risk | Required Action |
|-------|----------------|-----------------|
| Name change | Low — max 15 min stale | None; next rotation picks up the new value |
| Email change | Medium — affects notifications | Revoke all refresh tokens immediately; next login issues fresh claims |
| Role change (admin granted/revoked) | High — authorization impact | Revoke all refresh tokens; next rotation issues fresh claims |
| Account suspended | Critical | Revoke all refresh tokens; access tokens expire within 15 min (accepted tradeoff for stateless validation) |

Revocation on email/role change: the relevant use case raises a domain event → event listener calls `refreshTokenRepository.revokeAllForUser(userId, reason)`. The access token remains valid for up to 15 minutes — this is the cost of stateless validation. For zero-tolerance scenarios, add the `jti` denylist (see Section 16, Optional Enhancements).

---

### 6.3a What `sub` Identifies: the User or the Session

`sub` can name the **user** or the **session**. The choice decides whether a single device can be
logged out on its own.

| | `sub` = user id | `sub` = session id, user in its own claim |
|---|---|---|
| Identifies | who is acting | which login is acting |
| Revoke one device | not possible — the token says nothing about which session it is | delete that session's row |
| Multiple devices | indistinguishable in the token | independent by construction |
| Token size | one identifier | two |

Prefer the **session id** as `sub` with the user referenced beside it. Independent logins per device
are the normal expectation ("log me out everywhere" *and* "log this laptop out"), and only a session
subject makes the second one expressible. The user reference stays in the token so a resource
service still knows whose request it is without a lookup.

This only pays off with a server-side session or refresh row: without one there is nothing to
revoke, and a session id becomes a subject nobody can act on. Decide `sub` and the refresh store
together — retrofitting a session subject later invalidates every token in flight.

> `jti` is not a substitute. It is unique per *token*, so it changes on every rotation; a session id
> is stable for the life of the login, which is what a "log out this device" action needs to name.

### 6.4 Encrypting a Claim (defense in depth)

A signed JWT is integrity-protected but **not confidential**: anyone holding it can base64-decode
the payload. Where a claim carries an identifier that should not be readable by whoever obtains the
token, encrypt the value at application level and carry the ciphertext as a custom claim:

- **Cipher:** AES-256-GCM with a random 12-byte IV and a 128-bit auth tag
- **AAD:** the key id — this binds the ciphertext to the key that produced it, so tampering with the
  key prefix fails the GCM tag instead of silently decrypting under another key
- **Wire format:** `keyId:base64(IV ‖ ciphertext ‖ tag)`, so the reader learns which key to use
  without a lookup table on the wire
- **Rotation:** keep a key map (id → key); encrypt with the active key, decrypt with whichever key
  the prefix names. This is what makes rotation possible without a flag day
- **Failure mode:** a decryption failure degrades to an *absent value*, never an exception — a token
  encrypted under a retired key must not take down the request

Two **independent** key systems then coexist: the EC key pair signs the token, an AES key encrypts
the claim. Different algorithms, different rotation lifecycles, different secrets — the claim is
protected twice, by the GCM tag inside and the signature outside.

> Encrypt claims sparingly. Every encrypted claim is one a consumer cannot route or filter on
> without holding the key, and it moves a key-distribution problem into every service that needs
> the value.

### 6.5 Staff Tokens Are a Separate Token Type

Internal staff authentication does not belong in the customer token. A separate type keeps the
audiences apart — a customer token can never satisfy a staff endpoint even if roles were forged
into it — and lets the two evolve independently:

| Claim | Type | Purpose |
|-------|------|---------|
| `sub` | string | employee identifier |
| `exp` | date | expiry, typically much shorter than a customer session |
| `grp` | string[] | group memberships for authorization |

The same reasoning applies to admin and machine-to-machine access: prefer a distinct token type
with its own `aud` over adding privileged roles to the customer token.

---

## 7. Cookie Requirements

| Attribute | Access Token (`shop-session`) | Refresh Token (`shop-refresh`) | Visitor Token (`shop-identity`) |
|-----------|------------------------------|-------------------------------|--------------------------------|
| `HttpOnly` | `true` | `true` | `true` |
| `Secure` | `true` (env-driven) | `true` (env-driven) | `true` (env-driven) |
| `SameSite` | `Strict` | `Strict` | `Lax` |
| `Path` | `/` | `/auth/refresh` | `/` |
| `MaxAge` | 900 s | 2 592 000 s (30 days) | 2 592 000 s (30 days) |

**Three-cookie design:**
- `shop-identity` — visitor JWT (existing; survives session expiry, rotated on explicit logout — see §13)
- `shop-session` — access token JWT (replaces current all-in-one cookie)
- `shop-refresh` — opaque refresh token (**path-scoped to `/auth/refresh`**)

Path-scoping `shop-refresh` to `/auth/refresh` means the browser only sends it to the refresh endpoint. The cookie is never visible to product, cart, or checkout services — even if those services share the same origin.

**`Secure` flag must be environment-driven, never hardcoded:**

```java
boolean secure = environment.acceptsProfiles(Profiles.of("prod", "staging"));
ResponseCookie.from("shop-session", token)
    .httpOnly(true)
    .secure(secure)
    .sameSite("Strict")
    .path("/")
    .maxAge(Duration.ofMinutes(15))
    .build();
```

**Status in `dca-ecommerce-sample-java`:**

| | |
|---|---|
| `shop-identity` / `shop-session` split | ✅ done |
| Session expiry keeps the visitor identity | ✅ done |
| Logout rotates the identity, clears the session | ✅ done |
| `Secure` from configuration instead of hardcoded `false` | ✅ done (`app.security.jwt.secure-cookies`) |
| `SameSite` on every cookie the subsystem writes | ✅ done (`Lax`) |
| Path-scoped `shop-refresh` and the renewal flow | ❌ **deferred** — no refresh token exists |

The deferral is deliberate, and it has a price worth naming: without a refresh token there is no
revocation and no theft detection, so **the session cookie's lifetime is the blast radius of a
stolen token**.
A renewal flow needs a persistent token store, rotation with reuse detection, and an endpoint to
scope the cookie to — larger than everything above combined.

---

## 8. CSRF Protection

### Why Cookie Transport Requires CSRF Mitigation

When authentication credentials are stored in cookies, browsers automatically attach them to every request — including cross-origin requests initiated by a malicious page. This enables Cross-Site Request Forgery (CSRF): an attacker tricks an authenticated user's browser into making a state-changing request to your service without the user's intent.

### Primary Defence: `SameSite=Strict`

Section 7 specifies `SameSite=Strict` for both the access token (`shop-session`) and refresh token (`shop-refresh`) cookies. With `Strict`, the browser never sends these cookies on any cross-site request — not on top-level navigations, not on form submissions, not on fetch/XHR calls from third-party origins.

`SameSite=Strict` is sufficient CSRF protection when:
- All state-changing endpoints are protected by the `shop-session` cookie
- The session and refresh cookies consistently use `SameSite=Strict`
- The application does not rely on cross-site navigations that must carry authentication (e.g. OAuth redirect flows where cookies need to be sent on the redirect)

### Supplementary Defence: Double Submit Cookie (for `SameSite=Lax` cookies)

**The visitor cookie (`shop-identity`) uses `SameSite=Lax`.** Lax allows the cookie to be sent on top-level cross-site navigations (e.g. clicking a link from another site). If the visitor cookie is ever used to authorize a state-changing operation, a CSRF token is required.

The Double Submit Cookie pattern provides CSRF protection without server-side token state:

1. Server sets a random CSRF token in a **separate, non-HttpOnly cookie** (so JavaScript can read it)
2. Client-side JavaScript reads this cookie and echoes its value as a custom request header (e.g. `X-CSRF-Token`)
3. Server validates that the header value matches the cookie value

A cross-site attacker cannot read the cookie (same-origin policy on JS), so cannot forge the matching header.

```java
// Setting the CSRF cookie (not HttpOnly — must be readable by JavaScript)
ResponseCookie.from("csrf-token", UUID.randomUUID().toString())
    .sameSite("Lax")
    .secure(secure)
    .path("/")
    .build();

// Validating in the filter
String cookieValue = request.getCookieValue("csrf-token");
String headerValue = request.getHeader("X-CSRF-Token");
if (cookieValue == null || !cookieValue.equals(headerValue)) {
    throw new CsrfException("CSRF token mismatch");
}
```

Spring Security provides `CookieCsrfTokenRepository` for cookie-based CSRF token management, which handles token generation, storage, and validation automatically.

### Server-Rendered Forms: Hidden Field Instead of Header

The same double-submit pattern works without JavaScript. Spring Security renders the token into the model
(`CsrfToken` request attribute); a `@ControllerAdvice` exposes it to every template as `_csrf`, and each writing
form carries `<input type="hidden" name="_csrf" value="…">`. The filter compares the field with the `XSRF-TOKEN`
cookie — ASP.NET Core's `@Html.AntiForgeryToken()` is the same mechanism. With a stateless JWT chain this is the
only CSRF strategy that needs no server-side session:

```java
http.csrf(csrf -> csrf
    .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
    .ignoringRequestMatchers("/api/**"));   // see below — only sound for Bearer-only endpoints
```

### Exempting an API: Only If Cookies Never Authenticate It

A CSRF exemption for `/api/**` is correct only when a browser cannot authenticate a request to it by attaching
cookies. That means the authentication filter must read the token from `Authorization: Bearer` **only** on those
paths and must not issue cookies there — including on `/api/auth/login`, which otherwise becomes a login-CSRF
vector. Browser sessions are established through the CSRF-protected web forms; the API returns the token in the
response body and the client presents it as a header. An API that accepts the session cookie *and* is exempt from
CSRF is the worst of both worlds.

### Recommendation Summary

| Cookie | SameSite | CSRF mitigation needed? |
|--------|----------|-------------------------|
| `shop-session` (access token) | `Strict` | No — `SameSite=Strict` is sufficient |
| `shop-refresh` (refresh token) | `Strict` | No — `SameSite=Strict` is sufficient |
| `shop-identity` (visitor token) | `Lax` | Yes if used for state changes — use Double Submit Cookie |

`SameSite` is defence in depth. A server-rendered shop whose forms change state on a cookie session carries the token
in every form regardless of the `SameSite` value; the table above only tells you which cookie makes the token
mandatory.

---

## 9. PostgreSQL Schema

### 9.1 `login_attempts` Table

```sql
CREATE TABLE login_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255)  NOT NULL,
    ip_address      INET          NOT NULL,
    attempted_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    success         BOOLEAN       NOT NULL,
    failure_reason  VARCHAR(100)            -- 'WRONG_PASSWORD', 'ACCOUNT_SUSPENDED', 'NOT_FOUND'
);

CREATE INDEX idx_login_attempts_email_time
    ON login_attempts (email, attempted_at DESC) WHERE success = FALSE;

CREATE INDEX idx_login_attempts_ip_time
    ON login_attempts (ip_address, attempted_at DESC) WHERE success = FALSE;
```

**Why PostgreSQL over Redis:**
- Audit data must survive restarts and be queryable for forensics
- SQL window queries (`COUNT(*) OVER (PARTITION BY email ORDER BY attempted_at)`) simplify rate-limit calculations
- No sub-millisecond latency required for a login endpoint
- No extra infrastructure to operate

**Row retention:** 90 days. Purge via scheduled job (`DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '90 days'`) or time-based partitioning.

### 9.2 `refresh_tokens` Table

```sql
CREATE TABLE refresh_tokens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash          VARCHAR(64)   NOT NULL UNIQUE,   -- SHA-256 hex of raw token
    user_id             VARCHAR(36)   NOT NULL,
    email               VARCHAR(255)  NOT NULL,
    issued_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ   NOT NULL,          -- sliding; reset on rotation
    last_rotated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    absolute_expires_at TIMESTAMPTZ   NOT NULL,          -- hard limit; never updated
    device_hint         VARCHAR(255),                    -- User-Agent substring
    ip_address          INET,
    revoked             BOOLEAN       NOT NULL DEFAULT FALSE,
    revoked_at          TIMESTAMPTZ,
    revoked_reason      VARCHAR(100)                     -- 'LOGOUT', 'SUSPICIOUS', 'ACCOUNT_SUSPENDED'
);

CREATE UNIQUE INDEX idx_refresh_tokens_hash    ON refresh_tokens (token_hash);
CREATE INDEX        idx_refresh_tokens_user_id ON refresh_tokens (user_id) WHERE revoked = FALSE;
```

**Critical:** Never store the raw token value. Only store `SHA-256(rawToken)` as a hex string. The raw value must exist only in memory during processing and in the `HttpOnly` cookie on the client.

---

## 10. Brute-Force Protection and Login Attempt Tracking

**Current gap:** `AuthenticateAccountUseCase` logs failures to the console but stores nothing; there is no rate limiting.

### Strategy

On every login attempt: insert a row into `login_attempts` (success or failure).

Before checking credentials, count recent failures:

| Condition | Action |
|-----------|--------|
| ≥ 5 failures for this email in 15 min | Soft lock: return 429, skip credential check |
| ≥ 20 failures from this IP in 15 min | IP block: return 429 for all accounts from that IP |
| 3 soft locks for this email in 24 h | Escalate to `AccountStatus.SUSPENDED` (requires manual reactivation) |

Make thresholds configurable:

```yaml
app:
  security:
    login-attempts:
      max-per-email: 5
      max-per-ip: 20
      window-minutes: 15
```

### Application Layer Placement

Consistent with the existing output port pattern:

```
account/application/shared/
└── LoginAttemptRepository.java    -- extends OutputPort; called before + after credential check
```

`AuthenticateAccountUseCase` calls `loginAttemptRepository.record(...)` before returning. The `Account` aggregate does not know about attempt tracking — that concern belongs to the application layer.

### Soft Lock vs Hard Suspension

- **Soft lock:** Temporary, auto-expires, controlled by infrastructure policy. User can retry after the window.
- **AccountSuspended:** Business/admin decision requiring manual reactivation. Raises a domain event that triggers session revocation (see Section 10).
- Escalate to `AccountSuspended` only after repeated lockout events (e.g., 3 soft locks in 24 hours), not on the first lockout (see Section 11 for how suspended status affects the login flow).

---

## 11. Account Status and Login Flow

| AccountStatus | Credentials Checked | Outcome | Tokens Issued | Cookie Action |
|---------------|--------------------|---------|-----------|-----------------------|
| ACTIVE | Yes, valid | Success | Both | Set all three cookies |
| ACTIVE | Yes, invalid | Failure | None | No change |
| SUSPENDED | No | Failure | None | Clear session + refresh |
| CLOSED | No | Failure | None | Clear session + refresh (permanent) |
| Not found | No | Failure (generic) | None | No change |
| Rate limited | No | 429 Too Many Requests | None | No change |

### Generic Error Message Rule

Always return the same generic message for unauthenticated failures:

- Unknown email → "Invalid email or password" (do not confirm whether the email exists)
- Wrong password → "Invalid email or password" (same message; prevents timing-based account enumeration)
- SUSPENDED/CLOSED → Specific message, but **only after** valid credentials are confirmed. The user already knows their account exists; a specific message helps them understand next steps. An attacker who cannot authenticate cannot reach this message path.

### Session Revocation on Status Change

`AccountSuspended` domain event (already modeled in the sample) → event listener calls `refreshTokenRepository.revokeAllForUser(userId, "ACCOUNT_SUSPENDED")`.

Access tokens expire naturally within 15 minutes — this is the accepted tradeoff for stateless design. For immediate revocation, an optional Redis denylist on the `jti` claim can be added (see Section 16, Optional Enhancements).

---

## 12. Refresh Token Rotation Flow

```
1. POST /auth/refresh  →  Browser sends Cookie: shop-refresh=<raw>
2. Compute SHA-256(raw) → token_hash; query refresh_tokens table
3. Not found / revoked / expires_at < NOW() → 401; clear all cookies; force re-login
4. absolute_expires_at < NOW() → 401; clear all cookies; force re-login
5. AccountStatus check → SUSPENDED or CLOSED → 401; revoke row; clear cookies
6. Generate new access token (JWT, 15 min, ES256, includes jti + aud)
7. Generate new refresh token (SecureRandom 256-bit, Base64-encoded)
8. Update DB row:
     token_hash         = SHA-256(newRawToken)
     last_rotated_at    = NOW()
     expires_at         = NOW() + 30 days     (sliding reset)
     -- absolute_expires_at is NOT updated --
9. Set cookies: shop-session (MaxAge=900) + shop-refresh (MaxAge=2592000, Path=/auth/refresh)
10. Return 200 OK  (no body needed; tokens are in cookies)
```

### Theft Detection (Rotation Reuse)

If a replaced (already-rotated) token hash is presented:
1. The old hash is not found (it was overwritten in step 8)
2. Revoke **all** tokens for this `user_id` (set `revoked=true`, `revoked_reason='SUSPICIOUS'`)
3. Log a `SUSPICIOUS_REUSE` security event
4. Return 401; clear all cookies on the client

The user is forced to re-login on all devices. This is the correct tradeoff — if a token was reused, either the legitimate session was stolen, or the legitimate client has a bug. Either way, revoking everything protects the account.

### Silent Refresh for Server-Side Rendered Pages

`JwtAuthenticationFilter` detects an expired access token (valid signature, `exp` in the past) and triggers a server-side call to the refresh logic before passing the request to controllers. The user never sees a redirect or 401 during normal browsing.

### Token Expiry UX Contract

If the access token is expired **and** no valid refresh cookie is present (cookie missing, revoked, or past absolute expiry), the request MUST be treated as anonymous — not as an error. The user sees the experience an anonymous visitor would see, not a 401 error page or an error modal.

Implementation: catch `ExpiredJwtException` in the authentication filter, log at DEBUG level (this is expected behaviour, not a fault), and proceed with a null/anonymous principal. Reserve WARN-level logging and 401 responses for unexpected validation failures such as an invalid signature or a malformed token.

The general principle is **enrichment, not gating**: the authentication filter/interceptor never blocks a request. It either attaches an authenticated principal or attaches nothing — the request always proceeds. Authorization for protected actions is enforced per action in the application layer, not at the token-extraction boundary.

### Clock Skew

For self-issued tokens (tokens your own auth service signs and all other services verify), set clock skew tolerance to **0 seconds**. With a 15-minute access token lifetime, even 60 seconds of skew tolerance extends the effective blast radius of a stolen token. Enforce NTP synchronisation across all services instead of relying on token parser tolerance.

```java
// JJWT example
Jwts.parser()
    .clockSkewSeconds(0)  // strict — no tolerance for self-issued tokens
    .verifyWith(publicKey)
    .build()
    .parseSignedClaims(token);
```

---

## 13. Customer Tracking: Visitor Identity After Logout

### Expiry and logout are different events

The visitor identity answers "whose cart is this", not "is this person authenticated". Those two
questions have different lifetimes, which is why they sit in different cookies (§7):

| Event | User intent | `shop-session` | `shop-identity` |
|-------|-------------|----------------|-----------------|
| Access token expires | none — a timer fired | gone | **kept** |
| Explicit logout | "end my session here" | cleared | **rotated to a new UserId** |

Expiry must never cost the cart: nobody asked for anything, the clock simply ran out. Losing a cart
because a tab sat open over lunch is pure harm with no security benefit.

### On logout: rotate, do not delete

An explicit logout is a request to leave — typically on a shared device, where the next person must
not inherit the cart. Rotating the visitor identity satisfies that **without deleting anything**:

| Case | Outcome |
|------|---------|
| Shared device, next person | fresh `UserId` → empty cart |
| Own device, logs back in | cart returns from the **account**, via cart recovery on login |
| Privacy | nothing from the previous session is reachable from this browser |

The cart of a registered user is keyed on their account, not on the browser. A reference
implementation that recovers and merges the cart on login (e.g. `RecoverCartOnLoginUseCase`) makes
rotation free: what looks like "losing the cart" is only "losing the anonymous path to it".

> **This reverses earlier advice in this guide,** which recommended preserving the visitor identity
> through logout on cart-continuity grounds. That rationale does not survive account-based cart
> recovery: continuity is provided by the account, so preserving the identity buys nothing and keeps
> a shared-device risk.

### Tracking is a separate identifier — not this one

A stable visitor id is tempting for analytics, and that is exactly the trap. Three reasons to keep
the measurement identifier out of `shop-identity`:

1. **Consent.** A cart identifier is *strictly necessary* under ePrivacy/GDPR — no consent needed. An
   analytics identifier is not. Merging them makes the whole cookie consent-dependent, so **a visitor
   who declines analytics loses their cart** — a functional guarantee they are entitled to either way.
2. **Opposite lifecycles.** Analytics wants long, stable identifiers; the cart identity wants to
   rotate on logout for shared devices. One value cannot satisfy both.
3. **After login, analytics does not need it.** Events attach to the account; the anonymous id only
   matters before login, and the usual answer there is identity stitching at login time.

So "rotating on logout is safer but worse for tracking" is true only while one identifier does both
jobs. Separated, rotation costs exactly one thing: linking this browser's *future* anonymous sessions
to its past ones — which is what someone who deliberately logs out is asking you not to do.

```
shop-session   session         short    expiry is harmless
shop-refresh   renewal         long     path-scoped, rotating
shop-identity  cart identity   long     rotates only on explicit logout
[analytics]    measurement     own      consent-governed, owned by the analytics tool
```

### GDPR / Right to Erasure

If a "right to be forgotten" request is received, purge the `UserId` from:
- `refresh_tokens` table (`DELETE WHERE user_id = ?`)
- Shopping Cart bounded context
- Checkout history
- Account bounded context
- `login_attempts` table (`DELETE WHERE email = ?`)
- Any analytics or event store that references the `UserId`

The visitor cookie on the client device cannot be actively deleted, but the UUID it contains will no longer resolve to any stored data.

---

## 14. Architecture Placement (DCA Pattern)

New ports and use cases consistent with existing patterns:

```
account/application/shared/
├── LoginAttemptRepository.java      -- NEW output port; extends OutputPort
└── RefreshTokenRepository.java      -- NEW output port; extends OutputPort

account/application/refreshsession/
├── RefreshSessionInputPort.java     -- extends UseCase<RefreshSessionCommand, RefreshSessionResult>
├── RefreshSessionCommand.java       -- contains raw refresh token + client IP
├── RefreshSessionResult.java        -- contains new access token + new refresh token
└── RefreshSessionUseCase.java       -- implements RefreshSessionInputPort

account/application/revokeallsessions/
├── RevokeAllSessionsInputPort.java  -- extends UseCase<RevokeAllSessionsCommand, Void>
├── RevokeAllSessionsCommand.java    -- userId + reason
└── RevokeAllSessionsUseCase.java    -- implements RevokeAllSessionsInputPort
```

**Files to modify if implementing:**

| File | Change |
|------|--------|
| `JwtTokenService.java` | Switch to ES256; add `jti`, `aud`, `kid` to access token; separate visitor and access token generation |
| `JwtIdentitySession.java` | Three-cookie management; env-driven `Secure` flag; `clearAuthenticatedSession()` method |
| `JwtAuthenticationFilter.java` | Read from `shop-session` cookie; silent refresh on expired token |
| `AuthenticateAccountUseCase.java` | Integrate `LoginAttemptRepository` before and after credential check |

### Shared Auth Module Pattern

Every production implementation this guide was distilled from encapsulates JWT parsing and validation in a **shared internal library** — consuming services never call the JWT library directly. The consuming service:

1. Passes the raw cookie value (plus environment and rotation configuration) to the library
2. Receives a typed result object (e.g. `AccountInfo`) back
3. Accesses the user identity via a single method call (e.g. `.accountId()`)

This pattern provides:
- A single place to update validation logic (key rotation, skew settings, new claim extraction) simultaneously across all services
- Consuming services never import the JWT library directly — no accidental bypass of validation rules
- Token parsing behaviour is consistent and cannot drift between services
- Easier key rotation: update the shared library once, redeploy all consuming services

In DCA terms, a shared auth module belongs in `sharedkernel/` or as a separate internal library published to an internal artifact registry. It should expose only a typed result API — never raw JWT objects or JWT library types.

**Keep the library framework-free.** The shared auth module should carry no DI-container or web-framework dependencies, so both the issuing service and every consuming service can reuse it regardless of their stack. Expose it through a small factory, and route all I/O through a single SPI interface that the consuming service implements with its own HTTP client:

```java
// Factory — the only public entry points
SharedAuth.jwtValidator(jwksEndpointClient);       // → JwtValidator
SharedAuth.claimDecryptor(activeKeyId, keyMap);    // → ClaimDecryptor

// SPI — the caller supplies the HTTP transport
interface JwksEndpointClient {
    String fetchJwksJson();
}
```

Each consuming service wires these into beans and provides its own `JwksEndpointClient` (pointed at the issuer's JWKS endpoint, with sane connect/read timeouts). The library decides *what* to fetch and *how* to validate; the service decides *how* to talk HTTP — the same dependency-inversion move DCA applies to output ports.

### Principal Modeling: Adapter View vs Domain View

Model the authenticated principal as a **sealed type** so anonymous vs. authenticated is exhaustive and type-checked, rather than a nullable user object (the `dca-ecommerce-sample-java` already follows this with its sealed `JwtIdentity`):

```java
sealed interface User permits Guest, Registered {
    record Guest() implements User {}
    record Registered(UserId userId) implements User {}
}
```

Keep the **transport view** separate from the **domain view**:

- **Adapter model** (request-scoped): the validated/decrypted token content — subject plus optional claims. Lives in the adapter layer; produced by the authentication filter.
- **Domain model**: `Guest | Registered`, referenced by the relevant aggregate.

Controllers receive the adapter model (absent → guest) and map it into the domain model in the application layer. Token-shaped types never leak into the domain.

---

## 15. Must-Haves Checklist

```
[ ] Switch from HS256 to ES256 (asymmetric signing)
[ ] Publish JWKS endpoint (GET /.well-known/jwks.json) for public key distribution
[ ] Add kid claim to JWT header; support key rotation
[ ] Split into three token types: visitor JWT, access JWT, opaque refresh token
[ ] Store refresh tokens as SHA-256 hash in PostgreSQL; never store raw value
[ ] Implement refresh token rotation with reuse/theft detection
[ ] Absolute expiry on refresh tokens (90-day hard limit; never updated on rotation)
[ ] Reduce access token lifetime to 15 minutes
[ ] Set Secure=true on all cookies in production (env-driven, not hardcoded false)
[ ] SameSite=Strict for access + refresh cookies; SameSite=Lax for visitor cookie
[ ] Path=/auth/refresh on the refresh token cookie
[ ] login_attempts table with per-email + per-IP rate limiting
[ ] Configurable lockout thresholds via application.yml
[ ] Revoke all refresh tokens on AccountSuspended and AccountClosed domain events
[ ] On logout: clear session + refresh cookies; preserve visitor cookie
[ ] Generic error messages for all unauthenticated failures (no account enumeration)
[ ] jti claim (UUID) in every access token
[ ] aud claim per service or service group in every access token
[ ] Never log raw token values; never return refresh token in response body
[ ] Private key loaded from vault/secret manager, never from application.yml
[ ] clockSkewSeconds = 0 for self-issued token validation
[ ] Expired access token + no valid refresh cookie → treat as anonymous, not 401
```

---

## 16. Optional Enhancements

```
[ ] Multi-level authentication (soft login / full login) with loginTyp claim
[ ] Multi-country / multi-tenant support with tenant claim and per-tenant validation
[ ] Field-level AES encryption of sensitive claims (alternative to full JWE — see below)
[ ] "Manage active sessions" UI (list + revoke individual refresh_tokens rows by device_hint)
[ ] Remember-me vs regular session (different refresh token TTL chosen at login time)
[ ] Email notification on login from new IP address or unrecognised device_hint
[ ] Step-up authentication for high-risk operations (re-prompt password before checkout)
[ ] IP/country anomaly detection (flag logins from unusual geographies)
[ ] CAPTCHA or proof-of-work challenge after N consecutive failures
[ ] JWE (payload encryption) if access token claims contain sensitive data
[ ] Redis jti denylist for immediate access token revocation (before natural expiry)
[ ] Per-user "valid-after" watermark as a lightweight revocation alternative (see below)
[ ] Append-only auth_events audit table (login, logout, refresh, soft-lock, suspend, close)
[ ] Magic link tokens for passwordless login or account recovery flow
[ ] Shared auth library published to internal artifact registry (encapsulates all JWT parsing)
```

### Per-User Valid-After Watermark

A lightweight revocation alternative for topologies that deliberately run **without refresh tokens** (longer-lived access token, e.g. 30 minutes, as the only credential): store one **"valid-after" timestamp per user**, updated on logout, password change, or suspension. On verification, reject any token issued before the watermark:

```
tokenValid = token.iat >= user.tokenValidAfter
```

One indexed timestamp per user buys forced revocation without a token blacklist or denylist infrastructure.

**Trade-offs:**
- Enforcing the watermark requires a per-user lookup at verification time — it re-introduces state exactly where the stateless JWT was supposed to avoid it. Typically only the auth/issuer service enforces it; whether downstream resource services also check the watermark (vs. trusting `exp` alone) is an explicit design decision. Trusting `exp` alone means a logged-out user's unexpired token still passes at resource services — acceptable only if the TTL is short.
- Compared to the refresh-token approach in this guide (Sections 2 and 12): the refresh-token design keeps revocation checks off the per-request path entirely (revocation bites at the next rotation, at most 15 minutes out), at the cost of the refresh infrastructure. The watermark suits simpler topologies that accept a DB hit on verification or a short revocation lag.

### Field-Level AES Encryption

A practical middle ground between an unprotected payload (standard JWS) and full payload encryption (JWE): encrypt only the sensitive claim value before embedding it in the JWT.

```
1. AES-encrypt rawUserId  →  encryptedValue
2. Embed encryptedValue as the claim (e.g. "uniqueUserId": "<AES_ENCRYPTED>")
3. Sign the JWT normally (JWS)
4. Verifier: verify signature → AES-decrypt the claim value
```

The token is human-readable except for the encrypted field. This protects the sensitive identifier from log scrapers and intermediaries that can base64-decode the payload, without the complexity of a full JWE implementation.

**Recommended cipher construction — AES-256-GCM:**

- 12-byte random IV per encryption; 128-bit authentication tag
- Pass the encryption key ID as **AAD** (additional authenticated data) — this binds the ciphertext to its key, so tampering with the key prefix fails the GCM tag
- Wire format: `keyId:base64(IV ‖ ciphertext ‖ tag)`
- Decryption failures should degrade to an **absent value**, never an exception — consistent with the rule that invalid token material means anonymous, not 5xx

**Key versioning for rotation:** prefix the encrypted value with the key ID (as above) so the decryption side can select the correct key from a key map and fall back to older keys for in-flight tokens:

```
V2:<base64(AES_V2_encrypt(rawUserId))>
```

Decommission old key versions only after the maximum token lifetime has elapsed (i.e. after all tokens encrypted with the old key have expired). The same `OLD → BOTH → NEW` rotation pattern from Section 5 applies: accept both key versions during the transition window, then drop the old version.

**Two independent key systems:** the signing key pair (ES256) and the claim-encryption key (AES) must not be conflated — different algorithms, different rotation lifecycles, different secrets. The encrypted claim is protected twice: GCM auth tag inside, ES256 signature outside.

---

## 17. Related Documents

- [`spring-modulith.md`](./spring-modulith.md) — Spring Boot integration patterns
- [`archunit-governance.md`](./archunit-governance.md) — Enforcing architectural rules

> This guide was distilled from analyses of three production JWT implementations. Those analyses
> described third-party systems and are deliberately not part of this repository; what they taught is
> in the sections above.
