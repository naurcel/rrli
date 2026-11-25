import React from "react";

export interface ImportStep1SelectProps {
  batchName: string;
  onBatchNameChange: (name: string) => void;
  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
  onDrop: (e: React.DragEvent<HTMLLabelElement>) => void;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadXlsxTemplate: () => void;
  onDownloadCsvTemplate: () => void;
  onLoadSampleData: () => void;
}

export function ImportStep1Select({
  batchName,
  onBatchNameChange,
  isDragging,
  setIsDragging,
  onDrop,
  onFileInputChange,
  onDownloadXlsxTemplate,
  onDownloadCsvTemplate,
  onLoadSampleData,
}: ImportStep1SelectProps) {
  return (
    <section className="records-card" aria-label="Select Import File">
      <div className="records-heading">
        <div>
          <h2>Select Daily Trip Report File</h2>
          <p>Upload an Excel (.xlsx), CSV, or TSV spreadsheet containing completed delivery trips.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button type="button" className="secondary-button" onClick={onDownloadXlsxTemplate}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Excel (.xlsx) Template
          </button>
          <button type="button" className="secondary-button" onClick={onDownloadCsvTemplate}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download CSV Template
          </button>
          <button type="button" className="secondary-button" onClick={onLoadSampleData}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Load Sample DTR Rows
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 22px", borderTop: "1px solid var(--line)" }}>
        <div className="import-batch-field">
          <label htmlFor="import-batch-name">
            Batch Reference Name
          </label>
          <input
            id="import-batch-name"
            type="text"
            value={batchName}
            onChange={(e) => onBatchNameChange(e.target.value)}
            placeholder="e.g. DTR-Batch-2026-11-01"
          />
        </div>

        <label
          className={`import-dropzone${isDragging ? " is-dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            setIsDragging(false);
            onDrop(e);
          }}
        >
          <div className="import-dropzone-icon-wrap" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="12" y2="12" />
              <line x1="15" y1="15" x2="12" y2="12" />
            </svg>
          </div>
          <strong className="import-dropzone-title">
            Click to browse or drag and drop your spreadsheet
          </strong>
          <span className="import-dropzone-desc">
            Supports Microsoft Excel (.xlsx), CSV, and TSV spreadsheet files up to 10MB.
          </span>
          <div className="import-dropzone-badges">
            <span className="import-badge">.XLSX</span>
            <span className="import-badge">.CSV</span>
            <span className="import-badge">.TSV</span>
            <span className="import-badge">.TXT</span>
            <span className="import-badge">MAX 10MB</span>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,.txt"
            onChange={onFileInputChange}
            style={{ display: "none" }}
          />
        </label>

        <div className="import-guide-card">
          <strong className="import-guide-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--color-accent)" }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Import Requirements &amp; Multi-Stop Grouping:
          </strong>
          <ul className="import-guide-list">
            <li><strong>Mandatory Columns:</strong> Waybill Number, Delivery Date (2024 or later), Client Name, Truck Plate, Temperature, Delivery Rate/Revenue, and at least one Store Stop.</li>
            <li><strong>Multi-Stop Aggregation:</strong> Deliveries with multiple drop-offs repeat the same Waybill Number across consecutive rows and are automatically combined into a single trip record.</li>
            <li><strong>Duplicate Protection:</strong> Existing waybills in RouteX are detected before commit, preventing accidental historical record overwrites.</li>
            <li><strong>Strict Financial Integrity:</strong> Rates and allowances are strictly validated; incomplete or missing rates remain unresolved until verified.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
