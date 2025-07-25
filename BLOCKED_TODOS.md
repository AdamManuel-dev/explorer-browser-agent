# Blocked TODOs

## Overview
This document tracks TODO items that are currently blocked by dependencies, technical limitations, or external factors. Each item includes the blocker details and proposed resolution paths.

---

## 🔴 P0 - Critical Items (Currently Blocked)

### 1. Workflow System Integration
**Status**: BLOCKED
**Original TODOs**:
- Refactor ExplorationWorkflow to use Mastra's workflow system
- Implement proper workflow step definitions with AI agents
- Add workflow context management and state persistence
- Enable workflow error handling and recovery
- Connect workflows to Mastra agent tools

**Blockers**:
1. **Mastra Workflow API Documentation**: Incomplete documentation for workflow system integration
2. **State Persistence Strategy**: Need decision on storage backend (Redis, PostgreSQL, etc.)
3. **Agent Communication Protocol**: Undefined message passing between workflow steps

**Dependencies**:
- Mastra team to provide workflow integration examples
- Infrastructure decision on state storage
- Architecture review for agent communication patterns

**Proposed Resolution**:
1. Contact Mastra support for workflow documentation
2. Schedule architecture review meeting for state persistence
3. Create POC with simple workflow to validate approach

**Estimated Unblock Date**: 2025-08-01

---

## 🟡 P1 - High Priority Items (Partially Blocked)

### 2. AI-Powered Element Detection
**Status**: PARTIALLY BLOCKED
**Original TODOs**:
- Replace selector-based detection with Stagehand observe API
- Implement natural language element queries
- Add context-aware element identification
- Enable self-adapting element detection for UI changes
- Remove hardcoded CSS selectors from AIElementDetector

**Blockers**:
1. **Performance Concerns**: AI element detection adds 150-200ms latency per operation
2. **Rate Limiting**: Stagehand API has undocumented rate limits
3. **Complex UI Handling**: Shadow DOM and dynamic content pose challenges

**Dependencies**:
- Performance optimization strategy approval
- Stagehand API rate limit clarification
- Research on Shadow DOM traversal with AI

**Proposed Resolution**:
1. Implement intelligent caching layer for repeated elements
2. Batch element detection requests where possible
3. Create hybrid approach using AI + fallback selectors

**Estimated Unblock Date**: 2025-07-30

---

### 3. Self-Healing Test Features
**Status**: BLOCKED
**Original TODOs**:
- Implement AI-powered test repair when selectors break
- Add automatic test optimization using AI analysis
- Enable dynamic assertion adjustment
- Build test resilience through AI adaptation
- Create feedback loop for test improvements

**Blockers**:
1. **Test History Storage**: No system for storing test execution history
2. **AI Training Data**: Insufficient data for training self-healing models
3. **Change Detection**: Unable to differentiate intentional vs. breaking changes

**Dependencies**:
- Test execution database schema design
- Minimum 1000 test runs for training data
- Product decision on change detection strategy

**Proposed Resolution**:
1. Design and implement test history storage system
2. Start collecting test execution data immediately
3. Partner with QA team for change classification rules

**Estimated Unblock Date**: 2025-08-15

---

## 🟢 P2 - Medium Priority Items (Future Blocked)

### 4. Predictive Test Failure Analysis
**Status**: BLOCKED - INSUFFICIENT DATA
**Original TODO**: Enable predictive test failure analysis

**Blockers**:
1. **Historical Data**: Need 3+ months of test execution data
2. **ML Pipeline**: No infrastructure for ML model training/deployment
3. **Feature Engineering**: Undefined features for prediction model

**Dependencies**:
- Test history system (blocked by item #3)
- ML infrastructure setup
- Data science team consultation

**Proposed Resolution**:
1. Focus on data collection infrastructure first
2. Define MVP prediction features
3. Plan ML infrastructure for Q4 2025

**Estimated Unblock Date**: 2025-10-01

---

### 5. Learning from Previous Crawls
**Status**: BLOCKED - ARCHITECTURE DECISION
**Original TODO**: Implement learning from previous crawls

**Blockers**:
1. **Crawl Data Storage**: No persistent storage for crawl results
2. **Learning Algorithm**: Undefined approach for crawl optimization
3. **Memory Management**: Potential for unbounded data growth

**Dependencies**:
- Storage architecture decision
- Algorithm research and selection
- Data retention policy

**Proposed Resolution**:
1. Implement crawl result storage with TTL
2. Research graph-based learning algorithms
3. Define data retention and cleanup policies

**Estimated Unblock Date**: 2025-08-20

---

## Technical Blockers Summary

### Infrastructure Blockers
1. **State Storage**: No decision on persistence layer
2. **ML Pipeline**: Missing ML infrastructure
3. **Data Storage**: No test/crawl history database

### External Dependencies
1. **Mastra Documentation**: Incomplete workflow docs
2. **Stagehand Limits**: Undocumented API constraints
3. **Training Data**: Insufficient historical data

### Architecture Decisions Needed
1. **Communication Patterns**: Agent message passing
2. **Storage Strategy**: Persistence layer selection
3. **Caching Strategy**: AI response caching approach

---

## Unblocking Strategy

### Immediate Actions (This Week)
1. Contact Mastra support for documentation
2. Set up test execution data collection
3. Create storage architecture proposal

### Short-term (Next 2 Weeks)
1. Implement basic state storage system
2. Start collecting crawl history data
3. Define caching strategy for AI calls

### Long-term (Next Month)
1. Design ML infrastructure
2. Accumulate training data
3. Resolve all architecture decisions

---

## Risk Mitigation

### High-Risk Blockers
1. **Mastra Workflow Integration**: May need to build custom workflow system
2. **Performance Issues**: Could limit AI adoption if not resolved
3. **Data Requirements**: May need synthetic data generation

### Mitigation Strategies
1. Build abstraction layer for workflow system
2. Implement aggressive caching and batching
3. Create synthetic test data generator

---

*Last Updated: 2025-07-25*