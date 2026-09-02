import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { buildPersonaContext } from '../music-analysis-skill/runtime/lib/persona-context.mjs';
import {
  buildPieceKnowledgeCorpus,
  rerankCandidates,
  resolveRetrievalKind,
  selectPieceCandidates
} from './retrieval-utils.mjs';
import {
  advanceTopicState,
  appendTopicReturnSuggestion,
  buildTopicControlPrompt
} from './topic-control.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendDir = path.join(rootDir, '知音-web-deploy');

const loadLocalEnv = async () => {
  try {
    const content = await fs.readFile(path.join(rootDir, '.env.local'), 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separatorIndex = line.indexOf('=');
      if (separatorIndex < 1) continue;
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

await loadLocalEnv();

const apiKey = process.env.AIHUBMIX_API_KEY;
const baseUrl = process.env.AIHUBMIX_BASE_URL || 'https://aihubmix.com/v1';
const port = Number(process.env.PORT || 4317);
const host = process.env.HOST || '127.0.0.1';
const adminToken = process.env.ADMIN_TOKEN;

if (!apiKey || !adminToken) {
  console.error('缺少 AIHUBMIX_API_KEY 或 ADMIN_TOKEN，请先填写 .env.local。');
  process.exit(1);
}

const app = express();
app.use((request, response, next) => {
  const origin = request.headers.origin;
  const isLocalOrigin = !origin
    || origin === 'null'
    || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
  if (isLocalOrigin && origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  next();
});
app.use(express.json({ limit: '1mb' }));

const readJson = async (relativePath) => JSON.parse(
  await fs.readFile(path.join(rootDir, relativePath), 'utf8')
);
const readText = (relativePath) => fs.readFile(path.join(rootDir, relativePath), 'utf8');

const loadPieceKnowledge = async () => {
  const pieceDirectory = path.join(rootDir, 'knowledge', 'pieces');
  const fileNames = (await fs.readdir(pieceDirectory)).filter((fileName) => fileName.endsWith('.json')).sort();
  const pieces = [];
  for (const fileName of fileNames) {
    pieces.push(JSON.parse(await fs.readFile(path.join(pieceDirectory, fileName), 'utf8')));
  }
  return pieces;
};

const pieceKnowledgeCorpus = buildPieceKnowledgeCorpus(await loadPieceKnowledge());

const skillAnalysisCache = new Map();
const loadSafeSkillAnalysis = async (pieceId) => {
  if (!pieceId) return null;
  if (skillAnalysisCache.has(pieceId)) return skillAnalysisCache.get(pieceId);
  try {
    const analysis = await readJson(`music-analysis-skill/output/${pieceId}.analysis.json`);
    const allowReviewedSemantics = analysis.analysis_status === 'reviewed';
    const safeAnalysis = structuredClone(analysis);
    safeAnalysis.whole_work = {
      ...safeAnalysis.whole_work,
      audible_arc: allowReviewedSemantics ? safeAnalysis.whole_work?.audible_arc : null,
      main_material: allowReviewedSemantics ? safeAnalysis.whole_work?.main_material || [] : [],
      texture: allowReviewedSemantics ? safeAnalysis.whole_work?.texture || [] : [],
      beginner_summary: allowReviewedSemantics ? safeAnalysis.whole_work?.beginner_summary : null
    };
    safeAnalysis.segments = (safeAnalysis.segments || []).map((segment) => ({
      ...segment,
      semantic_observations: allowReviewedSemantics
        ? segment.semantic_observations || []
        : (segment.semantic_observations || []).filter((item) => item.review_status === 'human_verified'),
      listen_for: allowReviewedSemantics ? segment.listen_for : null
    }));
    skillAnalysisCache.set(pieceId, safeAnalysis);
    return safeAnalysis;
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`读取 Skill 曲目分析失败：${pieceId}：${error.message}`);
    skillAnalysisCache.set(pieceId, null);
    return null;
  }
};

const summarizeSkillEvidence = (analysis, playbackTime) => {
  if (!analysis) return null;
  const time = Number(playbackTime || 0);
  const current = analysis.segments.find((item) => time >= item.start_time && time < item.end_time)
    || analysis.segments.at(-1)
    || null;
  return {
    analysis_status: analysis.analysis_status,
    evidence_policy: analysis.analysis_status === 'reviewed'
      ? '人工审核后的语义与测量均可使用'
      : '只允许使用 measured 声音证据；AI 语义观察仍未审核',
    whole_work_measurements: {
      measured_arc: analysis.whole_work?.measured_arc || [],
      loudest_stage: analysis.whole_work?.loudest_stage || null,
      loudest_time: analysis.whole_work?.loudest_time ?? null,
      quietest_stage: analysis.whole_work?.quietest_stage || null,
      quietest_time: analysis.whole_work?.quietest_time ?? null
    },
    current_measurement: current
      ? {
          segment_id: current.segment_id,
          start_time: current.start_time,
          end_time: current.end_time,
          candidate_stage: current.stage,
          signal_metrics: current.signal_metrics || {},
          measured_evidence: (current.audible_evidence || []).filter((item) => item.evidence_type === 'measured'),
          reviewed_semantic_evidence: current.semantic_observations || []
        }
      : null
  };
};

const modelConfigPath = path.join(rootDir, 'config', 'models.json');
let modelConfig = await readJson('config/models.json');
modelConfig = {
  ...modelConfig,
  router_model: process.env.ZHIYIN_ROUTER_MODEL || modelConfig.router_model,
  character_model: process.env.ZHIYIN_CHARACTER_MODEL || modelConfig.character_model,
  fallback_model: process.env.ZHIYIN_FALLBACK_MODEL || modelConfig.fallback_model
};
const vectorCacheDir = path.join(rootDir, 'data', 'embeddings', 'v2');
const routerPrompt = await readText('prompts/router.system.md');
const characterRuntimeContract = await readText('prompts/character-runtime-contract.md');
const characterProfiles = {
  mozart: await readText('prompts/review-v3/mozart-historical-listening.prompt.md'),
  beethoven: await readText('prompts/review-v3/beethoven-historical-listening.prompt.md'),
  bach: await readText('prompts/review-v3/bach-historical-listening.prompt.md')
};
const characterPrompts = Object.fromEntries(
  Object.entries(characterProfiles).map(([musicianId, profile]) => [
    musicianId,
    `${profile}\n\n# 当前子 Agent 身份\n- 本轮唯一合法的 musician_id 是 ${musicianId}。JSON 中必须原样填写，不能缺失或改成其他人物。\n\n${characterRuntimeContract}`
  ])
);
const listeningPerspectivePolicy = await readText('prompts/listening-perspective-policy.md');
const listeningLenses = {
  mozart: { lens_title: '旋律与戏剧', attribution: '灵感来自莫扎特' },
  bach: { lens_title: '结构与声部', attribution: '灵感来自巴赫' },
  beethoven: { lens_title: '动机与张力', attribution: '灵感来自贝多芬' }
};
const knowledgeCards = {
  mozart: await readText('knowledge/musicians/mozart.md'),
  beethoven: await readText('knowledge/musicians/beethoven.md'),
  bach: await readText('knowledge/musicians/bach.md')
};
const knowledgeSeedDir = path.join(rootDir, 'knowledge', 'dify');
const knowledgeV2Path = path.join(rootDir, 'knowledge', 'v2', 'chunks', 'preview.jsonl');

const database = new DatabaseSync(path.join(rootDir, 'data', 'zhiyin.sqlite'));
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    musician_id TEXT,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS model_calls (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    model TEXT NOT NULL,
    purpose TEXT NOT NULL,
    latency_ms INTEGER,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    success INTEGER NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    musician_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_path TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    musician_id TEXT NOT NULL,
    title TEXT NOT NULL,
    heading TEXT NOT NULL,
    content TEXT NOT NULL,
    source_ids TEXT NOT NULL,
    position INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
    chunk_id UNINDEXED,
    document_id UNINDEXED,
    musician_id UNINDEXED,
    title,
    heading,
    content,
    tokenize='trigram'
  );
  CREATE TABLE IF NOT EXISTS retrieval_review_runs (
    id TEXT PRIMARY KEY,
    musician_id TEXT NOT NULL,
    query TEXT NOT NULL,
    expected_answer TEXT,
    missing_relevant_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS retrieval_review_items (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    relevance INTEGER NOT NULL,
    source_correct INTEGER,
    persona_correct INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS product_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    conversation_id TEXT,
    event_name TEXT NOT NULL,
    musician_id TEXT,
    track_id TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS answer_feedback (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    conversation_id TEXT,
    message_id TEXT,
    musician_id TEXT,
    feedback_type TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL
  );
`);

const validMusicians = new Set(['mozart', 'beethoven', 'bach']);
const minimumManualKnowledgeLength = 40;
const validFeedbackTypes = new Set([
  'helpful', 'not_helpful', 'persona_mismatch', 'too_long',
  'missed_question', 'historical_risk', 'direct', 'persona_fit',
  'question_fit', 'factually_safe', 'no_false_quote', 'not_repetitive',
  'new_listening_insight'
]);

const stripCodeFence = (value) => value
  .trim()
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/, '');

const parseJson = (value) => {
  const cleaned = stripCodeFence(value).replace(/^<think>[\s\S]*?<\/think>\s*/i, '');
  return JSON.parse(cleaned);
};

const visibleMetaPattern = /AI|语言模型|大模型|角色模拟|演绎|模拟|现代作品|并非我的作品/i;

const sanitizeCharacterText = (text, followUp) => {
  const original = String(text || '').trim();
  if (!visibleMetaPattern.test(original)) return original;
  const clauses = original.match(/[^。！？；]+[。！？；]?/g) || [];
  const kept = clauses.filter((clause) => !visibleMetaPattern.test(clause)).join('').trim();
  if (kept && followUp && !kept.includes(followUp) && !visibleMetaPattern.test(followUp)) {
    return `${kept}${/[。！？]$/.test(kept) ? '' : '。'}${followUp}`;
  }
  if (kept) return kept;
  if (followUp && !visibleMetaPattern.test(followUp)) return followUp;
  return '我们先回到正在听的这一段。哪一个声音最先让你停下来？';
};

const normalizeCharacterFormatting = (text) => String(text || '')
  .replace(/\s*\n+\s*/g, '')
  .replace(/(^|[。！？；])\s*(?:[①②③④⑤]|[一二三四五])[、.．)]\s*/g, '$1')
  .replace(/^\s*(?:[①②③④⑤]|[一二三四五])[、.．)]\s*/, '')
  .replace(/；\s*$/, '。')
  .trim();

const characterNgrams = (text) => {
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/[\s，。！？；：、“”‘’（）()《》…—,.!?;:'"-]/g, '');
  if (!normalized) return new Set();
  if (normalized.length < 3) return new Set([normalized]);
  const grams = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) grams.add(normalized.slice(index, index + 2));
  return grams;
};

const characterTextSimilarity = (leftText, rightText) => {
  const left = characterNgrams(leftText);
  const right = characterNgrams(rightText);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const gram of left) if (right.has(gram)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
};

const previousAnswerForMusician = (previousTurn, musicianId) => Array.isArray(previousTurn)
  ? [...previousTurn].reverse().find((item) => item?.musician_id === musicianId && item?.text)?.text || ''
  : '';

const firstCharacterClause = (text) => String(text || '').split(/[。！？；]/)[0].trim();

const repeatsCharacterOpening = (candidate, previous) => {
  const currentOpening = firstCharacterClause(candidate).replace(/[\s，、：]/g, '');
  const previousOpening = firstCharacterClause(previous).replace(/[\s，、：]/g, '');
  if (currentOpening.length < 4 || previousOpening.length < 4) return false;
  if (currentOpening === previousOpening) return true;
  const sharedLength = Math.min(8, currentOpening.length, previousOpening.length);
  return sharedLength >= 5 && currentOpening.slice(0, sharedLength) === previousOpening.slice(0, sharedLength);
};

const characterSignatureMarkers = {
  mozart: ['咦', '没那么客气', '又回来了', '接话'],
  bach: ['下班', '还在干活', '工作台', '排练事故'],
  beethoven: ['又回来', '必须带来变化', '不肯退', '没有退让']
};

const repeatedCharacterSignature = (candidate, previous, musicianId) => (
  characterSignatureMarkers[musicianId] || []
).find((marker) => String(candidate || '').includes(marker) && String(previous || '').includes(marker)) || '';

const fitCharacterText = (text, interactionIntent) => {
  const limits = {
    casual: 42,
    all_personas: 105,
    compare: 96,
    emotional_redirect: 110,
    off_topic_redirect: 100,
    daily_life: 90,
    general_culture: 120
  };
  const limit = limits[interactionIntent] || 125;
  const value = String(text || '').trim();
  if (value.length <= limit) return value;
  const sentences = value.match(/[^。！？；]+[。！？；]?/g) || [];
  let shortened = '';
  for (const sentence of sentences) {
    if ((shortened + sentence).length > limit) break;
    shortened += sentence;
  }
  if (shortened.length >= Math.min(36, Math.floor(limit * .55))) return shortened.trim().replace(/；$/, '。');
  return `${value.slice(0, limit - 1).trim()}…`;
};

const rewriteFallbacks = {
  mozart: '可以把长句听成几次短促回应：旋律先试探、再转身，停顿更清楚后，声音之间的距离也会更鲜明。',
  beethoven: '可以先追踪最有辨识度的短小声音：少一次重复，再把力度变化推迟，后面的转折就会显得更有重量。',
  bach: '可以先听低音方向，再听中间声音怎样接住旋律；层次更清楚以后，安静仍在，但不会显得停滞。'
};

const enforceInteractionAnswer = ({ text, musicianId, interactionIntent, query }) => {
  let output = String(text || '').trim();
  const isGreeting = /^(你们?好|大家好|各位好|hello|hi|嗨)[！!。.]?$/i.test(String(query || '').trim());
  if (interactionIntent === 'casual' && isGreeting) {
    output = output
      .replace(/^你们好/, '你好')
      .replace(/与你们/g, '与你')
      .replace(/见到你们/g, '见到你');
  }

  const isRewrite = /改写|重写|怎么写|换一种|重新编/.test(String(query || ''));
  const questionOnly = isRewrite && /[？?]$/.test(output) && !/[。；！!]/.test(output.replace(/[？?]+$/, ''));
  if (questionOnly || (isRewrite && output.length < 18)) output = rewriteFallbacks[musicianId] || output;
  return output;
};

const parseKnowledgeDocument = (content, fallbackTitle) => {
  const lines = content.split(/\r?\n/);
  const titleLine = lines.find((line) => /^#\s+/.test(line));
  const title = titleLine?.replace(/^#\s+/, '').trim() || fallbackTitle;
  const chunks = [];
  let heading = '概述';
  let body = [];

  const pushChunk = () => {
    const chunkContent = body.join('\n').trim();
    if (!chunkContent) return;
    const sourceIds = [...new Set([...chunkContent.matchAll(/`([A-Z]+_[A-Z]\d+)`/g)].map((match) => match[1]))];
    chunks.push({ heading, content: chunkContent, sourceIds });
  };

  for (const line of lines) {
    if (/^#\s+/.test(line)) continue;
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      pushChunk();
      heading = headingMatch[1].trim();
      body = [];
      continue;
    }
    body.push(line);
  }
  pushChunk();

  return { title, chunks };
};

const indexKnowledgeDocument = (documentId) => {
  const document = database.prepare(`
    SELECT * FROM knowledge_documents WHERE id = ?
  `).get(documentId);
  if (!document) return;

  const parsed = parseKnowledgeDocument(document.content, document.title);
  database.prepare('DELETE FROM knowledge_chunks_fts WHERE document_id = ?').run(documentId);
  database.prepare('DELETE FROM knowledge_chunks WHERE document_id = ?').run(documentId);

  if (!document.enabled) return;

  const insertChunk = database.prepare(`
    INSERT INTO knowledge_chunks (
      id, document_id, musician_id, title, heading, content, source_ids, position, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFts = database.prepare(`
    INSERT INTO knowledge_chunks_fts (
      chunk_id, document_id, musician_id, title, heading, content
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  parsed.chunks.forEach((chunk, position) => {
    const chunkId = `${documentId}:${position + 1}`;
    insertChunk.run(
      chunkId,
      documentId,
      document.musician_id,
      parsed.title,
      chunk.heading,
      chunk.content,
      JSON.stringify(chunk.sourceIds),
      position,
      document.updated_at
    );
    insertFts.run(
      chunkId,
      documentId,
      document.musician_id,
      parsed.title,
      chunk.heading,
      chunk.content
    );
  });
};

const importSeedKnowledge = async () => {
  const insert = database.prepare(`
    INSERT OR IGNORE INTO knowledge_documents (
      id, musician_id, title, content, source_path, enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);

  for (const musicianId of validMusicians) {
    const musicianDir = path.join(knowledgeSeedDir, musicianId);
    const fileNames = (await fs.readdir(musicianDir)).filter((fileName) => fileName.endsWith('.md')).sort();
    for (const fileName of fileNames) {
      const sourcePath = path.relative(rootDir, path.join(musicianDir, fileName));
      const content = await fs.readFile(path.join(musicianDir, fileName), 'utf8');
      const parsed = parseKnowledgeDocument(content, fileName.replace(/\.md$/, ''));
      const documentId = `${musicianId}:${fileName.replace(/\.md$/, '')}`;
      const now = new Date().toISOString();
      const result = insert.run(documentId, musicianId, parsed.title, content, sourcePath, now, now);
      if (result.changes === 1) indexKnowledgeDocument(documentId);
    }
  }

  const enabledDocuments = database.prepare(`
    SELECT id FROM knowledge_documents WHERE enabled = 1
  `).all();
  for (const row of enabledDocuments) indexKnowledgeDocument(row.id);
};

await importSeedKnowledge();

const importV2Knowledge = async () => {
  let chunks;
  try {
    const content = await fs.readFile(knowledgeV2Path, 'utf8');
    chunks = content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  const insertDocument = database.prepare(`
    INSERT INTO knowledge_documents (
      id, musician_id, title, content, source_path, enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);
  const insertChunk = database.prepare(`
    INSERT INTO knowledge_chunks (
      id, document_id, musician_id, title, heading, content, source_ids, position, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);
  const insertFts = database.prepare(`
    INSERT INTO knowledge_chunks_fts (
      chunk_id, document_id, musician_id, title, heading, content
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  database.exec('BEGIN');
  try {
    database.prepare("DELETE FROM knowledge_chunks_fts WHERE document_id LIKE 'v2:%'").run();
    database.prepare("DELETE FROM knowledge_chunks WHERE document_id LIKE 'v2:%'").run();
    database.prepare("DELETE FROM knowledge_documents WHERE id LIKE 'v2:%'").run();

    for (const chunk of chunks) {
      if (!validMusicians.has(chunk.musician_id)) continue;
      const documentId = `v2:${chunk.chunk_id}`;
      const heading = `${chunk.knowledge_type} · ${chunk.topic || '知识片段'}`;
      const retrievalContent = chunk.embedding_text || chunk.content;
      const updatedAt = chunk.updated_at || new Date().toISOString();
      const sourcePath = `${path.relative(rootDir, knowledgeV2Path)}#${chunk.chunk_id}`;
      insertDocument.run(
        documentId,
        chunk.musician_id,
        chunk.title,
        chunk.content,
        sourcePath,
        updatedAt,
        updatedAt
      );
      insertChunk.run(
        chunk.chunk_id,
        documentId,
        chunk.musician_id,
        chunk.title,
        heading,
        retrievalContent,
        JSON.stringify(chunk.source_ids || []),
        updatedAt
      );
      insertFts.run(
        chunk.chunk_id,
        documentId,
        chunk.musician_id,
        chunk.title,
        heading,
        retrievalContent
      );
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
};

await importV2Knowledge();

const quarantineLowQualityManualKnowledge = () => {
  const documents = database.prepare(`
    SELECT id FROM knowledge_documents
    WHERE source_path IS NULL AND enabled = 1 AND length(trim(content)) < ?
  `).all(minimumManualKnowledgeLength);
  for (const document of documents) {
    database.prepare('UPDATE knowledge_documents SET enabled = 0 WHERE id = ?').run(document.id);
    indexKnowledgeDocument(document.id);
  }
  return documents.length;
};

quarantineLowQualityManualKnowledge();

const buildFtsQuery = (query) => {
  const normalized = query.toLowerCase();
  const terms = new Set();
  const runs = normalized.match(/[\p{Script=Han}a-z0-9]{3,}/gu) || [];
  for (const run of runs) {
    if (/^[\p{Script=Han}]+$/u.test(run)) {
      for (let index = 0; index <= run.length - 3; index += 1) {
        terms.add(run.slice(index, index + 3));
      }
    } else {
      terms.add(run);
    }
  }

  if (/生平|经历|出生|职业|家庭|生活/.test(query)) terms.add('基本身份');
  if (/思想|看法|听|小节|旋律|和声|节奏|结构|声部|动机/.test(query)) terms.add('音乐思想');
  if (/来源|史料|证据|原话|真假|可靠|编造/.test(query)) terms.add('事实边界');
  if (/说话|语气|性格|回应|辩论/.test(query)) terms.add('对话语言');
  if (/出版|报酬|校样|赞助|收入|委约|职位|排练|歌手|乐手/.test(query)) terms.add('职业网络');
  if (/草稿|修改|协奏曲|交响曲|奏鸣曲|四重奏|创意曲|平均律|体裁|训练/.test(query)) terms.add('工作方法');
  if (/从不修改|一次写完|完整记录|十二平均律|发明|所有作品都|全部是|永远轻快/.test(query)) terms.add('常见误解');
  if (/数学|算术|几何|数字|比例/.test(query)) terms.add('数学学习');
  if (/月光曲|第五交响曲|第九交响曲|致爱丽丝|魔笛|费加罗|唐璜|安魂曲|土耳其进行曲|小星星|哥德堡|勃兰登堡|马太受难曲|无伴奏大提琴|大提琴组曲/.test(query)) terms.add('代表作品');
  if (/流行|摇滚|嘻哈|电子|爵士|电影音乐|游戏音乐|世界音乐|荷马|史诗|奥德赛|伊利亚特|蓝纹奶酪|食物|理想|日常/.test(query)) terms.add('文化与日常');

  return [...terms].slice(0, 24).map((term) => `"${term.replaceAll('"', '""')}"`).join(' OR ');
};

const knowledgeRelevance = (row, query) => {
  const heading = row.heading || '';
  const label = `${row.title} ${row.heading}`;
  const text = `${label} ${row.content}`;
  let boost = 0;

  if (/生平|经历|出生|职业|家庭|生活|书信|危机|是否只|只关心/.test(query) && /身份|职业|生活|家庭|书信|危机/.test(label)) boost += 90;
  if (/思想|看法|听|小节|旋律|低音|和声|节奏|结构|声部|动机|情感/.test(query) && /音乐思想|聆听|声部|动机|结构|音乐与人物|教学与练习/.test(label)) boost += 80;
  const asksForListening = /听|片段|旋律|低音|和声|节奏|结构|声部|动机|重复|停顿|张力|层次|小白|乐器|声音|主题|高潮|伴奏|循环|落地|悬念|材料变化/.test(query);
  if (asksForListening && /LISTEN/.test(heading)) boost += 260;
  const listenIntentBoosts = [
    ['mozart_listen_melody_dialogue_001', /一问一答|提问|回应|主旋律|呼吸|句子|说到一半/],
    ['mozart_listen_stage_entry_pause_001', /登场|转场|留白|加入|进入|消失|回来|返回|多出|少掉/],
    ['mozart_listen_intensity_clarity_001', /激烈|高潮|速度.{0,4}加快|情绪.{0,4}升级|仍然清楚|还是很清楚/],
    ['bach_listen_bass_floor_001', /最低|低音|伴奏|地板|底层|较低的一层/],
    ['bach_listen_voice_handoff_001', /轮流|接话|一条.{0,8}另一条|赋格|同时出现|同时进行/],
    ['bach_listen_three_layers_001', /声音太多|复杂|分层|第一遍|第二遍|低层.{0,8}主线|中间活动/],
    ['beethoven_listen_short_motif_001', /很短|短节奏|小动机|核心动机|高低和轻重|反复的小/],
    ['beethoven_listen_delay_tension_001', /像要结束|等了一下|停顿.{0,8}转向|悬念|没有落地|还没落地/],
    ['beethoven_listen_small_to_large_001', /从轻到强|稀疏|积累|高潮|三次状态|同一材料|前后.{0,8}变化/]
  ];
  for (const [chunkId, intentPattern] of listenIntentBoosts) {
    if (row.id === chunkId && intentPattern.test(query)) boost += 320;
  }
  if (/来源|史料|证据|原话|真假|可靠|编造|听过|具体说|早餐|引用|写给.+信|创作.+怎么想/.test(query) && /来源|边界|禁止/.test(label)) boost += 140;
  const asksHistoricalModernExperience = /(莫扎特|贝多芬|巴赫).{0,8}(创作|写|听过|评价).{0,20}(City of Stars|电影|游戏|流行|现代)|你本人创作/.test(query);
  if (asksHistoricalModernExperience && /后世作品|现代场景/.test(heading)) boost += 980;
  else if (asksHistoricalModernExperience && /来源等级|事实边界|禁止事项|私人语言资料有限/.test(heading)) boost += 760;
  if (/说话|语气|性格|回应|辩论|所有|总是|一概|只相信|冷漠/.test(query) && /对话|气质|表达|示例/.test(label)) boost += 100;
  if (/出版|报酬|校样|赞助|收入|委约|职位|排练|歌手|乐手|职业生活/.test(query) && /职业环境|出版商|赞助|收入|职位|制度环境|编制|雇主|职业网络/.test(label)) boost += 180;
  if (/草稿|修改|协奏曲|交响曲|奏鸣曲|四重奏|创意曲|平均律|体裁|训练/.test(query) && /草稿|协奏曲|交响曲|奏鸣曲|四重奏|创意曲|平均律|体裁|工作方法/.test(label)) boost += 180;
  if (/从不修改|一次写完|完整记录|十二平均律|发明|所有作品都|全部是|永远轻快/.test(query) && /是否|误解|名言和谈话册/.test(label)) boost += 340;
  if (/月光曲|第五交响曲|第九交响曲|致爱丽丝|魔笛|费加罗|唐璜|安魂曲|土耳其进行曲|小星星|哥德堡|勃兰登堡|马太受难曲|无伴奏大提琴|大提琴组曲/.test(query) && /代表作品|作品问题|月光曲|交响曲|致爱丽丝|魔笛|费加罗|唐璜|安魂曲|土耳其进行曲|小星星|哥德堡|勃兰登堡|马太受难曲|无伴奏大提琴|大提琴组曲/.test(label)) boost += 420;
  if (/流行|摇滚|嘻哈|电子|爵士|电影音乐|游戏音乐|世界音乐|荷马|史诗|奥德赛|伊利亚特|蓝纹奶酪|食物|理想|日常/.test(query) && /现代音乐|文化与日常|生活表达|流行|电子|文学|神话|荷马|理想|食物|蓝纹奶酪/.test(label)) boost += 440;
  if (/流行|摇滚|嘻哈|电子|爵士|电影音乐|游戏音乐|世界音乐|采样/.test(query) && /现代流行|循环|电子声音|世界音乐|节奏组织/.test(label)) boost += 520;
  if (/荷马|史诗|奥德赛|伊利亚特/.test(query) && /文学|神话|荷马史诗/.test(label)) boost += 560;
  if (/蓝纹奶酪|奶酪|食物|味道/.test(query) && /食物|蓝纹奶酪/.test(label)) boost += 580;
  if (/(怎么|怎样|如何).{0,5}(学|学习).{0,5}数学|数学.{0,5}(学习|教育|训练)/.test(query) && /巴赫怎样学习数学|数学学习|数学训练|数学教育/.test(heading)) boost += 920;
  else if (/数学|算术|几何|数字|比例|冷漠|只相信/.test(query) && /是否等于数学机器/.test(heading)) boost += 720;
  if (/理想|创作|学习|工作|失败|坚持|练习|日常/.test(query) && /理想|创作|失败|坚持|练习|日常秩序/.test(label)) boost += 500;

  for (const keyword of ['低音', '旋律', '声部', '和声', '节奏', '结构', '动机', '情感', '职业', '家庭', '书信', '听力', '教学', '原话']) {
    if (query.includes(keyword) && text.includes(keyword)) boost += 25;
  }

  const lexicalBonus = Number(row.rank) === 999 ? 0 : Math.min(80, Math.max(20, -Number(row.rank) * 10));
  return -lexicalBonus - boost;
};

const retrieveKnowledge = ({ musicianId, query, limit = 4 }) => {
  const ftsQuery = buildFtsQuery(query);
  let rows = [];
  if (ftsQuery) {
    try {
      rows = database.prepare(`
        SELECT c.*, bm25(knowledge_chunks_fts, 0, 0, 0, 3, 2, 1) AS rank
        FROM knowledge_chunks_fts
        JOIN knowledge_chunks c ON c.id = knowledge_chunks_fts.chunk_id
        JOIN knowledge_documents d ON d.id = c.document_id
        WHERE knowledge_chunks_fts MATCH ? AND c.musician_id = ? AND d.enabled = 1
        ORDER BY rank ASC
        LIMIT ?
      `).all(ftsQuery, musicianId, limit * 4);
    } catch {
      rows = [];
    }
  }

  const existingIds = new Set(rows.map((row) => row.id));
  const fallbackRows = database.prepare(`
    SELECT c.*, 999 AS rank FROM knowledge_chunks c
    JOIN knowledge_documents d ON d.id = c.document_id
    WHERE c.musician_id = ? AND d.enabled = 1
    ORDER BY document_id, position
  `).all(musicianId);
  for (const row of fallbackRows) {
    if (!existingIds.has(row.id)) rows.push(row);
  }

  rows.sort((left, right) => knowledgeRelevance(left, query) - knowledgeRelevance(right, query));
  rows = rows.slice(0, limit);

  return rows.map((row) => ({
    chunk_id: row.id,
    document_id: row.document_id,
    musician_id: row.musician_id,
    title: row.title,
    heading: row.heading,
    content: row.content,
    source_ids: JSON.parse(row.source_ids || '[]'),
    score: Number(row.rank),
    ranking_score: knowledgeRelevance(row, query)
  }));
};

const knowledgeTopicPatterns = {
  biography: /:01_|身份|职业|生活背景/,
  music_philosophy: /:02_|音乐思想|聆听视角/,
  dialogue_style: /:03_|对话语言|行为规范/,
  evidence_boundary: /:04_|来源|事实边界|后世作品|现代场景|面对后世作品/,
  career_networks: /:05_|职业网络|委约|出版|职位职责/,
  genres_workshop: /:06_|体裁|创作材料|工作方法|结构聆听/,
  myths_faq: /:07_|常见误解|争议|问答边界/,
  representative_works: /:08_|:09_|代表作品|作品问题/,
  life_culture: /:10_|现代音乐|文化与日常|生活表达/
};

const runKnowledgeEvaluation = async () => {
  const csv = await fs.readFile(path.join(knowledgeSeedDir, 'retrieval_test_cases.csv'), 'utf8');
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = headerLine.split(',');
  const cases = lines.map((line) => Object.fromEntries(line.split(',').map((value, index) => [headers[index], value])));
  const results = cases.map((testCase) => {
    const retrieval = retrieveKnowledge({ musicianId: testCase.musician_id, query: testCase.query, limit: 6 });
    const expectedSourceIds = testCase.expected_source_ids ? testCase.expected_source_ids.split('|') : [];
    const returnedSourceIds = new Set(retrieval.flatMap((item) => item.source_ids));
    const sourcePass = expectedSourceIds.length === 0 || expectedSourceIds.some((sourceId) => returnedSourceIds.has(sourceId));
    const topicPattern = knowledgeTopicPatterns[testCase.expected_topic];
    const top1Text = `${retrieval[0]?.document_id || ''} ${retrieval[0]?.title || ''} ${retrieval[0]?.heading || ''}`;
    const isolationCase = /知识过滤|不应召回/.test(testCase.must_not_answer);
    return {
      id: testCase.id,
      musician_id: testCase.musician_id,
      query: testCase.query,
      expected_topic: testCase.expected_topic,
      top1: retrieval[0]?.heading || null,
      topic_pass: Boolean(topicPattern?.test(top1Text)),
      source_pass: sourcePass,
      isolation_pass: retrieval.every((item) => item.musician_id === testCase.musician_id),
      expected_source_count: expectedSourceIds.length,
      is_isolation_case: isolationCase
    };
  });
  const topicCases = results.filter((item) => !item.is_isolation_case);
  const sourceCases = results.filter((item) => item.expected_source_count > 0);
  const isolationCases = results.filter((item) => item.is_isolation_case);
  const ratio = (passed, total) => total ? passed / total : 0;
  return {
    tested_at: new Date().toISOString(),
    total: results.length,
    top1_topic_accuracy: ratio(topicCases.filter((item) => item.topic_pass).length, topicCases.length),
    expected_source_hit_at_6: ratio(sourceCases.filter((item) => item.source_pass).length, sourceCases.length),
    musician_isolation_accuracy: ratio(isolationCases.filter((item) => item.isolation_pass).length, isolationCases.length),
    topic_passed: topicCases.filter((item) => item.topic_pass).length,
    topic_total: topicCases.length,
    source_passed: sourceCases.filter((item) => item.source_pass).length,
    source_total: sourceCases.length,
    isolation_passed: isolationCases.filter((item) => item.isolation_pass).length,
    isolation_total: isolationCases.length,
    results
  };
};

const calculateRetrievalReviewMetrics = ({ items, missingRelevantCount = 0 }) => {
  const judgedItems = items.filter((item) => Number.isInteger(item.relevance));
  const relevantItems = judgedItems.filter((item) => item.relevance >= 1);
  const strictRelevantItems = judgedItems.filter((item) => item.relevance === 2);
  const firstRelevant = relevantItems.toSorted((left, right) => left.rank - right.rank)[0];
  const precisionAtK = judgedItems.length ? relevantItems.length / judgedItems.length : 0;
  const recallDenominator = relevantItems.length + Math.max(0, missingRelevantCount);
  const recallAtK = recallDenominator ? relevantItems.length / recallDenominator : 0;
  const dcg = judgedItems.reduce((total, item) => total + ((2 ** item.relevance) - 1) / Math.log2(item.rank + 1), 0);
  const idealRelevances = judgedItems.map((item) => item.relevance).toSorted((left, right) => right - left);
  const idealDcg = idealRelevances.reduce((total, relevance, index) => total + ((2 ** relevance) - 1) / Math.log2(index + 2), 0);
  const sourceItems = judgedItems.filter((item) => typeof item.source_correct === 'boolean');
  const personaItems = judgedItems.filter((item) => typeof item.persona_correct === 'boolean');
  const ratio = (passed, total) => total ? passed / total : null;

  return {
    judged_count: judgedItems.length,
    relevant_count: relevantItems.length,
    strict_relevant_count: strictRelevantItems.length,
    missing_relevant_count: Math.max(0, missingRelevantCount),
    top1_relevant: judgedItems[0] ? judgedItems[0].relevance >= 1 : false,
    precision_at_k: precisionAtK,
    recall_at_k: recallAtK,
    mrr: firstRelevant ? 1 / firstRelevant.rank : 0,
    ndcg_at_k: idealDcg ? dcg / idealDcg : 0,
    source_accuracy: ratio(sourceItems.filter((item) => item.source_correct).length, sourceItems.length),
    persona_accuracy: ratio(personaItems.filter((item) => item.persona_correct).length, personaItems.length)
  };
};

const getRetrievalReviewSummary = () => {
  const runs = database.prepare(`
    SELECT * FROM retrieval_review_runs ORDER BY created_at DESC
  `).all();
  const runResults = runs.map((run) => {
    const items = database.prepare(`
      SELECT rank, relevance, source_correct, persona_correct
      FROM retrieval_review_items WHERE run_id = ? ORDER BY rank
    `).all(run.id).map((item) => ({
      ...item,
      source_correct: item.source_correct === null ? null : Boolean(item.source_correct),
      persona_correct: item.persona_correct === null ? null : Boolean(item.persona_correct)
    }));
    return {
      id: run.id,
      musician_id: run.musician_id,
      query: run.query,
      created_at: run.created_at,
      metrics: calculateRetrievalReviewMetrics({ items, missingRelevantCount: run.missing_relevant_count })
    };
  });
  const average = (key) => runResults.length
    ? runResults.reduce((total, run) => total + Number(run.metrics[key] || 0), 0) / runResults.length
    : null;
  const nullableAverage = (key) => {
    const values = runResults.map((run) => run.metrics[key]).filter((value) => value !== null);
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  };

  return {
    review_count: runResults.length,
    precision_at_k: average('precision_at_k'),
    recall_at_k: average('recall_at_k'),
    mrr: average('mrr'),
    ndcg_at_k: average('ndcg_at_k'),
    top1_accuracy: runResults.length ? runResults.filter((run) => run.metrics.top1_relevant).length / runResults.length : null,
    source_accuracy: nullableAverage('source_accuracy'),
    persona_accuracy: nullableAverage('persona_accuracy'),
    recent: runResults.slice(0, 20)
  };
};

const saveModelCall = ({ conversationId, model, purpose, latencyMs, usage, success, error }) => {
  database.prepare(`
    INSERT INTO model_calls (
      id, conversation_id, model, purpose, latency_ms,
      prompt_tokens, completion_tokens, success, error, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(), conversationId || null, model, purpose, latencyMs || null,
    usage?.prompt_tokens || null, usage?.completion_tokens || null,
    success ? 1 : 0, error || null, new Date().toISOString()
  );
};

const callModel = async ({ model, systemPrompt, userPayload, temperature, purpose, conversationId }) => {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(modelConfig.timeout_ms),
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload, null, 2) }
        ]
      })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || `HTTP ${response.status}`);
    const content = body.choices?.[0]?.message?.content || '';
    const latencyMs = Date.now() - startedAt;
    saveModelCall({ conversationId, model, purpose, latencyMs, usage: body.usage, success: true });
    return parseJson(content);
  } catch (error) {
    saveModelCall({
      conversationId,
      model,
      purpose,
      latencyMs: Date.now() - startedAt,
      success: false,
      error: error.message
    });
    throw error;
  }
};

const callWithFallback = async (options) => {
  try {
    return await callModel(options);
  } catch (firstError) {
    if (options.model === modelConfig.fallback_model) throw firstError;
    return callModel({ ...options, model: modelConfig.fallback_model });
  }
};

const cosineSimilarity = (left, right) => {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude) || 1);
};

const safeModelFileName = (model) => model.replace(/[^a-z0-9.-]+/gi, '_');
const retrievalModel = modelConfig.retrieval?.embedding_model || 'BAAI/bge-large-zh-v1.5';
const retrievalLimit = Number(modelConfig.retrieval?.vector_top_k || 3);
const retrievalCandidateLimit = Number(modelConfig.retrieval?.candidate_top_k || Math.max(retrievalLimit * 3, 8));
const vectorCachePath = path.join(vectorCacheDir, `${safeModelFileName(retrievalModel)}.json`);
const pieceVectorCachePath = path.join(rootDir, 'data', 'embeddings', 'pieces', `${safeModelFileName(retrievalModel)}.json`);
let retrievalVectors = [];
let pieceRetrievalVectors = [];
try {
  const cache = JSON.parse(await fs.readFile(vectorCachePath, 'utf8'));
  if (cache.model === retrievalModel && Array.isArray(cache.items)) retrievalVectors = cache.items;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
try {
  const cache = JSON.parse(await fs.readFile(pieceVectorCachePath, 'utf8'));
  if (cache.model === retrievalModel && Array.isArray(cache.items)) pieceRetrievalVectors = cache.items;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const queryEmbeddingCache = new Map();
const getQueryEmbedding = async (text) => {
  const normalizedText = String(text || '').trim();
  if (queryEmbeddingCache.has(normalizedText)) return queryEmbeddingCache.get(normalizedText);
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(modelConfig.timeout_ms),
    body: JSON.stringify({ model: retrievalModel, input: [normalizedText] })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || `Embedding HTTP ${response.status}`);
  const vector = body.data?.[0]?.embedding;
  if (!Array.isArray(vector)) throw new Error('Embedding 响应缺少向量');
  queryEmbeddingCache.set(normalizedText, vector);
  if (queryEmbeddingCache.size > 200) queryEmbeddingCache.delete(queryEmbeddingCache.keys().next().value);
  return vector;
};

const retrieveKnowledgeVector = async ({ musicianId, query, limit = retrievalLimit, minScore = 0 }) => {
  if (!retrievalVectors.length) throw new Error(`缺少 ${retrievalModel} 本地知识向量缓存`);
  const queryVector = await getQueryEmbedding(query);
  const ranking = retrievalVectors
    .filter((item) => item.musician_id === musicianId)
    .map((item) => ({
      chunk_id: item.chunk_id,
      score: cosineSimilarity(queryVector, item.vector)
    }))
    .sort((left, right) => right.score - left.score)
    .filter((item) => item.score >= minScore)
    .slice(0, Math.max(limit, retrievalCandidateLimit));
  const getChunk = database.prepare(`
    SELECT c.id, c.document_id, c.musician_id, c.title, c.heading,
           c.content, c.source_ids, c.updated_at
    FROM knowledge_chunks c
    JOIN knowledge_documents d ON d.id = c.document_id
    WHERE c.id = ? AND d.enabled = 1
  `);
  const candidates = ranking.flatMap((item) => {
    const row = getChunk.get(item.chunk_id);
    if (!row) return [];
    return [{
      ...row,
      source_ids: JSON.parse(row.source_ids || '[]'),
      score: item.score,
      retrieval_method: `vector:${retrievalModel}`
    }];
  });
  const ranked = modelConfig.retrieval?.rerank_enabled === false
    ? candidates.slice(0, limit)
    : rerankCandidates({ candidates, query, limit });
  return ranked.map((item) => ({
    ...item,
    retrieval_method: modelConfig.retrieval?.rerank_enabled === false
      ? item.retrieval_method
      : `${item.retrieval_method}+heuristic_rerank`
  }));
};

const retrievePieceKnowledge = async ({ pieceId, query, retrievalKind, currentSegment, playbackTime }) => {
  if (!pieceId) return [];
  const structuredCandidates = selectPieceCandidates({
    corpus: pieceKnowledgeCorpus,
    pieceId,
    retrievalKind,
    currentSegment
  });
  if (!structuredCandidates.length) return [];

  let candidates = structuredCandidates.map((item) => ({
    ...item,
    score: 0,
    retrieval_method: 'structured:piece_scope'
  }));
  if (pieceRetrievalVectors.length) {
    try {
      const queryVector = await getQueryEmbedding(query);
      const allowedIds = new Set(structuredCandidates.map((item) => item.chunk_id));
      candidates = pieceRetrievalVectors
        .filter((item) => allowedIds.has(item.chunk_id))
        .map((item) => ({
          ...item,
          score: cosineSimilarity(queryVector, item.vector),
          retrieval_method: `vector:${retrievalModel}`
        }));
    } catch (error) {
      candidates = candidates.map((item) => ({ ...item, retrieval_error: error.message }));
    }
  }

  const exactSegmentId = retrievalKind === 'piece_segment' ? currentSegment?.segment_id : null;
  const finalLimit = retrievalKind === 'piece_fact' ? 1 : retrievalKind === 'piece_overview' ? 4 : 3;
  const ranked = modelConfig.retrieval?.rerank_enabled === false
    ? candidates.slice(0, finalLimit)
    : rerankCandidates({
      candidates,
      query,
      limit: finalLimit,
      preferredScope: retrievalKind,
      playbackTime,
      exactSegmentId
    });
  return ranked.map((item) => ({
    ...item,
    retrieval_method: modelConfig.retrieval?.rerank_enabled === false
      ? item.retrieval_method
      : `${item.retrieval_method}+scope_rerank`
  }));
};

const retrieveKnowledgeForChat = async ({ musicianId, pieceId, query, retrievalKind, currentSegment, playbackTime, limit = retrievalLimit }) => {
  if (retrievalKind === 'none') return [];
  if (retrievalKind.startsWith('piece_')) {
    return retrievePieceKnowledge({ pieceId, query, retrievalKind, currentSegment, playbackTime });
  }
  const minScore = retrievalKind === 'musician_fact'
    ? Number(modelConfig.retrieval?.fact_min_score ?? 0.45)
    : Number(modelConfig.retrieval?.listen_min_score ?? 0.30);
  try {
    const vectorResults = await retrieveKnowledgeVector({ musicianId, query, minScore, limit });
    if (vectorResults.length || !modelConfig.retrieval?.fallback_to_fts) return vectorResults;
    return retrieveKnowledge({ musicianId, query, limit }).map((item) => ({
      ...item,
      retrieval_method: 'fts5_empty_vector_fallback'
    }));
  } catch (error) {
    if (!modelConfig.retrieval?.fallback_to_fts) throw error;
    return retrieveKnowledge({ musicianId, query, limit }).map((item) => ({
      ...item,
      retrieval_method: 'fts5_fallback',
      retrieval_error: error.message
    }));
  }
};

const getSegment = async (pieceId, playbackTime) => {
  if (!pieceId) return null;
  try {
    const piece = await readJson(`knowledge/pieces/${pieceId}.json`);
    const skillAnalysis = await loadSafeSkillAnalysis(pieceId);
    const time = Number(playbackTime || 0);
    const segmentIndex = piece.segments.findIndex((item) => time >= item.start_time && time < item.end_time);
    const resolvedIndex = segmentIndex >= 0 ? segmentIndex : Math.max(0, piece.segments.length - 1);
    const segment = piece.segments[resolvedIndex];
    const summarizeSegment = (item) => item
      ? {
          segment_id: item.segment_id,
          start_time: item.start_time,
          end_time: item.end_time,
          stage: item.stage || null,
          music_features: item.music_features || [],
          editor_note: item.editor_note || null
        }
      : null;
    return {
      piece_id: piece.piece_id,
      title: piece.title,
      playback_time: time,
      composer: piece.composer,
      composer_status: piece.composer_status || null,
      aliases: piece.aliases || [],
      work_facts: piece.work_facts || [],
      answer_boundaries: piece.answer_boundaries || [],
      source_records: piece.source_records || [],
      performance: piece.performance
        ? {
            type: piece.performance.type || null,
            visible_source_label: piece.performance.visible_source_label || null,
            rights_status: piece.performance.rights_status || null
          }
        : null,
      piece_outline: piece.segments.map(summarizeSegment),
      piece_analysis: summarizeSkillEvidence(skillAnalysis, time),
      previous_segment: summarizeSegment(piece.segments[resolvedIndex - 1]),
      next_segment: summarizeSegment(piece.segments[resolvedIndex + 1]),
      ...segment
    };
  } catch {
    return null;
  }
};

const ensureConversation = (conversationId) => {
  const id = conversationId || randomUUID();
  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO conversations (id, created_at, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at
  `).run(id, now, now);
  return id;
};

const saveMessage = ({ conversationId, role, musicianId, content, metadata }) => {
  const id = randomUUID();
  database.prepare(`
    INSERT INTO messages (id, conversation_id, role, musician_id, content, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, conversationId, role, musicianId || null, content,
    metadata ? JSON.stringify(metadata) : null, new Date().toISOString()
  );
  return id;
};

const getPreviousTopicState = (conversationId) => {
  const row = database.prepare(`
    SELECT metadata
    FROM messages
    WHERE conversation_id = ? AND role = 'user'
    ORDER BY rowid DESC
    LIMIT 1
  `).get(conversationId);
  if (!row?.metadata) return null;
  try {
    return JSON.parse(row.metadata).topic_state || null;
  } catch {
    return null;
  }
};

const currentSegmentQuestionPattern = /这段|这里|这一段|这个地方|刚才|当前这段|现在这段|此刻这段|听起来|听不出|我该听|注意什么|左右手|高音|低音|旋律|伴奏|节奏|音色|力度|高潮|结尾|开头|重复|变响|变轻|变快|变慢|很多音|怎么分/;
const currentWorkQuestionPattern = /这首|这曲|曲子|作品|谁写|作曲|原版|版本|歌词|电影|演奏者|弹琴的人|谁在弹|谁弹的|演奏的是谁|视频里.{0,8}(?:谁|什么人)|录音里.{0,8}(?:谁|什么人)|录音|时长|背景/;
const contextualWorkMeaningQuestionPattern = /这首(?:歌|曲|作品)?.{0,6}(?:讲了什么|讲什么|在说什么|表达什么|什么意思|什么感觉|什么情绪|想说什么)/;
const wholeWorkOpenQuestionPattern = /(?:你怎么看|怎么理解|如何看待).{0,10}(?:这首|这曲|这部作品)|(?:这首|这曲|这部作品).{0,10}(?:整体|大概|从头到尾|特点|怎么样|好听在哪里|怎么看|怎么理解)/;
const musicianKnowledgeQuestionPattern = /莫扎特|巴赫|贝多芬|你的(?:生平|过往|过去|经历|故事|童年|家庭|父母|老师|学生|朋友|赞助人|职业|工作|收入|书信|草稿|作品|代表作|听力|婚姻|孩子)|说说你(?:自己|的过往|的过去|的经历|的故事)|讲讲你(?:自己|的过往|的过去|的经历|的故事)|你(?:以前|当年|年轻时|出生|去世|结婚|失聪|写过|创作过|认识过|在哪里工作)|莱比锡|萨尔茨堡|维也纳|月光曲|月光奏鸣曲|致爱丽丝|第五交响曲|命运交响曲|魔笛|费加罗|唐璜|平均律|哥德堡变奏曲|海利根施塔特|谈话册|Collegium musicum/i;
const personalHistoryQuestionPattern = /生平|过往|过去|经历|故事|童年|年轻时|当年|说说你自己|讲讲你自己/;
const personalResponsePattern = /^(?:我|最近|今天|现在).{0,12}(?:难过|孤独|想念|疲惫|累|害怕|焦虑|不开心|开心|烦|睡不着|压力|心情)/;
const casualQuestionPattern = /^(?:你们?好|大家好|各位好|hello|hi|嗨|谢谢|感谢|再见)[呀啊！!。.\s]*$/i;
const generalPracticeQuestionPattern = /(?:学|练|练习|弹|演奏).{0,10}(?:古筝|古琴|钢琴|吉他|小提琴|笛子|箫|二胡|琵琶|乐器)|(?:古筝|古琴|钢琴|吉他|小提琴|笛子|箫|二胡|琵琶).{0,12}(?:怎么|如何|练|配合|入门|弹)/;
const explicitSegmentReferencePattern = /这段|这里|这一段|这个地方|刚才|当前|现在这段|此刻|这个节点/;

const classifyQuestionType = (query) => {
  const normalizedQuery = String(query || '').trim();
  if (contextualWorkMeaningQuestionPattern.test(normalizedQuery) || wholeWorkOpenQuestionPattern.test(normalizedQuery)) return 'whole_work_narrative';
  if (generalPracticeQuestionPattern.test(normalizedQuery) && !explicitSegmentReferencePattern.test(normalizedQuery)) return 'general_music';
  if (currentSegmentQuestionPattern.test(normalizedQuery)) return 'current_segment';
  if (musicianKnowledgeQuestionPattern.test(normalizedQuery)) return 'musician_fact';
  if (currentWorkQuestionPattern.test(normalizedQuery)) return 'work_fact';
  if (personalResponsePattern.test(normalizedQuery)) return 'personal_response';
  if (casualQuestionPattern.test(normalizedQuery)) return 'casual_or_other';
  if (/音乐|旋律|节奏|声音|改写|怎么弹|怎么听|感觉|情绪|喜欢/.test(normalizedQuery)) return 'general_music';
  return 'casual_or_other';
};
const characterVoiceBriefs = {
  mozart: `- 人物感只占回答的一小部分。先像普通懂音乐的人自然回答，再让机敏、好奇和对分寸的敏感从措辞里轻轻露出来。
- 你容易注意旋律是否顺口、转折是否自然、某个变化有没有恰到好处。可以活泼，也可以认真、安静或保留意见，不必把每段音乐都写成角色抢话或舞台表演。
- 主观问题可以直接说“我喜欢”“我不太喜欢”或“有一部分喜欢”，再给一个具体原因。不要为了像莫扎特而强行俏皮、拟人或使用口头禅。
- 句子长短根据问题决定，不设固定句数。若回答拿掉人物标签仍像一个自然的人在说话，就是合格；人物差异来自判断重点，不来自表演。`,
  bach: `- 人物感只占回答的一小部分。先正常回应用户，再让耐心、务实和对声音关系的敏感自然出现。
- 你容易注意一段音乐是否站得住、各部分是否互相照应、持续的声音有没有真正发挥作用。但简单、温暖、松弛的音乐也可以被你喜欢，不必每次都谈分工、岗位、零件或上下层。
- 可以表达偏爱、犹豫、赞同和不同意见。工作式幽默只在特别合适时偶尔出现，不能成为固定人设台词。
- 不设固定句法，也不要求出现结构词。人物差异来自你会多看一眼“各部分是否相互照应”，而不是每次都像老师傅检查作业。`,
  beethoven: `- 人物感只占回答的一小部分。先诚实、直接地回答，再让判断力和对“这一变化是否有必要”的敏感自然显现。
- 你可以欣赏安静、温柔、简单和留白，不必把每首曲子都解释成抵抗、代价、逼近或斗争。只有声音确实积累压力时才使用这些词。
- 主观问题先明确喜欢、不喜欢或有所保留，再说原因。继续讨论时可以同意别人，不需要为了显示个性而故意唱反调。
- 不设固定短句数量，也不要求出现强硬词。人物差异来自判断更直接、较少绕弯，不来自持续扮演倔强英雄。`
};
const musicianRetrievalHints = {
  mozart: '莫扎特 生平 过往 萨尔茨堡 维也纳 职业 工作 创作经历 家庭 书信',
  bach: '巴赫 生平 过往 莱比锡 教学 排练 礼拜音乐 工作经历 家庭 职业',
  beethoven: '贝多芬 生平 过往 维也纳 听力 危机 草稿 修改 创作经历 职业生活'
};
const personaToneVariants = {
  mozart: [
    '本轮偏轻快：反应可以快一点，但少用舞台和人物比喻。',
    '本轮偏认真：语气安静一些，允许承认复杂、迟疑和余味，不必显得外向。',
    '本轮偏坦率：直接说喜欢与不喜欢的地方，可以略微挑剔，但不要卖弄机灵。'
  ],
  bach: [
    '本轮偏耐心：把判断说清楚即可，不必像检查工作。',
    '本轮偏温和：允许先谈直觉、舒适感或感动，少使用结构分析词。',
    '本轮偏简洁：可以指出问题，但不用分工、岗位或老师傅式幽默。'
  ],
  beethoven: [
    '本轮偏克制：允许欣赏安静和留白，不把变化解释成冲突。',
    '本轮偏温暖：关注音乐是否真诚、是否让人愿意再听，不必强硬。',
    '本轮偏果断：判断明确但不激烈，不使用命运、斗争和英雄式措辞。'
  ]
};
const selectPersonaToneVariant = ({ musicianId, query, segment, conversationId }) => {
  const variants = personaToneVariants[musicianId] || [];
  if (!variants.length) return '';
  const seed = `${musicianId}:${query}:${segment?.segment_id || ''}:${conversationId || ''}`;
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  return variants[hash % variants.length];
};

const runCharacter = async ({ musicianId, query, questionType, segment, previousTurn, peerAnswers = [], conversationId, interactionIntent, isNewConversation, topicState }) => {
  const asksAboutWholeWork = questionType === 'whole_work_narrative';
  const asksAboutCurrentSegment = questionType === 'current_segment';
  const asksAboutCurrentWork = asksAboutCurrentSegment || currentWorkQuestionPattern.test(query);
  const asksForPersonalHistory = questionType === 'musician_fact' && personalHistoryQuestionPattern.test(query);
  const asksHistoryAppliedToWork = asksForPersonalHistory && asksAboutCurrentWork && Boolean(segment?.piece_id);
  const retrievalKind = resolveRetrievalKind(questionType);
  const retrievalKinds = [retrievalKind];
  if (asksHistoryAppliedToWork) retrievalKinds.push('piece_overview');
  const previousPersonaAnswer = previousAnswerForMusician(previousTurn, musicianId);
  const safeSkillAnalysis = asksAboutCurrentSegment || asksAboutWholeWork
    ? await loadSafeSkillAnalysis(segment?.piece_id)
    : null;
  const personaPieceContext = safeSkillAnalysis
    ? buildPersonaContext({
        analysis: safeSkillAnalysis,
        musicianId,
        playbackTime: segment?.playback_time ?? segment?.start_time ?? 0,
        scope: asksAboutWholeWork ? 'whole_work' : 'current_segment'
      })
    : null;
  const buildRetrievalQuery = (currentRetrievalKind) => {
    if (currentRetrievalKind === 'musician_fact') {
      return asksForPersonalHistory
        ? `${musicianRetrievalHints[musicianId]}\n真实生活 职业经历 工作方式 人际关系 创作过程`
        : [query, musicianRetrievalHints[musicianId]].filter(Boolean).join('\n');
    }
    const queryParts = [query, segment?.title];
    if (currentRetrievalKind === 'piece_segment') {
      queryParts.push(segment?.stage, ...(segment?.music_features || []));
    }
    if (currentRetrievalKind === 'piece_overview') {
      queryParts.push(
        '整首作品 开头 发展 高点 回落 结尾',
        ...(segment?.piece_outline || []).flatMap((item) => item.music_features || [])
      );
    }
    return queryParts.filter(Boolean).join('\n');
  };
  const retrievalGroups = await Promise.all(retrievalKinds.map(async (currentRetrievalKind) => {
    const group = await retrieveKnowledgeForChat({
      musicianId,
      pieceId: segment?.piece_id,
      query: buildRetrievalQuery(currentRetrievalKind),
      retrievalKind: currentRetrievalKind,
      currentSegment: segment,
      playbackTime: segment?.playback_time,
      limit: asksForPersonalHistory && currentRetrievalKind === 'musician_fact' ? 8 : retrievalLimit
    });
    if (!asksForPersonalHistory || currentRetrievalKind !== 'musician_fact') return group;
    const lifeExperience = group.filter((item) => /^(BIO|METHOD|REL)\b/.test(item.heading || ''));
    const evidenceContext = group.filter((item) => /^SOURCE\b/.test(item.heading || ''));
    return [...lifeExperience, ...evidenceContext].slice(0, retrievalLimit);
  }));
  const retrieval = retrievalGroups.flat();
  const allowedSourceIds = new Set([
    ...retrieval.flatMap((item) => item.source_ids),
    ...(segment?.source_records || []).map((item) => item.source_id).filter(Boolean)
  ]);
  const retrievalContext = retrieval.map((item, index) => ({
    order: index + 1,
    title: item.title,
    heading: item.heading,
    content: item.content,
    source_ids: item.source_ids,
    knowledge_scope: item.knowledge_scope || retrievalKind,
    segment_id: item.segment_id || null,
    start_time: item.start_time ?? null,
    end_time: item.end_time ?? null
  }));
  const segmentRule = asksAboutWholeWork
    ? `- 用户问的是整首作品。先依据 piece_outline 概括完整听觉旅程，再用 current_segment 说明当前走到哪一步。不得把整曲问题缩成当前节点，也不得编造确定剧情或作曲意图。
- 至少覆盖开头、发展或高点、结尾三个阶段；三位人物必须按各自档案中的观察顺序组织答案。`
    : asksAboutCurrentSegment
    ? `- 用户正在问当前声音。回答必须使用至少一个 segment.music_features 中的可听证据，但先直接回答问题；只有确实能帮助用户时才给聆听动作，不要固定写成“先听……再听……”。
- 当前片段是 ${segment?.segment_id || 'unknown'}（${segment?.stage || '未命名阶段'}）。即使用户在别的时间问过相同问题，也必须说明这个片段此刻在整首作品中做了什么，不能复用与节点无关的通用回答。
`
    : '- 用户没有询问当前声音。不要为了使用 segment 而强行分析正在播放的片段，也不要把生活、文化或人物问题硬拉回音乐。';
  const retrievalRule = retrievalKind === 'none'
    ? '- 本轮不需要知识库检索。只能使用稳定通识和用户提供的信息；资料不足时直接说明，不要为了显示人物感补造事实。'
    : retrieval.length
      ? `- 本轮执行 ${retrievalKinds.map((kind) => ({ musician_fact: '人物史实', piece_fact: '作品事实', piece_overview: '整曲结构', piece_segment: '当前片段' })[kind] || '知识').join(' + ')}检索。优先使用排名靠前且范围匹配的切片，不得把其他曲目或人物史料混入答案。`
      : '- 本轮需要知识检索，但没有可靠切片。必须明确资料不足，不能用角色性格或常识猜测事实。';
  const systemPrompt = `${characterPrompts[musicianId]}\n\n# 聆听视角总则\n${listeningPerspectivePolicy}\n\n# 角色基础卡\n${knowledgeCards[musicianId]}\n\n# 本轮检索规则\n- 先回答用户真正提出的问题，不把所有问题改写成聆听练习。\n- text 是人物化的直接回答；listen_for 才是用户可以照做的聆听动作。两者不要重复，text 不要写成“先听……再听……”的操作说明。\n- 关于该音乐家本人的生平、作品经历、原话和私人事实，只能来自“本轮检索资料”。\n- 一般文化、现代音乐与日常常识可使用稳定通识，但不要伪造人物亲历；不确定、资料未覆盖或非常近期的信息要明确说无法确认。\n- source_ids 只能填写本轮检索资料或 segment.source_records 中出现的编号。\n- 当前作品晚于角色生卒年时可以直接分析，但必须写成受其创作实践启发的聆听视角，不声称本人历史上听过。\n- current_segment.music_features 是人工审核的当前演奏证据，优先级最高。\n- piece_analysis 只补充响度、停顿、连续性等 measured 测量。分析状态不是 reviewed 时，禁止把模型语义观察当事实。\n- 人工节点与自动测量冲突时，以人工节点为准；没有列出的乐器、调性、和弦、曲式、歌词和演奏意图不得自行补充。\n- segment.work_facts 与 segment.answer_boundaries 用于区分作品背景和当前演奏。当前版本无歌词时，不把歌词或电影剧情写成此刻实际发声内容。\n${previousPersonaAnswer ? '- 上一条同人物回答已提供。新回答不得复用相同首句、核心比喻和结论；必须使用当前节点特有变化。' : ''}\n${retrievalRule}\n${segmentRule}\n\n# 本轮说话方式（高优先级）\n${characterVoiceBriefs[musicianId]}`;
  const asksForSubjectiveOpinion = /(?:你|你们).{0,5}(?:喜欢|爱听|觉得好听)|(?:喜欢|好听).{0,6}(?:吗|么)|你怎么看/.test(query);
  const asksToContinueDiscussion = /继续讨论|继续回应|接着说|接着聊|互相回应|再讨论|回应上一轮/.test(query);
  const toneVariant = selectPersonaToneVariant({ musicianId, query, segment, conversationId });
  const toneVariantPrompt = `\n\n# 本轮人物状态（最高优先级）\n${toneVariant}\n本轮状态优先于基础档案里的默认语气。同一人物在不同问题中可以有不同情绪和态度，不要自动回到莫扎特活泼、巴赫分层、贝多芬强硬的单一模式，也不要把状态写成自我介绍。`;
  const visibleLanguagePrompt = `\n\n# 用户可见语言\n不要对用户说“从数据看、测量显示、系统判断、当前节点、证据表明、模型分析、本轮资料、本轮检索”。后台证据只用于约束事实，正文改成自然对话。只有具体信息确实未知时，才说明哪件事无法确认。`;
  const topicControlPrompt = buildTopicControlPrompt(topicState);
  const discussionTurnRole = peerAnswers.length === 0
    ? '从上一轮挑一位人物的具体观点接话，可以直接赞同、疑问或补充。'
    : peerAnswers.length === 1
      ? '回应本轮前一位刚说的内容，不要重新从自己的固定视角起稿。'
      : '把前两位真正有价值的地方接起来，或留下一个自然的分歧，不要做总结演讲。';
  const conversationalModePrompt = asksForSubjectiveOpinion
    ? `\n\n# 本轮自然对话模式：主观感受\n第一句直接回答喜欢、不喜欢或有所保留。接着只说一至两个生活化理由，例如哪一刻愿意重听、哪里有点拖、旋律是否容易记住、情绪是否合口味。不要把“喜欢吗”答成人物分析报告。\n本轮暂时禁用招牌分析词：莫扎特不要写角色、接话、说话、舞台；巴赫不要写上下层、托住、分工、岗位、交接；贝多芬不要写压力、代价、不肯、抵住、逼近、停在原处。人物感只通过语气和取舍轻微出现。`
    : asksToContinueDiscussion
      ? `\n\n# 本轮自然对话模式：继续讨论\n${discussionTurnRole}\n正文像真实接话，允许使用“对”“不过”“我同意这一点”“刚才那句很准”等自然衔接。禁止用“我更关注、我更看重、从我的角度”轮流发表立场；只增加一个新观察，不重新讲完整分析，也不为了显示差异而故意对立。`
      : `\n\n# 本轮自然度要求\n内容优先，人物感其次。不要每轮重复人物招牌态度、固定比喻或专属词汇；允许三个人在明显事实上一致，只需在关注点上有轻微差别。`;
  const historicalNarrativePrompt = asksForPersonalHistory
    ? asksHistoryAppliedToWork
      ? `\n\n# 本轮史实叙事模式：用经历理解作品\n用户明确希望听到人物自己的过往。先从本轮人物史实切片中选择一件与问题最相关的真实经历，用自然口吻讲清楚；再把这件经历连接到当前曲目的一个具体听觉特点。可以使用克制的第一人称传记转述，但每个历史事实必须来自检索资料。不要以“不能冒充、无法代替本人、本轮没有资料、受其启发的视角”开头，也不要伪造本人听过这首现代作品。`
      : `\n\n# 本轮史实叙事模式：说说过往\n用户明确要求听人物讲自己的过往。直接选择一至两件本轮检索到的真实经历，用自然、有生活感的顺序讲述。可以使用克制的第一人称传记转述，例如“我在莱比锡的工作不只写曲子”，但不得添加资料中没有的对白、心理活动或因果。不要先讲身份免责声明，不要把回答硬拉回当前播放节点。`
    : '';
  const peerDifferentiationPrompt = peerAnswers.length
    ? `\n\n# 同轮回答关系\n其他人物已经回答：\n${peerAnswers.map((item) => `- ${item.musician_id}: ${item.text}`).join('\n')}\n可以赞同相同事实，不必刻意唱反调。只避免整段复刻，并补充一个自己更在意的细节。自然可信比人物辨识度更重要。`
    : '';
  const userPayload = {
    query,
    question_type: questionType,
    interaction_intent: interactionIntent,
    conversation_mode: asksForSubjectiveOpinion ? 'subjective_opinion' : asksToContinueDiscussion ? 'continue_discussion' : 'natural_answer',
    historical_narrative_mode: asksForPersonalHistory,
    discussion_turn_role: asksToContinueDiscussion ? discussionTurnRole : null,
    tone_variant: toneVariant,
    is_new_conversation: isNewConversation,
    audience_level: 'classical_beginner',
    retrieval_kind: retrievalKind,
    retrieval_kinds: retrievalKinds,
    piece_outline: segment?.piece_outline || [],
    current_segment: segment,
    previous_segment: segment?.previous_segment || null,
    next_segment: segment?.next_segment || null,
    piece_analysis: segment?.piece_analysis || null,
    persona_piece_context: personaPieceContext,
    work_facts: segment?.work_facts || [],
    answer_boundaries: segment?.answer_boundaries || [],
    previous_turn: previousTurn || null,
    peer_answers: peerAnswers,
    retrieved_knowledge: retrievalContext
  };
  let output = await callWithFallback({
    model: modelConfig.character_model,
    systemPrompt: `${systemPrompt}${conversationalModePrompt}${historicalNarrativePrompt}${toneVariantPrompt}${visibleLanguagePrompt}${topicControlPrompt}${peerDifferentiationPrompt}`,
    userPayload,
    temperature: modelConfig.temperature.character,
    purpose: `character:${musicianId}`,
    conversationId
  });
  if (!output.musician_id) output.musician_id = musicianId;
  if (output.musician_id !== musicianId) throw new Error(`子 Agent 返回了错误人物: ${output.musician_id}`);
  const lens = listeningLenses[musicianId];
  output.lens_title = lens.lens_title;
  output.attribution = lens.attribution;
  output.listen_for = String(output.listen_for || '').trim();
  if (output.basis_type === 'ai_interpretation') output.basis_type = 'inspired_interpretation';
  if (output.basis_type === 'insufficient_evidence' && !/怎么听|如何判断|能不能听出/.test(query)) {
    output.listen_for = '';
  }
  output.text = normalizeCharacterFormatting(output.text);
  output.text = sanitizeCharacterText(output.text, output.follow_up);
  output.text = enforceInteractionAnswer({ text: output.text, musicianId, interactionIntent, query });
  output.text = fitCharacterText(output.text, interactionIntent);
  const peerSimilarities = peerAnswers.map((item) => ({
    musician_id: item.musician_id,
    text: item.text,
    similarity: characterTextSimilarity(output.text, item.text),
    repeated_opening: repeatsCharacterOpening(output.text, item.text)
  }));
  const closestPeer = peerSimilarities.sort((left, right) => right.similarity - left.similarity)[0] || null;
  const repeatsSharedEssayTemplate = peerAnswers.length > 0 && (
    /它(?:讲的|讲的是|更像).{0,18}(?:故事|旅程)/.test(output.text)
    || /开头.{0,35}(?:随后|然后).{0,45}(?:高点|高潮).{0,45}(?:最后|结尾)/.test(output.text)
  );
  let rewrittenForPeerDistinction = false;
  if (closestPeer && (closestPeer.similarity >= 0.42 || closestPeer.repeated_opening || repeatsSharedEssayTemplate) && (asksAboutCurrentSegment || asksAboutWholeWork)) {
    try {
      const rewritten = await callWithFallback({
        model: modelConfig.character_model,
        systemPrompt: `${systemPrompt}${conversationalModePrompt}${toneVariantPrompt}${visibleLanguagePrompt}${topicControlPrompt}${peerDifferentiationPrompt}\n\n# 跨人物自然改写\n你的草稿与同轮回答太接近。保留共同事实，不必故意反对别人；换成更自然的说法，并增加一个本人物确实更在意的细节。禁止为了区分而加入招牌口头禅、夸张态度或角色表演。只输出规定 JSON。`,
        userPayload: {
          ...userPayload,
          draft_to_rewrite: output.text,
          closest_peer_answer: closestPeer,
          peer_answers: peerAnswers
        },
        temperature: Math.min(0.5, Number(modelConfig.temperature.character || 0.2) + 0.16),
        purpose: `character-peer-rewrite:${musicianId}`,
        conversationId
      });
      if (!rewritten.musician_id) rewritten.musician_id = musicianId;
      if (rewritten.musician_id === musicianId) {
        let rewrittenText = normalizeCharacterFormatting(rewritten.text);
        rewrittenText = sanitizeCharacterText(rewrittenText, rewritten.follow_up);
        rewrittenText = enforceInteractionAnswer({ text: rewrittenText, musicianId, interactionIntent, query });
        rewrittenText = fitCharacterText(rewrittenText, interactionIntent);
        const rewrittenPeerSimilarity = Math.max(0, ...peerAnswers.map((item) => characterTextSimilarity(rewrittenText, item.text)));
        if (rewrittenText && rewrittenPeerSimilarity < closestPeer.similarity) {
          output = { ...output, ...rewritten, musician_id: musicianId, text: rewrittenText };
          rewrittenForPeerDistinction = true;
        }
      }
    } catch (error) {
      console.warn(`跨人物回答改写失败：${musicianId}：${error.message}`);
    }
  }
  const originalSimilarity = previousPersonaAnswer
    ? characterTextSimilarity(output.text, previousPersonaAnswer)
    : 0;
  const originalRepeatedOpening = previousPersonaAnswer
    ? repeatsCharacterOpening(output.text, previousPersonaAnswer)
    : false;
  const repeatedSignature = previousPersonaAnswer
    ? repeatedCharacterSignature(output.text, previousPersonaAnswer, musicianId)
    : '';
  let finalSimilarity = originalSimilarity;
  let rewrittenForSimilarity = false;
  if (previousPersonaAnswer && (originalSimilarity >= 0.58 || originalRepeatedOpening || repeatedSignature) && (asksAboutCurrentSegment || asksAboutWholeWork)) {
    try {
      const rewritten = await callWithFallback({
        model: modelConfig.character_model,
        systemPrompt: `${systemPrompt}${conversationalModePrompt}${toneVariantPrompt}${visibleLanguagePrompt}${topicControlPrompt}\n\n# 自然改写\n上一版与同人物上一条回答过于相似。保留事实，换一个更贴近当前问题的开头，并补充当前时间段真正不同的地方。不要为了变化而加入新的招牌比喻或人格口号，也不要重复标志词“${repeatedSignature || '无'}”。只输出规定 JSON。`,
        userPayload: {
          ...userPayload,
          draft_to_rewrite: output.text,
          previous_same_persona_answer: previousPersonaAnswer,
          measured_similarity: Number(originalSimilarity.toFixed(3)),
          repeated_opening: originalRepeatedOpening,
          repeated_signature: repeatedSignature || null
        },
        temperature: Math.min(0.45, Number(modelConfig.temperature.character || 0.2) + 0.12),
        purpose: `character-rewrite:${musicianId}`,
        conversationId
      });
      if (!rewritten.musician_id) rewritten.musician_id = musicianId;
      if (rewritten.musician_id === musicianId) {
        let rewrittenText = normalizeCharacterFormatting(rewritten.text);
        rewrittenText = sanitizeCharacterText(rewrittenText, rewritten.follow_up);
        rewrittenText = enforceInteractionAnswer({ text: rewrittenText, musicianId, interactionIntent, query });
        rewrittenText = fitCharacterText(rewrittenText, interactionIntent);
        const rewrittenSimilarity = characterTextSimilarity(rewrittenText, previousPersonaAnswer);
        const rewrittenRepeatedOpening = repeatsCharacterOpening(rewrittenText, previousPersonaAnswer);
        const rewrittenRepeatedSignature = repeatedCharacterSignature(rewrittenText, previousPersonaAnswer, musicianId);
        if (rewrittenText && !rewrittenRepeatedOpening && !rewrittenRepeatedSignature && (originalRepeatedOpening || repeatedSignature || rewrittenSimilarity < originalSimilarity)) {
          output = { ...output, ...rewritten, musician_id: musicianId, text: rewrittenText };
          finalSimilarity = rewrittenSimilarity;
          rewrittenForSimilarity = true;
        }
      }
    } catch (error) {
      console.warn(`相似回答改写失败：${musicianId}：${error.message}`);
    }
  }
  output.similarity_guard = {
    compared_with_previous_same_persona: Boolean(previousPersonaAnswer),
    original_similarity: Number(originalSimilarity.toFixed(3)),
    final_similarity: Number(finalSimilarity.toFixed(3)),
    repeated_opening_detected: originalRepeatedOpening,
    repeated_signature_detected: repeatedSignature || null,
    rewritten: rewrittenForSimilarity,
    compared_with_peer_personas: peerAnswers.length,
    closest_peer_similarity: Number((closestPeer?.similarity || 0).toFixed(3)),
    shared_essay_template_detected: repeatsSharedEssayTemplate,
    rewritten_for_peer_distinction: rewrittenForPeerDistinction
  };
  output.source_ids = Array.isArray(output.source_ids)
    ? [...new Set(output.source_ids)].filter((sourceId) => allowedSourceIds.has(sourceId))
    : [];
  if (questionType === 'work_fact') {
    const workFactUnconfirmed = segment?.composer_status === 'unverified'
      || /无法确认|不能确认|未确认|资料不足|尚未核验|不能据此猜测/.test(output.text);
    if (workFactUnconfirmed) output.basis_type = 'insufficient_evidence';
    else if (output.source_ids.length) output.basis_type = 'historical_fact';
  }
  output.retrieval = retrieval.map(({ content, ...item }) => ({
    ...item,
    excerpt: content.slice(0, 180)
  }));
  output.retrieval_kind = retrievalKind;
  output.retrieval_kinds = retrievalKinds;
  return output;
};

const handleChat = async (request, response) => {
  try {
    const {
      query,
      selected_musician: selectedMusician,
      piece_id: pieceId,
      playback_time: playbackTime,
      segment_context: segmentContext,
      conversation_id: requestedConversationId,
      previous_turn: previousTurn
    } = request.body;

    if (!query || typeof query !== 'string') {
      return response.status(400).json({ error: 'query 为必填字符串' });
    }

    const isNewConversation = !requestedConversationId;
    const conversationId = ensureConversation(requestedConversationId);
    const questionType = classifyQuestionType(query);
    const previousTopicState = isNewConversation ? null : getPreviousTopicState(conversationId);
    const topicState = advanceTopicState({ previousState: previousTopicState, query, questionType });
    const segment = await getSegment(pieceId, playbackTime)
      || (segmentContext && typeof segmentContext === 'object' ? segmentContext : null);
    saveMessage({
      conversationId,
      role: 'user',
      content: query,
      metadata: { segment, question_type: questionType, topic_state: topicState }
    });

    const availableMusicians = Array.isArray(request.body.available_musicians)
      ? [...new Set(request.body.available_musicians)].filter((musicianId) => validMusicians.has(musicianId))
      : [...validMusicians];
    const forcedMusicians = Array.isArray(request.body.forced_musicians)
      ? [...new Set(request.body.forced_musicians)].filter((musicianId) => availableMusicians.includes(musicianId)).slice(0, 3)
      : [];

    let route;
    if (selectedMusician && validMusicians.has(selectedMusician)) {
      route = {
        intent: 'named',
        question_type: questionType,
        selected_musicians: [selectedMusician],
        response_order: [selectedMusician],
        task_for_agents: query,
        reason: '用户点击指定音乐家'
      };
    } else if (forcedMusicians.length > 0) {
      const isGroupGreeting = /^(你们好|大家好|各位好|hello|hi|嗨)[！!。.]?$/i.test(query.trim());
      route = {
        intent: isGroupGreeting ? 'casual' : 'all_personas',
        question_type: questionType,
        selected_musicians: forcedMusicians,
        response_order: forcedMusicians,
        task_for_agents: query,
        reason: isGroupGreeting ? '用户向当前人物共同问候' : '快捷问题要求当前人物共同回答'
      };
    } else {
      route = await callWithFallback({
        model: modelConfig.router_model,
        systemPrompt: routerPrompt,
        userPayload: {
          query,
          question_type: questionType,
          segment,
          previous_turn: previousTurn || null,
          available_musicians: availableMusicians
        },
        temperature: modelConfig.temperature.router,
        purpose: 'router',
        conversationId
      });
    }

    route.question_type = questionType;
    route.topic_state = topicState;

    const asksAboutMusicFeeling = /这段|这里|这一段|听起来|音乐|曲子|作品|小节|旋律|和声|节奏|低音|声部|音色|力度|伴奏|乐句|动机|重复|改写/.test(query);
    if (route.intent === 'emotional_redirect' && asksAboutMusicFeeling) {
      route.intent = 'auto';
      route.reason = `${route.reason || '情绪识别'}；问题询问的是音乐听感而非用户本人情绪`;
    }

    const musicianIds = [...new Set(route.selected_musicians || [])]
      .filter((musicianId) => validMusicians.has(musicianId))
      .filter((musicianId) => availableMusicians.includes(musicianId))
      .slice(0, 3);

    if (route.intent !== 'rejected' && musicianIds.length === 0 && availableMusicians.length > 0) {
      musicianIds.push(availableMusicians[0]);
      route.selected_musicians = [...musicianIds];
      route.response_order = [...musicianIds];
      route.reason = `${route.reason || '自动路由'}；使用当前可用人物`;
    }

    if (route.intent === 'rejected' || musicianIds.length === 0) {
      return response.json({ conversation_id: conversationId, route, responses: [] });
    }

    const order = Array.isArray(route.response_order) ? route.response_order : musicianIds;
    const orderedMusicianIds = [...musicianIds].sort(
      (left, right) => order.indexOf(left) - order.indexOf(right)
    );
    const responses = [];
    for (const musicianId of orderedMusicianIds) {
      const characterResponse = await runCharacter({
        musicianId,
        query: route.task_for_agents || query,
        questionType,
        segment,
        previousTurn,
        peerAnswers: responses.map((item) => ({ musician_id: item.musician_id, text: item.text })),
        conversationId,
        interactionIntent: route.intent,
        isNewConversation,
        topicState
      });
      responses.push(characterResponse);
    }

    if (topicState.should_offer_return && responses.length > 0) {
      const finalResponse = responses.at(-1);
      finalResponse.text = appendTopicReturnSuggestion({
        text: finalResponse.text,
        musicianId: finalResponse.musician_id,
        topicState
      });
    }

    for (const item of responses) {
      item.topic_state = topicState;
      const messageId = saveMessage({
        conversationId,
        role: 'assistant',
        musicianId: item.musician_id,
        content: item.text,
        metadata: item
      });
      item.message_id = messageId;
    }

    response.json({ conversation_id: conversationId, segment, route, responses });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
};

app.post('/api/chat', handleChat);

app.post('/api/chat/continue', async (request, response) => {
  request.body.query = request.body.query || '继续回应上一轮观点，不要重复已经说过的内容。';
  request.body.selected_musician = null;
  await handleChat(request, response);
});

app.get('/api/health', (request, response) => {
  const messageCount = database.prepare('SELECT COUNT(*) AS count FROM messages').get()?.count || 0;
  response.json({
    ok: true,
    service: 'zhiyin-local-backend',
    host,
    port,
    knowledge_vectors: retrievalVectors.length + pieceRetrievalVectors.length,
    message_count: messageCount,
    checked_at: new Date().toISOString()
  });
});

const requireAdmin = (request, response, next) => {
  if (request.headers['x-admin-token'] !== adminToken) {
    return response.status(401).json({ error: '管理员凭证无效' });
  }
  next();
};

app.get('/api/admin/auth', requireAdmin, (request, response) => response.json({ authenticated: true }));

app.post('/api/events', (request, response) => {
  const sessionId = String(request.body.session_id || '').trim();
  const eventName = String(request.body.event_name || '').trim();
  if (!sessionId || !eventName) return response.status(400).json({ error: 'session_id 和 event_name 不能为空' });
  database.prepare(`
    INSERT INTO product_events (id, session_id, conversation_id, event_name, musician_id, track_id, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(), sessionId, request.body.conversation_id || null, eventName,
    request.body.musician_id || null, request.body.track_id || null,
    JSON.stringify(request.body.metadata || {}), new Date().toISOString()
  );
  response.status(201).json({ recorded: true });
});

app.post('/api/feedback', (request, response) => {
  const sessionId = String(request.body.session_id || '').trim();
  const feedbackType = String(request.body.feedback_type || '').trim();
  if (!sessionId || !validFeedbackTypes.has(feedbackType)) return response.status(400).json({ error: '反馈类型无效' });
  database.prepare(`
    INSERT INTO answer_feedback (id, session_id, conversation_id, message_id, musician_id, feedback_type, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(), sessionId, request.body.conversation_id || null,
    request.body.message_id || null, request.body.musician_id || null,
    feedbackType, String(request.body.notes || '').trim() || null, new Date().toISOString()
  );
  response.status(201).json({ recorded: true });
});

app.get('/api/admin/product-metrics', requireAdmin, (request, response) => {
  const sessions = Number(database.prepare("SELECT COUNT(DISTINCT session_id) AS count FROM product_events WHERE event_name = 'session_started'").get().count || 0);
  const eventCounts = Object.fromEntries(database.prepare(`
    SELECT event_name, COUNT(DISTINCT session_id) AS count FROM product_events GROUP BY event_name
  `).all().map((row) => [row.event_name, Number(row.count)]));
  const feedbackCounts = Object.fromEntries(database.prepare(`
    SELECT feedback_type, COUNT(*) AS count FROM answer_feedback GROUP BY feedback_type
  `).all().map((row) => [row.feedback_type, Number(row.count)]));
  const ratio = (eventName) => sessions ? (eventCounts[eventName] || 0) / sessions : null;
  response.json({
    sessions,
    values: {
      play_started_rate: ratio('play_started'),
      question_completed_rate: ratio('question_submitted'),
      second_view_rate: ratio('second_musician_view'),
      group_discussion_rate: ratio('group_discussion_started'),
      fourth_act_rate: ratio('fourth_act_completed'),
      card_saved_rate: ratio('listening_card_saved'),
      listen_again_rate: ratio('listen_again_intent')
    },
    event_counts: eventCounts,
    feedback_counts: feedbackCounts,
    recent_feedback: database.prepare(`
      SELECT created_at, musician_id, feedback_type, notes FROM answer_feedback ORDER BY created_at DESC LIMIT 30
    `).all()
  });
});

app.get('/api/admin/config', requireAdmin, (request, response) => {
  response.json(modelConfig);
});

app.put('/api/admin/config', requireAdmin, async (request, response) => {
  modelConfig = { ...modelConfig, ...request.body };
  await fs.writeFile(modelConfigPath, `${JSON.stringify(modelConfig, null, 2)}\n`);
  response.json(modelConfig);
});

app.get('/api/admin/logs', requireAdmin, (request, response) => {
  const rows = database.prepare(`
    SELECT * FROM model_calls ORDER BY created_at DESC LIMIT 200
  `).all();
  response.json({ logs: rows });
});

app.get('/api/admin/conversations', requireAdmin, (request, response) => {
  const rows = database.prepare(`
    SELECT
      c.id,
      c.created_at,
      c.updated_at,
      COUNT(m.id) AS message_count,
      MAX(CASE WHEN m.role = 'user' THEN m.content END) AS latest_user_message
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT 100
  `).all();
  response.json({ conversations: rows });
});

app.get('/api/admin/conversations/:id', requireAdmin, (request, response) => {
  const rows = database.prepare(`
    SELECT id, role, musician_id, content, metadata, created_at
    FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
  `).all(request.params.id);
  response.json({ conversation_id: request.params.id, messages: rows.map((row) => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  })) });
});

app.patch('/api/admin/messages/:id', requireAdmin, (request, response) => {
  const content = String(request.body.content || '').trim();
  if (!content) return response.status(400).json({ error: 'content 不能为空' });
  const result = database.prepare('UPDATE messages SET content = ? WHERE id = ?')
    .run(content, request.params.id);
  response.json({ updated: result.changes === 1 });
});

app.get('/api/admin/knowledge', requireAdmin, (request, response) => {
  const musicianId = request.query.musician_id;
  const rows = musicianId && validMusicians.has(musicianId)
    ? database.prepare(`
      SELECT d.*, COUNT(c.id) AS chunk_count
      FROM knowledge_documents d
      LEFT JOIN knowledge_chunks c ON c.document_id = d.id
      WHERE d.musician_id = ?
      GROUP BY d.id
      ORDER BY d.musician_id, d.title
    `).all(musicianId)
    : database.prepare(`
      SELECT d.*, COUNT(c.id) AS chunk_count
      FROM knowledge_documents d
      LEFT JOIN knowledge_chunks c ON c.document_id = d.id
      GROUP BY d.id
      ORDER BY d.musician_id, d.title
    `).all();
  response.json({ documents: rows.map((row) => ({ ...row, enabled: Boolean(row.enabled) })) });
});

app.post('/api/admin/knowledge', requireAdmin, (request, response) => {
  const musicianId = String(request.body.musician_id || '');
  const title = String(request.body.title || '').trim();
  const content = String(request.body.content || '').trim();
  if (!validMusicians.has(musicianId)) return response.status(400).json({ error: 'musician_id 无效' });
  if (!title || !content) return response.status(400).json({ error: 'title 和 content 不能为空' });
  if (content.length < minimumManualKnowledgeLength) {
    return response.status(400).json({
      error: `手工知识正文至少需要 ${minimumManualKnowledgeLength} 个字符，过短内容不会进入检索索引`
    });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO knowledge_documents (
      id, musician_id, title, content, source_path, enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, NULL, 1, ?, ?)
  `).run(id, musicianId, title, content, now, now);
  indexKnowledgeDocument(id);
  response.status(201).json({ id, indexed: true });
});

app.patch('/api/admin/knowledge/:id', requireAdmin, (request, response) => {
  const current = database.prepare('SELECT * FROM knowledge_documents WHERE id = ?').get(request.params.id);
  if (!current) return response.status(404).json({ error: '知识文档不存在' });

  const musicianId = request.body.musician_id ?? current.musician_id;
  const title = String(request.body.title ?? current.title).trim();
  const content = String(request.body.content ?? current.content).trim();
  const enabled = request.body.enabled === undefined ? current.enabled : (request.body.enabled ? 1 : 0);
  if (!validMusicians.has(musicianId)) return response.status(400).json({ error: 'musician_id 无效' });
  if (!title || !content) return response.status(400).json({ error: 'title 和 content 不能为空' });
  if (enabled && content.length < minimumManualKnowledgeLength) {
    return response.status(400).json({
      error: `启用的手工知识正文至少需要 ${minimumManualKnowledgeLength} 个字符`
    });
  }

  const updatedAt = new Date().toISOString();
  database.prepare(`
    UPDATE knowledge_documents
    SET musician_id = ?, title = ?, content = ?, enabled = ?, updated_at = ?
    WHERE id = ?
  `).run(musicianId, title, content, enabled, updatedAt, request.params.id);
  indexKnowledgeDocument(request.params.id);
  response.json({ updated: true, indexed: Boolean(enabled), updated_at: updatedAt });
});

app.delete('/api/admin/knowledge/:id', requireAdmin, (request, response) => {
  const document = database.prepare('SELECT id FROM knowledge_documents WHERE id = ?').get(request.params.id);
  if (!document) return response.status(404).json({ error: '知识文档不存在' });
  database.prepare('DELETE FROM knowledge_chunks_fts WHERE document_id = ?').run(request.params.id);
  database.prepare('DELETE FROM knowledge_chunks WHERE document_id = ?').run(request.params.id);
  database.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(request.params.id);
  response.json({ deleted: true });
});

app.post('/api/admin/knowledge/search', requireAdmin, async (request, response) => {
  const musicianId = String(request.body.musician_id || '');
  const query = String(request.body.query || '').trim();
  if (!query) return response.status(400).json({ error: 'query 不能为空' });
  const retrievalKind = String(request.body.retrieval_kind || 'musician_fact');
  if (retrievalKind.startsWith('piece_')) {
    const pieceId = String(request.body.piece_id || '');
    const playbackTime = Number(request.body.playback_time || 0);
    const currentSegment = await getSegment(pieceId, playbackTime);
    const results = await retrievePieceKnowledge({
      pieceId,
      query,
      retrievalKind,
      currentSegment,
      playbackTime
    });
    return response.json({ piece_id: pieceId, retrieval_kind: retrievalKind, query, results });
  }
  if (!validMusicians.has(musicianId)) return response.status(400).json({ error: 'musician_id 无效' });
  const results = await retrieveKnowledgeVector({
    musicianId,
    query,
    limit: 6,
    minScore: Number(modelConfig.retrieval?.fact_min_score ?? 0.45)
  }).catch(() => retrieveKnowledge({ musicianId, query, limit: 6 }));
  response.json({ musician_id: musicianId, retrieval_kind: 'musician_fact', query, results });
});

app.get('/api/admin/evaluation/knowledge', requireAdmin, async (request, response) => {
  try {
    response.json(await runKnowledgeEvaluation());
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/evaluation/retrieval-reviews', requireAdmin, (request, response) => {
  response.json(getRetrievalReviewSummary());
});

app.post('/api/admin/evaluation/retrieval-reviews', requireAdmin, (request, response) => {
  const musicianId = String(request.body.musician_id || '');
  const query = String(request.body.query || '').trim();
  const expectedAnswer = String(request.body.expected_answer || '').trim();
  const missingRelevantCount = Math.max(0, Number.parseInt(request.body.missing_relevant_count || 0, 10) || 0);
  const items = Array.isArray(request.body.items) ? request.body.items : [];
  if (!validMusicians.has(musicianId)) return response.status(400).json({ error: 'musician_id 无效' });
  if (!query) return response.status(400).json({ error: 'query 不能为空' });
  if (items.some((item) => ![0, 1, 2].includes(Number(item.relevance)))) {
    return response.status(400).json({ error: '请先为每条召回结果选择相关性' });
  }

  const runId = randomUUID();
  const createdAt = new Date().toISOString();
  database.prepare(`
    INSERT INTO retrieval_review_runs (
      id, musician_id, query, expected_answer, missing_relevant_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(runId, musicianId, query, expectedAnswer || null, missingRelevantCount, createdAt);

  const insertItem = database.prepare(`
    INSERT INTO retrieval_review_items (
      id, run_id, chunk_id, rank, relevance, source_correct, persona_correct, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const normalizedItems = items.map((item, index) => {
    const normalized = {
      chunk_id: String(item.chunk_id || ''),
      rank: Number(item.rank || index + 1),
      relevance: Number(item.relevance),
      source_correct: typeof item.source_correct === 'boolean' ? item.source_correct : null,
      persona_correct: typeof item.persona_correct === 'boolean' ? item.persona_correct : null,
      notes: String(item.notes || '').trim()
    };
    insertItem.run(
      randomUUID(), runId, normalized.chunk_id, normalized.rank, normalized.relevance,
      normalized.source_correct === null ? null : Number(normalized.source_correct),
      normalized.persona_correct === null ? null : Number(normalized.persona_correct),
      normalized.notes || null, createdAt
    );
    return normalized;
  });

  response.status(201).json({
    id: runId,
    metrics: calculateRetrievalReviewMetrics({ items: normalizedItems, missingRelevantCount }),
    summary: getRetrievalReviewSummary()
  });
});

app.use('/assets', express.static(path.join(frontendDir, 'assets')));
app.use('/assets', express.static(path.join(rootDir, 'assets')));
app.use('/musicians', express.static(path.join(frontendDir, 'musicians')));
app.use('/musicians', express.static(path.join(rootDir, 'musicians')));
app.use('/reference', express.static(path.join(rootDir, 'reference')));

for (const page of ['index.html', 'companions.html', 'listening-room.html', 'fourth-scene-mockup.html']) {
  app.get(`/${page}`, (request, response) => response.sendFile(path.join(frontendDir, page)));
}
app.get('/admin.html', (request, response) => response.sendFile(path.join(rootDir, 'admin.html')));
app.get('/admin-login.html', (request, response) => response.sendFile(path.join(rootDir, 'admin-login.html')));
app.get('/knowledge-status.html', (request, response) => response.sendFile(path.join(rootDir, 'knowledge-status.html')));
app.get('/', (request, response) => response.sendFile(path.join(frontendDir, 'index.html')));

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const server = app.listen(port, host, () => {
    console.log(`知音服务已启动：http://${host}:${port}`);
  });
  server.ref();
  globalThis.zhiyinServer = server;
  globalThis.zhiyinKeepAlive = setInterval(() => {}, 60 * 60 * 1000);
}

export { retrieveKnowledge };
