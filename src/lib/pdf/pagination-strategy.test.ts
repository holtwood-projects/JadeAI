
import {
  getUsableHeight,
  getMaxMarginDelta,
  resolvePaginationTargetPlan,
  resolvePaginationStrategyConfig,
  type PaginationContext,
} from './pagination-strategy';
import { test, expect } from 'vitest';

function createContext(
  overrides: Partial<PaginationContext['profile']> = {},
): PaginationContext {
  return {
    profile: {
      pageMode: 'standard',
      surfaceMode: 'light',
      columnMode: 'single',
      blankPagePrevention: 'light-shrink',
      fitOnePageMinScale: 55,
      blankPageMinScale: 85,
      breakRuleMode: 'allow-override',
      outerCloneMode: 'none',
      shrinkTarget: 'outer-padding',
      ...overrides,
    },
    needsPadding: true,
    sectionSpacing: 16,
    lineSpacing: 1.5,
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 20,
    marginRight: 20,
    childPaddingTop: 20,
    fragmentPaddingFloor: 8,
  };
}

test('resolvePaginationStrategyConfig returns fit-one-page settings', () => {
  const config = resolvePaginationStrategyConfig('fit-one-page', createContext());

  expect(config.styleId).toBe('__fit-one-page');
  expect(config.maxIterations).toBe(20);
  expect(config.scaleStepPct).toBe(5);
  expect(config.allowZoom).toBe(true);
  // A failed fit must restore the original layout instead of keeping the
  // over-shrunk styles in the generated PDF.
  expect(config.cleanupOnFailure).toBe(true);
});

test('resolvePaginationStrategyConfig returns aggressive blank-page settings', () => {
  const config = resolvePaginationStrategyConfig(
    'prevent-blank-page',
    createContext({ blankPagePrevention: 'aggressive-fit' }),
  );

  expect(config.styleId).toBe('__prevent-blank');
  expect(config.maxIterations).toBe(20);
  expect(config.scaleStepPct).toBe(1);
  expect(config.overflowGuard).toBe(1.2);
  expect(config.cleanupOnFailure).toBe(true);
});

test('resolvePaginationStrategyConfig disables blank-page mode when prevention is off', () => {
  const config = resolvePaginationStrategyConfig(
    'prevent-blank-page',
    createContext({ blankPagePrevention: 'none' }),
  );

  expect(config.disabledReason).toBe('disabled');
  expect(config.maxIterations).toBe(0);
});

test('getUsableHeight models physical PDF page margins', () => {
  expect(getUsableHeight(createContext({ pageMode: 'standard' }))).toBe(1083);
  expect(getUsableHeight({
      ...createContext({ pageMode: 'standard' }),
      needsPadding: false,
    })).toBe(1083);
  expect(getUsableHeight({
      ...createContext({ pageMode: 'edge-to-edge' }),
      needsPadding: false,
      marginTop: 0,
      marginBottom: 0,
    })).toBe(1123);
});

test('getUsableHeight reserves background template physical safe margins', () => {
  expect(getUsableHeight({
      ...createContext({ pageMode: 'edge-to-edge', surfaceMode: 'background' }),
      needsPadding: false,
      marginTop: 38,
      marginBottom: 38,
    })).toBe(1047);
});

test('getMaxMarginDelta preserves edge-to-edge fragment padding floor', () => {
  expect(getMaxMarginDelta({
      ...createContext({ shrinkTarget: 'child-padding' }),
      childPaddingTop: 19,
      fragmentPaddingFloor: 19,
    })).toBe(0);
  expect(getMaxMarginDelta({
      ...createContext({ shrinkTarget: 'child-padding' }),
      childPaddingTop: 32,
      fragmentPaddingFloor: 19,
    })).toBe(13);
});

test('resolvePaginationTargetPlan packs a small multi-page trailing fragment', () => {
  const context = createContext();
  const config = resolvePaginationStrategyConfig('prevent-blank-page', context);
  const plan = resolvePaginationTargetPlan('prevent-blank-page', 2080, 1000, context, config);

  expect(plan.estimatedPageCount).toBe(3);
  expect(plan.targetPageCount).toBe(2);
  expect(plan.trailingFragmentHeight).toBe(80);
  expect(plan.trailingFragmentRatio).toBe(0.08);
  expect(plan.targetHeight).toBe(1952);
  expect(plan.skipReason).toBe(null);
});

test('resolvePaginationTargetPlan skips large trailing fragments as normal content', () => {
  const context = createContext();
  const config = resolvePaginationStrategyConfig('prevent-blank-page', context);
  const plan = resolvePaginationTargetPlan('prevent-blank-page', 2500, 1000, context, config);

  expect(plan.estimatedPageCount).toBe(3);
  expect(plan.targetPageCount).toBe(2);
  expect(plan.trailingFragmentHeight).toBe(500);
  expect(plan.skipReason).toBe('no-blank-risk');
});

test('resolvePaginationTargetPlan lets aggressive profiles pack larger absolute fragments', () => {
  const lightContext = createContext();
  const lightConfig = resolvePaginationStrategyConfig('prevent-blank-page', lightContext);
  const lightPlan = resolvePaginationTargetPlan(
    'prevent-blank-page',
    2210,
    1000,
    lightContext,
    lightConfig,
  );

  const aggressiveContext = createContext({ blankPagePrevention: 'aggressive-fit' });
  const aggressiveConfig = resolvePaginationStrategyConfig(
    'prevent-blank-page',
    aggressiveContext,
  );
  const aggressivePlan = resolvePaginationTargetPlan(
    'prevent-blank-page',
    2210,
    1000,
    aggressiveContext,
    aggressiveConfig,
  );

  expect(lightPlan.skipReason).toBe('no-blank-risk');
  expect(aggressivePlan.skipReason).toBe(null);
});
