"use client";
import { useState, useEffect } from "react";
import BrandMark from "./brand-mark";
import {
  ArrowUpRight,
  ArrowRight,
  Layers,
  Search,
  Plus,
  Check,
  Download,
  PanelRightClose,
  PanelRightOpen,
  MessageSquare,
  ShieldCheck,
  Globe2,
  Leaf,
  ChevronRight,
  Upload,
  FlaskConical,
  BookOpen,
  Settings2,
  FileText,
  X,
} from "lucide-react";
import {
  Project,
  Comment,
  ContentVersion,
  SentenceEvidence,
  blank,
  demo,
  uid,
  parseCSV,
  ingest,
  dedup,
  frequencies,
  stopDefault,
  generate,
  check,
  safeUrl,
  validateProject,
  evidenceRows,
  toCSV,
} from "@/lib/core";
const steps = [
  "项目设置",
  "消费者洞察",
  "文化差异分析",
  "本地化内容创作",
  "交付与测试",
];
const english = [
  "Project setup",
  "Consumer insight",
  "Cultural analysis",
  "Content studio",
  "Delivery & testing",
];
const download = (name: string, text: string, type = "text/plain") => {
  const u = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
};
export default function App() {
  const [projects, setProjects] = useState<Project[]>([]),
    [id, setId] = useState(""),
    [ready, setReady] = useState(false),
    [step, setStep] = useState(0),
    [notice, setNotice] = useState(""),
    [save, setSave] = useState("尚未保存"),
    [busy, setBusy] = useState(false),
    [drawer, setDrawer] = useState(false),
    [evidence, setEvidence] = useState<{
      title: string;
      comments: string[];
      facts: string[];
      note?: string;
    }>({ title: "让每一句，都有来处", comments: [], facts: [] });
  const [csv, setCsv] = useState<{
      headers: string[];
      rows: string[][];
    } | null>(null),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [importMode, setImportMode] = useState("append"),
    [paste, setPaste] = useState(""),
    [n, setN] = useState(2),
    [stop, setStop] = useState(stopDefault),
    [query, setQuery] = useState(""),
    [manual, setManual] = useState(""),
    [category, setCategory] = useState("功能需求"),
    [picked, setPicked] = useState<string[]>([]),
    [factText, setFactText] = useState(""),
    [factSource, setFactSource] = useState(""),
    [factKind, setFactKind] = useState("产品"),
    [compare, setCompare] = useState(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("storybridge-v1");
      if (raw) {
        const loaded = JSON.parse(raw);
        const ps = loaded.projects.map(validateProject);
        setProjects(ps);
        setId(
          ps.some((p: Project) => p.id === loaded.id)
            ? loaded.id
            : ps[0]?.id || "",
        );
        setSave("已恢复本地项目");
      } else {
        const p = blank();
        setProjects([p]);
        setId(p.id);
      }
    } catch {
      setNotice("本地数据读取失败，未覆盖原始存储。请导入备份或新建项目。");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || !projects.length) return;
    setSave("未保存…");
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          "storybridge-v1",
          JSON.stringify({ projects, id }),
        );
        setSave("已保存到此浏览器");
      } catch {
        setSave("保存失败：浏览器存储空间不足");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [projects, id, ready]);
  const p = projects.find((x) => x.id === id);
  const edit = (fn: (x: Project) => void, upstream = false) => {
    setProjects((ps) =>
      ps.map((v) => {
        if (v.id !== id) return v;
        const next = structuredClone(v);
        fn(next);
        next.updatedAt = new Date().toISOString();
        if (upstream) {
          next.upstreamRevision++;
          next.strategies.forEach((s) => (s.confirmed = false));
        } else if (
          JSON.stringify(next.strategies) !== JSON.stringify(v.strategies)
        ) {
          next.upstreamRevision++;
        }
        return next;
      }),
    );
  };
  const show = (
    title: string,
    comments: string[] = [],
    facts: string[] = [],
    note = "",
  ) => {
    setEvidence({ title, comments, facts, note });
    setDrawer(true);
  };
  const newProject = (isDemo = false) => {
    const v = isDemo ? demo() : blank();
    setProjects((ps) => [...ps, v]);
    setId(v.id);
    setStep(0);
    setCsv(null);
    setPaste("");
    setDrawer(false);
    setPicked([]);
    setNotice(
      isDemo
        ? "演示项目已载入：所有评论、品牌资料及生成结果均为虚构演示。"
        : "空项目已创建",
    );
  };
  const switchProject = (value: string) => {
    setId(value);
    setCsv(null);
    setPaste("");
    setQuery("");
    setPicked([]);
    setDrawer(false);
    setEvidence({ title: "让每一句，都有来处", comments: [], facts: [] });
  };
  const importRows = () => {
    if (!csv || !mapping.text) {
      setNotice("请选择 text 对应字段");
      return;
    }
    if (p?.mode === "demo" && importMode === "append") {
      setNotice("演示与真实数据不能混合。请选择替换，或新建真实项目后追加。");
      return;
    }
    const result = ingest(csv.rows, csv.headers, mapping);
    if (!result.comments.length) {
      setNotice("无有效记录：" + result.errors.join("；"));
      return;
    }
    if (
      (importMode === "append" ? p?.rawCount || 0 : 0) + csv.rows.length >
      5000
    ) {
      setNotice("项目累计最多 5000 条原始记录，请新建项目或替换导入。");
      return;
    }
    edit((v) => {
      const base = importMode === "append" ? v.comments : [];
      v.comments = dedup([...base, ...result.comments]);
      v.rawCount = (importMode === "append" ? v.rawCount : 0) + csv.rows.length;
      v.emptyCount =
        (importMode === "append" ? v.emptyCount : 0) + result.empty;
      v.mode = "imported";
      if (importMode === "replace") {
        v.insights = [];
        v.strategies = [];
        v.versions = [];
        v.selectedVersion = "";
        v.derived = { product: "", social: "", revision: -1 };
      }
    }, true);
    setNotice(
      `成功处理 ${csv.rows.length} 行，接收 ${result.comments.length} 条；${result.errors.length} 条错误。${result.errors.join("；")}`,
    );
    setCsv(null);
  };
  const loadCSV = (text: string) => {
    try {
      const v = parseCSV(text);
      setCsv(v);
      setMapping(
        Object.fromEntries(
          ["text", "comment_id", "source", "url", "date", "language"].map(
            (k) => [k, v.headers.includes(k) ? k : ""],
          ),
        ),
      );
      setNotice("解析成功，请核对字段映射与预览后确认导入");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  async function readFile(file: File | undefined, kind: string) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setNotice("文件过大：上限 2 MB");
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      if (kind === "csv") loadCSV(text);
      if (kind === "facts") {
        setFactText(text);
        setFactSource("文本资料：" + file.name);
        setNotice(
          "资料已填入事实编辑框，请分类、核对并添加；文件上传不等于验证。",
        );
      }
      if (kind === "project") {
        const v = validateProject(JSON.parse(text));
        const remapped = structuredClone(v);
        remapped.id = uid("project");
        setProjects((ps) => [...ps, remapped]);
        switchProject(remapped.id);
        setStep(0);
        setNotice("项目 JSON 校验成功，已作为独立项目导入");
      }
    } catch (e) {
      setNotice("导入失败：" + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <div className="loading">正在恢复工作台…</div>;
  if (!p)
    return (
      <div className="loading">
        <h1>content studio</h1>
        <p>{notice || "暂无项目"}</p>
        <button onClick={() => newProject()}>创建项目</button>
      </div>
    );
  const focus = p.insights.filter((i) => i.selected && i.status !== "已忽略");
  const stale =
    p.versions.length > 0 &&
    p.versions.some((v) => v.baseRevision !== p.upstreamRevision);
  const words = frequencies(p.comments, n, stop)
    .filter((w) => w.term.includes(query.toLowerCase()))
    .slice(0, 60);
  const selected = p.versions.find((v) => v.id === p.selectedVersion);
  const dates = p.comments
    .flatMap((c) => c.origins.map((o) => o.date))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const sourceCounts = Object.entries(
    p.comments
      .flatMap((c) => c.origins)
      .reduce(
        (a, o) => ({ ...a, [o.source]: (a[o.source] || 0) + 1 }),
        {} as Record<string, number>,
      ),
  );
  const editVersion = (vid: string, fn: (v: ContentVersion) => void) =>
    edit((v) => {
      const c = v.versions.find((x) => x.id === vid)!;
      fn(c);
      c.revision++;
      v.derived.revision = -1;
    });
  const addStrategy = () =>
    edit((v) =>
      v.strategies.push({
        id: uid("strategy"),
        original: "",
        question: focus.map((i) => i.text).join("；"),
        factIds: [],
        difference: "待人工判断，不依据语言推断人口属性",
        action: "等待补证",
        gap: "",
        confirmed: false,
      }),
    );
  const exportMD = () => {
    if (!selected) return;
    download(
      "content studio-内容包.md",
      `# ${p.name}\n\n数据模式：${p.mode}；${p.mode === "demo" ? "所有内容为演示结果。" : ""}\n上游状态：${stale ? "已过期" : "当前"}；规则检查：${selected.checkedRevision === selected.revision && selected.baseRevision === p.upstreamRevision ? "本轮已检查" : "未检查或已失效"}\n\n## ${selected.title}\n${selected.sentences.map((s) => `${s.en}\n\n${s.zh}\n\n句子 ${s.id} | 事实 ${s.factIds.join(", ")} | 评论 ${s.commentIds.join(", ")}`).join("\n\n")}\n\n## 产品介绍\n${p.derived.product}\n\n## 社媒短帖\n${p.derived.social}\n\n派生内容状态：${p.derived.revision === selected.revision ? "当前" : "待生成或已过期"}\n\n## 风险与待补证\n${p.versions.map((v) => `${v.kind}: ${v.pending}\n${v.findings.map((r) => r.reason + "；" + r.suggestion).join("\n")}`).join("\n")}\n${p.strategies.map((s) => s.gap).join("\n")}\n\n## 实验卡\n${p.experiments.map((e) => JSON.stringify(e)).join("\n")}\n\n未提供法律合规结论；没有投放数据时暂不能判断。`,
    );
  };
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setStep(0);
          }}
        >
          <span className="brand-icon">
            <BrandMark />
          </span>
          <span>
            content studio<small>CROSS-BORDER CONTENT</small>
          </span>
        </a>
        <div className="workspace-label">
          WORKSPACE <span>个人工作空间</span>
        </div>
        <div className="project-select">
          <span className="project-avatar">{p.name.slice(0, 1)}</span>
          <select
            aria-label="切换项目"
            value={id}
            onChange={(e) => switchProject(e.target.value)}
          >
            {projects.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <button className="new-project" onClick={() => newProject()}>
          <Plus size={15} /> 创建新项目
        </button>
        <div className="nav-label">品牌出海工作流</div>
        <nav>
          {steps.map((s, i) => (
            <button
              key={s}
              className={step === i ? "active" : ""}
              onClick={() => setStep(i)}
            >
              <span className="step-no">0{i + 1}</span>
              <span>
                {s}
                <small>{english[i]}</small>
              </span>
              {step === i && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-icon">
            <ShieldCheck size={19} />
          </div>
          <strong>好故事，经得起追问。</strong>
          <p>
            评论是洞察的起点，
            <br />
            真实资料是表达的底气。
          </p>
          <span className="local-tag">● 数据仅保存在本地浏览器</span>
        </div>
        <div className="profile">
          <span>SB</span>
          <div>
            Hackathon workspace<small>无需登录 · 本地体验</small>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumbs">
            工作空间 <ChevronRight size={13} /> <strong>{p.name}</strong>
          </div>
          <div className="top-meta">
            <span>
              <Globe2 size={14} />
              {p.country} / {p.language}
            </span>
            <span className={"mode " + (p.mode === "demo" ? "demo" : "")}>
              {p.mode === "demo" ? "◈ 演示数据" : "○ 真实导入"}
            </span>
            <span className="save">
              <Check size={13} />
              {save}
            </span>
            <button
              className="icon-button"
              aria-label="切换证据侧栏"
              onClick={() => setDrawer(!drawer)}
            >
              <PanelRightOpen size={19} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">CONTENT STUDIO / 0{step + 1}</div>
              <h1>
                {steps[step]}
                <span>{english[step]}</span>
              </h1>
              <p>
                {
                  [
                    "从真实的声音出发，为你的品牌建立清晰的出海语境。",
                    "看见词语背后的问题，让每一个洞察都能回到原文。",
                    "跨越理解差异，不跨越事实边界。",
                    "用真实资料，讲一个能被理解、也能被追溯的故事。",
                    "把故事与依据一起交付，让验证发生在真实世界。",
                  ][step]
                }
              </p>
            </div>
            <button className="secondary" onClick={() => newProject(true)}>
              <FlaskConical size={16} />
              载入演示项目 <ArrowUpRight size={14} />
            </button>
          </div>
          {p.mode === "demo" && (
            <div className="banner demo-banner">
              <FlaskConical size={17} />
              <div>
                <strong>演示模式</strong> ·
                评论与品牌资料均为虚构样本，故事为预设演示结果，不代表真实 AI
                调用或产品效果。
              </div>
              <span>DEMO</span>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                className="icon-button"
                onClick={() => setNotice("")}
                aria-label="关闭提示"
              >
                <X size={15} />
              </button>
            </div>
          )}
          {busy && <div className="notice">处理中，请稍候…</div>}
          {stale && (
            <div className="warning">
              上游数据已变更：文化策略需重新确认，已有文案与派生内容已过期。请核对后重新生成或人工更新。
            </div>
          )}
          {step === 0 && (
            <>
              <div className="intro-card">
                <div>
                  <span className="pill">让品牌故事，有据可循</span>
                  <h2>
                    从消费者的「为什么」，
                    <br />
                    到品牌的「所以然」。
                  </h2>
                  <p>
                    先认识市场与产品，再导入评论和品牌资料。
                    <br />
                    我们帮你连接需求、文化与事实，不替你编造答案。
                  </p>
                  <div className="intro-flow">
                    <span>消费者评论</span>
                    <ArrowRight size={15} />
                    <span>真实品牌资料</span>
                    <ArrowRight size={15} />
                    <strong>本地化故事</strong>
                  </div>
                </div>
                <div className="bridge-art">
                  <BrandMark className="hero-brand-mark" />
                  <span className="hero-wordmark">CONTENT STUDIO</span>
                  <span className="hero-tagline">
                    CROSS-BORDER CONTENT GENERATION
                  </span>
                  <div className="orbit one" />
                  <div className="orbit two" />
                  <div className="art-card comment-art">
                    <MessageSquare size={19} />
                    <span>
                      “What does botanical
                      <br />
                      care actually mean?”
                    </span>
                    <small>消费者的真实疑问</small>
                  </div>
                  <div className="art-line" />
                  <div className="art-card fact-art">
                    <Leaf size={20} />
                    <span>具体成分 · 可追溯来源</span>
                    <small>用事实连接理解</small>
                  </div>
                  <span className="art-dot" />
                </div>
              </div>
              <div className="section-title">
                <h2>
                  <span>01</span> 项目基本信息
                </h2>
                <span>定义这一次，和谁对话</span>
              </div>
              <section className="card">
                <div className="form-grid">
                  {(
                    [
                      ["项目名称", "name"],
                      ["产品名称", "product"],
                      ["目标国家", "country"],
                      ["输出语言", "language"],
                      ["产品类别", "category"],
                      ["使用场景", "usage"],
                      ["目标消费者", "audience"],
                      ["消费者定位依据", "audienceBasis"],
                    ] as const
                  ).map(([label, key]) => (
                    <label key={key}>
                      {label}
                      <input
                        value={p[key]}
                        placeholder={
                          key === "audienceBasis"
                            ? "说明依据，或填写“待验证”"
                            : "请输入" + label
                        }
                        onChange={(e) =>
                          edit((v) => {
                            v[key] = e.target.value;
                          }, true)
                        }
                      />
                    </label>
                  ))}
                </div>
                <label className="channel-label">使用渠道</label>
                <div className="segmented">
                  {["独立站", "社交媒体", "广告"].map((s) => (
                    <button
                      key={s}
                      className={p.channel === s ? "chosen" : ""}
                      onClick={() =>
                        edit((v) => {
                          v.channel = s;
                        }, true)
                      }
                    >
                      {s === "独立站" ? (
                        <Globe2 size={15} />
                      ) : s === "社交媒体" ? (
                        <MessageSquare size={15} />
                      ) : (
                        <ArrowUpRight size={15} />
                      )}{" "}
                      {s}
                      {p.channel === s && <Check size={14} />}
                    </button>
                  ))}
                </div>
                <p className="hint">
                  {p.country === "美国" && p.language === "英语"
                    ? "当前规则覆盖：美国英语编辑场景的轻量启发式提示；不构成合规审查。"
                    : "此市场或语言尚无专属规则覆盖；英文词频仍可使用，其他内容需人工核对。"}
                </p>
              </section>
              <div className="section-title">
                <h2>
                  <span>02</span> 导入你的资料
                </h2>
                <span>数据有边界，洞察才有意义</span>
              </div>
              <div className="two-col">
                <section className="card import-card">
                  <div className="card-title">
                    <span className="tile">
                      <MessageSquare size={19} />
                    </span>
                    <div>
                      <h3>消费者评论</h3>
                      <p>聆听来自市场的声音</p>
                    </div>
                    <span className="pill neutral">
                      {p.comments.length} 条有效评论
                    </span>
                  </div>
                  <label className="upload">
                    <Upload size={24} />
                    <strong>上传评论 CSV 文件</strong>
                    <span>
                      点击选择文件 · UTF-8 / BOM · 最大 2 MB / 5000 条
                    </span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => {
                        readFile(e.target.files?.[0], "csv");
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    className="text-button"
                    onClick={() =>
                      download(
                        "评论模板.csv",
                        '\uFEFFtext,comment_id,source,url,date,language\r\n"I want a moisturizer that is not sticky.",C1,用户自有评论,,2026-10-31,en',
                        "text/csv",
                      )
                    }
                  >
                    下载 CSV 模板 <Download size={13} />
                  </button>
                  <div className="divider">或粘贴评论文本（每行一条）</div>
                  <textarea
                    aria-label="评论文本"
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                    placeholder="I prefer a simple ingredient list…"
                  />
                  <div className="row">
                    <select
                      aria-label="导入方式"
                      value={importMode}
                      onChange={(e) => setImportMode(e.target.value)}
                    >
                      <option value="append">追加至当前评论</option>
                      <option value="replace">替换评论并清空下游</option>
                    </select>
                    <button
                      className="secondary"
                      onClick={() => {
                        const rows = paste
                          .split(/\r?\n/)
                          .filter(Boolean)
                          .map((t) => [t]);
                        if (!rows.length) {
                          setNotice("请先粘贴评论");
                          return;
                        }
                        if (rows.length > 5000 || paste.length > 2_000_000) {
                          setNotice("超过 5000 条或 2 MB 限制");
                          return;
                        }
                        setCsv({ headers: ["text"], rows });
                        setMapping({ text: "text" });
                      }}
                    >
                      预览导入
                    </button>
                  </div>
                  <p className="hint">
                    仅导入你有权使用的资料；请先去除姓名、邮箱等个人信息。
                  </p>
                </section>
                <section className="card import-card">
                  <div className="card-title">
                    <span className="tile">
                      <BookOpen size={19} />
                    </span>
                    <div>
                      <h3>品牌事实资料</h3>
                      <p>让每一个表达都有真实的底稿</p>
                    </div>
                  </div>
                  <label>
                    事实内容
                    <textarea
                      value={factText}
                      onChange={(e) => setFactText(e.target.value)}
                      placeholder="如：成分表列有燕麦提取物。每条事实尽量保持单一、具体。"
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      材料或来源
                      <input
                        value={factSource}
                        onChange={(e) => setFactSource(e.target.value)}
                        placeholder="文件名、资料位置或来源说明"
                      />
                    </label>
                    <label>
                      资料类型
                      <select
                        value={factKind}
                        onChange={(e) => setFactKind(e.target.value)}
                      >
                        {["产品", "成分", "人物", "地方", "工序", "其他"].map(
                          (k) => (
                            <option key={k}>{k}</option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                  <div className="row">
                    <label className="file-button">
                      <Upload size={14} /> 导入 TXT
                      <input
                        type="file"
                        accept=".txt"
                        onChange={(e) => {
                          readFile(e.target.files?.[0], "facts");
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      className="primary"
                      onClick={() => {
                        if (!factText.trim()) {
                          setNotice("请填写事实内容");
                          return;
                        }
                        edit(
                          (v) =>
                            v.facts.push({
                              id: uid("fact"),
                              content: factText.trim(),
                              source: factSource,
                              status: factSource
                                ? "已附支持材料，待人工核对"
                                : "商家提供，未附证明",
                              kind: factKind,
                            }),
                          true,
                        );
                        setFactText("");
                        setFactSource("");
                        setNotice("事实已添加；资料来源不代表事实已验证");
                      }}
                    >
                      <Plus size={15} />
                      添加事实
                    </button>
                  </div>
                  <p className="hint">
                    上传不等于核验。请在文化分析模块逐条人工核对。
                  </p>
                  <div className="mini-status">
                    <ShieldCheck size={16} />
                    已添加 {p.facts.length} 条事实 ·{" "}
                    {p.facts.filter((f) => f.status === "已人工核对").length}{" "}
                    条人工核对
                  </div>
                </section>
              </div>
              {csv && (
                <section className="card">
                  <h3>字段映射与导入预览 · {csv.rows.length} 行</h3>
                  <div className="form-grid">
                    {[
                      "text",
                      "comment_id",
                      "source",
                      "url",
                      "date",
                      "language",
                    ].map((k) => (
                      <label key={k}>
                        {k}
                        {k === "text" ? " *（必填）" : ""}
                        <select
                          value={mapping[k] || ""}
                          onChange={(e) =>
                            setMapping({ ...mapping, [k]: e.target.value })
                          }
                        >
                          <option value="">未映射</option>
                          {csv.headers.map((h) => (
                            <option key={h}>{h}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {csv.headers.map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csv.rows.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            {r.map((c, j) => (
                              <td key={j}>{c}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="hint">
                    预览前 5
                    行。无效行会列出错误；有效记录继续处理。同文评论合并并保留全部来源。替换会清空旧洞察、策略及文案。
                  </p>
                  <div className="row">
                    <button className="secondary" onClick={() => setCsv(null)}>
                      取消
                    </button>
                    <button className="primary" onClick={importRows}>
                      确认{importMode === "replace" ? "替换" : "追加"}导入
                    </button>
                  </div>
                </section>
              )}
              <div className="adapter-note">
                <Globe2 size={19} />
                <div>
                  <strong>在线采集适配器：尚未接入</strong>
                  <p>
                    当前不提供平台抓取或模型 API。请使用 CSV /
                    文本导入，不会模拟连接成功。
                  </p>
                </div>
              </div>
              <section className="card compact">
                <h3>项目文件与数据管理</h3>
                <div className="row wrap">
                  <label className="file-button">
                    <Upload size={14} />
                    导入项目 JSON
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        readFile(e.target.files?.[0], "project");
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        "content studio-project.json",
                        JSON.stringify(p, null, 2),
                        "application/json",
                      )
                    }
                  >
                    备份项目 JSON
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (
                        confirm(
                          "确认删除当前项目及其本地数据？此操作不可撤销，请先导出备份。",
                        )
                      ) {
                        const next = projects.filter((x) => x.id !== id);
                        if (!next.length) next.push(blank());
                        setProjects(next);
                        switchProject(next[0].id);
                        setNotice(
                          "当前项目已删除；导出文件和其他浏览器中的副本不受影响。",
                        );
                      }
                    }}
                  >
                    删除当前项目
                  </button>
                </div>
                <p className="hint">
                  评论及事实保存在此浏览器
                  localStorage；不会上传服务器。导出文件保存至浏览器下载目录；不包含密钥。
                </p>
              </section>
            </>
          )}
          {step === 1 && (
            <>
              <div className="stats">
                {[
                  ["原始记录", p.rawCount],
                  ["有效独立评论", p.comments.length],
                  [
                    "重复来源记录",
                    Math.max(
                      0,
                      p.comments.reduce((a, c) => a + c.origins.length, 0) -
                        p.comments.length,
                    ),
                  ],
                  ["空值记录", p.emptyCount],
                ].map(([k, v]) => (
                  <div className="card" key={k}>
                    <span>{k}</span>
                    <strong>
                      {v}
                      <small>条</small>
                    </strong>
                  </div>
                ))}
              </div>
              <section className="card">
                <h3>样本范围</h3>
                <p>
                  仅代表本项目导入样本，不代表市场整体。来源：
                  {sourceCounts
                    .map(([k, v]) => `${k} ${v} 条来源记录`)
                    .join(" / ") || "暂无"}
                  。
                </p>
                <p className="hint">
                  有效日期范围：
                  {dates.length ? `${dates[0]} — ${dates.at(-1)}` : "未提供"}；
                  {
                    p.comments.flatMap((c) => c.origins).filter((o) => !o.date)
                      .length
                  }{" "}
                  条来源缺少日期。无效行在导入时报告，不计入有效样本。语言不能推断国籍、年龄、肤色或收入。
                </p>
              </section>
              <section className="card">
                <div className="card-title">
                  <h3>词频与短语</h3>
                  <span className="pill">EN · 英文规则分词</span>
                </div>
                <div className="row wrap">
                  <div className="segmented">
                    {[1, 2, 3].map((x) => (
                      <button
                        key={x}
                        className={n === x ? "chosen" : ""}
                        onClick={() => setN(x)}
                      >
                        {x === 1 ? "单词" : x + " 词短语"}
                      </button>
                    ))}
                  </div>
                  <div className="search">
                    <Search size={16} />
                    <input
                      aria-label="关键词搜索"
                      placeholder="搜索词语"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>
                <details>
                  <summary>停用词设置</summary>
                  <textarea
                    aria-label="停用词"
                    value={stop}
                    onChange={(e) => setStop(e.target.value)}
                  />
                </details>
                <p className="hint">
                  按涉及独立评论数排序；占比的分母为 {p.comments.length}{" "}
                  条有效独立评论。短语在句内连续提取，不移除内部停用词，保留 not
                  sticky。频率不代表喜爱、情绪或功效。仅支持英文规则分词。
                </p>
                {words.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>词语 / 短语</th>
                          <th>出现次数</th>
                          <th>涉及评论</th>
                          <th>样本占比</th>
                          <th>原文追溯</th>
                        </tr>
                      </thead>
                      <tbody>
                        {words.map((w) => (
                          <tr key={w.term}>
                            <td>
                              <button
                                className="term"
                                onClick={() => show(w.term, w.ids)}
                              >
                                {w.term}
                              </button>
                            </td>
                            <td>{w.count}</td>
                            <td>{w.ids.length}</td>
                            <td>
                              <div className="bar">
                                <i style={{ width: w.share * 100 + "%" }} />
                              </div>
                              {(w.share * 100).toFixed(1)}%
                            </td>
                            <td>
                              <button
                                className="text-button"
                                onClick={() => show(w.term, w.ids)}
                              >
                                查看 {w.ids.length} 条{" "}
                                <ArrowUpRight size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty">
                    <Search />
                    没有匹配结果；请导入英文评论或调整搜索。
                  </div>
                )}
              </section>
              <section className="card">
                <div className="card-title">
                  <h3>需求洞察</h3>
                  <span className="pill">已选 {focus.length} / 3 个重点</span>
                </div>
                <p className="hint">
                  演示洞察为预设分析。自有数据请手动记录，不会将词频冒充 AI
                  分析。
                </p>
                {p.insights.map((i) => (
                  <div className="insight" key={i.id}>
                    <div className="row">
                      <span className="pill">{i.category}</span>
                      <span className="hint">
                        {i.inferred ? "推断 · 待验证" : "样本明确表达"} ·{" "}
                        {i.commentIds.length} 条支持评论
                      </span>
                    </div>
                    <textarea
                      aria-label="洞察描述"
                      value={i.text}
                      onChange={(e) =>
                        edit((v) => {
                          v.insights.find((x) => x.id === i.id)!.text =
                            e.target.value;
                        }, true)
                      }
                    />
                    <div className="row wrap">
                      <button
                        className="text-button"
                        onClick={() => show("洞察原始证据", i.commentIds)}
                      >
                        查看证据 <ArrowUpRight size={13} />
                      </button>
                      {["商家已确认", "已忽略"].map((s) => (
                        <button
                          className={i.status === s ? "primary" : "secondary"}
                          key={s}
                          onClick={() =>
                            edit((v) => {
                              const x = v.insights.find((x) => x.id === i.id)!;
                              x.status = s;
                              if (s === "已忽略") x.selected = false;
                            }, true)
                          }
                        >
                          {s === "已忽略" ? "忽略" : "确认洞察"}
                        </button>
                      ))}
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={i.selected}
                          disabled={i.status === "已忽略"}
                          onChange={(e) => {
                            if (e.target.checked && focus.length >= 3) {
                              setNotice("最多选择三个重点问题");
                              return;
                            }
                            edit((v) => {
                              v.insights.find((x) => x.id === i.id)!.selected =
                                e.target.checked;
                            }, true);
                          }}
                        />
                        传入下一步
                      </label>
                    </div>
                  </div>
                ))}
                <div className="form-grid">
                  <label>
                    手动洞察
                    <textarea
                      value={manual}
                      onChange={(e) => setManual(e.target.value)}
                      placeholder="写下需求或疑问，选择原始评论作为依据"
                    />
                  </label>
                  <label>
                    洞察分类
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {[
                        "功能需求",
                        "使用场景",
                        "购买障碍",
                        "审美偏好",
                        "情感诉求",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <span className="hint">
                      手动洞察默认标为推断，需商家确认。
                    </span>
                  </label>
                </div>
                <details>
                  <summary>选择支持评论（{picked.length}）</summary>
                  {p.comments.map((c) => (
                    <label className="check-label comment-pick" key={c.id}>
                      <input
                        type="checkbox"
                        checked={picked.includes(c.id)}
                        onChange={(e) =>
                          setPicked(
                            e.target.checked
                              ? [...picked, c.id]
                              : picked.filter((x) => x !== c.id),
                          )
                        }
                      />
                      {c.origins[0].comment_id} · {c.text}
                    </label>
                  ))}
                </details>
                <button
                  className="secondary"
                  onClick={() => {
                    if (!manual.trim() || !picked.length) {
                      setNotice("请填写洞察并选择至少一条支持评论");
                      return;
                    }
                    edit(
                      (v) =>
                        v.insights.push({
                          id: uid("insight"),
                          text: manual,
                          category,
                          commentIds: picked,
                          inferred: true,
                          status: "待确认",
                          selected: false,
                        }),
                      true,
                    );
                    setManual("");
                    setPicked([]);
                  }}
                >
                  <Plus size={14} />
                  添加人工洞察
                </button>
              </section>
            </>
          )}
          {step === 2 && (
            <>
              <Focus items={focus.map((i) => i.text)} />
              <section className="card">
                <h3>
                  品牌事实库 <span className="hint">上传资料 ≠ 验证事实</span>
                </h3>
                {!p.facts.length && (
                  <div className="empty">
                    尚无事实，请先在项目设置中添加资料。
                  </div>
                )}
                {p.facts.map((f) => (
                  <div className="fact-row" key={f.id}>
                    <code>{f.id}</code>
                    <label>
                      事实内容
                      <textarea
                        value={f.content}
                        onChange={(e) =>
                          edit((v) => {
                            v.facts.find((x) => x.id === f.id)!.content =
                              e.target.value;
                          }, true)
                        }
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        材料或来源
                        <input
                          value={f.source}
                          onChange={(e) =>
                            edit((v) => {
                              v.facts.find((x) => x.id === f.id)!.source =
                                e.target.value;
                            }, true)
                          }
                        />
                      </label>
                      <label>
                        核对状态
                        <select
                          value={f.status}
                          onChange={(e) =>
                            edit((v) => {
                              v.facts.find((x) => x.id === f.id)!.status =
                                e.target.value;
                            }, true)
                          }
                        >
                          {[
                            "商家提供，未附证明",
                            "已附支持材料，待人工核对",
                            "已人工核对",
                          ].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </section>
              <section className="card">
                <div className="card-title">
                  <h3>表达转译对照表</h3>
                  <button className="secondary" onClick={addStrategy}>
                    <Plus size={15} />
                    添加策略
                  </button>
                </div>
                <p className="hint">
                  示例：“本草养肤” → 解释具体成分，功效另查证据。“千年古方” →
                  无历史来源则等待补证，不编造年份。
                </p>
                {!p.strategies.length && (
                  <div className="empty">
                    尚无策略，添加一条并确认后进入创作。
                  </div>
                )}
                {p.strategies.map((s) => (
                  <div className="strategy" key={s.id}>
                    <div className="form-grid">
                      {(
                        [
                          ["中文原表达", "original"],
                          ["消费者疑问", "question"],
                          ["文化理解差异", "difference"],
                          ["待补证问题", "gap"],
                        ] as const
                      ).map(([label, key]) => (
                        <label key={key}>
                          {label}
                          <textarea
                            value={s[key]}
                            onChange={(e) =>
                              edit((v) => {
                                const x = v.strategies.find(
                                  (x) => x.id === s.id,
                                )!;
                                x[key] = e.target.value;
                                x.confirmed = false;
                              })
                            }
                          />
                        </label>
                      ))}
                      <label>
                        转译策略
                        <select
                          value={s.action}
                          onChange={(e) =>
                            edit((v) => {
                              const x = v.strategies.find(
                                (x) => x.id === s.id,
                              )!;
                              x.action = e.target.value;
                              x.confirmed = false;
                            })
                          }
                        >
                          {[
                            "保留",
                            "解释",
                            "具体化",
                            "弱化",
                            "删除",
                            "等待补证",
                          ].map((k) => (
                            <option key={k}>{k}</option>
                          ))}
                        </select>
                      </label>
                      <div>
                        <label>可用品牌事实</label>
                        {p.facts.map((f) => (
                          <label className="check-label" key={f.id}>
                            <input
                              type="checkbox"
                              checked={s.factIds.includes(f.id)}
                              onChange={(e) =>
                                edit((v) => {
                                  const x = v.strategies.find(
                                    (x) => x.id === s.id,
                                  )!;
                                  x.factIds = e.target.checked
                                    ? [...x.factIds, f.id]
                                    : x.factIds.filter((id) => id !== f.id);
                                  x.confirmed = false;
                                })
                              }
                            />
                            {f.content}
                          </label>
                        ))}
                      </div>
                    </div>
                    <button
                      className={s.confirmed ? "primary" : "secondary"}
                      onClick={() => {
                        if (!s.original.trim() || !s.question.trim()) {
                          setNotice("请填写原表达与消费者疑问");
                          return;
                        }
                        edit((v) => {
                          v.strategies.find((x) => x.id === s.id)!.confirmed =
                            !s.confirmed;
                        });
                      }}
                    >
                      <Check size={15} />
                      {s.confirmed ? "已确认策略 · 点击撤回" : "确认此策略"}
                    </button>
                  </div>
                ))}
              </section>
            </>
          )}
          {step === 3 && (
            <>
              <Focus items={focus.map((i) => i.text)} />
              <div className="banner">
                <ShieldCheck size={19} />
                <div>
                  <strong>以事实为边界的创作</strong>
                  <p>
                    当前未配置模型
                    API。演示项目可使用预设结构；自有数据请创建人工草稿。评论只解释需求，不证明品牌事实。
                  </p>
                </div>
              </div>
              <section className="card">
                <div className="row wrap">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        !p.strategies.length ||
                        p.strategies.some((s) => !s.confirmed)
                      ) {
                        setNotice("请先添加并确认文化表达策略");
                        return;
                      }
                      if (p.mode !== "demo") {
                        setNotice(
                          "未配置模型 API：不能生成真实 AI 结果，请使用人工草稿。",
                        );
                        return;
                      }
                      setBusy(true);
                      await new Promise((r) => setTimeout(r, 450));
                      try {
                        const versions = generate(p);
                        edit((v) => {
                          v.versions.push(...versions);
                          v.contentRevision = v.upstreamRevision;
                        });
                        setNotice(
                          "已创建三版演示结构；人物与地方资料不足，未编造内容。",
                        );
                      } catch (e) {
                        setNotice((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Layers size={16} />
                    {busy
                      ? "正在创建…"
                      : p.versions.length
                        ? "重新生成三版演示"
                        : "生成三版演示故事"}
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      edit((v) => {
                        v.versions.push({
                          id: uid("version"),
                          kind: "人工草稿",
                          title: "待编辑故事",
                          sentences: [
                            {
                              id: uid("sentence"),
                              en: "",
                              zh: "",
                              factIds: [],
                              commentIds: focus.flatMap((i) => i.commentIds),
                            },
                          ],
                          revision: 1,
                          baseRevision: v.upstreamRevision,
                          checkedRevision: 0,
                          findings: [],
                          history: [],
                          pending: "人工编辑，请仅使用已提供事实",
                        });
                        v.contentRevision = v.upstreamRevision;
                      })
                    }
                  >
                    <Plus size={15} />
                    创建人工草稿
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setCompare(!compare)}
                  >
                    {compare ? "切换逐版查看" : "三版并排比较"}
                  </button>
                </div>
                <p className="hint">
                  已确认策略：
                  {p.strategies
                    .filter((s) => s.confirmed)
                    .map((s) => `${s.original} → ${s.action}`)
                    .join("；") || "暂无"}
                  。生成不调用任何外部模型。
                </p>
              </section>
              {!p.versions.length && (
                <div className="empty card">
                  <FileText />
                  尚无内容。确认策略后生成演示，或创建人工草稿。
                </div>
              )}
              <div className={compare ? "studio-grid" : ""}>
                {p.versions.map((v) => (
                  <section
                    className={
                      "card story-card " +
                      (p.selectedVersion === v.id ? "selected" : "")
                    }
                    key={v.id}
                  >
                    <div className="row">
                      <span className="pill">{v.kind}</span>
                      <small>
                        {p.mode === "demo" ? "演示结果" : "人工编辑"} · r
                        {v.revision}
                      </small>
                    </div>
                    <input
                      className="story-title"
                      aria-label="故事标题"
                      value={v.title}
                      onChange={(e) =>
                        editVersion(v.id, (x) => {
                          x.title = e.target.value;
                        })
                      }
                    />
                    <div className="warning">{v.pending}</div>
                    {v.sentences.map((s, i) => (
                      <div className="sentence" key={s.id}>
                        <div className="row">
                          <code>句子 {i + 1}</code>
                          <button
                            className="text-button"
                            onClick={() =>
                              show(
                                "句子依据",
                                s.commentIds,
                                s.factIds,
                                "评论仅支持需求。关联由编辑者确认，不代表自动事实核验。",
                              )
                            }
                          >
                            查看依据 <ArrowUpRight size={13} />
                          </button>
                        </div>
                        <label>
                          EN
                          <textarea
                            value={s.en}
                            onChange={(e) =>
                              editVersion(v.id, (x) => {
                                x.sentences.find((t) => t.id === s.id)!.en =
                                  e.target.value;
                              })
                            }
                          />
                        </label>
                        <label>
                          中文对照
                          <textarea
                            value={s.zh}
                            onChange={(e) =>
                              editVersion(v.id, (x) => {
                                x.sentences.find((t) => t.id === s.id)!.zh =
                                  e.target.value;
                              })
                            }
                          />
                        </label>
                        <details>
                          <summary>关联品牌事实与评论</summary>
                          {p.facts.map((f) => (
                            <label className="check-label" key={f.id}>
                              <input
                                type="checkbox"
                                checked={s.factIds.includes(f.id)}
                                onChange={(e) =>
                                  editVersion(v.id, (x) => {
                                    const t = x.sentences.find(
                                      (t) => t.id === s.id,
                                    )!;
                                    t.factIds = e.target.checked
                                      ? [...t.factIds, f.id]
                                      : t.factIds.filter((id) => id !== f.id);
                                  })
                                }
                              />
                              {f.content}
                            </label>
                          ))}
                          {p.comments.map((c) => (
                            <label className="check-label" key={c.id}>
                              <input
                                type="checkbox"
                                checked={s.commentIds.includes(c.id)}
                                onChange={(e) =>
                                  editVersion(v.id, (x) => {
                                    const t = x.sentences.find(
                                      (t) => t.id === s.id,
                                    )!;
                                    t.commentIds = e.target.checked
                                      ? [...t.commentIds, c.id]
                                      : t.commentIds.filter(
                                          (id) => id !== c.id,
                                        );
                                  })
                                }
                              />
                              {c.origins[0].comment_id} · {c.text}
                            </label>
                          ))}
                        </details>
                      </div>
                    ))}
                    <button
                      className="text-button"
                      onClick={() =>
                        editVersion(v.id, (x) =>
                          x.sentences.push({
                            id: uid("sentence"),
                            en: "",
                            zh: "",
                            factIds: [],
                            commentIds: focus.flatMap((i) => i.commentIds),
                          }),
                        )
                      }
                    >
                      <Plus size={14} />
                      添加句子
                    </button>
                    <div className="row wrap actions">
                      <button
                        className="secondary"
                        disabled={!v.sentences.some((s) => s.en || s.zh)}
                        onClick={() =>
                          edit((x) => {
                            const t = x.versions.find((t) => t.id === v.id)!;
                            t.findings = check(t, x.facts);
                            t.checkedRevision = t.revision;
                          })
                        }
                      >
                        <ShieldCheck size={14} />
                        重新检查
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          edit((x) =>
                            x.versions
                              .find((t) => t.id === v.id)!
                              .history.push({
                                at: new Date().toISOString(),
                                text: JSON.stringify(v.sentences),
                              }),
                          );
                          setNotice("版本快照已保存");
                        }}
                      >
                        保存版本
                      </button>
                      <button
                        className={
                          p.selectedVersion === v.id ? "primary" : "secondary"
                        }
                        disabled={!v.sentences.some((s) => s.en.trim())}
                        onClick={() =>
                          edit((x) => {
                            x.selectedVersion = v.id;
                            x.derived.revision = -1;
                          })
                        }
                      >
                        {p.selectedVersion === v.id ? "已选定" : "选定此版"}
                      </button>
                    </div>
                    {v.baseRevision !== p.upstreamRevision && (
                      <button
                        className="secondary"
                        onClick={() => {
                          if (p.strategies.some((s) => !s.confirmed)) {
                            setNotice("请先重新确认文化策略");
                            return;
                          }
                          if (
                            confirm(
                              "确认已逐句复核这份草稿与最新品牌资料？此操作只更新数据版本，仍需重新检查文案。",
                            )
                          )
                            editVersion(v.id, (x) => {
                              x.baseRevision = p.upstreamRevision;
                            });
                        }}
                      >
                        已核对上游，更新此稿
                      </button>
                    )}
                    <div className="check-status">
                      {v.checkedRevision !== v.revision ||
                      v.baseRevision !== p.upstreamRevision
                        ? "检查未运行或旧结果已失效，请重新检查"
                        : v.findings.length
                          ? `本轮发现 ${v.findings.length} 项，需处理 / 需确认`
                          : "本轮未检出问题（不代表事实正确或保证合规）"}
                    </div>
                    {v.checkedRevision === v.revision &&
                      v.baseRevision === p.upstreamRevision &&
                      v.findings.map((r) => (
                        <button
                          className="risk"
                          key={r.id}
                          onClick={() => {
                            const s = v.sentences.find(
                              (s) => s.id === r.sentenceId,
                            )!;
                            show(
                              r.reason,
                              s.commentIds,
                              s.factIds,
                              `${s.en} / ${s.zh}\n${r.scope}\n${r.suggestion}\n${r.source}`,
                            );
                          }}
                        >
                          <strong>{r.level}</strong> · {r.reason}
                          <small>{r.suggestion}</small>
                        </button>
                      ))}
                    <details>
                      <summary>
                        已保存快照 / 变更记录（{v.history.length}）
                      </summary>
                      {v.history.map((h, i) => (
                        <div className="history" key={i}>
                          <small>{h.at}</small>
                          <pre>{h.text}</pre>
                        </div>
                      ))}
                    </details>
                  </section>
                ))}
              </div>
              <section className="card">
                <h3>从已选故事派生</h3>
                <p className="hint">
                  本地摘录与重排，不使用模型新增事实；使用所选故事原句。英文与中文草稿需一起人工复核。
                </p>
                <button
                  className="secondary"
                  disabled={!selected}
                  onClick={() => {
                    if (!selected) return;
                    edit((v) => {
                      v.derived = {
                        product: selected.sentences
                          .map((s) => s.en + "\n" + s.zh)
                          .join("\n\n"),
                        social: selected.sentences
                          .slice(0, 1)
                          .map((s) => s.en + "\n" + s.zh)
                          .join(""),
                        revision: selected.revision,
                      };
                    });
                    setNotice("已从选定故事原句派生内容，未新增事实。");
                  }}
                >
                  派生产品介绍与社媒短帖
                </button>
                {selected && (
                  <>
                    <p className="hint">
                      {p.derived.revision === selected.revision
                        ? "派生内容与所选版本一致"
                        : "尚未派生或原稿已变更，请重新派生"}
                    </p>
                    <div className="form-grid">
                      <label>
                        产品介绍
                        <textarea readOnly value={p.derived.product} />
                      </label>
                      <label>
                        社媒短帖
                        <textarea readOnly value={p.derived.social} />
                      </label>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
          {step === 4 && (
            <>
              <section className="card">
                <div className="card-title">
                  <span className="tile">
                    <Download size={21} />
                  </span>
                  <div>
                    <h3>把故事和依据，一起交付</h3>
                    <p>完整导出当前项目，不受词频搜索和页面筛选影响。</p>
                  </div>
                </div>
                <div className="delivery-summary">
                  <span>选定故事</span>
                  <h2>{selected?.title || "尚未选择故事"}</h2>
                  <p>
                    {stale
                      ? "上游内容已过期，请先更新。"
                      : selected
                        ? "导出前请复核事实、检查状态与所有待补证项。"
                        : "请在内容创作中选定一个有内容的版本。"}
                  </p>
                </div>
                <div className="row wrap">
                  <button
                    className="primary"
                    disabled={!selected}
                    onClick={exportMD}
                  >
                    <Download size={15} />
                    Markdown 内容包
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        "content studio-证据映射.csv",
                        toCSV(evidenceRows(p)),
                        "text/csv",
                      )
                    }
                  >
                    句子证据 CSV
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        "content studio-project.json",
                        JSON.stringify(p, null, 2),
                        "application/json",
                      )
                    }
                  >
                    完整项目 JSON
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        "content studio-实验卡.csv",
                        toCSV(
                          p.experiments.map((e) => ({
                            ...e,
                            conclusion: "暂不能判断",
                          })),
                        ),
                        "text/csv",
                      )
                    }
                  >
                    实验卡 CSV
                  </button>
                </div>
                <p className="hint">
                  Markdown
                  包含选定故事、双语文本、派生内容、风险与待补证事项及实验卡。JSON
                  包含所有版本、完整评论来源和事实。PDF 暂未实现。
                </p>
              </section>
              <section className="card">
                <div className="card-title">
                  <h3>三版本实验卡</h3>
                  <button
                    className="secondary"
                    onClick={() => {
                      edit((v) => {
                        v.experiments = [
                          "A 人物版",
                          "B 地方版",
                          "C 工序版",
                        ].map((kind) => ({
                          id: uid("experiment"),
                          question: "哪种叙事更有助于理解品牌？",
                          audience: v.audience || "待验证",
                          channel: v.channel,
                          variable: kind + "叙事角度（其他条件保持一致）",
                          metric: "理解度问卷与可信度反馈",
                          plan: "同一招募条件，随机分组；先设定样本量与观察周期。",
                          result: "",
                          type: "真实用户反馈",
                        }));
                      });
                      setNotice("已创建三张空实验卡，未生成虚假结果");
                    }}
                  >
                    创建 / 重建三版实验卡
                  </button>
                </div>
                <p className="hint">
                  不自动生成点击率、转化率或胜者。模型预评估、真实反馈与真实投放分别记录。重建会替换已有实验卡。
                </p>
                {!p.experiments.length && (
                  <div className="empty">
                    尚未开始实验。创建实验卡，先定义如何验证。
                  </div>
                )}
                {p.experiments.map((e, i) => (
                  <div className="experiment" key={e.id}>
                    <h3>
                      0{i + 1} · {e.variable.split("（")[0]}
                    </h3>
                    <div className="form-grid">
                      {(
                        [
                          ["验证问题", "question"],
                          ["目标受众", "audience"],
                          ["渠道", "channel"],
                          ["唯一变化项", "variable"],
                          ["主要指标", "metric"],
                          ["观察计划", "plan"],
                          ["结果录入", "result"],
                        ] as const
                      ).map(([label, key]) => (
                        <label key={key}>
                          {label}
                          <textarea
                            value={e[key]}
                            placeholder={
                              key === "result"
                                ? "尚无数据，请记录来源、日期、样本量及原始结果"
                                : ""
                            }
                            onChange={(ev) =>
                              edit((v) => {
                                v.experiments.find((x) => x.id === e.id)![key] =
                                  ev.target.value;
                              })
                            }
                          />
                        </label>
                      ))}
                      <label>
                        证据类型
                        <select
                          value={e.type}
                          onChange={(ev) =>
                            edit((v) => {
                              v.experiments.find((x) => x.id === e.id)!.type =
                                ev.target.value;
                            })
                          }
                        >
                          {["模型预评估", "真实用户反馈", "真实投放数据"].map(
                            (t) => (
                              <option key={t}>{t}</option>
                            ),
                          )}
                        </select>
                        <p className="hint">
                          {e.type === "模型预评估"
                            ? "当前无模型连接；录入内容只能为用户自行提供的评估。"
                            : "用户手动录入，不表示平台验证数据真实性。"}
                        </p>
                      </label>
                    </div>
                    <div className="warning">
                      暂不能判断 · 当前不执行统计显著性分析或自动判定胜者。
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>
              <ShieldCheck size={14} /> 事实可追溯，表达有边界。
            </span>
            <button
              className="primary"
              onClick={() => {
                if (step < 4) {
                  setStep(step + 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else exportMD();
              }}
              disabled={step === 4 && !selected}
            >
              {step < 4 ? "下一步：" + steps[step + 1] : "导出内容包"}
              <ArrowRight size={16} />
            </button>
          </footer>
        </main>
      </div>
      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <aside className="evidence-panel">
            <div className="evidence-header">
              <span>
                <ShieldCheck size={17} />
                证据侧栏
              </span>
              <button
                className="icon-button"
                aria-label="关闭证据"
                onClick={() => setDrawer(false)}
              >
                <PanelRightClose size={19} />
              </button>
            </div>
            <div className="evidence-body">
              <div className="eyebrow">TRACE THE SOURCE</div>
              <h2>{evidence.title}</h2>
              {evidence.note && (
                <p className="warning preline">{evidence.note}</p>
              )}
              {!evidence.comments.length &&
                !evidence.facts.length &&
                !evidence.note && (
                  <div className="empty">
                    点击词语、洞察或故事句子，查看它背后的依据。
                  </div>
                )}
              {evidence.facts.map((id) => {
                const f = p.facts.find((x) => x.id === id);
                return (
                  f && (
                    <div className="evidence-item" key={id}>
                      <span className="pill">品牌事实 · {f.kind}</span>
                      <code>{f.id}</code>
                      <p>{f.content}</p>
                      <small>材料：{f.source || "未附证明"}</small>
                      <div className="check-status">{f.status}</div>
                    </div>
                  )
                );
              })}
              {evidence.comments.map((id) => {
                const c = p.comments.find((x) => x.id === id);
                return (
                  c && (
                    <div className="evidence-item" key={id}>
                      <span className="pill">
                        {p.mode === "demo" ? "演示评论" : "导入原评论"}
                      </span>
                      <code>{c.id}</code>
                      <blockquote>{c.text}</blockquote>
                      {c.origins.map((o, i) => (
                        <div className="origin" key={i}>
                          <strong>
                            {o.comment_id} · {o.source}
                          </strong>
                          <small>
                            {o.date || "日期未知"} ·{" "}
                            {o.language || "语言未标注"}
                          </small>
                          {safeUrl(o.url) && (
                            <a
                              href={safeUrl(o.url)!}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              查看原始链接 ↗
                            </a>
                          )}
                        </div>
                      ))}
                      <small>
                        未自动翻译；以上为原文。评论不是产品功效证明。
                      </small>
                    </div>
                  )
                );
              })}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
function Focus({ items }: { items: string[] }) {
  return (
    <section className="focus">
      <div className="eyebrow">PRIORITY QUESTIONS · 跨模块重点</div>
      {items.length ? (
        items.map((s, i) => (
          <p key={i}>
            <span>0{i + 1}</span>
            {s}
          </p>
        ))
      ) : (
        <p>尚未选择重点问题，请在消费者洞察中选择最多三项。</p>
      )}
    </section>
  );
}
