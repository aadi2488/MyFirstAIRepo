import { useRef, useState } from "react";
import { detectShapes, parseRules, validateRules, type DetectedShape, type RuleResult, type ShapeKind } from "../utils/shapeDetection";

const SHAPE_LABELS: Record<ShapeKind, string> = {
  circle: "🟢 Circle",
  square: "🟦 Square",
  rectangle: "📐 Rectangle",
  triangle: "🔺 Triangle",
  unknown: "❓ Unknown",
};

export default function ImageValidator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [rulesText, setRulesText] = useState("");
  const [results, setResults] = useState<RuleResult[] | null>(null);
  const [shapes, setShapes] = useState<DetectedShape[]>([]);
  const [error, setError] = useState("");

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResults(null);
    setShapes([]);
    setError("");

    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleValidate = () => {
    if (!imageUrl) return;
    setError("");

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const detected = detectShapes(imageData);
      setShapes(detected);

      // Draw annotations
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 2;
      for (const s of detected) {
        const { x, y, width, height } = s.boundingBox;
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = "#00ff00";
        ctx.font = "14px monospace";
        ctx.fillText(s.kind, x, y - 4);
      }

      const rules = parseRules(rulesText);

      if (rules.length === 0) {
        setError("No valid rules found. Use format like \"1 circle\", \"2 squares\".");
        return;
      }

      const ruleResults = validateRules(detected, rules);
      setResults(ruleResults);
    };

    img.src = imageUrl;
  };

  return (
    <div>
      <h1>Image Shape Validator</h1>

      <div className="validator-layout">
        <div className="validator-inputs card">
          <h2>Upload & Rules</h2>

          <div className="compose-field">
            <label>Image</label>
            <input type="file" accept="image/*" onChange={handleImage} />
          </div>

          {imageUrl && (
            <div className="preview-wrap">
              <img src={imageUrl} className="preview-img" alt="Uploaded" />
            </div>
          )}

          <div className="compose-field">
            <label>Rules (one per line)</label>
            <textarea
              placeholder={`1 circle\n2 squares\n1 triangle`}
              rows={4}
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
            />
          </div>

          <button
            className="send-btn"
            onClick={handleValidate}
            disabled={!imageUrl}
          >
            Validate Shapes
          </button>

          {error && <p className="error">{error}</p>}
        </div>

        <div className="validator-results">
          {imageUrl && (
            <div className="card">
              <h2>Analysis</h2>
              <canvas ref={canvasRef} className="analysis-canvas" />
            </div>
          )}

          {results && (
            <div className="card results-card">
              <h2>Results</h2>
              <div className="results-list">
                {results.map((r, i) => (
                  <div key={i} className={`result-item ${r.passed ? "pass" : "fail"}`}>
                    {r.message}
                  </div>
                ))}
              </div>

              <h3 style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>Detected Shapes</h3>
              {shapes.length === 0 ? (
                <p className="empty-state">No shapes detected.</p>
              ) : (
                <div className="shapes-summary">
                  {Object.entries(
                    shapes.reduce<Record<string, number>>((acc, s) => {
                      acc[s.kind] = (acc[s.kind] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([kind, count]) => (
                    <span key={kind} className="shape-badge">
                      {SHAPE_LABELS[kind as ShapeKind] || kind}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
