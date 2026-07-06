import type { StudioTabId } from './tabs';

// ============================================================
// Help content — hướng dẫn chi tiết cho từng tool
// ============================================================
//
// Tách sang file riêng vì content dài. HelpDialog render theo activeTab.
// Mỗi section có: what, whenToUse (bullets), howToUse (bullets có step),
// examples (code block + description), tips.
// ============================================================

export interface HelpExample {
  title: string;
  input?: string;
  output?: string;
  note?: string;
}

export interface TabHelpContent {
  what: string;
  whenToUse: string[];
  howToUse: string[];
  examples: HelpExample[];
  tips: string[];
  cheatsheet?: Array<{ label: string; meaning: string }>;
}

export const HELP: Record<StudioTabId, TabHelpContent> = {
  visualize: {
    what: 'Vẽ JSON thành graph tương tác. Mỗi object/array là 1 node, edge nối tầng cha-con. Zoom, pan, collapse node để nắm cấu trúc data mà không cần scroll text.',
    whenToUse: [
      'JSON nested nhiều tầng, đọc text mỏi mắt',
      'Cần screenshot cấu trúc data để gửi cho team',
      'Debug API response — nhìn overview trước khi drill từng field',
      'Compare 2 API bằng cách visualize song song 2 tab browser',
    ],
    howToUse: [
      'Paste JSON vào editor bên trái (auto parse 400ms sau khi ngừng gõ)',
      'Chuyển giữa Graph (canvas) và Tree (indent list) qua sub-tab trong workspace',
      'Click node để mở dialog xem full content + JSON path tới node đó',
      'Toolbar dưới góc: Fit / Zoom in-out / Rotate direction / Collapse all / Export image',
      'Long press hoặc drag để pan canvas',
    ],
    examples: [
      {
        title: 'API response e-com',
        input: '{\n  "user": { "id": 1, "name": "Alice" },\n  "orders": [\n    { "id": "A1", "total": 100 },\n    { "id": "A2", "total": 250 }\n  ]\n}',
        note: 'Graph sẽ hiện root object → 2 nhánh "user" (leaf) và "orders" (array 2 items). Click "orders" node để xem chi tiết từng order.',
      },
    ],
    tips: [
      'Với JSON > 500 nodes, tool cảnh báo overflow. Nên chọn Tree view thay vì Graph để render nhanh hơn.',
      'Export image: chọn PNG/JPEG/SVG. SVG scale vô hạn, dùng cho document.',
      'Preferences (icon settings): toggle light/dark theme graph, zoom on scroll, ruler.',
    ],
  },

  format: {
    what: 'Bộ 6 action nhanh cho JSON: Prettify (2sp/4sp), Minify, Sort keys (asc/desc), Convert JSONL. 1 click 1 kết quả copy được.',
    whenToUse: [
      'JSON minified 1 dòng, muốn đọc → Prettify',
      'Ship file config, muốn tiết kiệm size → Minify',
      'So sánh 2 JSON có key order khác nhau → Sort keys cả 2 rồi paste vào Diff',
      'Log file JSONL (mỗi dòng 1 record) → JSON array chuẩn để xử lý',
      'Ngược lại: JSON array → JSONL để streaming line-by-line',
    ],
    howToUse: [
      'Paste JSON vào editor',
      'Bấm 1 trong 6 action button',
      'Output hiện dưới, bấm Copy để lấy',
      'JSONL button smart 2-chiều: tự detect input',
    ],
    examples: [
      {
        title: 'Sort keys giúp diff cleaner',
        input: '{ "z": 1, "a": 2, "m": 3 }',
        output: '{\n  "a": 2,\n  "m": 3,\n  "z": 1\n}',
        note: 'Sort xong 2 JSON, paste vào Diff tab → không còn noise từ order khác nhau.',
      },
      {
        title: 'JSONL smart detect',
        input: 'Editor có: { "fruits": [ {...}, {...}, {...} ] }\n\nBấm JSONL',
        output: '{"name":"Apple","color":"..."}\n{"name":"Banana",...}\n{"name":"Orange",...}',
        note: 'Tool tự thấy `fruits` là array key duy nhất, convert array đó thành JSONL. Không cần chỉ định.',
      },
    ],
    tips: [
      'JSONL fail nếu data có nhiều array key ambiguous (VD `{ a: [], b: [] }`). Tách 1 array ra trước.',
      'Sort keys chỉ sort keys của object. Array giữ nguyên order (index có ý nghĩa).',
      'Nếu JSONL parse fail có link "Vẫn thử parse text hiện tại như JSONL →" để override.',
    ],
  },

  diff: {
    what: 'So sánh 2 JSON structural: liệt kê field nào added / removed / changed. Không phải diff text từng ký tự — mà hiểu cấu trúc object/array.',
    whenToUse: [
      'API v1 vs v2 — xem field nào mới, mất, đổi type',
      'Config trước và sau merge PR',
      'Debug state Redux: dispatch action → snapshot before/after → diff',
      'Verify migration data: bản cũ và bản mới có gì khác',
    ],
    howToUse: [
      'JSON A lấy từ editor bên trái (chung với các tab khác)',
      'JSON B: paste vào textarea pane phải',
      'Bấm "Compute diff"',
      'Kết quả hiện dưới với color code: + xanh (add), - đỏ (remove), ~ vàng (change)',
    ],
    examples: [
      {
        title: 'API v1 vs v2',
        input: 'A (v1): { "id": 1, "name": "Alice", "role": "user" }\nB (v2): { "id": "u001", "name": "Alice", "email": "a@x.com" }',
        output: '~ id: 1 → "u001"     (change type)\n- role: "user"       (removed)\n+ email: "a@x.com"   (added)',
      },
    ],
    tips: [
      'Cap 500 entries — data quá lớn hiện "truncated" indicator, xem entries đầu.',
      'Array so sánh theo index, không phải content matching. Item cùng content khác index vẫn báo change.',
      'Muốn diff order-insensitive → dùng Format Sort keys cho cả 2 trước.',
    ],
  },

  convert: {
    what: 'JSON ↔ YAML / XML / CSV / JSONL. Auto convert khi chọn target format, output ready-to-copy.',
    whenToUse: [
      'Docker Compose / k8s dùng YAML, cần convert từ JSON config sinh sẵn',
      'Data khoa học ở CSV Excel → JSON array of objects để xử lý code',
      'Legacy API XML SOAP → JSON dễ đọc',
      'Log stream JSONL → JSON array để import DB',
    ],
    howToUse: [
      'Source format tự detect từ editor bên trái (JSON/YAML/XML/CSV)',
      'Chọn target format từ dropdown',
      'Output convert tự động, bấm Copy',
    ],
    examples: [
      {
        title: 'JSON → YAML',
        input: '{ "server": { "port": 8080, "host": "localhost" } }',
        output: 'server:\n  port: 8080\n  host: localhost',
      },
      {
        title: 'JSON → CSV',
        input: '[{"id":1,"name":"Apple"},{"id":2,"name":"Banana"}]',
        output: 'id,name\n1,Apple\n2,Banana',
        note: 'CSV cần array of flat objects. Object nested sẽ fail.',
      },
    ],
    tips: [
      'YAML → JSON mất comment YAML (JSON không có comment concept).',
      'XML round-trip có thể mất attribute order, namespace, CDATA. OK cho basic case.',
      'CSV fail với data lồng → chọn 1 array flat trong data trước.',
    ],
  },

  path: {
    what: 'JSONPath tester — gõ expression tìm giá trị trong JSON tree, giống SQL SELECT nhưng cho JSON.',
    whenToUse: [
      'Grep 1 field ở nhiều tầng nested (mọi email, mọi userId, mọi url)',
      'Extract slice data cho code (VD test path trước khi viết trong jq / lodash.get)',
      'Debug: chỉ muốn xem 1 phần data thay vì scroll cả file',
      'Filter theo điều kiện: mọi items có price > 100',
    ],
    howToUse: [
      'Gõ expression vào input top',
      'Auto run debounce 350ms (không cần bấm nút)',
      'Click preset chip điền sẵn expression common',
      'Click path trong result để copy expression cụ thể đến value đó',
      'Copy values button → copy tất cả matched values dạng JSON array',
    ],
    examples: [
      {
        title: 'Tìm mọi name bất kỳ tầng',
        input: 'Expression: $..name\n\nData: { "user": { "name": "A" }, "items": [{ "name": "B" }] }',
        output: '$.user.name → "A"\n$.items[0].name → "B"',
      },
      {
        title: 'Filter theo điều kiện',
        input: 'Expression: $.fruits[?(@.nutrients.calories>50)].name\n\nData có 3 fruits',
        output: '$.fruits[0].name → "Apple" (52 cal)\n$.fruits[1].name → "Banana" (89 cal)\n(Orange 47 cal bị lọc)',
      },
    ],
    cheatsheet: [
      { label: '$', meaning: 'Gốc data' },
      { label: '.field', meaning: 'Xuống key' },
      { label: '..field', meaning: 'Đệ quy mọi tầng có key này' },
      { label: '[0]', meaning: 'Array index' },
      { label: '[*]', meaning: 'Mọi phần tử array' },
      { label: '[-1:]', meaning: 'Phần tử cuối' },
      { label: '[0:3]', meaning: 'Slice index 0-2' },
      { label: '[?(@.x>10)]', meaning: 'Filter: element có x > 10' },
      { label: '$..*', meaning: 'Mọi giá trị' },
    ],
    tips: [
      'Expression rỗng hoặc invalid → error hiện trong preview, không crash.',
      'Result 0 match → hiện Empty state, không phải bug.',
      'Path click-to-copy tiện dán vào code TypeScript như `data.fruits[0].nutrients.calories`.',
    ],
  },

  schema: {
    what: 'JSON Schema validator — check data có đúng "khuôn" bạn định nghĩa không (type, required, format email/uri/uuid, range số...).',
    whenToUse: [
      'Test API response mẫu có match schema backend gửi không',
      'Viết schema mới → paste data mẫu → tinh chỉnh cho đúng',
      'Config file check trước commit (VD `.eslintrc.json` đúng shape chưa)',
      'Validate user input trước khi save DB (nếu có schema in JSON)',
    ],
    howToUse: [
      'Data lấy từ editor bên trái (chung tool)',
      'Schema paste vào pane phải — hoặc bấm Sparkles (Infer) để Kiro tự sinh',
      'Auto validate 400ms sau khi schema/data đổi',
      'Result dưới: valid xanh, invalid liệt kê error với path + message',
    ],
    examples: [
      {
        title: 'Schema với format email',
        input: 'Schema: { "type": "object", "properties": { "email": { "type": "string", "format": "email" } } }\n\nData: { "email": "not-an-email" }',
        output: '/email: must match format "email"',
      },
      {
        title: 'Enum + required',
        input: 'Schema: { "properties": { "status": { "enum": ["pending", "done"] } }, "required": ["status"] }\n\nData: { "status": "unknown" }',
        output: '/status: must be equal to one of the allowed values',
      },
    ],
    tips: [
      'Infer button (Sparkles) sinh schema mẫu từ data — 70% việc, còn 30% bạn thêm enum/pattern/range theo domain.',
      'Cùng 1 data có VÔ HẠN schema hợp lệ. Tool chỉ sinh cái an toàn nhất (type-only). Muốn siết chặt phải sửa tay.',
      'Format có sẵn ajv-formats: email, uri, uuid, date, date-time, time, ipv4, ipv6, hostname, regex.',
      'Schema đã edit tự cache qua tab switch — không mất khi qua tab khác rồi quay lại.',
    ],
    cheatsheet: [
      { label: '"type"', meaning: 'string | number | integer | boolean | null | array | object' },
      { label: '"required"', meaning: 'Array key bắt buộc' },
      { label: '"enum"', meaning: 'Chỉ chấp nhận giá trị trong list' },
      { label: '"format"', meaning: 'email / uri / uuid / date / date-time / ipv4' },
      { label: '"pattern"', meaning: 'Regex string' },
      { label: '"minimum"/"maximum"', meaning: 'Range số' },
      { label: '"minLength"/"maxLength"', meaning: 'Độ dài string/array' },
      { label: '"items"', meaning: 'Schema cho phần tử array' },
      { label: '"oneOf"/"anyOf"', meaning: 'Union type' },
    ],
  },

  ts: {
    what: '2 chiều: JSON → TypeScript interface, hoặc TS interface → JSON Schema. Auto convert khi input đổi.',
    whenToUse: [
      'Copy API response mẫu → có TypeScript interface ngay để paste vào code',
      'Viết TS type xong → sinh JSON Schema để validate runtime (VD form input)',
      'Refactor: JSON đang xử lý cần typing chính xác',
      'Bridge giữa TS type và JSON Schema definition trong OpenAPI',
    ],
    howToUse: [
      'Mode switch top: JSON → TS hoặc TS → Schema',
      'JSON → TS: dùng data từ editor bên trái, output TS interface bên phải',
      'TS → Schema: paste TS text bên trái, output JSON Schema bên phải',
      'Auto convert 350ms sau khi input hoặc mode đổi',
    ],
    examples: [
      {
        title: 'JSON → TS',
        input: '{ "id": 1, "name": "Alice", "tags": ["admin"] }',
        output: 'export interface Root {\n  id: number;\n  name: string;\n  tags: string[];\n}',
      },
      {
        title: 'TS → Schema',
        input: 'interface User {\n  id: number;\n  email?: string;\n}',
        output: '{\n  "type": "object",\n  "properties": {\n    "id": { "type": "number" },\n    "email": { "type": "string" }\n  },\n  "required": ["id"]\n}',
      },
    ],
    tips: [
      'TS → Schema chưa hỗ trợ generic, complex union, import cross-file. Interface đơn giản OK.',
      'JSON → TS auto detect nested object → tách interface riêng, tránh anonymous type.',
      'Empty array → `unknown[]`, cần bạn tự sửa thành type cụ thể theo domain.',
      'Kết quả copy sang code project ngay được, hoặc chỉnh thêm generics/utility types.',
    ],
  },
};