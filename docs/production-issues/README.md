# Production Readiness Issues - Master Index

This directory contains detailed documentation for critical production
readiness issues identified in the AnkiToon codebase analysis.

**Overall Assessment:** The codebase demonstrates senior+ level
engineering with excellent architecture and patterns, but has several
critical issues that must be addressed before production deployment.

---

## Critical Issues 🔴

These must be fixed before production launch. They pose immediate risks
to reliability, security, or cost.

### 1. [Redis Connection Management](./01-redis-connection-management.md) ✅

**Status:** RESOLVED (2026-01-11)
**Risk:** Production outages, cascading failures
**Effort:** ~1 hour (actual)
**Impact:** HIGH

**Problem:** Busy-wait loop with no timeout could hang requests
indefinitely and burn entire serverless function timeout.

**Quick Summary:**
- Busy-wait loop replaced with promise-based locking
- 10-second connection timeout with `Promise.race()`
- 3 retries with exponential backoff

**Action Items:**
- [x] Replace busy-wait with Promise-based locking
- [x] Add 10-second connection timeout
- [x] Implement retry logic with exponential backoff
- [x] Add connection health check endpoint (`/api/health`)

---

### 2. [CSRF Protection](./02-csrf-protection.md) ✅

**Status:** RESOLVED (2026-01-11)
**Risk:** Cross-site request forgery attacks
**Effort:** ~3 hours (actual)
**Impact:** HIGH

**Problem:** No CSRF token validation allows attackers to trick
authenticated users into making unwanted requests.

**Quick Summary:**
- Any website can make requests as logged-in users
- Could trigger expensive API calls
- Could sabotage user study progress

**Action Items:**
- [x] Install `@edge-csrf/nextjs` package
- [x] Create CSRF protection in `src/proxy.ts`
- [x] Update all API calls to include CSRF tokens
- [x] Verify build and type checking passes

---

### 3. [Rate Limiting](./03-rate-limiting.md)

**Risk:** API abuse, unlimited cost exposure
**Effort:** ~3 hours
**Impact:** CRITICAL (Financial) - **Mitigated for current deployment**

**Problem:** No application-level rate limiting for expensive OCR and
Gemini APIs. Relies on external provider limits.

**Current Mitigation:**
- Free tier APIs have built-in provider rate limits
- Admin-only access restricts attack surface
- Small number of admin users (<5) with manual oversight

**Why This Still Matters:**
- Provider limits can change without notice
- No budget control or cost caps
- Admin credential compromise = no defense
- Required for production best practices

**Quick Summary:**
- Image processing costs $0.10 per request
- Currently acceptable for beta/internal deployment
- Must implement before public production launch

**Action Items:**
- [ ] Install `@upstash/ratelimit` package
- [ ] Create rate limiter service
- [ ] Add middleware to enforce limits
- [ ] Set per-endpoint limits (10/hour for expensive operations)

---

### 4. [Test Coverage](./04-test-coverage.md)

**Risk:** Low confidence in changes, regression risk
**Effort:** ~85 hours (4 weeks part-time)
**Impact:** HIGH

**Problem:** Only pipeline module has tests. Critical study session
logic has 0% coverage.

**Quick Summary:**
- 491-line `sessionService.ts` completely untested
- FSRS card updates untested
- Redis failure scenarios untested
- Current coverage: ~15%, Target: 70%

**Action Items:**
- [ ] Test `sessionService.ts` (10 hours)
- [ ] Test `batchCardUpdates.ts` (10 hours)
- [ ] Test `sessionCache.ts` (4 hours)
- [ ] Test API routes (14 hours)
- [ ] Add integration tests (8 hours)
- [ ] Add E2E tests (8 hours)

---

## High Priority Issues 🟠

Should be addressed soon, but app can launch without them with monitoring.

### 5. [File Upload Security](./05-file-upload-security.md) ✅

**Status:** RESOLVED (2026-01-11)
**Risk:** Malware uploads, storage abuse
**Effort:** ~1.5 hours (actual)
**Impact:** MEDIUM-HIGH

**Problem:** Avatar uploads trust client-provided MIME types and don't
validate actual file content.

**Quick Summary:**
- No magic byte verification
- Predictable filenames (privacy risk)
- SVG files could contain XSS

**Action Items:**
- [x] Install `file-type` and `sharp` packages
- [x] Validate magic bytes
- [x] Re-encode images to strip metadata
- [x] Use random UUIDs for filenames
- [ ] Add per-user upload quotas (deferred to rate limiting)

---

### 6. [N+1 Query Pattern](./06-n-plus-one-queries.md)

**Risk:** Performance degradation, slow page loads
**Effort:** ~2 hours
**Impact:** MEDIUM

**Problem:** Series vocabulary stats makes 300+ queries for 100 series
instead of 2 queries.

**Quick Summary:**
- 15-second response time with 100 series
- Could timeout with larger catalog
- Simple fix: batch queries with IN clause

**Action Items:**
- [ ] Create `getChaptersBatch()` query
- [ ] Create `getVocabularyCountsBatch()` RPC
- [ ] Update service to use batch queries
- [ ] Add performance tests
- [ ] Add database indexes

---

### 7. [Environment Variable Validation](./07-environment-variable-validation.md)

**Risk:** Runtime crashes, unclear errors
**Effort:** ~1.5 hours
**Impact:** MEDIUM

**Problem:** App uses `process.env.*!` without validating variables exist
at startup.

**Quick Summary:**
- Crashes occur when feature used, not at startup
- Cryptic error messages
- Poor developer experience

**Action Items:**
- [ ] Create `src/lib/config/env.ts` validation module
- [ ] Validate on app startup in `layout.tsx`
- [ ] Update all files to use config instead of `process.env`
- [ ] Update `.env.example` with descriptions

