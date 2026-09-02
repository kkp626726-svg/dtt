const normalizeText = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

const meaningfulTerms = (value) => {
  const text = normalizeText(value);
  const terms = new Set(text.match(/[a-z0-9]{2,}|[\p{Script=Han}]{2,}/gu) || []);
  for (const run of text.match(/[\p{Script=Han}]{3,}/gu) || []) {
    for (let index = 0; index <= run.length - 2; index += 1) terms.add(run.slice(index, index + 2));
  }
  return terms;
};

export const lexicalOverlap = (query, content) => {
  const queryTerms = meaningfulTerms(query);
  if (!queryTerms.size) return 0;
  const contentText = normalizeText(content);
  let hits = 0;
  for (const term of queryTerms) if (contentText.includes(term)) hits += 1;
  return hits / queryTerms.size;
};

export const resolveRetrievalKind = (questionType) => ({
  musician_fact: 'musician_fact',
  work_fact: 'piece_fact',
  whole_work_narrative: 'piece_overview',
  current_segment: 'piece_segment'
}[questionType] || 'none');

const pieceSourceIds = (piece, support) => (piece.source_records || [])
  .filter((record) => !support || (record.supports || []).includes(support))
  .map((record) => record.source_id)
  .filter(Boolean);

const formatTime = (seconds) => {
  const value = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(value / 60);
  const remainder = Math.floor(value % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

export const buildPieceKnowledgeCorpus = (pieces) => pieces.flatMap((piece) => {
  const allSourceIds = pieceSourceIds(piece);
  const segmentSourceIds = pieceSourceIds(piece, 'segment_analysis');
  const aliases = (piece.aliases || []).join('；');
  const workFacts = (piece.work_facts || []).join('\n- ');
  const boundaries = (piece.answer_boundaries || []).join('\n- ');
  const stages = (piece.segments || []).map((segment) => (
    `${formatTime(segment.start_time)}-${formatTime(segment.end_time)} ${segment.stage}：${(segment.music_features || []).join('；')}`
  ));
  const facts = {
    chunk_id: `piece:${piece.piece_id}:facts`,
    piece_id: piece.piece_id,
    knowledge_scope: 'piece_fact',
    title: `${piece.title}｜作品事实`,
    heading: 'WORK_FACT · 作品与当前版本',
    start_time: null,
    end_time: null,
    source_ids: allSourceIds,
    content: [
      `曲目：${piece.title}`,
      `别名：${aliases || '无'}`,
      `作曲者：${piece.composer || '现有资料未确认'}`,
      `作曲者核验状态：${piece.composer_status || '未记录'}`,
      piece.related_work ? `关联作品：${piece.related_work}` : '',
      piece.lyricists?.length ? `词作者：${piece.lyricists.join('、')}` : '',
      `时长：${piece.duration_seconds || '未记录'} 秒`,
      `当前演奏版本：${piece.performance?.type || '未记录'}`,
      `可核验事实：\n- ${workFacts || '无'}`,
      `回答边界：\n- ${boundaries || '无'}`
    ].filter(Boolean).join('\n')
  };
  const overview = {
    chunk_id: `piece:${piece.piece_id}:overview`,
    piece_id: piece.piece_id,
    knowledge_scope: 'piece_overview',
    title: `${piece.title}｜整曲听觉路线`,
    heading: 'WHOLE_WORK · 从开头到结尾',
    start_time: 0,
    end_time: piece.duration_seconds || null,
    source_ids: segmentSourceIds.length ? segmentSourceIds : allSourceIds,
    content: [
      `曲目：${piece.title}`,
      '整曲阶段：',
      ...stages.map((stage) => `- ${stage}`),
      `回答边界：\n- ${boundaries || '无'}`
    ].join('\n')
  };
  const segments = (piece.segments || []).map((segment, index) => ({
    chunk_id: `piece:${piece.piece_id}:segment:${segment.segment_id}`,
    piece_id: piece.piece_id,
    knowledge_scope: 'piece_segment',
    segment_id: segment.segment_id,
    segment_index: index,
    title: `${piece.title}｜${segment.stage}`,
    heading: `SEGMENT · ${formatTime(segment.start_time)}-${formatTime(segment.end_time)} · ${segment.stage}`,
    start_time: segment.start_time,
    end_time: segment.end_time,
    source_ids: segmentSourceIds.length ? segmentSourceIds : allSourceIds,
    content: [
      `曲目：${piece.title}`,
      `片段：${segment.stage}`,
      `时间：${formatTime(segment.start_time)}-${formatTime(segment.end_time)}`,
      `可听特征：${(segment.music_features || []).join('；')}`,
      `聆听提示：${segment.listen_for || '无'}`,
      `人工说明：${segment.editor_note || '无'}`,
      `回答边界：${(piece.answer_boundaries || []).join('；')}`
    ].join('\n')
  }));
  return [facts, overview, ...segments];
});

export const rerankCandidates = ({
  candidates,
  query,
  limit,
  preferredScope = null,
  playbackTime = null,
  exactSegmentId = null
}) => candidates
  .map((candidate) => {
    const lexicalScore = lexicalOverlap(query, `${candidate.title} ${candidate.heading} ${candidate.content}`);
    const vectorScore = Number.isFinite(candidate.score) ? candidate.score : 0;
    const scopeBoost = preferredScope && candidate.knowledge_scope === preferredScope ? 0.16 : 0;
    const exactSegmentBoost = exactSegmentId && candidate.segment_id === exactSegmentId ? 0.42 : 0;
    const time = Number(playbackTime);
    const inCurrentTime = Number.isFinite(time)
      && candidate.start_time !== null
      && time >= Number(candidate.start_time)
      && time < Number(candidate.end_time);
    const timeBoost = inCurrentTime ? 0.3 : 0;
    const rerankScore = vectorScore + lexicalScore * 0.12 + scopeBoost + exactSegmentBoost + timeBoost;
    return { ...candidate, lexical_score: lexicalScore, rerank_score: rerankScore };
  })
  .sort((left, right) => right.rerank_score - left.rerank_score)
  .slice(0, limit);

export const selectPieceCandidates = ({ corpus, pieceId, retrievalKind, currentSegment }) => {
  const pieceItems = corpus.filter((item) => item.piece_id === pieceId);
  if (retrievalKind === 'piece_fact') {
    return pieceItems.filter((item) => item.knowledge_scope === 'piece_fact');
  }
  if (retrievalKind === 'piece_overview') {
    return pieceItems.filter((item) => (
      item.knowledge_scope === 'piece_overview'
      || item.knowledge_scope === 'piece_segment'
    ));
  }
  if (retrievalKind === 'piece_segment') {
    const currentIndex = currentSegment?.segment_id
      ? pieceItems.find((item) => item.segment_id === currentSegment.segment_id)?.segment_index
      : null;
    return pieceItems.filter((item) => {
      if (item.knowledge_scope !== 'piece_segment') return false;
      if (!Number.isInteger(currentIndex)) return true;
      return Math.abs(item.segment_index - currentIndex) <= 2;
    });
  }
  return [];
};
