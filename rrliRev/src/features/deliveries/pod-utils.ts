/**
 * RouteX POD & Document Utility Functions
 */

export type PodReceiptDeliveryMeta = {
  waybillNumber?: string;
  clientName?: string;
  deliveryDate?: string;
  plateNumber?: string;
  truckType?: string;
};

export type PodReceiptDropoffMeta = {
  storeName?: string;
  destinationArea?: string;
  sequence?: number;
  entryFee?: number | null;
};

export function isImageDocument(url?: string | null, filename?: string | null): boolean {
  if (!url && !filename) return false;
  if (url?.startsWith("data:image/")) return true;
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(filename ?? "")) {
    if (url?.startsWith("data:application/pdf")) return false;
    return true;
  }
  return false;
}

/**
 * Generates an authentic, professional SVG Proof of Delivery receipt data URL
 * for simulated/mock deliveries so that users can view, preview, and download real documents.
 */
export function generateMockPodSvgReceipt(
  delivery: PodReceiptDeliveryMeta | undefined,
  dropoff: PodReceiptDropoffMeta | undefined,
  filename: string,
): string {
  const waybill = delivery?.waybillNumber ?? "WB-261102";
  const client = delivery?.clientName ?? "Redeemed Route Logistics Client";
  const date = delivery?.deliveryDate ?? new Date().toISOString().slice(0, 10);
  const truck = delivery?.plateNumber ?? "CBZ 1187";
  const truckType = delivery?.truckType ?? "10-Wheeler";
  const store = dropoff?.storeName ?? "Wilcon Depot - Las Pinas";
  const area = dropoff?.destinationArea ?? "Metro Manila";
  const seq = dropoff?.sequence ?? 1;
  const entryFee = dropoff?.entryFee != null ? `PHP ${dropoff.entryFee.toLocaleString()}` : "PHP 150.00 (Confirmed)";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 820" width="100%" height="100%">
    <defs>
      <linearGradient id="podHeaderGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#1e3a8a"/>
        <stop offset="100%" stop-color="#2563eb"/>
      </linearGradient>
      <filter id="podShadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08"/>
      </filter>
    </defs>
    <!-- Background Document Page -->
    <rect width="640" height="820" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <rect x="20" y="20" width="600" height="780" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" rx="6"/>
    
    <!-- Header Banner -->
    <rect x="20" y="20" width="600" height="74" fill="url(#podHeaderGrad)" rx="6"/>
    <text x="44" y="50" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="800" fill="#ffffff" letter-spacing="0.08em">REDEEMED ROUTE LOGISTICS INC.</text>
    <text x="44" y="70" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#93c5fd" letter-spacing="0.05em">OFFICIAL PROOF OF DELIVERY RECEIPT (POD)</text>
    <text x="596" y="60" font-family="monospace" font-size="11" font-weight="600" fill="#ffffff" text-anchor="end">${filename}</text>

    <!-- Trip & Logistics Overview Box -->
    <rect x="40" y="114" width="560" height="116" fill="#ffffff" stroke="#e2e8f0" rx="8" filter="url(#podShadow)"/>
    <text x="60" y="138" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="0.06em">WAYBILL NUMBER</text>
    <text x="60" y="158" font-family="monospace" font-size="15" font-weight="800" fill="#0f172a">${waybill}</text>

    <text x="240" y="138" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="0.06em">DELIVERY DATE</text>
    <text x="240" y="158" font-family="sans-serif" font-size="13" font-weight="700" fill="#0f172a">${date}</text>

    <text x="420" y="138" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="0.06em">FLEET VEHICLE</text>
    <text x="420" y="158" font-family="sans-serif" font-size="13" font-weight="700" fill="#0f172a">${truck} (${truckType})</text>

    <line x1="60" y1="178" x2="580" y2="178" stroke="#f1f5f9" stroke-width="1"/>
    <text x="60" y="202" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="0.06em">CLIENT ACCOUNT</text>
    <text x="200" y="202" font-family="sans-serif" font-size="13" font-weight="700" fill="#0f172a">${client}</text>

    <!-- Destination Stop Box -->
    <rect x="40" y="250" width="560" height="155" fill="#ffffff" stroke="#e2e8f0" rx="8" filter="url(#podShadow)"/>
    <text x="60" y="280" font-family="sans-serif" font-size="12" font-weight="800" fill="#1e293b">DESTINATION DROP-OFF DETAILS</text>
    <rect x="495" y="264" width="85" height="24" fill="#dcfce7" rx="12"/>
    <text x="537" y="280" font-family="sans-serif" font-size="10" font-weight="700" fill="#15803d" text-anchor="middle">STOP #${seq}</text>

    <text x="60" y="315" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b">RECEIVING STORE / BRANCH</text>
    <text x="60" y="335" font-family="sans-serif" font-size="14" font-weight="800" fill="#0f172a">${store}</text>

    <text x="60" y="365" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b">DESTINATION AREA</text>
    <text x="60" y="385" font-family="sans-serif" font-size="12" font-weight="600" fill="#334155">${area}</text>

    <text x="420" y="365" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b">CONFIRMED ENTRY FEE</text>
    <text x="420" y="385" font-family="sans-serif" font-size="12" font-weight="700" fill="#0f172a">${entryFee}</text>

    <!-- Receiving Goods Confirmation Section -->
    <rect x="40" y="425" width="560" height="235" fill="#ffffff" stroke="#e2e8f0" rx="8" filter="url(#podShadow)"/>
    <text x="60" y="455" font-family="sans-serif" font-size="12" font-weight="800" fill="#1e293b">RECEIVING ACKNOWLEDGEMENT &amp; SIGNATURE</text>
    <text x="60" y="480" font-family="sans-serif" font-size="11" fill="#475569">The undersigned store receiver hereby acknowledges complete delivery in good condition.</text>

    <!-- Custodian Signature Line & Scribble -->
    <line x1="60" y1="585" x2="310" y2="585" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="M 75 572 Q 95 530 115 568 T 155 538 T 195 562 T 235 536 T 280 568" fill="none" stroke="#1d4ed8" stroke-width="2.4" stroke-linecap="round"/>
    <text x="60" y="605" font-family="sans-serif" font-size="11" font-weight="700" fill="#1e293b">Authorized Store Receiving Staff</text>
    <text x="60" y="621" font-family="sans-serif" font-size="10" fill="#64748b">Verified signature on file</text>

    <!-- Official Receiving Rubber Stamp -->
    <g transform="translate(365, 485) rotate(-6)">
      <rect x="0" y="0" width="180" height="96" fill="rgba(16, 185, 129, 0.05)" stroke="#059669" stroke-width="3" stroke-dasharray="6 2" rx="6"/>
      <rect x="5" y="5" width="170" height="86" fill="none" stroke="#059669" stroke-width="1" rx="4"/>
      <text x="90" y="28" font-family="sans-serif" font-size="10" font-weight="900" fill="#059669" text-anchor="middle" letter-spacing="0.1em">STORE RECEIVING</text>
      <text x="90" y="50" font-family="sans-serif" font-size="13" font-weight="900" fill="#059669" text-anchor="middle">RECEIVED &amp; VERIFIED</text>
      <text x="90" y="70" font-family="sans-serif" font-size="10" font-weight="700" fill="#059669" text-anchor="middle">${date}</text>
    </g>

    <!-- Tracking Barcode & Hash -->
    <g transform="translate(60, 690)">
      <rect x="0" y="0" width="3" height="38" fill="#0f172a"/>
      <rect x="6" y="0" width="2" height="38" fill="#0f172a"/>
      <rect x="12" y="0" width="5" height="38" fill="#0f172a"/>
      <rect x="20" y="0" width="2" height="38" fill="#0f172a"/>
      <rect x="26" y="0" width="4" height="38" fill="#0f172a"/>
      <rect x="34" y="0" width="1" height="38" fill="#0f172a"/>
      <rect x="38" y="0" width="6" height="38" fill="#0f172a"/>
      <rect x="48" y="0" width="3" height="38" fill="#0f172a"/>
      <rect x="54" y="0" width="2" height="38" fill="#0f172a"/>
      <rect x="60" y="0" width="5" height="38" fill="#0f172a"/>
      <rect x="70" y="0" width="3" height="38" fill="#0f172a"/>
      <rect x="76" y="0" width="4" height="38" fill="#0f172a"/>
      <rect x="84" y="0" width="2" height="38" fill="#0f172a"/>
      <rect x="90" y="0" width="6" height="38" fill="#0f172a"/>
      <rect x="100" y="0" width="2" height="38" fill="#0f172a"/>
      <rect x="106" y="0" width="4" height="38" fill="#0f172a"/>
      <rect x="114" y="0" width="3" height="38" fill="#0f172a"/>
      <rect x="120" y="0" width="5" height="38" fill="#0f172a"/>
      <text x="64" y="52" font-family="monospace" font-size="10" fill="#64748b" text-anchor="middle">POD-${waybill}-${seq}</text>
    </g>

    <!-- Confidential Notice Footer -->
    <text x="320" y="790" font-family="sans-serif" font-size="9" fill="#94a3b8" text-anchor="middle">Official Document · Redeemed Route Logistics Inc. · Private &amp; Confidential</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function openDocumentInNewTab(url: string, _filename: string): Promise<void> {
  try {
    if (url.startsWith("data:")) {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, "_blank");
      if (!win) {
        window.location.href = blobUrl;
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }
  } catch {
    // Fall through to standard window.open
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function triggerDocumentDownload(url: string, filename: string): Promise<void> {
  try {
    let downloadHref = url;
    let revokeNeeded = false;
    if (url.startsWith("data:")) {
      const res = await fetch(url);
      const blob = await res.blob();
      downloadHref = URL.createObjectURL(blob);
      revokeNeeded = true;
    }
    const a = document.createElement("a");
    a.href = downloadHref;
    a.download = filename || "proof-of-delivery.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (revokeNeeded) {
      setTimeout(() => URL.revokeObjectURL(downloadHref), 60000);
    }
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "proof-of-delivery.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}