const musicQuestionTypes = new Set([
  'whole_work_narrative',
  'current_segment',
  'work_fact',
  'general_music'
]);

const greetingPattern = /^(?:你们?好|大家好|各位好|hello|hi|嗨|谢谢|感谢|再见)[呀啊！!。.\s]*$/i;

export const classifyTopicDistance = ({ query, questionType }) => {
  const normalizedQuery = String(query || '').trim();
  if (musicQuestionTypes.has(questionType)) return 0;
  if (questionType === 'musician_fact') return 1;
  if (questionType === 'personal_response') return 2;
  if (questionType === 'casual_or_other' && greetingPattern.test(normalizedQuery)) return 1;
  return 3;
};

export const advanceTopicState = ({ previousState, query, questionType }) => {
  const topicDistance = classifyTopicDistance({ query, questionType });
  const prior = previousState && typeof previousState === 'object' ? previousState : {};
  const isOffTopic = topicDistance >= 2;
  const offTopicStreak = isOffTopic ? Number(prior.off_topic_streak || 0) + 1 : 0;
  const previouslyPrompted = isOffTopic ? Boolean(prior.return_prompted) : false;
  const shouldOfferReturn = isOffTopic && offTopicStreak >= 3 && !previouslyPrompted;

  return {
    topic_distance: topicDistance,
    off_topic_streak: offTopicStreak,
    return_prompted: previouslyPrompted || shouldOfferReturn,
    should_offer_return: shouldOfferReturn,
    state_reason: topicDistance === 0
      ? '当前曲目或音乐问题'
      : topicDistance === 1
        ? '音乐家、艺术话题或简短社交'
        : topicDistance === 2
          ? '个人感受或生活话题'
          : '与音乐弱相关或无关'
  };
};

const returnSuggestions = {
  mozart: '如果你愿意，我们也可以回到正在听的这首曲子，看看它有没有刚好碰到你说的事。',
  bach: '如果你愿意，我们也可以回到正在播放的声音，从一个具体地方接着听。',
  beethoven: '这件事可以继续谈；若想回到音乐，也可以指出刚才哪一处最抓住你。'
};

export const appendTopicReturnSuggestion = ({ text, musicianId, topicState }) => {
  const answer = String(text || '').trim();
  if (!topicState?.should_offer_return || !answer) return answer;
  const suggestion = returnSuggestions[musicianId] || returnSuggestions.mozart;
  if (answer.includes(suggestion)) return answer;
  return `${answer}\n\n${suggestion}`;
};

export const buildTopicControlPrompt = (topicState) => {
  if (!topicState || topicState.topic_distance <= 1) {
    return '\n\n# 多轮话题状态\n- 当前话题仍在音乐、艺术家或正常社交范围内，直接回答，不要主动提醒用户“回到音乐”。';
  }
  if (topicState.should_offer_return) {
    return `\n\n# 多轮话题状态\n- 用户已连续 ${topicState.off_topic_streak} 轮谈个人生活或弱音乐相关话题。先完整、自然地回答当前问题，不要敷衍，也不要把答案硬改成音乐分析。\n- 服务端会在本轮答案末尾补一次可选的回到音乐提示；你不要重复添加提醒。`;
  }
  return `\n\n# 多轮话题状态\n- 当前话题距离音乐为 ${topicState.topic_distance} 级，连续偏离 ${topicState.off_topic_streak} 轮。仍然直接回答用户，不要强行借当前曲目说教，也不要主动催用户回到音乐。`;
};
