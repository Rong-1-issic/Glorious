export type Mode = "demo" | "imported" | "online";
export type Source = {
  comment_id: string;
  source: string;
  url: string;
  date: string;
  language: string;
};
export type Comment = { id: string; text: string; origins: Source[] };
export type BrandFact = {
  id: string;
  content: string;
  source: string;
  status: string;
  kind: string;
};
export type Insight = {
  id: string;
  text: string;
  category: string;
  commentIds: string[];
  inferred: boolean;
  status: string;
  selected: boolean;
};
export type LocalizationStrategy = {
  id: string;
  original: string;
  question: string;
  factIds: string[];
  difference: string;
  action: string;
  gap: string;
  confirmed: boolean;
};
export type SentenceEvidence = {
  id: string;
  en: string;
  zh: string;
  factIds: string[];
  commentIds: string[];
};
export type RiskFinding = {
  id: string;
  sentenceId: string;
  reason: string;
  level: string;
  suggestion: string;
  scope: string;
  source: string;
};
export type ContentVersion = {
  id: string;
  kind: string;
  title: string;
  sentences: SentenceEvidence[];
  revision: number;
  baseRevision: number;
  checkedRevision: number;
  findings: RiskFinding[];
  history: { at: string; text: string }[];
  pending: string;
};
export type Experiment = {
  id: string;
  question: string;
  audience: string;
  channel: string;
  variable: string;
  metric: string;
  plan: string;
  result: string;
  type: string;
};
export type Project = {
  schemaVersion: 1;
  id: string;
  name: string;
  country: string;
  language: string;
  category: string;
  product: string;
  usage: string;
  audience: string;
  audienceBasis: string;
  channel: string;
  mode: Mode;
  comments: Comment[];
  rawCount: number;
  emptyCount: number;
  facts: BrandFact[];
  insights: Insight[];
  strategies: LocalizationStrategy[];
  versions: ContentVersion[];
  selectedVersion: string;
  experiments: Experiment[];
  upstreamRevision: number;
  contentRevision: number;
  derived: { product: string; social: string; revision: number };
  updatedAt: string;
};
export const uid = (prefix: string) => prefix + "_" + crypto.randomUUID();
export const safeUrl = (v: string) => {
  try {
    const u = new URL(v);
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};
export function blank(): Project {
  return {
    schemaVersion: 1,
    id: uid("project"),
    name: "未命名出海项目",
    country: "美国",
    language: "英语",
    category: "保湿护肤品",
    product: "",
    usage: "日常保湿",
    audience: "",
    audienceBasis: "待验证",
    channel: "独立站",
    mode: "imported",
    comments: [],
    rawCount: 0,
    emptyCount: 0,
    facts: [],
    insights: [],
    strategies: [],
    versions: [],
    selectedVersion: "",
    experiments: [],
    upstreamRevision: 0,
    contentRevision: -1,
    derived: { product: "", social: "", revision: -1 },
    updatedAt: "",
  };
}
export const stopDefault =
  "i me my we our you your the a an and or to of for is it this that in on with was are be as at so very have has but";
export function frequencies(comments: Comment[], n: number, stop: string) {
  const ignored = new Set(stop.toLowerCase().split(/\s+/));
  const map = new Map<
    string,
    { term: string; count: number; ids: Set<string> }
  >();
  for (const c of comments) {
    for (const sentence of c.text.toLowerCase().split(/[.!?;。！？\n]+/)) {
      const words = sentence.match(/[a-z]+(?:'[a-z]+)?/g) || [];
      for (let i = 0; i <= words.length - n; i++) {
        const part = words.slice(i, i + n);
        if (n === 1 && ignored.has(part[0])) continue;
        if (n > 1 && part.every((w) => ignored.has(w))) continue;
        const term = part.join(" ");
        const v = map.get(term) || { term, count: 0, ids: new Set<string>() };
        v.count++;
        v.ids.add(c.id);
        map.set(term, v);
      }
    }
  }
  return [...map.values()]
    .map((x) => ({
      ...x,
      ids: [...x.ids],
      share: comments.length ? x.ids.size / comments.length : 0,
    }))
    .sort(
      (a, b) =>
        b.ids.length - a.ids.length ||
        b.count - a.count ||
        a.term.localeCompare(b.term),
    );
}
export function parseCSV(input: string) {
  if (input.length > 2_000_000) throw Error("文件超过 2 MB");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const text = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || cell === "") quoted = !quoted;
      else throw Error("CSV 引号位置错误");
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("CSV 引号未闭合，请修复后重试");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (rows.length > 5001) throw Error("最多导入 5000 条记录");
  if (!rows.length) throw Error("文件为空");
  const headers = rows.shift()!;
  if (new Set(headers).size !== headers.length)
    throw Error("列名重复，请先修正");
  return { headers, rows };
}
export function ingest(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string>,
) {
  let empty = 0;
  const errors: string[] = [];
  const comments: Comment[] = [];
  rows.forEach((r, i) => {
    if (r.length !== headers.length) {
      errors.push(`第 ${i + 2} 行列数不匹配`);
      return;
    }
    const get = (key: string) => r[headers.indexOf(mapping[key])]?.trim() || "";
    const text = get("text");
    if (!text) {
      empty++;
      errors.push(`第 ${i + 2} 行 text 为空`);
      return;
    }
    comments.push({
      id: uid("comment"),
      text,
      origins: [
        {
          comment_id: get("comment_id") || `row-${i + 2}`,
          source: get("source") || "用户导入",
          url: get("url"),
          date: get("date"),
          language: get("language"),
        },
      ],
    });
  });
  return { comments, empty, errors };
}
export function dedup(items: Comment[]) {
  const map = new Map<string, Comment>();
  for (const c of items) {
    const key = c.text.trim().toLowerCase().replace(/\s+/g, " ");
    const old = map.get(key);
    if (old) old.origins.push(...c.origins);
    else map.set(key, { ...c, origins: [...c.origins] });
  }
  return [...map.values()];
}
export function check(v: ContentVersion, facts: BrandFact[]): RiskFinding[] {
  const out: RiskFinding[] = [];
  for (const s of v.sentences) {
    const add = (reason: string, level: string, suggestion: string) =>
      out.push({
        id: uid("risk"),
        sentenceId: s.id,
        reason,
        level,
        suggestion,
        scope: "英文与中文草稿；本地启发式规则，非法律意见",
        source: "编辑建议 · 2026-10-31；无外部规则库",
      });
    const text = s.en + " " + s.zh;
    const linked = facts.filter((f) => s.factIds.includes(f.id));
    if (/\d|\bcenturies|ancient|千年|百年/i.test(text))
      add(
        "数字、日期、浓度、时间或历史表达需要逐项核对原材料",
        "需处理",
        "删除未核对数字，或补充可追溯材料并人工确认",
      );
    if (
      /cure|heal|eczema|clinically|repair|治疗|治愈|修复|见效|抗炎/i.test(text)
    )
      add(
        "可能涉及功效或医疗性宣称；评论不能证明产品功效",
        "需处理",
        "核对适用市场要求与产品证据，避免无依据功效承诺",
      );
    if (/guarantee|always|everyone|best|100%|保证|所有人|最佳|绝对/i.test(text))
      add("绝对或过度概括表达", "需处理", "限定真实适用范围，移除保证性措辞");
    if (
      /found|tradition|tested|handmade|配方|检测|传承|创立|工艺/i.test(text) &&
      !linked.length
    )
      add(
        "历史、配方、工艺或检测事实未关联品牌依据",
        "需处理",
        "关联明确品牌事实；材料不足则暂不使用",
      );
    if (!linked.length)
      add(
        "本句尚无关联品牌事实，需确认是否仅为编辑性表达",
        "需确认",
        "为事实性句子关联材料；消费者评论仅支持需求",
      );
    if (linked.some((f) => f.status !== "已人工核对"))
      add("引用事实尚未经人工核对", "需确认", "人工核对来源，保留当前核对状态");
    if (/本草|古方|ritual|heritage/i.test(text))
      add(
        "抽象文化表达可能需要解释",
        "需确认",
        "解释具体成分或实际做法，避免文化刻板印象",
      );
    if (/guarantee|cure|best/i.test(s.en) && !/保证|治愈|最佳/.test(s.zh))
      add("英文可能比中文新增或加强原意", "需处理", "逐句对照并弱化新增承诺");
  }
  return out;
}
export function demo(): Project {
  const p = blank();
  p.mode = "demo";
  p.name = "青屿 · 美国市场叙事";
  p.product = "青屿日常保湿霜";
  p.audience = "偏好轻盈肤感、关注成分透明的消费者";
  p.audienceBasis = "演示样本假设，待真实消费者验证";
  const texts = [
    "I want a moisturizer that is not sticky. I read the ingredient list before buying.",
    "Not sticky is important in my morning routine. What does botanical care mean?",
    "I prefer a simple ingredient list and clear instructions.",
    "The texture feels lightweight. I want to know where the ingredients come from.",
    "I am unsure what an ancient formula means. Please explain the actual ingredients.",
    "I want packaging that looks calm and simple, not a medical promise.",
    "I need a moisturizer for my daily routine. Fragrance information matters to me.",
    "Please tell me who makes this and how it is made.",
  ];
  p.comments = texts.map((text, i) => ({
    id: `demo-comment-${i + 1}`,
    text,
    origins: [
      {
        comment_id: `D${i + 1}`,
        source: i % 2 ? "演示访谈" : "演示评论",
        url: "",
        date: `2026-10-${10 + i}`,
        language: "en",
      },
    ],
  }));
  p.rawCount = 8;
  p.facts = [
    {
      id: "demo-fact-1",
      content: "品牌名称为青屿，产品为日常保湿霜。",
      source: "演示品牌资料，不是真实商家证明",
      status: "商家提供，未附证明",
      kind: "产品",
    },
    {
      id: "demo-fact-2",
      content: "演示成分资料列有燕麦提取物。此信息不证明任何功效。",
      source: "演示成分表，不是真实检测报告",
      status: "已附支持材料，待人工核对",
      kind: "成分",
    },
  ];
  p.facts.push(
    {
      id: "demo-fact-3",
      content: "虚构演示人物 Lin 负责整理品牌提供的产品信息与成分说明。",
      source: "虚构人物设定，仅用于演示，不是真实人物经历或授权",
      status: "商家提供，未附证明",
      kind: "人物",
    },
    {
      id: "demo-fact-4",
      content: "虚构演示工作室设于杭州；此地点不是产品产地声明。",
      source: "虚构地点设定，仅用于演示，不证明生产地或原料来源",
      status: "商家提供，未附证明",
      kind: "地方",
    },
    {
      id: "demo-fact-5",
      content:
        "演示信息整理流程为：整理商家成分资料、人工核对标签，再制作产品说明。这不是生产工艺或检测。",
      source: "虚构说明流程，仅用于演示，不是检测或生产记录",
      status: "商家提供，未附证明",
      kind: "工序",
    },
  );
  p.insights = [
    {
      id: "demo-insight-1",
      text: "部分样本明确关心不黏腻的使用感；不能据此声称本产品不黏腻。",
      category: "功能需求",
      commentIds: p.comments.slice(0, 2).map((c) => c.id),
      inferred: false,
      status: "待确认",
      selected: false,
    },
    {
      id: "demo-insight-2",
      text: "消费者希望用具体成分信息理解“本草”表达。",
      category: "购买障碍",
      commentIds: [p.comments[1].id, p.comments[2].id, p.comments[4].id],
      inferred: true,
      status: "待确认",
      selected: false,
    },
    {
      id: "demo-insight-3",
      text: "简洁视觉与透明叙述可能适合作为表达方向，仍需验证。",
      category: "审美偏好",
      commentIds: [p.comments[5].id],
      inferred: true,
      status: "待确认",
      selected: false,
    },
  ];
  return p;
}
export function generate(p: Project): ContentVersion[] {
  if (p.mode !== "demo")
    throw Error(
      "未配置模型 API：自有数据请创建人工草稿，预设演示不用于真实数据。",
    );
  const comments = [
    ...new Set(
      p.insights
        .filter((i) => i.selected && i.status !== "已忽略")
        .flatMap((i) => i.commentIds),
    ),
  ];
  const sentence = (
    en: string,
    zh: string,
    factId: string,
  ): SentenceEvidence => ({
    id: uid("sentence"),
    en,
    zh,
    factIds: [factId],
    commentIds: comments,
  });
  const original = (id: string, expected: string) =>
    p.facts.find((f) => f.id === id && f.content === expected);
  const person = original(
    "demo-fact-3",
    "虚构演示人物 Lin 负责整理品牌提供的产品信息与成分说明。",
  );
  const place = original(
    "demo-fact-4",
    "虚构演示工作室设于杭州；此地点不是产品产地声明。",
  );
  const process = original(
    "demo-fact-5",
    "演示信息整理流程为：整理商家成分资料、人工核对标签，再制作产品说明。这不是生产工艺或检测。",
  );
  const product = original("demo-fact-1", "品牌名称为青屿，产品为日常保湿霜。");
  const ingredient = original(
    "demo-fact-2",
    "演示成分资料列有燕麦提取物。此信息不证明任何功效。",
  );
  return ["A 人物版", "B 地方版", "C 工序版"].map((kind, i) => {
    let sentences: SentenceEvidence[] = [];
    if (product)
      sentences.push(
        sentence(
          "Meet Qingyu, a daily moisturizer.",
          "认识青屿，一款日常保湿霜。",
          product.id,
        ),
      );
    if (i === 0 && person)
      sentences.push(
        sentence(
          "In this fictional demonstration, Lin organizes the product information and ingredient descriptions supplied by the brand.",
          person.content,
          person.id,
        ),
      );
    if (i === 1 && place)
      sentences.push(
        sentence(
          "This fictional demonstration studio is based in Hangzhou. This is not a statement about where the product is made.",
          place.content,
          place.id,
        ),
      );
    if (i === 2 && process)
      sentences.push(
        sentence(
          "In this demonstration, information is prepared by organizing supplied ingredient documents, manually reviewing labels, and creating product descriptions. This is not a manufacturing or testing process.",
          process.content,
          process.id,
        ),
      );
    if (ingredient)
      sentences.push(
        sentence(
          "The supplied demonstration ingredient sheet lists oat extract. This does not establish any product benefit.",
          ingredient.content,
          ingredient.id,
        ),
      );
    const enough = [person, place, process][i];
    if (!enough) sentences = [];
    return {
      id: uid("version"),
      kind,
      title: [
        "让产品信息有一个清晰的讲述者",
        "从杭州工作室，到更清晰的沟通",
        "每一句说明，都从资料开始",
      ][i],
      sentences,
      revision: 1,
      baseRevision: p.upstreamRevision,
      checkedRevision: 0,
      findings: [],
      history: [],
      pending: enough
        ? "演示结果：仅使用演示事实，来源与表达均待真实商家核对；不证明生产地、功效或检测。"
        : [
            "缺少人物身份、经历及授权资料，暂不生成故事。",
            "缺少真实地方联系与来源材料，暂不生成故事。",
            "缺少真实流程材料，暂不生成工序故事。",
          ][i],
    };
  });
}
export function validateProject(v: unknown): Project {
  if (!v || typeof v !== "object") throw Error("项目必须为 JSON 对象");
  const p = v as Project;
  if (p.schemaVersion !== 1) throw Error("不支持的项目版本");
  const strings = [
    "id",
    "name",
    "country",
    "language",
    "category",
    "product",
    "usage",
    "audience",
    "audienceBasis",
    "channel",
    "selectedVersion",
    "updatedAt",
  ];
  for (const k of strings)
    if (typeof (p as unknown as Record<string, unknown>)[k] !== "string")
      throw Error(`项目字段无效：${k}`);
  if (!["demo", "imported", "online"].includes(p.mode) || p.mode === "online")
    throw Error("不支持的模式；在线适配器未实现");
  for (const key of [
    "comments",
    "facts",
    "insights",
    "strategies",
    "versions",
    "experiments",
  ] as const)
    if (!Array.isArray(p[key])) throw Error(`缺少 ${key}`);
  if (p.comments.length > 5000) throw Error("评论超过 5000 条");
  const ids = new Set<string>();
  const reg = (id: string) => {
    if (typeof id !== "string" || !id || ids.has(id))
      throw Error("ID 无效或重复");
    ids.add(id);
  };
  const refs = (arr: string[], known: Set<string>) => {
    if (!Array.isArray(arr) || arr.some((id) => !known.has(id)))
      throw Error("存在无效引用 ID");
  };
  for (const c of p.comments) {
    reg(c.id);
    if (
      typeof c.text !== "string" ||
      !Array.isArray(c.origins) ||
      c.origins.some((o) =>
        ["comment_id", "source", "url", "date", "language"].some(
          (k) =>
            typeof (o as unknown as Record<string, unknown>)[k] !== "string",
        ),
      )
    )
      throw Error("评论结构错误");
  }
  const ci = new Set(p.comments.map((c) => c.id));
  for (const f of p.facts) {
    reg(f.id);
    if (
      ["content", "source", "status", "kind"].some(
        (k) => typeof (f as unknown as Record<string, unknown>)[k] !== "string",
      )
    )
      throw Error("事实结构错误");
  }
  const fi = new Set(p.facts.map((f) => f.id));
  for (const i of p.insights) {
    reg(i.id);
    refs(i.commentIds, ci);
    if (
      typeof i.text !== "string" ||
      typeof i.category !== "string" ||
      typeof i.status !== "string" ||
      typeof i.selected !== "boolean"
    )
      throw Error("洞察结构错误");
  }
  if (p.insights.filter((i) => i.selected).length > 3)
    throw Error("最多三个重点");
  for (const s of p.strategies) {
    reg(s.id);
    refs(s.factIds, fi);
    if (
      ["original", "question", "difference", "action", "gap"].some(
        (k) => typeof (s as unknown as Record<string, unknown>)[k] !== "string",
      )
    )
      throw Error("策略结构错误");
  }
  for (const v of p.versions) {
    reg(v.id);
    if (
      !Number.isFinite(v.baseRevision) ||
      !Number.isFinite(v.revision) ||
      !Number.isFinite(v.checkedRevision) ||
      v.history.some(
        (h) => typeof h.at !== "string" || typeof h.text !== "string",
      )
    )
      throw Error("版本状态错误");
    if (
      typeof v.title !== "string" ||
      typeof v.kind !== "string" ||
      typeof v.pending !== "string" ||
      !Array.isArray(v.sentences) ||
      !Array.isArray(v.findings) ||
      !Array.isArray(v.history)
    )
      throw Error("版本结构错误");
    for (const s of v.sentences) {
      reg(s.id);
      refs(s.factIds, fi);
      refs(s.commentIds, ci);
      if (typeof s.en !== "string" || typeof s.zh !== "string")
        throw Error("句子结构错误");
    }
    for (const r of v.findings) {
      if (
        !v.sentences.some((s) => s.id === r.sentenceId) ||
        ["reason", "suggestion", "scope", "source", "level"].some(
          (k) =>
            typeof (r as unknown as Record<string, unknown>)[k] !== "string",
        )
      )
        throw Error("风险结构错误");
    }
  }
  if (p.selectedVersion && !p.versions.some((v) => v.id === p.selectedVersion))
    throw Error("选定版本不存在");
  for (const e of p.experiments) {
    reg(e.id);
    if (
      [
        "question",
        "audience",
        "channel",
        "variable",
        "metric",
        "plan",
        "result",
        "type",
      ].some(
        (k) => typeof (e as unknown as Record<string, unknown>)[k] !== "string",
      )
    )
      throw Error("实验结构错误");
  }
  if (
    !p.derived ||
    typeof p.derived.product !== "string" ||
    typeof p.derived.social !== "string" ||
    !["rawCount", "emptyCount", "upstreamRevision", "contentRevision"].every(
      (k) => Number.isFinite((p as unknown as Record<string, number>)[k]),
    )
  )
    throw Error("统计结构错误");
  return p;
}
export function evidenceRows(p: Project) {
  return p.versions.flatMap((v) =>
    v.sentences.map((s) => ({
      version_id: v.id,
      sentence_id: s.id,
      en: s.en,
      zh: s.zh,
      fact_ids: s.factIds.join("|"),
      comment_ids: s.commentIds.join("|"),
    })),
  );
}
export function toCSV(rows: Record<string, unknown>[]) {
  const keys = Object.keys(
    rows[0] || {
      version_id: "",
      sentence_id: "",
      en: "",
      zh: "",
      fact_ids: "",
      comment_ids: "",
    },
  );
  const quote = (x: unknown) => {
    let s = String(x ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [keys, ...rows.map((r) => keys.map((k) => r[k]))]
      .map((r) => r.map(quote).join(","))
      .join("\r\n")
  );
}
