/**
 * 렌더 프로파일링 MCP API 메서드.
 * __REACT_NATIVE_MCP__에 등록되어 서버 eval로 호출됨.
 */

import type { RenderEntry } from './types';
import {
  renderProfileActive,
  renderProfileStartTime,
  renderEntries,
  setRenderProfileActive,
  setRenderProfileStartTime,
  setRenderComponentFilter,
  setRenderIgnoreFilter,
  resetRenderProfile,
} from './shared';

/** 프로파일링 시작 */
export function startRenderProfile(options?: any): { started: boolean } {
  var opts = typeof options === 'object' && options !== null ? options : {};
  resetRenderProfile();
  setRenderProfileActive(true);
  setRenderProfileStartTime(Date.now());
  if (Array.isArray(opts.components) && opts.components.length > 0) {
    setRenderComponentFilter(opts.components);
  }
  if (Array.isArray(opts.ignore) && opts.ignore.length > 0) {
    setRenderIgnoreFilter(opts.ignore);
  }
  return { started: true };
}

/** 수집된 데이터 집계 리포트 반환 */
export function getRenderReport(): any {
  var now = Date.now();
  var durationMs = renderProfileStartTime > 0 ? now - renderProfileStartTime : 0;
  var durationStr = (durationMs / 1000).toFixed(1) + 's';

  // commitId 집합으로 총 커밋 수 계산
  var commitIds: Record<number, boolean> = {};
  for (var i = 0; i < renderEntries.length; i++) {
    commitIds[renderEntries[i]!.commitId] = true;
  }
  var totalCommits = Object.keys(commitIds).length;

  // 컴포넌트별 집계
  var componentMap: Record<
    string,
    {
      name: string;
      renders: number;
      mounts: number;
      unnecessaryRenders: number;
      triggers: Record<string, number>;
      isMemoized: boolean;
      recentRenders: RenderEntry[];
    }
  > = {};

  for (var j = 0; j < renderEntries.length; j++) {
    var entry = renderEntries[j]!;
    var comp = componentMap[entry.component];
    if (!comp) {
      comp = {
        name: entry.component,
        renders: 0,
        mounts: 0,
        unnecessaryRenders: 0,
        triggers: {},
        isMemoized: entry.isMemoized,
        recentRenders: [],
      };
      componentMap[entry.component] = comp;
    }
    comp.renders++;
    if (entry.type === 'mount') {
      comp.mounts++;
    } else {
      // trigger 카운트
      comp.triggers[entry.trigger] = (comp.triggers[entry.trigger] || 0) + 1;
      // 불필요 리렌더 판정: trigger가 parent (state/props/context 변경 없음)
      if (entry.trigger === 'parent') {
        comp.unnecessaryRenders++;
      }
    }
    // isMemoized는 최신 값 반영
    if (entry.isMemoized) comp.isMemoized = true;
    // recentRenders: 최근 5개 유지
    comp.recentRenders.push(entry);
    if (comp.recentRenders.length > 5) comp.recentRenders.shift();
  }

  // renders 내림차순, 상위 20개
  var components = [];
  for (var key in componentMap) {
    if (componentMap.hasOwnProperty(key)) components.push(componentMap[key]!);
  }
  components.sort(function (a, b) {
    return b.renders - a.renders;
  });
  if (components.length > 20) components = components.slice(0, 20);

  // recentRenders 형식 정리
  var hotComponents = components.map(function (c) {
    return {
      name: c.name,
      renders: c.renders,
      mounts: c.mounts,
      unnecessaryRenders: c.unnecessaryRenders,
      triggers: c.triggers,
      isMemoized: c.isMemoized,
      recentRenders: c.recentRenders.map(function (r) {
        var recent: any = {
          timestamp: r.timestamp,
          trigger: r.trigger,
          commitId: r.commitId,
          parent: r.parent,
        };
        if (r.changes) recent.changes = r.changes;
        return recent;
      }),
    };
  });

  return {
    profiling: renderProfileActive,
    startTime: renderProfileStartTime,
    endTime: now,
    duration: durationStr,
    totalCommits: totalCommits,
    totalRenders: renderEntries.length,
    hotComponents: hotComponents,
  };
}

/** 프로파일링 중지 + 데이터 초기화 */
export function clearRenderProfile(): { cleared: boolean } {
  resetRenderProfile();
  return { cleared: true };
}
