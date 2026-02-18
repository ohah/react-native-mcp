import { describe, expect, it } from 'bun:test';
import { compareImages, cropElement } from '../tools/image-compare.js';

/** Sharp로 단색 10×10 PNG를 생성한다. */
async function createSolidPng(
  width: number,
  height: number,
  color: { r: number; g: number; b: number; alpha: number }
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp({
    create: { width, height, channels: 4, background: color },
  })
    .png()
    .toBuffer();
}

describe('compareImages', () => {
  it('동일한 이미지 비교 시 pass=true, diffPixels=0', async () => {
    const png = await createSolidPng(10, 10, { r: 255, g: 0, b: 0, alpha: 255 });
    const result = await compareImages(png, png);
    expect(result.pass).toBe(true);
    expect(result.diffPixels).toBe(0);
    expect(result.diffRatio).toBe(0);
    expect(result.dimensions).toEqual({ width: 10, height: 10 });
    expect(result.diffBuffer).toBeInstanceOf(Buffer);
  });

  it('다른 이미지 비교 시 pass=false, diffPixels > 0', async () => {
    const red = await createSolidPng(10, 10, { r: 255, g: 0, b: 0, alpha: 255 });
    const blue = await createSolidPng(10, 10, { r: 0, g: 0, b: 255, alpha: 255 });
    const result = await compareImages(red, blue);
    expect(result.pass).toBe(false);
    expect(result.diffPixels).toBe(100);
    expect(result.diffRatio).toBe(1);
    expect(result.totalPixels).toBe(100);
  });

  it('크기 불일치 시 즉시 실패', async () => {
    const small = await createSolidPng(10, 10, { r: 255, g: 0, b: 0, alpha: 255 });
    const big = await createSolidPng(20, 20, { r: 255, g: 0, b: 0, alpha: 255 });
    const result = await compareImages(small, big);
    expect(result.pass).toBe(false);
    expect(result.message).toContain('Size mismatch');
    expect(result.diffBuffer).toBeUndefined();
  });

  it('threshold 0으로 설정 시 미세 차이도 감지', async () => {
    const sharp = (await import('sharp')).default;
    // 10×10 빨간색 기본
    const base = await createSolidPng(10, 10, { r: 255, g: 0, b: 0, alpha: 255 });

    // 1픽셀만 다른 이미지 생성 (raw RGBA 조작)
    const rawBase = await sharp(base).ensureAlpha().raw().toBuffer();
    const rawModified = Buffer.from(rawBase);
    // 첫 번째 픽셀 녹색으로
    rawModified[0] = 0;
    rawModified[1] = 255;
    rawModified[2] = 0;

    const modified = await sharp(rawModified, { raw: { width: 10, height: 10, channels: 4 } })
      .png()
      .toBuffer();

    const result = await compareImages(base, modified, 0);
    expect(result.pass).toBe(false);
    expect(result.diffPixels).toBeGreaterThanOrEqual(1);
  });

  it('diff 이미지가 유효한 PNG', async () => {
    const red = await createSolidPng(10, 10, { r: 255, g: 0, b: 0, alpha: 255 });
    const blue = await createSolidPng(10, 10, { r: 0, g: 0, b: 255, alpha: 255 });
    const result = await compareImages(red, blue);
    // PNG signature check
    expect(result.diffBuffer!.subarray(0, 4).toString('hex')).toBe('89504e47');
  });
});

describe('cropElement', () => {
  it('20×20 이미지에서 10×10 영역 크롭', async () => {
    const png = await createSolidPng(20, 20, { r: 0, g: 255, b: 0, alpha: 255 });
    const cropped = await cropElement(png, { left: 5, top: 5, width: 10, height: 10 });
    const sharp = (await import('sharp')).default;
    const meta = await sharp(cropped).metadata();
    expect(meta.width).toBe(10);
    expect(meta.height).toBe(10);
    // PNG signature check
    expect(cropped.subarray(0, 4).toString('hex')).toBe('89504e47');
  });

  it('전체 영역 크롭 시 원본과 동일 크기', async () => {
    const png = await createSolidPng(15, 15, { r: 128, g: 128, b: 128, alpha: 255 });
    const cropped = await cropElement(png, { left: 0, top: 0, width: 15, height: 15 });
    const sharp = (await import('sharp')).default;
    const meta = await sharp(cropped).metadata();
    expect(meta.width).toBe(15);
    expect(meta.height).toBe(15);
  });
});
