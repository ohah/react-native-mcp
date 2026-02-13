/**
 * Metro transformer에서 로드할 진입점
 * transformSource, injectTestIds만 export (번들 크기 최소화용)
 */

export { transformSource } from './metro/transform-source.ts';
export { injectTestIds } from './babel/inject-testid.ts';
