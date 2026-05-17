export type ShapeKind = "circle" | "square" | "rectangle" | "triangle" | "unknown";

export interface DetectedShape {
  kind: ShapeKind;
  area: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  center: { x: number; y: number };
}

function grayscale(data: Uint8ClampedArray): number[] {
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return gray;
}

function otsuThreshold(gray: number[]): number {
  const hist = new Int32Array(256);
  for (const v of gray) hist[Math.round(v)]++;

  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0, wB = 0, maxV = 0, best = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxV) {
      maxV = between;
      best = t;
    }
  }
  return best;
}

function threshold(gray: number[]): Uint8Array {
  const t = otsuThreshold(gray);
  const bin = new Uint8Array(gray.length);

  // Count which side of threshold has fewer pixels (likely the shapes)
  let darker = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] <= t) darker++;
  }
  // Invert if the "foreground" (shapes) are darker than background
  const invert = darker < gray.length / 2;

  for (let i = 0; i < gray.length; i++) {
    const above = gray[i] > t;
    bin[i] = (invert ? !above : above) ? 255 : 0;
  }
  return bin;
}

interface BoundaryPixel {
  x: number;
  y: number;
}

interface ComponentPixels {
  pixels: Array<{ x: number; y: number }>;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function connectedComponents(bin: Uint8Array, width: number, height: number): ComponentPixels[] {
  const labels = new Int32Array(bin.length);
  labels.fill(0);
  let nextLabel = 1;
  const equiv: number[] = [0];

  function gl(x: number, y: number) {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return labels[y * width + x];
  }

  function sl(x: number, y: number, l: number) {
    labels[y * width + x] = l;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bin[y * width + x] === 0) continue;
      const left = gl(x - 1, y);
      const top = gl(x, y - 1);
      if (left === 0 && top === 0) {
        sl(x, y, nextLabel);
        equiv.push(nextLabel);
        nextLabel++;
      } else if (left !== 0 && top === 0) {
        sl(x, y, left);
      } else if (left === 0 && top !== 0) {
        sl(x, y, top);
      } else {
        const mn = Math.min(left, top);
        const mx = Math.max(left, top);
        sl(x, y, mn);
        equiv[mx] = mn;
      }
    }
  }

  for (let i = 1; i < equiv.length; i++) {
    let r = i;
    while (equiv[r] !== r) { equiv[r] = equiv[equiv[r]]; r = equiv[r]; }
    equiv[i] = r;
  }

  const map = new Map<number, ComponentPixels>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bin[y * width + x] === 0) continue;
      const label = equiv[labels[y * width + x]];
      let c = map.get(label);
      if (!c) {
        c = { pixels: [], minX: x, maxX: x, minY: y, maxY: y };
        map.set(label, c);
      }
      c.pixels.push({ x, y });
      if (x < c.minX) c.minX = x;
      if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
    }
  }

  const out: ComponentPixels[] = [];
  map.forEach((c) => {
    if (c.pixels.length < 80) return;
    out.push(c);
  });
  return out;
}

function extractBoundary(bin: Uint8Array, width: number, height: number, comp: ComponentPixels): BoundaryPixel[] {
  const boundary: BoundaryPixel[] = [];
  for (const { x, y } of comp.pixels) {
    if (y === 0 || y === height - 1 || x === 0 || x === width - 1 ||
      bin[(y - 1) * width + x] === 0 || bin[(y + 1) * width + x] === 0 ||
      bin[y * width + (x - 1)] === 0 || bin[y * width + (x + 1)] === 0) {
      boundary.push({ x, y });
    }
  }
  return boundary;
}

function centroid(points: BoundaryPixel[]): { cx: number; cy: number } {
  let sx = 0, sy = 0;
  for (const p of points) { sx += p.x; sy += p.y; }
  return { cx: sx / points.length, cy: sy / points.length };
}

function sortBoundaryByAngle(points: BoundaryPixel[], cx: number, cy: number): BoundaryPixel[] {
  const copy = [...points];
  copy.sort((a, b) => {
    const ta = Math.atan2(a.y - cy, a.x - cx);
    const tb = Math.atan2(b.y - cy, b.x - cx);
    return ta - tb;
  });
  return copy;
}

function pointToLineDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
  return Math.sqrt((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2);
}

