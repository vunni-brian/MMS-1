param(
  [string]$OutputPath = (Join-Path (Get-Location) "Market_Management_System_Architecture_and_Design_Documentation.docx")
)

$ErrorActionPreference = "Stop"

function Escape-Xml {
  param([string]$Text)

  if ($null -eq $Text) {
    return ""
  }

  return $Text.
    Replace("&", "&amp;").
    Replace("<", "&lt;").
    Replace(">", "&gt;").
    Replace('"', "&quot;").
    Replace("'", "&apos;")
}

function New-ParagraphXml {
  param(
    [string]$Text,
    [string]$Style = "Normal",
    [int]$FontSize = 22,
    [bool]$Bold = $false
  )

  $boldXml = if ($Bold) { "<w:b/>" } else { "" }
  $escaped = Escape-Xml $Text

  return @"
<w:p>
  <w:pPr>
    <w:pStyle w:val="$Style"/>
    <w:spacing w:after="120"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      $boldXml
      <w:sz w:val="$FontSize"/>
      <w:szCs w:val="$FontSize"/>
    </w:rPr>
    <w:t xml:space="preserve">$escaped</w:t>
  </w:r>
</w:p>
"@
}

function New-CodeParagraphXml {
  param([string]$Text)

  $escaped = Escape-Xml $Text

  return @"
<w:p>
  <w:pPr>
    <w:pStyle w:val="Code"/>
    <w:spacing w:after="20"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>
      <w:sz w:val="18"/>
      <w:szCs w:val="18"/>
    </w:rPr>
    <w:t xml:space="preserve">$escaped</w:t>
  </w:r>
</w:p>
"@
}

function Add-Section {
  param(
    [System.Collections.Generic.List[string]]$Body,
    [string]$Heading,
    [string[]]$Paragraphs,
    [string[]]$CodeLines
  )

  $Body.Add((New-ParagraphXml -Text $Heading -Style "Heading1" -FontSize 30 -Bold $true))
  foreach ($paragraph in $Paragraphs) {
    $Body.Add((New-ParagraphXml -Text $paragraph -Style "Normal" -FontSize 22))
  }
  if ($CodeLines) {
    foreach ($line in $CodeLines) {
      $Body.Add((New-CodeParagraphXml -Text $line))
    }
  }
}

