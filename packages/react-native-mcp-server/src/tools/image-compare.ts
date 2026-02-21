/**
 * 이미지 비교 핵심 모듈.
 * Sharp로 PNG → raw RGBA 변환, pixelmatch로 diff, Sharp로 diff RGBA → PNG 인코딩.
 * JPEG 아티팩트 false-positive 방지를 위해 항상 PNG 원본 기준 비교.
 */

export interface CompareResult {
  pass: boolean;
  diffRatio: number;
  diffPixels: number;
  totalPixels: number;
  dimensions: { width: number; height: number };
  /** diff 이미지 PNG Buffer. 비교 수행 시에만 존재. */
  diffBuffer?: Buffer;
  message: string;
}

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 두 PNG 이미지를 픽셀 단위로 비교한다.
 * @param baselinePng 기준 이미지 PNG Buffer
 * @param currentPng 현재 이미지 PNG Buffer
 * @param threshold pixelmatch threshold (0~1). 기본 0.1 (pixelmatch 기본값)
 * @returns CompareResult
 */
export async function compareImages(
  baselinePng: Buffer,
  currentPng: Buffer,
  threshold = 0.1
): Promise<CompareResult> {
  const sharp = (await import('sharp')).default;
  const pixelmatch = (await import('pixelmatch')).default;

  const [baseMeta, curMeta] = await Promise.all([
    sharp(baselinePng).metadata(),
    sharp(currentPng).metadata(),
  ]);

  const bw = baseMeta.width!;
  const bh = baseMeta.height!;
  const cw = curMeta.width!;
  const ch = curMeta.height!;

  // 해상도가 다르면 픽셀 비교를 수행하지 않음. threshold(퍼센트)는 같은 크기일 때만 적용됨.
  // CI와 로컬 시뮬레이터 해상도가 다르면 이 단계에서 실패하므로, 베이스라인은 CI와 동일한
  // 기기/해상도에서 생성하거나, 워크플로에서 시뮬레이터를 고정하는 것이 필요함.
  if (bw !== cw || bh !== ch) {
    return {
      pass: false,
      diffRatio: 1,
      diffPixels: bw * bh,
      totalPixels: bw * bh,
      dimensions: { width: bw, height: bh },
      message: `Size mismatch: baseline ${bw}x${bh} vs current ${cw}x${ch}`,
    };
  }

  const [baseRaw, curRaw] = await Promise.all([
    sharp(baselinePng).ensureAlpha().raw().toBuffer(),
    sharp(currentPng).ensureAlpha().raw().toBuffer(),
  ]);

  const totalPixels = bw * bh;
  const diffRaw = Buffer.alloc(bw * bh * 4);

  const diffPixels = pixelmatch(baseRaw, curRaw, diffRaw, bw, bh, { threshold });

  const diffRatio = diffPixels / totalPixels;

  const diffBuffer = await sharp(diffRaw, { raw: { width: bw, height: bh, channels: 4 } })
    .png()
    .toBuffer();

  const pass = diffPixels === 0;

  return {
    pass,
    diffRatio,
    diffPixels,
    totalPixels,
    dimensions: { width: bw, height: bh },
    diffBuffer,
    message: pass
      ? `Images match (${bw}x${bh})`
      : `${diffPixels} pixels differ (${(diffRatio * 100).toFixed(2)}%) in ${bw}x${bh} image`,
  };
}

/**
 * PNG 이미지에서 지정 영역을 크롭한다.
 * @param png 원본 PNG Buffer
 * @param rect 크롭 영역 (pixel 단위)
 * @returns 크롭된 PNG Buffer
 */
export async function cropElement(png: Buffer, rect: CropRect): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(png).extract(rect).png().toBuffer();
}

/**
 * PNG 이미지에서 스크린 스케일을 계산한다.
 * 런타임 pixelRatio를 우선 사용하고, 없으면 플랫폼별 fallback.
 */
export async function getScreenScale(
  png: Buffer,
  platform: 'android' | 'ios',
  runtimePixelRatio?: number | null
): Promise<number> {
  // 런타임에서 보내준 pixelRatio가 있으면 우선 사용 (iOS/Android 공통)
  if (runtimePixelRatio != null) return runtimePixelRatio;

  if (platform === 'android') {
    const { getAndroidScale } = await import('./adb-utils.js');
    return getAndroidScale();
  }
  // iOS fallback: simctl PNG의 DPI 메타데이터 (144=2x, 216=3x)
  // 일부 simctl 버전은 DPI를 72로 찍으므로 신뢰도가 낮음
  const sharp = (await import('sharp')).default;
  const metadata = await sharp(png).metadata();
  const density = metadata.density || 72;
  return Math.round(density / 72) || 1;
}
