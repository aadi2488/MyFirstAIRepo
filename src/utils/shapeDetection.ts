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

function gaussianBlur(gray: number[], width: number, height: number): number[] {
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1],
  ];
  const kSum = 16;
  const result: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const py = Math.min(height - 1, Math.max(0, y + ky));
          sum += gray[py * width + px] * kernel[ky + 1][kx + 1];
        }
      }
      result.push(sum / kSum);
    }
  }
  return result;
}

function threshold(gray: number[], threshold: number): Uint8Array {
  const bin = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    bin[i] = gray[i] > threshold ? 255 : 0;
  }
  return bin;
}

interface Component {
  pixels: Array<{ x: number; y: number }>;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function connectedComponents(bin: Uint8Array, width: number, height: number): Component[] {
  const labels = new Int32Array(bin.length);
  labels.fill(0);
  let nextLabel = 1;
  const equivalences: number[] = [0];

  function getLabel(x: number, y: number): number {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return labels[y * width + x];
  }

  function setLabel(x: number, y: number, l: number) {
    labels[y * width + x] = l;
  }

  // First pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (bin[idx] === 0) continue;

      const left = getLabel(x - 1, y);
      const top = getLabel(x, y - 1);

      if (left === 0 && top === 0) {
        setLabel(x, y, nextLabel);
        equivalences.push(nextLabel);
        nextLabel++;
      } else if (left !== 0 && top === 0) {
        setLabel(x, y, left);
      } else if (left === 0 && top !== 0) {
        setLabel(x, y, top);
      } else {
        // Both have labels - union
        const min = Math.min(left, top);
        const max = Math.max(left, top);
        setLabel(x, y, min);
        equivalences[max] = min;
      }
    }
  }

  // Resolve equivalences (simple path compression)
  for (let i = 1; i < equivalences.length; i++) {
    let root = i;
    while (equivalences[root] !== root) {
      equivalences[root] = equivalences[equivalences[root]];
      root = equivalences[root];
    }
    equivalences[i] = root;
  }

  // Second pass and component collection
  const compMap = new Map<number, Component>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (bin[idx] === 0) continue;
      const label = equivalences[labels[idx]];

      if (!compMap.has(label)) {
        compMap.set(label, {
          pixels: [],
          minX: x,
          maxX: x,
          minY: y,
          maxY: y,
        });
      }
      const comp = compMap.get(label)!;
      comp.pixels.push({ x, y });
      comp.minX = Math.min(comp.minX, x);
      comp.maxX = Math.max(comp.maxX, x);
      comp.minY = Math.min(comp.minY, y);
      comp.maxY = Math.max(comp.maxY, y);
    }
  }

  const result: Component[] = [];
  compMap.forEach((comp) => {
    if (comp.pixels.length < 50) return; // filter noise
    result.push(comp);
  });
  return result;
}

function traceContour(bin: Uint8Array, width: number, height: number, startX: number, startY: number): Array<{ x: number; y: number }> {
  // Moore-Neighbor tracing
  const contour: Array<{ x: number; y: number }> = [];
  const dirs = [
    [1, 0], [1, -1], [0, -1], [-1, -1],
    [-1, 0], [-1, 1], [0, 1], [1, 1],
  ];

  let cx = startX;
  let cy = startY;
  let startDir = 0;
  const visited = new Set<string>();

  do {
    contour.push({ x: cx, y: cy });
    visited.add(`${cx},${cy}`);

    let found = false;
    for (let d = 0; d < 8; d++) {
      const dirIdx = (startDir + d) % 8;
      const nx = cx + dirs[dirIdx][0];
      const ny = cy + dirs[dirIdx][1];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const key = `${nx},${ny}`;
        if (bin[ny * width + nx] !== 0 && !visited.has(key)) {
          cx = nx;
          cy = ny;
          startDir = (dirIdx + 6) % 8;
          found = true;
          break;
        }
      }
    }

    if (!found) break;
    if (contour.length > 20000) break; // safety limit
  } while (cx !== startX || cy !== startY);

  return contour;
}

function pointToLineDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

function rdpSimplify(points: Array<{ x: number; y: number }>, epsilon: number): Array<{ x: number; y: number }> {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToLineDist(points[i].x, points[i].y, first.x, first.y, last.x, last.y);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  } else {
    return [first, last];
  }
}

function classifyShape(contour: Array<{ x: number; y: number }>, component: Component): DetectedShape {
  const area = component.pixels.length;
  const w = component.maxX - component.minX + 1;
  const h = component.maxY - component.minY + 1;

  // Perimeter from contour
  let perimeter = 0;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    perimeter += Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  // Circularity: 4π * area / perimeter²
  const circularity = (4 * Math.PI * area) / (perimeter * perimeter);

  const center = {
    x: Math.round((component.minX + component.maxX) / 2),
    y: Math.round((component.minY + component.maxY) / 2),
  };

  const boundingBox = { x: component.minX, y: component.minY, width: w, height: h };

  // Circle: circularity > 0.7
  if (circularity > 0.7) {
    return { kind: "circle", area, boundingBox, center };
  }

  // For polygons, simplify the contour
  const simplified = rdpSimplify(contour, 2);
  let vertexCount = simplified.length;

  // Deduplicate near-identical vertices
  if (vertexCount > 2) {
    const deduped: Array<{ x: number; y: number }> = [simplified[0]];
    for (let i = 1; i < simplified.length; i++) {
      const last = deduped[deduped.length - 1];
      const dx = simplified[i].x - last.x;
      const dy = simplified[i].y - last.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        deduped.push(simplified[i]);
      }
    }
    // Check if first and last are same point
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    if (Math.sqrt(dx * dx + dy * dy) <= 5 && deduped.length > 2) {
      deduped.pop();
    }
    vertexCount = deduped.length;
  }

  const aspectRatio = w / h;
  const isSquare = aspectRatio >= 0.8 && aspectRatio <= 1.25;

  if (vertexCount === 3) {
    return { kind: "triangle", area, boundingBox, center };
  } else if (vertexCount === 4) {
    if (isSquare) {
      return { kind: "square", area, boundingBox, center };
    } else {
      return { kind: "rectangle", area, boundingBox, center };
    }
  } else if (vertexCount <= 6) {
    if (isSquare) {
      return { kind: "square", area, boundingBox, center };
    }
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
    circle: "circle",
    circles: "circle",
    square: "square",
    squares: "square",
    rectangle: "rectangle",
    rectangles: "rectangle",
    triangle: "triangle",
    triangles: "triangle",
  };

  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    const match = lower.match(/(\d+)\s+(circle|circles|square|squares|rectangle|rectangles|triangle|triangles)/);
    if (match) {
      const count = parseInt(match[1], 10);
      const kind = shapeMap[match[2]];
      if (kind && count > 0) {
        rules.push({ kind, count });
      }
    }
  }

  return rules;
}

export function detectShapes(imageData: ImageData): DetectedShape[] {
  const { width, height, data } = imageData;

  // Preprocessing pipeline
  const gray = grayscale(data);
  const blurred = gaussianBlur(gray, width, height);
  const bin = threshold(blurred, 128);

  // Find connected components
  const components = connectedComponents(bin, width, height);

  // For each component, trace contour and classify
  const shapes: DetectedShape[] = [];

  for (const comp of components) {
    const startX = comp.minX + Math.floor((comp.maxX - comp.minX) / 2);
    const startY = comp.minY + Math.floor((comp.maxY - comp.minY) / 2);
    const contour = traceContour(bin, width, height, startX, startY);

    if (contour.length < 20) continue;

    const shape = classifyShape(contour, comp);
    shapes.push(shape);
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
