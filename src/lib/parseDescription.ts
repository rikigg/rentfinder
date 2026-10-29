const APPLIANCE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /стиральн\w*\s+машин/i, label: "Стиральная машина" },
  { re: /посудомо\w*/i, label: "Посудомойка" },
  { re: /микроволн\w*/i, label: "Микроволновка" },
  { re: /холодильник/i, label: "Холодильник" },
  { re: /кондиционер/i, label: "Кондиционер" },
  { re: /телевизор/i, label: "Телевизор" },
  { re: /духов\w*/i, label: "Духовой шкаф" },
  { re: /варочн\w*\s+панел/i, label: "Варочная панель" },
  { re: /\bплит[аыеу]\b/i, label: "Плита" },
  { re: /вытяжк/i, label: "Вытяжка" },
  { re: /утюг/i, label: "Утюг" },
  { re: /пылесос/i, label: "Пылесос" },
  { re: /фен\b/i, label: "Фен" },
  { re: /интернет|wi-?fi/i, label: "Интернет" },
  { re: /мебель/i, label: "Мебель" },
];

const BUILDING_RE =
  /дом\s*[-–—:]?\s*(монолитн\w*|панельн\w*|кирпичн\w*|блочн\w*|деревянн\w*)/i;
const MOVE_IN_RE =
  /заезд[^.!?\n]{0,40}?(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i;
const TERM_RE =
  /на\s+срок\s+от\s+(\d+)\s+(месяц\w*|год\w*)/i;
const WINDOWS_RE =
  /окна\s*[-–—:]?\s*([а-яё\s,-]+?)(?:\.|$)/i;

export type ParsedDescription = {
  moveIn: string | null;
  term: string | null;
  building: string | null;
  windows: string | null;
  appliances: string[];
  /** Remaining prose with extracted structured bits removed */
  body: string;
};

function stripChunk(text: string, chunk: string | null | undefined): string {
  if (!chunk) return text;
  return text.split(chunk).join(" ").replace(/\s{2,}/g, " ").trim();
}

export function parseDescription(raw: string | null | undefined): ParsedDescription {
  const text = (raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) {
    return {
      moveIn: null,
      term: null,
      building: null,
      windows: null,
      appliances: [],
      body: "",
    };
  }

  let working = text;
  let moveIn: string | null = null;
  let term: string | null = null;
  let building: string | null = null;
  let windows: string | null = null;
  const appliances: string[] = [];

  const moveMatch = working.match(MOVE_IN_RE);
  if (moveMatch) {
    moveIn = moveMatch[1].replace(/\./g, ".");
    working = stripChunk(working, moveMatch[0]);
  }

  const termMatch = working.match(TERM_RE);
  if (termMatch) {
    term = `от ${termMatch[1]} ${termMatch[2]}`;
    working = stripChunk(working, termMatch[0]);
  }

  const buildMatch = working.match(BUILDING_RE);
  if (buildMatch) {
    building = buildMatch[1];
    working = stripChunk(working, buildMatch[0]);
  }

  const winMatch = working.match(WINDOWS_RE);
  if (winMatch) {
    windows = winMatch[1].replace(/\s*,\s*$/, "").trim();
    if (windows) working = stripChunk(working, winMatch[0]);
  }

  // Prefer explicit "Из техники есть:" block, else scan whole text.
  const techSplit = working.split(/из\s+техники\s+есть\s*:?\s*/i);
  let techBlob = "";
  if (techSplit.length > 1) {
    techBlob = techSplit.slice(1).join(" ");
    working = techSplit[0];
  } else {
    techBlob = working;
  }

  for (const { re, label } of APPLIANCE_PATTERNS) {
    if (re.test(techBlob) && !appliances.includes(label)) {
      appliances.push(label);
    }
  }

  if (techSplit.length > 1) {
    // Drop known appliance words from leftover tech blob; keep unknown prose.
    let leftover = techBlob;
    for (const { re } of APPLIANCE_PATTERNS) {
      leftover = leftover.replace(re, " ");
    }
    leftover = leftover
      .replace(/[,;·•]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (leftover.length > 12) {
      working = `${working} ${leftover}`.trim();
    }
  } else if (appliances.length) {
    for (const { re } of APPLIANCE_PATTERNS) {
      working = working.replace(re, " ");
    }
  }

  // Clean leftover punctuation crumbs from extractions.
  working = working
    .replace(/\s*[,;]\s*([.!?])/g, "$1")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { moveIn, term, building, windows, appliances, body: working };
}