function rdpSimplify(points: BoundaryPixel[], epsilon: number): BoundaryPixel[] {
  if (points.length <= 2) return points;
  let maxDist = 0, maxIdx = 0;
  const first = points[0], last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToLineDist(points[i].x, points[i].y, first.x, first.y, last.x, last.y);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function deduplicateVertices(points: BoundaryPixel[], minDist: number): BoundaryPixel[] {
  if (points.length <= 1) return points;
  const result: BoundaryPixel[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const last = result[result.length - 1];
    const dx = points[i].x - last.x, dy = points[i].y - last.y;
    if (Math.sqrt(dx * dx + dy * dy) > minDist) result.push(points[i]);
  }
  const first = result[0], last = result[result.length - 1];
  const dx = last.x - first.x, dy = last.y - first.y;
  if (result.length > 2 && Math.sqrt(dx * dx + dy * dy) <= minDist) result.pop();
  return result;
}

function classifyShape(boundary: BoundaryPixel[], comp: ComponentPixels): DetectedShape {
  const area = comp.pixels.length;
  const w = comp.maxX - comp.minX + 1;
  const h = comp.maxY - comp.minY + 1;

  // Perimeter from boundary
  const sorted = sortBoundaryByAngle(boundary, centroid(boundary).cx, centroid(boundary).cy);
  let perimeter = 0;
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i], b = sorted[(i + 1) % sorted.length];
    perimeter += Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  // Circularity
  const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;

  const center = {
    x: Math.round((comp.minX + comp.maxX) / 2),
    y: Math.round((comp.minY + comp.maxY) / 2),
  };
  const boundingBox = { x: comp.minX, y: comp.minY, width: w, height: h };

  // Strong circle candidate
  if (circularity > 0.75) {
    return { kind: "circle", area, boundingBox, center };
  }

  // Simplify boundary to find vertices
  const epsilon = Math.max(3, (w + h) / 40);
  const simplified = rdpSimplify(sorted, epsilon);
  const vertices = deduplicateVertices(simplified, Math.max(5, (w + h) / 20));
  const vertexCount = vertices.length;

  const aspectRatio = w / h;
  const isSquareish = aspectRatio >= 0.75 && aspectRatio <= 1.35;

  if (vertexCount <= 3) {
    return { kind: "triangle", area, boundingBox, center };
  }

  if (vertexCount <= 5) {
    if (isSquareish) return { kind: "square", area, boundingBox, center };
    return { kind: "rectangle", area, boundingBox, center };
  }

  if (vertexCount <= 7) {
    // Could be a rounded polygon — check aspect ratio
    if (isSquareish) return { kind: "square", area, boundingBox, center };
    return { kind: "rectangle", area, boundingBox, center };
  }

  // Many vertices — check if still basically a rectangle/square
  const hullArea = w * h;
  const fillRatio = area / hullArea;
  if (fillRatio > 0.7) {
    if (isSquareish) return { kind: "square", area, boundingBox, center };
    return { kind: "rectangle", area, boundingBox, center };
  }

  return { kind: "unknown", area, boundingBox, center };
}

export interface Rule {
  kind: ShapeKind;
  count: number;
}

export interface RuleResult {
  rule: Rule;
  passed: boolean;
  detected: number;
  message: string;
}

export function parseRules(text: string): Rule[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const rules: Rule[] = [];
  const shapeMap: Record<string, ShapeKind> = {
    circle: "circle", circles: "circle",
    square: "square", squares: "square",
    rectangle: "rectangle", rectangles: "rectangle",
    triangle: "triangle", triangles: "triangle",
  };

  for (const line of lines) {
    const clean = line.toLowerCase().trim();

    // Match patterns like:
    // "2 circles", "1 square"
    // "there should be 2 circles"
    // "at least 1 square"
    // "exactly 3 triangles"
    // "circle should be 2"
    // "2 circle"
    let num: number | null = null;
    let shape: string | null = null;

    // Try "N shape" pattern (most common)
    const m1 = clean.match(/(\d+)\s+(circle|circles|square|squares|rectangle|rectangles|triangle|triangles)/);
    if (m1) { num = parseInt(m1[1]); shape = m1[2]; }

    // Try "shape N" pattern ("circle should be 2")
    if (!num) {
      const m2 = clean.match(/(circle|circles|square|squares|rectangle|rectangles|triangle|triangles).*?(\d+)/);
      if (m2) { shape = m2[1]; num = parseInt(m2[2]); }
    }

    // Try word numbers: "two circles", "one square"
    if (!num) {
      const wordNums: Record<string, number> = {
        one: 1, two: 2, three: 3, four: 4, five: 5,
        six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      };
      for (const [word, n] of Object.entries(wordNums)) {
        if (clean.includes(word)) { num = n; break; }
      }
      if (num) {
        const m3 = clean.match(/(circle|circles|square|squares|rectangle|rectangles|triangle|triangles)/);
        if (m3) shape = m3[1];
      }
    }

    if (num && shape) {
      const kind = shapeMap[shape];
      if (kind && num > 0) rules.push({ kind, count: num });
    }
  }

  return rules;
}

export function detectShapes(imageData: ImageData): DetectedShape[] {
  const { width, height, data } = imageData;
  const gray = grayscale(data);
  const bin = threshold(gray);

  const components = connectedComponents(bin, width, height);
  const shapes: DetectedShape[] = [];

  for (const comp of components) {
    const boundary = extractBoundary(bin, width, height, comp);
    if (boundary.length < 30) continue;
    const shape = classifyShape(boundary, comp);
    shapes.push(shape);
  }

  // Auto-filter: drop shapes smaller than 0.5% of the largest shape's area
  const maxArea = shapes.reduce((m, s) => Math.max(m, s.area), 0);
  if (maxArea > 0) {
    return shapes.filter((s) => s.area >= maxArea * 0.005);
  }

  return shapes;
}

export function validateRules(shapes: DetectedShape[], rules: Rule[]): RuleResult[] {
  return rules.map((rule) => {
    const detected = shapes.filter((s) => s.kind === rule.kind).length;
    const passed = detected >= rule.count;
    const message = passed
      ? `${rule.kind}: ${detected} detected (required: ${rule.count}) ✓`
      : `${rule.kind}: only ${detected} detected (required: ${rule.count}) ✗`;
    return { rule, passed, detected, message };
  });
}