---

## Implementation Roadmap

### Week 1: Critical Security & Reliability (16 hours)

**Goal:** Eliminate critical production risks

- **Monday:** Redis connection management (2h)
- **Tuesday:** CSRF protection (4h)
- **Wednesday:** Rate limiting (3h)
- **Thursday:** Environment validation (1.5h)
- **Friday:** Integration testing + fixes (5.5h)

**Deliverable:** App passes security audit, no critical vulnerabilities

---

### Week 2: Security Hardening (10 hours)

**Goal:** Close remaining security gaps

- **Monday:** File upload security (2h)
- **Tuesday:** Add security headers via middleware (2h)
- **Wednesday:** Verify Redis password config (1h)
- **Thursday:** Add timeout config for external APIs (1h)
- **Friday:** Security testing + documentation (4h)

**Deliverable:** Comprehensive security measures in place

---

### Week 3-4: Test Coverage (40 hours)

**Goal:** Achieve 70% test coverage

- **Week 3:**
  - Study session tests (20h)
  - API route tests (14h)
  - Error handler tests (6h)

- **Week 4:**
  - Service layer tests (12h)
  - Integration tests (8h)
  - E2E tests (8h)
  - Performance benchmarks (7h)
  - CI/CD integration (5h)

**Deliverable:** Comprehensive test suite, CI enforcing coverage

---

### Week 5: Performance & Polish (15 hours)

**Goal:** Optimize and prepare for launch

- **Monday:** Fix N+1 queries (2h)
- **Tuesday:** Add database indexes (2h)
- **Wednesday:** Performance testing (7h)
- **Thursday:** Monitoring setup (2h)
- **Friday:** Documentation updates (2h)

**Deliverable:** Production-ready application

---

## Estimated Total Effort

| Phase | Hours | Developer Days |
|-------|-------|----------------|
| Week 1: Critical Issues | 16 | 2 days |
| Week 2: Security | 10 | 1.5 days |
| Week 3-4: Testing | 40 | 5 days |
| Week 5: Performance | 15 | 2 days |
| **Total** | **81 hours** | **~10 days** |

**Timeline:** 5 weeks working part-time (2 hours/day), or 2 weeks
full-time

---

## Quick Start

### Minimum Viable Production (Week 1 Only)

If you need to launch quickly, address Week 1 issues only:

1. ✅ Redis connection management (COMPLETED 2026-01-11)
2. ✅ CSRF protection (COMPLETED 2026-01-11)
3. ⏳ Rate limiting
4. ⏳ Environment validation

**Plus:**
- Set up monitoring and alerting
- Enable error tracking (Sentry)
- Have rollback plan ready

**Risk:** Acceptable for beta launch with close monitoring

---

## Verification Checklist

Before deploying to production, verify:

### Security ✅
- [x] CSRF protection enabled and tested
- [ ] Rate limiting on all expensive endpoints
- [x] File uploads validate magic bytes
- [ ] Security headers configured
- [ ] No secrets in code or logs
- [ ] Environment variables validated

### Reliability ✅
- [x] Redis connection has timeout and retry
- [ ] External API calls have timeouts
- [ ] Database queries have error handling
- [ ] Test coverage > 70% for critical paths
- [ ] Load testing completed (100 concurrent users)

### Monitoring ✅
- [ ] Error tracking configured (Sentry/similar)
- [ ] Logging to centralized service
- [ ] Metrics dashboard set up
- [ ] Alerts configured for critical errors
- [ ] Cost monitoring for external APIs

### Documentation ✅
- [ ] `.env.example` complete and accurate
- [ ] API documentation up to date
- [ ] Runbook for common issues
- [ ] Deployment guide written
- [ ] Rollback procedure documented

---

## Post-Launch Monitoring

### Week 1 After Launch

Monitor these metrics daily:

1. **API Costs**
   - OCR usage and cost
   - Gemini usage and cost
   - Alert if > $50/day

2. **Error Rates**
   - Redis connection failures
   - CSRF validation failures
   - Rate limit hits
   - File upload errors

3. **Performance**
   - API response times (p95, p99)
   - Database query latency
   - Page load times

4. **Usage Patterns**
   - Study sessions per day
   - Image processing requests
   - Active users

### Red Flags to Watch

🚨 **Immediate Action Required:**
- Error rate > 5%
- API costs > $100/day (unexpected)
- Redis connection failures
- Database connection pool exhausted

⚠️ **Investigate Within 24 Hours:**
- Response time p95 > 2 seconds
- Rate limit hits from legitimate users
- File upload rejection rate > 10%

---

## Getting Help

### Internal Resources

- **Architecture Docs:** `/docs/implementation-patterns.md`
- **API Reference:** `/docs/api-documentation.md`
- **Logging Guide:** `/docs/logging-guidelines.md`

### External Resources

- **Next.js Security:** https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#security
- **Supabase RLS:** https://supabase.com/docs/guides/auth/row-level-security
- **OWASP Top 10:** https://owasp.org/www-project-top-ten/

---

## Document Maintenance

These documents should be updated when:

1. **Issue is fixed:** Mark as ✅ resolved with PR link
2. **New issue discovered:** Create new document following template
3. **Severity changes:** Update priority and roadmap
4. **Solution improves:** Update implementation section

**Last Updated:** 2026-01-11
**Next Review:** After Week 1 implementation

**Recent Changes:**
- 2026-01-11: ✅ File Upload Security completed (magic bytes, re-encoding, secure filenames)
- 2026-01-11: ✅ Redis Connection Management completed (promise-based locking, timeout, retry)
- 2026-01-11: ✅ CSRF Protection completed and verified
