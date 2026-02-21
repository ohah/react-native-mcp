import type { Fiber } from './types';
import { getFiberTypeName, collectText } from './fiber-helpers';

// ─── querySelector 셀렉터 파서 & 매칭 엔진 ──────────────────────

/**
 * 셀렉터 문자열을 AST로 파싱한다 (재귀 하강 파서).
 * 지원 문법:
 *   Type#testID[attr="val"]:text("..."):display-name("..."):nth-of-type(N):has-press:has-scroll
 *   A > B (직접 자식), A B (후손), A, B (OR)
 */
export function parseSelector(input: string): any {
  var pos = 0;
  var len = input.length;

  function isIdentChar(ch: string) {
    return /[A-Za-z0-9_.-]/.test(ch);
  }

  function skipSpaces() {
    while (pos < len && (input.charAt(pos) === ' ' || input.charAt(pos) === '\t')) pos++;
  }

  function readIdentifier() {
    var start = pos;
    while (pos < len && isIdentChar(input.charAt(pos))) pos++;
    return input.substring(start, pos);
  }

  function readQuotedString(): string | null {
    var quote = input.charAt(pos);
    if (quote !== '"' && quote !== "'") return '';
    pos++; // skip opening quote
    var start = pos;
    while (pos < len && input.charAt(pos) !== quote) {
      if (input.charAt(pos) === '\\') pos++; // skip escaped char
      pos++;
    }
    if (pos >= len) return null; // 따옴표 미닫힘 → 파싱 실패로 처리
    var str = input.substring(start, pos);
    pos++; // skip closing quote
    return str;
  }

  function readNumber() {
    var start = pos;
    while (pos < len && /[0-9]/.test(input.charAt(pos))) pos++;
    return parseInt(input.substring(start, pos), 10);
  }

  function parseCompound(): any {
    var sel: any = {
      type: null,
      testID: null,
      attrs: [] as Array<{ name: string; value: string }>,
      text: null,
      displayName: null,
      nth: -1,
      hasPress: false,
      hasScroll: false,
    };

    // Optional type selector
    var ch = pos < len ? input.charAt(pos) : '';
    if (/[A-Za-z_]/.test(ch)) {
      sel.type = readIdentifier();
    }

    // Optional #testID
    if (pos < len && input.charAt(pos) === '#') {
      pos++; // skip #
      sel.testID = readIdentifier();
    }

    // Zero or more [attr="val"]
    while (pos < len && input.charAt(pos) === '[') {
      pos++; // skip [
      skipSpaces();
      var attrName = readIdentifier();
      skipSpaces();
      if (pos < len && input.charAt(pos) === '=') {
        pos++; // skip =
        skipSpaces();
        var attrVal = readQuotedString();
        if (attrVal === null) throw new Error('Unclosed quote in selector [attr="..."]');
        sel.attrs.push({ name: attrName, value: attrVal });
      }
      skipSpaces();
      if (pos < len && input.charAt(pos) === ']') pos++; // skip ]
    }

    // Zero or more :pseudo selectors
    while (pos < len && input.charAt(pos) === ':') {
      pos++; // skip :
      var pseudo = readIdentifier();
      if (pseudo === 'text') {
        if (pos < len && input.charAt(pos) === '(') {
          pos++; // skip (
          skipSpaces();
          var textVal = readQuotedString();
          if (textVal === null) throw new Error('Unclosed quote in selector :text(...)');
          sel.text = textVal;
          skipSpaces();
          if (pos < len && input.charAt(pos) === ')') pos++; // skip )
        }
      } else if (pseudo === 'nth-of-type') {
        if (pos < len && input.charAt(pos) === '(') {
          pos++; // skip (
          skipSpaces();
          sel.nth = readNumber() - 1; // 1-based input → 0-based internal
          skipSpaces();
          if (pos < len && input.charAt(pos) === ')') pos++; // skip )
        }
      } else if (pseudo === 'first-of-type') {
        sel.nth = 0; // first matching element (same as :nth-of-type(1))
      } else if (pseudo === 'last-of-type') {
        sel.nth = -2; // -2 = last matching element
      } else if (pseudo === 'display-name') {
        if (pos < len && input.charAt(pos) === '(') {
          pos++; // skip (
          skipSpaces();
          var dn = readQuotedString();
          if (dn === null) throw new Error('Unclosed quote in selector :display-name("...")');
          skipSpaces();
          if (pos < len && input.charAt(pos) === ')') pos++;
          sel.displayName = dn;
        }
      } else if (pseudo === 'has-press') {
        sel.hasPress = true;
      } else if (pseudo === 'has-scroll') {
        sel.hasScroll = true;
      }
    }

    return sel;
  }

  function parseComplex(): any {
    skipSpaces();
    var segments: any[] = [];
    segments.push({ selector: parseCompound(), combinator: null });

    while (pos < len) {
      var beforeSkip = pos;
      skipSpaces();
      if (pos >= len || input.charAt(pos) === ',') break;

      var combinator = ' '; // 기본: 후손 (descendant)
      if (input.charAt(pos) === '>') {
        combinator = '>';
        pos++; // skip >
        skipSpaces();
      } else if (pos === beforeSkip) {
        // 공백 없이 바로 다음 토큰 → compound의 연속이므로 break
        break;
      }

      // 다음 compound가 있는지 확인
      var nextCh = pos < len ? input.charAt(pos) : '';
      if (!/[A-Za-z_#[:]/.test(nextCh)) break;

      segments.push({ selector: parseCompound(), combinator: combinator });
    }

    return { segments: segments };
  }

  var selectors: any[] = [];
  selectors.push(parseComplex());
  while (pos < len) {
    skipSpaces();
    if (pos >= len || input.charAt(pos) !== ',') break;
    pos++; // skip comma
    selectors.push(parseComplex());
  }

  return { selectors: selectors };
}

/** compound 셀렉터가 단일 fiber 노드에 매칭되는지 검사 */
export function matchesCompound(
  fiber: Fiber | null,
  compound: any,
  TextComp: any,
  _ImgComp: any
): boolean {
  if (!fiber) return false;
  var props = fiber.memoizedProps || {};

  // 타입 검사 (getFiberTypeName: displayName > name)
  if (compound.type !== null) {
    if (getFiberTypeName(fiber) !== compound.type) return false;
  }

  // displayName 검사 (fiber.type.displayName으로 매칭. Reanimated는 타입명 AnimatedComponent, displayName "Animated.View")
  if (compound.displayName !== null) {
    var t = fiber.type;
    if (!t || typeof t.displayName !== 'string' || t.displayName !== compound.displayName)
      return false;
  }

  // testID 검사
  if (compound.testID !== null && props.testID !== compound.testID) return false;

  // 속성 검사
  for (var i = 0; i < compound.attrs.length; i++) {
    var attr = compound.attrs[i];
    if (String(props[attr.name] || '') !== attr.value) return false;
  }

  // 텍스트 검사 (substring)
  if (compound.text !== null) {
    var text = collectText(fiber, TextComp).replace(/\s+/g, ' ').trim();
    if (text.indexOf(compound.text) === -1) return false;
  }

  // :has-press
  if (compound.hasPress && typeof props.onPress !== 'function') return false;

  // :has-scroll
  if (compound.hasScroll) {
    var sn = fiber.stateNode;
    if (!sn || (typeof sn.scrollTo !== 'function' && typeof sn.scrollToOffset !== 'function'))
      return false;
  }

  return true;
}

/** 계층 셀렉터(A > B, A B) 매칭 — fiber.return을 상향 탐색 */
export function matchesComplexSelector(
  fiber: Fiber,
  complex: any,
  TextComp: any,
  _ImgComp: any
): boolean {
  var segs = complex.segments;
  var last = segs.length - 1;

  // 마지막 segment가 현재 fiber에 매칭되어야 함
  if (!matchesCompound(fiber, segs[last].selector, TextComp, _ImgComp)) return false;

  var current: Fiber | null = fiber;
  for (var i = last - 1; i >= 0; i--) {
    var combinator = segs[i + 1].combinator;
    var targetSel = segs[i].selector;

    if (combinator === '>') {
      // 직접 부모가 매칭되어야 함
      current = current!.return;
      if (!current || !matchesCompound(current, targetSel, TextComp, _ImgComp)) return false;
    } else {
      // 후손: 조상 중 하나가 매칭되면 됨
      current = current!.return;
      while (current) {
        if (matchesCompound(current, targetSel, TextComp, _ImgComp)) break;
        current = current.return;
      }
      if (!current) return false;
    }
  }
  return true;
}

/** testID 없는 fiber의 경로 기반 uid 계산 ("0.1.2" 형식) */
export function getPathUid(fiber: Fiber): string {
  var parts: number[] = [];
  var cur: Fiber | null = fiber;
  while (cur && cur.return) {
    var parent: Fiber = cur.return;
    var idx = 0;
    var ch = parent.child;
    while (ch) {
      if (ch === cur) break;
      ch = ch.sibling;
      idx++;
    }
    parts.unshift(idx);
    cur = parent;
  }
  parts.unshift(0); // root
  return parts.join('.');
}

/** path("0.1.2")로 Fiber 트리에서 노드 찾기. getComponentTree와 동일한 인덱스 규칙. */
export function getFiberByPath(root: Fiber, pathStr: string): Fiber | null {
  if (!root || typeof pathStr !== 'string') return null;
  var parts = pathStr.trim().split('.');
  var fiber: Fiber | null = root;
  for (var i = 0; i < parts.length; i++) {
    if (!fiber) return null;
    var part = parts[i];
    if (part === undefined) return null;
    var idx = parseInt(part, 10);
    if (i === 0) {
      if (idx !== 0) return null;
      continue;
    }
    var child: Fiber | null = fiber.child;
    var j = 0;
    while (child && j < idx) {
      child = child.sibling;
      j++;
    }
    fiber = child;
  }
  return fiber;
}

/** uid가 경로 형식인지 ("0", "0.1", "0.1.2" 등) */
export function isPathUid(uid: string): boolean {
  return typeof uid === 'string' && /^\d+(\.\d+)*$/.test(uid.trim());
}
