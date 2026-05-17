import { useRef, useState, useEffect } from "react";
import { detectShapes, parseRules, validateRules, type DetectedShape, type RuleResult, type ShapeKind } from "../utils/shapeDetection";

const SHAPE_COLORS: Record<string, string> = {
  circle: "#22c55e",
  square: "#3b82f6",
  rectangle: "#f59e0b",
  triangle: "#ef4444",
  unknown: "#9ca3af",
};

const SHAPE_ICONS: Record<string, string> = {
  circle: "⬤",
  square: "■",
  rectangle: "▬",
  triangle: "▲",
  unknown: "?",
};

const DEFAULT_RULES = `1 circle
2 squares
1 triangle`;

export default function ImageValidator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [rulesText, setRulesText] = useState(DEFAULT_RULES);
  const [results, setResults] = useState<RuleResult[] | null>(null);
  const [shapes, setShapes] = useState<DetectedShape[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [summary, setSummary] = useState<string>("");

  const runAnalysis = (url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setAnalyzing(true);
    setResults(null);

    const img = new Image();
    img.onload = () => {
      // Scale down large images for performance
      const maxDim = 1200;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const scale = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const detected = detectShapes(imageData);
      setShapes(detected);

      // Draw annotations
      for (const s of detected) {
        const { x, y, width, height } = s.boundingBox;
        ctx.strokeStyle = SHAPE_COLORS[s.kind] || "#00ff00";
        ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) / 200));
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = SHAPE_COLORS[s.kind] || "#00ff00";
        ctx.font = `bold ${Math.max(11, Math.round(Math.min(w, h) / 60))}px monospace`;
        ctx.fillText(s.kind, x + 2, y - 4);
      }

      // Build summary
      if (detected.length === 0) {
        setSummary("No shapes detected. Try an image with clear shapes on a plain background.");
      } else {
        const counts: Record<string, number> = {};
        for (const s of detected) {
          counts[s.kind] = (counts[s.kind] || 0) + 1;
        }
        const parts = Object.entries(counts).map(
          ([k, c]) => `${c} ${k}${c > 1 ? "s" : ""}`
        );
        const last = parts.pop();
        setSummary(`Found ${detected.length} shape${detected.length > 1 ? "s" : ""}: ${parts.length ? parts.join(", ") + " and " : ""}${last}.`);
      }

      setAnalyzing(false);
    };
    img.src = url;
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResults(null);
    setShapes([]);

    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setImageUrl(url);
      runAnalysis(url);
    };
    reader.readAsDataURL(file);
  };

  const handleValidate = () => {
    if (shapes.length === 0) return;

    const rules = parseRules(rulesText);

    if (rules.length === 0) {
      // Instead of error, show guidance
      setResults([
        {
          rule: { kind: "circle", count: 0 },
          passed: false,
          detected: 0,
          message: 'Could not understand your rules. Try "1 circle", "2 squares", or "at least 1 triangle".',
        },
      ]);
      return;
    }

    const ruleResults = validateRules(shapes, rules);
    setResults(ruleResults);
  };

  const overallPass = results && results.filter((r) => !r.passed).length === 0;
  const overallFail = results && results.filter((r) => !r.passed).length > 0;

  return (
    <div>
      <h1>Image Shape Validator</h1>

      <div className="validator-layout">
        {/* Left panel: upload + rules */}
        <div className="validator-side card">
          <h2>1. Upload Image</h2>
          <div className="compose-field">
            <input type="file" accept="image/*" onChange={handleImage} />
          </div>

          {!imageUrl && (
            <div className="upload-hint">
              <div className="upload-icon">🖼️</div>
              <p>Upload an image with circles, squares, rectangles, or triangles</p>
            </div>
          )}

          <h2 style={{ marginTop: "1.5rem" }}>2. Define Rules</h2>
          <div className="compose-field">
            <textarea
              rows={4}
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
            />
            <p className="hint" style={{ textAlign: "left", marginTop: "0.375rem" }}>
              Examples: "1 circle", "2 squares", "at least 1 triangle", "three rectangles"
            </p>
          </div>

          <button
            className="send-btn"
            onClick={handleValidate}
            disabled={shapes.length === 0 || analyzing}
          >
            {analyzing ? "Analyzing..." : "3. Validate Rules"}
          </button>
        </div>

        {/* Right panel: canvas + results */}
        <div className="validator-results">
          {/* Analysis canvas */}
          <div className="card">
            <h2>
              Analysis
              {analyzing && <span className="analyzing-badge"> Analyzing...</span>}
            </h2>
            {imageUrl ? (
              <canvas ref={canvasRef} className="analysis-canvas" />
            ) : (
              <div className="canvas-placeholder">
                <p>Your annotated image will appear here</p>
              </div>
            )}
          </div>

          {/* Summary */}
          {summary && (
            <div className="card">
              <h2>Detected Shapes</h2>
              <p className="summary-text">{summary}</p>
              {shapes.length > 0 && (
                <div className="shapes-summary">
                  {Object.entries(
                    shapes.reduce<Record<string, number>>((acc, s) => {
                      acc[s.kind] = (acc[s.kind] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([kind, count]) => (
                    <span key={kind} className="shape-badge" style={{ borderLeftColor: SHAPE_COLORS[kind] || "#9ca3af" }}>
                      {SHAPE_ICONS[kind] || "?"} {kind}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Validation results */}
          {results && (
            <div className={`card results-card ${overallPass ? "result-pass" : ""} ${overallFail ? "result-fail" : ""}`}>
              <h2>
                Validation Results
                {overallPass && <span className="verdict pass">✓ All passed</span>}
                {overallFail && <span className="verdict fail">✗ Failed</span>}
              </h2>

              {results.map((r, i) => (
                <div key={i} className={`result-item ${r.passed ? "pass" : "fail"}`}>
                  {r.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
