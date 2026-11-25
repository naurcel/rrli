export function ImportStepper({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <nav className="import-stepper" aria-label="Import Workflow Steps">
      <div className={`import-stepper-item${step === 1 ? " active" : step > 1 ? " completed" : ""}`}>
        <span className="import-stepper-num">1</span>
        <span>Select File</span>
      </div>
      <span className="import-stepper-arrow" aria-hidden="true">›</span>
      <div className={`import-stepper-item${step === 2 ? " active" : step > 2 ? " completed" : ""}`}>
        <span className="import-stepper-num">2</span>
        <span>Preview &amp; Validate</span>
      </div>
      <span className="import-stepper-arrow" aria-hidden="true">›</span>
      <div className={`import-stepper-item${step === 3 ? " active" : step > 3 ? " completed" : ""}`}>
        <span className="import-stepper-num">3</span>
        <span>Confirm Batch</span>
      </div>
      <span className="import-stepper-arrow" aria-hidden="true">›</span>
      <div className={`import-stepper-item${step === 4 ? " active" : ""}`}>
        <span className="import-stepper-num">4</span>
        <span>Import Results</span>
      </div>
    </nav>
  );
}