function Write-Utf8File {
  param(
    [string]$Path,
    [string]$Content
  )

  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

$generatedOn = Get-Date -Format "dd MMMM yyyy HH:mm"
$body = New-Object System.Collections.Generic.List[string]

$body.Add((New-ParagraphXml -Text "Market Management System" -Style "Title" -FontSize 34 -Bold $true))
$body.Add((New-ParagraphXml -Text "System Architecture and Design Documentation" -Style "Title" -FontSize 28 -Bold $true))
$body.Add((New-ParagraphXml -Text "Generated on $generatedOn" -Style "Normal" -FontSize 22))

Add-Section -Body $body -Heading "1. Document Purpose and Scope" -Paragraphs @(
  "This document captures the architecture and design of the Market Management System platform after the full-stack MVP implementation.",
  "It covers the modular monolith backend, the React frontend, the persistence model, the main business flows, security controls, and the low-fidelity UI wireframes required for analysis and project reporting.",
  "The scope includes identity and access management, vendor registration, stall booking, payments, notifications, complaints, reporting, audit logging, fallback channels, and the new multi-market oversight capability for officials."
) -CodeLines @()

Add-Section -Body $body -Heading "2. Architectural Summary" -Paragraphs @(
  "The system follows a modular monolith architecture. The frontend is a Vite and React application, while the backend is a TypeScript Node HTTP API organized by business modules such as auth, vendors, stalls, payments, tickets, reports, and coordination.",
  "SQLite is used as the local system of record in development, file uploads are stored on disk, and adapter-style services isolate SMS and mobile money provider behavior from the core booking and payment logic.",
  "Role-based access control is enforced on the server. Vendors and managers are scoped to one market. Officials can review aggregate performance across all markets or drill down into one market."
) -CodeLines @(
  "+--------------------------------------------------------------------------------+",
  "|                               SYSTEM OVERVIEW                                  |",
  "+--------------------------------------------------------------------------------+",
  "| React/Vite Frontend                                                            |",
  "| - Login and MFA                                                               |",
  "| - Vendor registration                                                         |",
  "| - Manager operations dashboard                                                |",
  "| - Official oversight dashboard                                                |",
  "+------------------------------------+-------------------------------------------+",
  "                                     | JSON over HTTP",
  "+------------------------------------v-------------------------------------------+",
  "| TypeScript API (Modular Monolith)                                              |",
  "| - auth    - vendors   - stalls/bookings   - payments                          |",
  "| - tickets - reports   - audit             - notifications                     |",
  "| - coordination         - resources         - fallback                         |",
  "+--------------------+-------------------------------+----------------------------+",
  "                     |                               |",
  "          +----------v----------+         +----------v----------------------+",
  "          | SQLite Database     |         | Local File Storage             |",
  "          | users, markets,     |         | vendor docs, ticket files      |",
  "          | stalls, payments... |         +--------------------------------+",
  "          +----------+----------+",
  "                     |",
  "          +----------v--------------------------------+",
  "          | External Adapters                          |",
  "          | SMS / OTP, MTN Mobile Money, Airtel Money |",
  "          +-------------------------------------------+"
)

Add-Section -Body $body -Heading "3. Component Responsibilities" -Paragraphs @(
  "Frontend responsibilities include rendering dashboards, collecting user input, managing client-side session state, protected routing, and polling for updates where near-real-time awareness is needed.",
  "Backend responsibilities include authentication, MFA challenge handling, market scoping, booking rules, payment lifecycle control, notification queuing, ticket workflows, report aggregation, and audit event capture.",
  "The database is responsible for persistent business state, uniqueness constraints, market ownership, and relationship integrity. File storage is responsible for document and attachment durability outside the relational tables."
) -CodeLines @(
  "- Auth module: registration, OTP, login, MFA, session identity",
  "- Vendor module: profile lookup, approval, rejection, document metadata",
  "- Stall module: inventory, publication state, reservations, confirmations",
  "- Payment module: initiation, attempts, webhook settlement, receipts",
  "- Ticket module: complaint capture, attachments, manager responses",
  "- Report module: revenue, dues, audit, financial reconciliation",
  "- Coordination module: manager and official communication by market",
  "- Resource module: manager requests and official review workflow"
)

Add-Section -Body $body -Heading "4. Context-Level Data Flow Diagram (DFD Level 0)" -Paragraphs @(
  "The context diagram shows the platform as a single system interacting with external actors and providers.",
  "The main external actors are Vendors, Managers, Officials, SMS and OTP providers, and Mobile Money gateways."
) -CodeLines @(
  "                               +------------------+",
  "                               |   SMS Provider   |",
  "                               +--------+---------+",
  "                                        ^",
  "                                        | OTP / alerts",
  "+----------+       registration, login   |",
  "| Vendor   +-----------------------------+",
  "+----+-----+                             |",
  "     |                                   |",
  "     v                                   |",
  "+----+--------------------------------------------------------------------+",
  "|                    Market Management System Platform                     |",
  "+----+--------------------------------------------------------------------+",
  "     ^                                   |",
  "     | approvals, booking ops            | payment callbacks / status",
  "+----+-----+                             v",
  "| Manager  |                    +--------+---------+",
  "+----+-----+                    | Mobile Money APIs |",
  "     ^                          +-------------------+",
  "     |",
  "     | oversight, audit, budgets",
  "+----+-----+",
  "| Official |",
  "+----------+"
)

Add-Section -Body $body -Heading "5. Process Data Flow Diagram (DFD Level 1)" -Paragraphs @(
  "The level 1 diagram decomposes the main platform into business processes and persistent stores.",
  "This view is useful for explaining where booking rules, payment state transitions, and approval workflows are enforced."
) -CodeLines @(
  "+----------------+      +-------------------+      +----------------------+",
  "| 1. Identity    |----->| Users / Sessions  |<-----| 2. Vendor Approval   |",
  "| registration   |      | OTP Challenges    |      | Vendor Profiles      |",
  "+--------+-------+      +-------------------+      +----------+-----------+",
  "         |                                                        |",
  "         v                                                        v",
  "+--------+-------+      +-------------------+      +----------------------+",
  "| 3. Stall        |---->| Markets / Stalls  |<-----| 4. Booking Engine    |",
  "| publication     |      | Bookings          |      | reservation rules    |",
  "+--------+-------+      +-------------------+      +----------+-----------+",
  "         |                                                        |",
  "         v                                                        v",
  "+--------+-------+      +-------------------+      +----------------------+",
  "| 5. Payment      |---->| Payments /        |<-----| 6. Notifications     |",
  "| initiation      |      | Payment Attempts  |      | history + outbox     |",
  "+--------+-------+      +-------------------+      +----------+-----------+",
  "         |                                                        |",
  "         v                                                        v",
  "+--------+-------+      +-------------------+      +----------------------+",
  "| 7. Ticketing    |---->| Tickets / Updates |<-----| 8. Reports & Audit   |",
  "| complaints      |      | Attachments       |      | financial oversight   |",
  "+-----------------+      +-------------------+      +----------------------+"
)

Add-Section -Body $body -Heading "6. Payment Flow" -Paragraphs @(
  "Payments are linked to bookings and carry both business state and provider references.",
  "The booking lifecycle is Available -> Reserved -> Paid -> Confirmed. Payment records preserve attempts, references, transaction identifiers, and receipt messages."
) -CodeLines @(
  "Vendor selects booking",
  "        |",
  "        v",
  "Create payment record (status = pending)",
  "        |",
  "        v",
  "Create payment attempt and external reference",
  "        |",
  "        v",
  "Provider callback or simulated settlement",
  "        |",
  "   +----+--------------------------+",
  "   |                               |",
  "   v                               v",
  "Completed                     Failed",
  "   |                               |",
  "   v                               v",
  "Booking -> paid               Attempt closed",
  "Stall -> paid                 Receipt notes stored",
  "Receipt generated             Notification sent",
  "Notification sent"
)

Add-Section -Body $body -Heading "7. Entity Relationship Diagram (ERD Overview)" -Paragraphs @(
  "The ERD reflects a market-scoped operational system. Markets own managers, vendors, stalls, bookings, payments, tickets, resource requests, and bank deposits.",
  "Users are shared across roles, while vendor-specific approval state is separated into vendor profiles. Audit and coordination records preserve traceability and communication context."
) -CodeLines @(
  "+-----------+      1      *    +-----------+",
  "| markets   +------------------+ users     |",
  "+-----+-----+                  +-----+-----+",
  "      | 1                              | 1",
  "      |                                |",
  "      | *                              | 1",
  "+-----v-----+                   +------v---------+",
  "| stalls    |                   | vendor_profiles|",
  "+-----+-----+                   +----------------+",
  "      | 1",
  "      |",
  "      | *",
  "+-----v-----+      *      1    +----------------+",
  "| bookings  +------------------+ users(vendor)  |",
  "+-----+-----+                   +----------------+",
  "      | 1",
  "      |",
  "      | *",
  "+-----v-----------+",
  "| payments        |",
  "+-----------------+",
  "",
  "+-----------+      1      *    +-----------------+",
  "| users     +------------------+ tickets         |",
  "+-----------+                  +--------+--------+",
  "                                         | 1",
  "                                         |",
  "                                         | *",
  "                                  +------v---------+",
  "                                  | ticket_updates |",
  "                                  +----------------+",
  "",
  "Other market-scoped entities:",
  "- coordination_messages",
  "- resource_requests",
  "- bank_deposits",
  "- audit_events"
)

Add-Section -Body $body -Heading "8. Core Data Model Notes" -Paragraphs @(
  "markets: top-level business boundary used for operational and reporting scope.",
  "users: contains role, contact details, MFA flag, and market assignment for vendors and managers.",
  "vendor_profiles: stores approval status and ID document metadata for vendors.",
  "stalls, bookings, and payments: implement the operational and financial lifecycle of permit and occupancy management.",
  "tickets, ticket_updates, and ticket_attachments: implement complaint intake, resolution tracking, and evidence storage.",
  "resource_requests and coordination_messages: support manager to official interaction for budget and structural oversight."
) -CodeLines @()

Add-Section -Body $body -Heading "9. Security and Access Control Design" -Paragraphs @(
  "Authentication uses phone and password. Managers require an additional OTP challenge for MFA. Sessions are stored server-side and presented with bearer tokens.",
  "Authorization is enforced by role and permission mapping on the server. Vendors can access only their own profile, bookings, payments, tickets, and notifications. Managers operate only within their market. Officials have read-heavy cross-market oversight plus resource review and coordination privileges.",
  "Audit logging captures actor identity, role, market context, action, entity type, entity id, and optional JSON details for forensic review."
) -CodeLines @(
  "Roles:",
  "- Vendor: stall browsing, booking requests, payments, tickets, profile, fallback queries",
  "- Manager: vendor review, stall control, booking confirmation, reports, audit read, coordination, resource creation",
  "- Official: cross-market reports, audit read, coordination, resource review"
)

Add-Section -Body $body -Heading "10. UI Wireframes" -Paragraphs @(
  "The following low-fidelity wireframes describe the main interface states. These are conceptual wireframes intended for documentation and planning rather than pixel-perfect design output."
) -CodeLines @(
  "A. Login / MFA",
  "+--------------------------------------------------------------+",
  "| Market Management System                                     |",
  "| Phone Number [____________________]                          |",
  "| Password     [____________________]                          |",
  "| [ Sign In ]                                                  |",
  "| ------------------------------------------------------------ |",
  "| If manager: OTP challenge after password verification        |",
  "+--------------------------------------------------------------+",
  "",
  "B. Vendor Registration",
  "+--------------------------------------------------------------+",
  "| Vendor Registration                                          |",
  "| Name        [____________________]                           |",
  "| Email       [____________________]                           |",
  "| Phone       [____________________]                           |",
  "| Market      [ Kampala v ]                                    |",
  "| Password    [____________________]                           |",
  "| ID Upload   [ Choose File ]                                  |",
  "| [ Send OTP ]                                                 |",
  "+--------------------------------------------------------------+",
  "",
  "C. Manager Dashboard",
  "+----------------------------------------------------------------------------------+",
  "| KPIs: Revenue | Occupancy | Pending Approvals | Open Tickets                     |",
  "| Market Sentiment | Permit Alerts | Stall Lifecycle | Market Map                  |",
  "| Vendor Directory | Resource Requests | Coordination                              |",
  "+----------------------------------------------------------------------------------+",
  "",
  "D. Official Dashboard",
  "+----------------------------------------------------------------------------------+",
  "| Scope Filter: [ All Markets v ]                                                  |",
  "| KPIs: Health Score | Aggregate Revenue | Manager Performance | Audit Variance    |",
  "| Market Comparison Chart                                                          |",
  "| Revenue Trend | Vendor Approval Mix                                              |",
  "| Performance Index | Financial Audit Trail                                        |",
  "| Exception Reporting | Resource Allocation                                        |",
  "+----------------------------------------------------------------------------------+",
  "",
  "E. Vendor Stalls",
  "+-----------------------------------------------------------------------+",
  "| Available Stalls                                                      |",
  "| [ A-02 ] [ B-01 ] [ D-01 ] [ J-02 ] ...                               |",
  "| Only free and published stalls are visible to vendors                 |",
  "| Select stall -> reservation dates -> reserve                          |",
  "+-----------------------------------------------------------------------+"
)

Add-Section -Body $body -Heading "11. Deployment and Runtime View" -Paragraphs @(
  "In local development, the frontend runs on Vite, the backend runs as a Node process, the SQLite database is created under runtime storage, and uploaded files are placed under runtime uploads.",
  "In a production-ready deployment, the same logical architecture can be placed behind a reverse proxy with a managed relational database and object storage while preserving the current API boundaries and module organization."
) -CodeLines @(
  "Developer workstation / server",
  "  |- Web app: npm run dev:web or production static build",
  "  |- API app: npm run dev:api or npm run api",
  "  |- runtime/mms.sqlite",
  "  |- runtime/uploads/"
)

Add-Section -Body $body -Heading "12. Key Design Decisions" -Paragraphs @(
  "A modular monolith was chosen over microservices to keep the MVP operationally simple while still separating concerns by module.",
  "RBAC and market scoping are enforced server-side to avoid the security problems of client-side role selection and cross-market leakage.",
  "The system uses adapter boundaries for SMS and mobile money so sandbox implementations can be replaced without changing core booking and payment workflows.",
  "Auditability, approval history, receipt history, and immutable event logging were treated as first-class concerns because the platform manages permits, collections, and official oversight."
) -CodeLines @()

Add-Section -Body $body -Heading "13. Suggested Future Enhancements" -Paragraphs @(
  "Introduce PostgreSQL and object storage for production durability at scale.",
  "Replace polling with WebSocket or server-sent events for real-time market availability and coordination feeds.",
  "Extend official oversight to portfolio-level analytics across districts or regions.",
  "Add deeper design artifacts such as BPMN process maps, high-fidelity Figma wireframes, and formal sequence diagrams for payment and notification flows."
) -CodeLines @()

$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
            xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
            xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
            xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
            xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
            mc:Ignorable="w14 w15 wp14">
  <w:body>
    $($body -join "`n")
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>
"@

$stylesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="22"/>
      <w:szCs w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:b/>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="34"/>
      <w:szCs w:val="34"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:b/>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="30"/>
      <w:szCs w:val="30"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Code">
    <w:name w:val="Code"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>
      <w:sz w:val="18"/>
      <w:szCs w:val="18"/>
    </w:rPr>
  </w:style>
</w:styles>
"@

$contentTypesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"@

$rootRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

$documentRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"@

$coreXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:dcmitype="http://purl.org/dc/dcmitype/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Market Management System - System Architecture and Design Documentation</dc:title>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")</dcterms:modified>
</cp:coreProperties>
"@

$appXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
            xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <Company>OpenAI</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>
"@

$staging = Join-Path $env:TEMP ("mms-architecture-doc-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $staging | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "_rels") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "docProps") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "word") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "word\_rels") | Out-Null

Write-Utf8File -Path (Join-Path $staging "[Content_Types].xml") -Content $contentTypesXml
Write-Utf8File -Path (Join-Path $staging "_rels\.rels") -Content $rootRelsXml
Write-Utf8File -Path (Join-Path $staging "docProps\core.xml") -Content $coreXml
Write-Utf8File -Path (Join-Path $staging "docProps\app.xml") -Content $appXml
Write-Utf8File -Path (Join-Path $staging "word\document.xml") -Content $documentXml
Write-Utf8File -Path (Join-Path $staging "word\styles.xml") -Content $stylesXml
Write-Utf8File -Path (Join-Path $staging "word\_rels\document.xml.rels") -Content $documentRelsXml

$zipPath = [System.IO.Path]::ChangeExtension($OutputPath, ".zip")
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}
if (Test-Path $OutputPath) {
  Remove-Item $OutputPath -Force
}

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force
Move-Item -Path $zipPath -Destination $OutputPath -Force
Remove-Item $staging -Recurse -Force

Write-Output "Created $OutputPath"
