const musicianCatalog = {
  'guan-pinghu': { name: '管平湖', image: 'musicians/cartoons/web-cutouts/01-guan-pinghu-v6.png?v=20260828-9', tags: ['poetic', 'philosophy', 'spiritual'], line: '这一声落下以后，真正要听的是它怎样慢慢消失。' },
  'liu-dehai': { name: '刘德海', image: 'musicians/cartoons/web-cutouts/02-liu-dehai-v6.png?v=20260828-9', tags: ['rhythm', 'dramatic', 'strength'], line: '每一颗声音都要站稳，连起来才会成为动作。' },
  'feng-zicun': { name: '冯子存', image: 'musicians/cartoons/web-cutouts/03-feng-zicun-v4.png?v=20260828-5', tags: ['rhythm', 'strength', 'poetic'], line: '这一口气转过去，旋律就从说话变成了起舞。' },
  abing: { name: '阿炳', image: 'musicians/cartoons/web-cutouts/04-abing.png', tags: ['poetic', 'philosophy'], line: '我听见的不是悲，是一个人在夜里走。' },
  'xian-xinghai': { name: '冼星海', image: 'musicians/cartoons/web-cutouts/05-xian-xinghai.png', tags: ['strength', 'dramatic'], line: '弱音里也藏着向前的力量。' },
  chopin: { name: '肖邦', image: 'musicians/cartoons/web-cutouts/06-chopin-v4.png?v=20260828-5', tags: ['poetic', 'rhythm', 'philosophy'], line: '旋律需要呼吸，停顿有时比下一个音更接近心事。' },
  bach: { name: '巴赫', image: 'musicians/cartoons/web-cutouts/07-bach.png', tags: ['structure', 'strength'], line: '低音与和弦反复交替，秩序由此显现。' },
  mozart: { name: '莫扎特', image: 'musicians/cartoons/web-cutouts/08-mozart.png', tags: ['dramatic', 'poetic'], line: '它看似简单，却故意把答案藏得很远。' },
  beethoven: { name: '贝多芬', image: 'musicians/cartoons/web-cutouts/09-beethoven.png', tags: ['strength', 'philosophy', 'dramatic'], line: '克制得越久，下一次变化就越有重量。' },
  'scott-joplin': { name: '斯科特·乔普林', image: 'musicians/cartoons/web-cutouts/10-scott-joplin.png', tags: ['rhythm', 'dramatic'], line: '三拍子没有催促你，它只让身体轻轻摇摆。' }
};
const smartMusicianIds = new Set(['mozart', 'beethoven', 'bach']);
const localPreviewHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
const publicBackendUrl = 'https://ssvdnn5sq0amjs370rfm7.apigateway-cn-beijing.volceapi.com';
const isGitHubPages = window.location.hostname.endsWith('.github.io');
const apiBaseUrl = isGitHubPages
  ? publicBackendUrl
  : localPreviewHost && window.location.port !== '4317'
    ? 'http://127.0.0.1:4317'
    : '';
const apiUrl = (pathname) => `${apiBaseUrl}${pathname}`;
const publicAssetUrl = (pathname) => isGitHubPages ? `${publicBackendUrl}/${pathname.replace(/^\/+/, '')}` : pathname;
const waitForBackendRetry = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function ensureBackendAvailable() {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(apiUrl('/api/health'), {
        cache: 'no-store',
        signal: AbortSignal.timeout(1500)
      });
      if (response.ok) return true;
      lastError = new Error(`健康检查 HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await waitForBackendRetry(600);
  }
  throw lastError || new Error('本地后端未启动');
}

function musicianDisplayName(id) {
  const musician = musicianCatalog[id];
  return smartMusicianIds.has(id) ? `${musician.name}视角` : musician.name;
}

const trackListeningCues = {
  'river-flows-in-you': [
  {
    id: 'opening-pattern', time: 9, timecode: '00:09', emotion: '起步', title: '先抓住反复出现的手势', hint: '先别追每个音，只听右手这一小串声音怎样一次次回来。',
    tags: ['structure', 'rhythm', 'poetic'],
    features: ['右手短旋律反复出现', '左手保持连续流动', '整体音量较轻'],
    perspectives: {
      mozart: '先抓“好记”这一点：右手短短的旋律像一句开场白，重复几次，你就能认出它。',
      bach: '先把声音分成两层：右手在说旋律，左手像水流一样维持前进。',
      beethoven: '先听它没有立刻用力。开头越克制，后面变响时越容易被你感觉到。'
    }
  },
  {
    id: 'first-lift', time: 32, timecode: '00:32', emotion: '靠近', title: '旋律开始抬高，声音也更近', hint: '比较前十秒：同一句旋律，现在是不是更亮、更有方向？',
    tags: ['poetic', 'dramatic', 'strength'],
    features: ['熟悉旋律抬高', '响度逐渐增加', '左手流动保持'],
    perspectives: {
      mozart: '旋律像角色换了语气：还是熟悉的话，但它开始主动靠近你。',
      bach: '左手没有停；正因为底下保持稳定，上面的旋律才显得抬高了。',
      beethoven: '听“力量怎样进入”：不是突然砸下来，而是声音一层层变高、变响。'
    }
  },
  {
    id: 'fuller-current', time: 55, timecode: '00:55', emotion: '展开', title: '伴奏变密，水流感更明显', hint: '这次把注意力从旋律移到左手，听它怎样把音乐不断向前送。',
    tags: ['structure', 'rhythm', 'strength'],
    features: ['左手活动更密', '上下两层持续配合', '向前推动增强'],
    perspectives: {
      mozart: '把左手听成持续的动作：它一直在移动，所以右手的长旋律不会停在原地。',
      bach: '先听上下两层怎样配合：左手持续流动，右手把较长的线条放在上面。',
      beethoven: '速度未必明显变快，但同一时间出现的声音变多了，身体就会觉得更往前。'
    }
  },
  {
    id: 'brightest-wave', time: 82, timecode: '01:22', emotion: '涌起', title: '第一轮最明亮的波峰', hint: '不用判断技巧，只比较：现在的声音比开头更高、更满，还是更急？',
    tags: ['strength', 'dramatic', 'poetic'],
    features: ['音区提高', '响度增加', '上下两层同时更充实'],
    perspectives: {
      mozart: '旋律终于把情绪说得更直接，但它依然保持清楚，没有挤成一团。',
      bach: '波峰不是只靠右手变响；上下两层同时更充实，整体才被撑大。',
      beethoven: '抓住积累后的释放：前面一次次重复，到了这里才换来真正的重量。'
    }
  },
  {
    id: 'quiet-return', time: 108, timecode: '01:48', emotion: '回落', title: '声音突然收回来', hint: '听刚才的饱满退去后，熟悉的旋律为什么显得更安静。',
    tags: ['poetic', 'structure', 'philosophy'],
    features: ['响度回落', '织体变薄', '熟悉旋律重新突出'],
    perspectives: {
      mozart: '这里像角色重新低声说话。同一个旋律，换了音量，关系就变了。',
      bach: '熟悉的声音并没有消失，只是同时出现的声音变少了，所以你仍然不会迷路。',
      beethoven: '退回安静也是力量的一部分。对比越清楚，下一次上升越有效。'
    }
  },
  {
    id: 'second-build', time: 131, timecode: '02:11', emotion: '再出发', title: '第二次上升，比第一次更熟悉', hint: '试着预测下一句会往哪里走，再听音乐有没有满足你的预期。',
    tags: ['structure', 'dramatic', 'rhythm'],
    features: ['熟悉材料再次上升', '伴奏继续流动', '第二轮积累更早出现'],
    perspectives: {
      mozart: '试着“猜下一句”：旋律让你产生期待，再用熟悉的走向给出回应。',
      bach: '比较两次上升的骨架。你听得出它回来，说明重复已经帮你建立了地图。',
      beethoven: '听第二次积累怎样缩短等待。你已经知道波峰会来，所以紧张感出现得更早。'
    }
  },
  {
    id: 'release-after-peak', time: 166, timecode: '02:46', emotion: '松开', title: '最满之后，音乐开始放手', hint: '别只听变小，听每一层声音是一起退，还是先后退。',
    tags: ['strength', 'structure', 'spiritual'],
    features: ['响度逐渐下降', '旋律和伴奏先后退场', '声音密度减少'],
    perspectives: {
      mozart: '收尾也有表情：不是突然结束，而是把一句话慢慢说轻。',
      bach: '分层听退场：上面的旋律先松开，下面的流动仍替它维持道路。',
      beethoven: '这里保留着释放后的余力。真正的高潮过去了，身体还记得刚才的重量。'
    }
  },
  {
    id: 'last-ripple', time: 188, timecode: '03:08', emotion: '余波', title: '旋律没有消失，只是越走越远', hint: '最后一次认出主旋律后，继续听它怎样缩短、变轻并停下来。',
    tags: ['poetic', 'spiritual', 'philosophy'],
    features: ['主旋律最后回归', '短句缩短', '响度变轻并停止'],
    perspectives: {
      mozart: '听最后一句怎样保留辨识度：即使越来越轻，你仍知道是谁在说话。',
      bach: '结尾把复杂层次逐渐拿走，只留下最容易认出的线条。',
      beethoven: '听“结束前还剩多少力”。声音退远了，但前面建立的张力仍留在记忆里。'
    }
  }
  ],
  'sonnet-piano': [
    {
      id: 'sonnet-opening-breath', time: 9, timecode: '00:09', emotion: '开场', title: '先听旋律怎样留下呼吸', hint: '别急着追音符，先听每一句抬起后，在哪里稍微停一下。',
      tags: ['poetic', 'structure', 'rhythm'],
      features: ['旋律由短句组成', '句子之间有停顿', '低处支撑保持方向'],
      perspectives: {
        mozart: '把它当成一句正在说的话。旋律每次抬起后都留一点空隙，所以开场亲近，却没有把情绪一次说满。',
        bach: '先把右手旋律和下面的支撑分开听。上面可以自由呼吸，是因为下面始终替它保留方向。',
        beethoven: '它没有用重音宣布开始，而是让短句一点点站稳。真正的力量暂时藏在克制里。'
      }
    },
    {
      id: 'sonnet-first-expansion', time: 33, timecode: '00:33', emotion: '展开', title: '同一段材料开始变得更宽', hint: '比较开头：现在是音更高了、声音更满了，还是句子更长了？',
      tags: ['strength', 'poetic', 'structure'],
      features: ['句子延长', '音区抬高', '响度增加'],
      perspectives: {
        mozart: '熟悉的语气没有消失，只是句子被说得更完整。你会觉得它靠近了，因为旋律停留得更久。',
        bach: '留意下面反复出现的声音没有换，上面的旋律却拉长了。地面稳定，旋律才敢向外展开。',
        beethoven: '这里没有突然加速，只是声音越弹越高、越弹越响。空间变大，紧张感也跟着出现。'
      }
    },
    {
      id: 'sonnet-quiet-reset', time: 59, timecode: '00:59', emotion: '转身', title: '饱满之后，音乐重新收细', hint: '听刚才较满的声音退去后，哪一层还留在原地继续带路。',
      tags: ['structure', 'philosophy', 'poetic'],
      features: ['织体变薄', '响度回落', '低处支撑仍连续'],
      perspectives: {
        mozart: '这里像说到一半忽然换成较轻的口气。旋律仍然熟悉，关系却从展示变成了倾听。',
        bach: '声音变少不等于迷路。先跟住下面持续出现的声音，你仍能听见音乐往哪里走。',
        beethoven: '一次回收让前面的扩张有了边界。张力不是一直增加，退一步也在为下一次积累腾出空间。'
      }
    },
    {
      id: 'sonnet-second-lift', time: 85, timecode: '01:25', emotion: '再起', title: '熟悉旋律换了更坚定的语气', hint: '试着认出前面听过的轮廓，再比较这次落键是否更明确。',
      tags: ['dramatic', 'rhythm', 'strength'],
      features: ['熟悉旋律轮廓回归', '落键更明确', '响度再次上升'],
      perspectives: {
        mozart: '同一句话第二次出现时，重点不在新鲜，而在语气。轮廓仍清楚，落点却比第一次更肯定。',
        bach: '重复让你认出这条路，但上下两层的轻重已经改变。听下面怎样把同一条路走得更稳。',
        beethoven: '这段越熟悉，你越容易听出这一次弹得更重。重复先让你等待，落键再改变分量。'
      }
    },
    {
      id: 'sonnet-main-crest', time: 112, timecode: '01:52', emotion: '涌起', title: '左右手一起变忙，声音来到波峰', hint: '不要只听“变响”，留意左右手是不是同时弹出更多声音。',
      tags: ['strength', 'structure', 'dramatic'],
      features: ['左右手活动同时增加', '音区扩大', '响度来到高点'],
      perspectives: {
        mozart: '声音变满时，旋律仍要能被认出来。这里最值得听的是热度增加了，句子的轮廓却没有被淹没。',
        bach: '波峰并非只靠右手变响。上面和下面同时出现更多声音，整个空间才真正被撑开。',
        beethoven: '这是前面多次忍住后换来的释放。声音更高、更响也更多，所以身体会先感到重量。'
      }
    },
    {
      id: 'sonnet-afterglow', time: 128, timecode: '02:08', emotion: '余热', title: '高潮过去，旋律还带着惯性', hint: '听声音开始回落时，句尾有没有马上停住，还是继续向前滑行。',
      tags: ['poetic', 'philosophy', 'structure'],
      features: ['上层开始回落', '支撑层继续向前', '句尾没有立即停止'],
      perspectives: {
        mozart: '高潮后的句子没有立刻关门，而是保留了一点余音。这个迟到的收尾，让情绪显得更真。',
        bach: '上层开始松开，下面仍保持连续。正是这种不同步的退场，让段落不会突然塌下来。',
        beethoven: '最响的部分已经过去，推动力却没有马上归零。余力继续向前，释放因此有了长度。'
      }
    },
    {
      id: 'sonnet-cleared-space', time: 154, timecode: '02:34', emotion: '留白', title: '层次减少，空间突然显出来', hint: '把注意力放到音与音之间，听停顿怎样让下一句更清楚。',
      tags: ['poetic', 'structure', 'spiritual'],
      features: ['同时出现的声音减少', '停顿更加明显', '句子边界变清楚'],
      perspectives: {
        mozart: '少掉一些声音以后，句子的标点反而更清楚。停顿不是空白，它决定下一句以什么口气出现。',
        bach: '同时出现的声音变少后，更容易分清谁先谁后。先听下面落稳，再听旋律重新出发。',
        beethoven: '这里把重量撤掉，反而让等待变得明显。沉默越清楚，下一次落键越像一个决定。'
      }
    },
    {
      id: 'sonnet-final-return', time: 180, timecode: '03:00', emotion: '回望', title: '最后一次认出熟悉的轮廓', hint: '听主旋律回来后，哪些音被保留，哪些装饰正在慢慢减少。',
      tags: ['structure', 'poetic', 'philosophy'],
      features: ['熟悉旋律回归', '装饰和层次减少', '力量不再向外扩张'],
      perspectives: {
        mozart: '最后的回望不需要重新解释一切。旋律留下最容易辨认的轮廓，语气也从表达转向告别。',
        bach: '结尾在做减法。陪伴旋律的声音逐渐减少，只留下最好认的那条线，所以你仍能找到归处。',
        beethoven: '力量不再向外扩张，而是被压缩进最后几次落点。越接近结束，每一次克制越有分量。'
      }
    },
    {
      id: 'sonnet-last-release', time: 196, timecode: '03:16', emotion: '落定', title: '别急着离开，听声音怎样真正结束', hint: '最后几次落键后继续听，直到琴弦的余响完全退去。',
      tags: ['spiritual', 'poetic', 'structure'],
      features: ['落键次数减少', '最后声音不再追加', '琴弦余响逐渐消失'],
      perspectives: {
        mozart: '最后一句说完后，余响仍替它保留表情。结束并不在最后一个音落下，而在声音真正离开的时候。',
        bach: '旋律停下后，同时响起的声音还没有完全消失。多等一秒，听它们怎样一起变成安静。',
        beethoven: '最后的重量来自不再追加。让余响自己消退，这个克制的停止比再弹一个音更坚定。'
      }
    }
  ],
  'city-of-stars': [
    {
      id: 'city-opening-line', time: 9, timecode: '00:09', emotion: '开场', title: '先记住最容易哼出的短句', hint: '听这句说完后留了多少空间，不要急着追后面的音。',
      tags: ['poetic', 'structure', 'dramatic'],
      features: ['开头音量较轻', '旋律短句清楚', '旋律与支撑之间留有空间'],
      perspectives: {
        mozart: '先把短句当成一句没说满的话。它停一下再继续，所以亲近里还留着一点试探。',
        bach: '先分开听上面的短句和下面的支撑。两层都不拥挤，音乐才显得有空间。',
        beethoven: '它没有急着加重。先记住这份克制，后面声音变多时，你会更容易感觉到分量。'
      }
    },
    {
      id: 'city-first-approach', time: 34, timecode: '00:34', emotion: '靠近', title: '熟悉短句开始说得更连贯', hint: '比较开头：旋律第二次说起时，是不是更连贯，也更靠近。',
      tags: ['poetic', 'dramatic', 'strength'],
      features: ['旋律连接更紧', '响度逐渐增加', '高处活动增加'],
      perspectives: {
        mozart: '还是熟悉的语气，但停顿变少以后，它像终于愿意把后半句话接着说完。',
        bach: '下面仍在维持方向，上面的句子却连接得更紧。稳定和变化同时存在。',
        beethoven: '力量不是突然出现的。声音一点点靠近、变满，第一轮推动正在形成。'
      }
    },
    {
      id: 'city-first-turn', time: 64, timecode: '01:04', emotion: '转身', title: '较满的声音短暂收细', hint: '听上一段退开后，哪条旋律还留在前面。',
      tags: ['structure', 'poetic', 'philosophy'],
      features: ['上一段活动短暂收细', '声音密度下降', '旋律重新突出'],
      perspectives: {
        mozart: '这里像把说话声放轻了一点。句子的轮廓重新清楚，注意力也跟着回到旋律。',
        bach: '同时出现的声音减少以后，更容易听清哪一层在带路。先跟住最突出的那条线。',
        beethoven: '一次回收给前面的扩展画出边界，也让接下来的增强不至于失去对比。'
      }
    },
    {
      id: 'city-first-crest', time: 81, timecode: '01:21', emotion: '涌起', title: '第一轮声音真正撑开', hint: '不要只听变响，也听同一时间是不是出现了更多声音。',
      tags: ['strength', 'structure', 'dramatic'],
      features: ['响度进入第一轮高区', '高低范围同时更活跃', '声音数量增加'],
      perspectives: {
        mozart: '声音变满以后，最值得听的是旋律还认不认得出来。热度增加了，句子不能被淹没。',
        bach: '这一轮扩展来自上下同时更活跃。不是只有上面的旋律变响，下面也把空间撑开了。',
        beethoven: '前面的克制在这里换成了重量。声音更多、更响，第一轮积累终于有了落点。'
      }
    },
    {
      id: 'city-open-space', time: 111, timecode: '01:51', emotion: '留白', title: '第一轮退去，空间重新出现', hint: '听上一轮退下去以后，安静是突然出现，还是一点点空出来。',
      tags: ['poetic', 'structure', 'spiritual'],
      features: ['响度明显下降', '织体变薄', '句子之间空间增加'],
      perspectives: {
        mozart: '热闹退开后，短句重新像在轻声说话。停顿让下一句带上了等待的表情。',
        bach: '层次减少并没有让方向消失。先找仍然保持的支撑，再听旋律从上面重新出现。',
        beethoven: '把重量撤掉也是结构的一部分。这里越安静，下一轮重新进入时越有力量。'
      }
    },
    {
      id: 'city-second-departure', time: 134, timecode: '02:14', emotion: '再起', title: '熟悉轮廓重新开始向前', hint: '认出熟悉短句，再听这一次是不是更快开始变满。',
      tags: ['dramatic', 'rhythm', 'strength'],
      features: ['熟悉轮廓重新出现', '活动范围逐渐扩大', '响度恢复'],
      perspectives: {
        mozart: '同一句话再次回来，重点已经不是认不认识，而是这次说得是不是更肯定。',
        bach: '重复先帮你找到旧路线，再比较上下两层这次怎样更早开始扩展。',
        beethoven: '因为你已经记住这段材料，第二轮刚开始增加重量，等待感就比第一次来得更快。'
      }
    },
    {
      id: 'city-second-crest', time: 151, timecode: '02:31', emotion: '推高', title: '第二轮高点持续得更久', hint: '比较两轮高点：这一轮只是更响，还是上下都变得更忙。',
      tags: ['strength', 'structure', 'dramatic'],
      features: ['第二轮持续高响度', '低处与高处同时活跃', '整体声音更满'],
      perspectives: {
        mozart: '旋律仍要像一句清楚的话，而不是被伴奏挤走。听它怎样在更满的声音里保持轮廓。',
        bach: '上下两层一起增加活动，第二轮空间才显得更宽。试着分别听一次，再把它们合起来。',
        beethoven: '这次不是瞬间爆发，而是把重量维持得更久。持续本身让高点比第一次更难放下。'
      }
    },
    {
      id: 'city-main-release', time: 181, timecode: '03:01', emotion: '回落', title: '饱满的声音一起退下去', hint: '听哪一层先松开，哪一层最后才离开。',
      tags: ['structure', 'poetic', 'philosophy'],
      features: ['响度快速下降', '频谱活动减少', '段落边界明显'],
      perspectives: {
        mozart: '这里像一群人说完后逐渐安静。最后留下的那条线，决定了退场是什么语气。',
        bach: '不要只听整体变轻，试着分辨上下两层是否同时减少，还是有一层多留了一会儿。',
        beethoven: '第二轮高点在这里失去重量。释放越清楚，前面的积累越显得完整。'
      }
    },
    {
      id: 'city-final-look-back', time: 197, timecode: '03:17', emotion: '回望', title: '短句变少，停顿变长', hint: '只跟住零散出现的短句，听每次停顿是不是比前面更长。',
      tags: ['poetic', 'philosophy', 'structure'],
      features: ['旋律片段变得稀疏', '停顿变长', '响度保持较轻'],
      perspectives: {
        mozart: '最后的短句不再急着接满。每一次停顿都像留出一个眼神，让旋律慢慢告别。',
        bach: '声音越少，先后关系越容易听清。留意一条线停下以后，下一次从哪里重新出现。',
        beethoven: '力量已经不再向外增加。剩下的分量来自等待，以及每次落键后没有立刻继续。'
      }
    },
    {
      id: 'city-final-release', time: 214, timecode: '03:34', emotion: '落定', title: '最后几次落键留下长余响', hint: '最后几次落键后别马上离开，等到余响真的不见。',
      tags: ['spiritual', 'poetic', 'structure'],
      features: ['较长停顿出现', '只剩少量落键', '最终余响后进入安静'],
      perspectives: {
        mozart: '最后一句说完以后，表情还留在余响里。结束不是最后一个音，而是声音真正离开。',
        bach: '现在只剩少量声音和它们共同的余响。多等一会儿，听这些层次怎样一起归于安静。',
        beethoven: '最后的坚定来自不再追加。声音停下以后，让余响自己完成剩下的距离。'
      }
    }
  ]
};

function currentListeningCues() {
  return trackListeningCues[currentTrackId] || [];
}

const trackLibrary = {
  'river-flows-in-you': {
    src: publicAssetUrl('assets/video/library/river-flows-in-you-performance.mp4'),
    audioSrc: publicAssetUrl('assets/audio/library/river-flows-in-you.mp3'),
    poster: 'assets/visual/library/river-flows-in-you-performance.jpg',
    mediaType: 'video',
    title: 'River Flows In You',
    pieceMeta: 'Yiruma · Piano Cover · 03:29',
    trackTitle: 'River Flows In You',
    trackMeta: 'Yiruma · 钢琴演奏视频',
    captionTitle: '跟着旋律的回流，听见它怎样一次次靠近',
    captionMeta: '8 个聆听节点 · 听旋律、听左右手、听轻重变化',
    credit: 'RIVER FLOWS IN YOU · PIANO PERFORMANCE',
    hasCues: true,
    cueDuration: 209.163,
    videoCrop: { position: 'center 50%' },
    openingLines: {
      mozart: '先记住最容易哼出的那一句：它每次回来，是更轻、更响，还是多停了一会儿？',
      bach: '先分别听右手和左手：右手唱什么，左手怎样一直带它往前？',
      beethoven: '先比较开头和一分钟后：是不是声音更多了，也弹得更响了？'
    },
    sourceNote: '节点依据音量、音色、节奏密度与段落变化检测后人工整理。莫扎特、巴赫与贝多芬在此作为三种聆听视角，不代表历史人物本人评价现代作品。'
  },
  'sonnet-piano': {
    src: publicAssetUrl('assets/video/library/sonnet-performance.mp4'),
    audioSrc: publicAssetUrl('assets/audio/library/sonnet.mp3'),
    poster: 'assets/visual/library/sonnet-performance.jpg',
    mediaType: 'video',
    title: 'Sonnet',
    pieceMeta: '钢琴独奏 · 03:38',
    trackTitle: 'Sonnet',
    trackMeta: '钢琴独奏 · 演奏视频',
    captionTitle: '从一句旋律的停顿，听到声音怎样变多又变少',
    captionMeta: '9 个聆听节点 · 听旋律、听左右手、听轻重变化',
    credit: 'SONNET · PIANO PERFORMANCE',
    hasCues: true,
    cueDuration: 218.252,
    videoCrop: { position: 'center 50%' },
    openingLines: {
      mozart: '先听最好记的那句旋律：它在哪里停一下，又从哪里继续？',
      bach: '先分别听上面和下面：上面的旋律怎样停顿，下面怎样一直带路？',
      beethoven: '先比较每次重复：是不是一次比一次更响，也弹得更重？'
    },
    sourceNote: '曲名“Sonnet”来自视频画面，作曲者尚未从可靠来源核验，因此不作作者归属。节点依据响度、音色、密度与段落变化检测后人工复核；三位人物是受其音乐观念启发的聆听视角，不代表历史人物本人评价该演奏。'
  },
  'city-of-stars': {
    src: publicAssetUrl('assets/video/library/city-of-stars-performance.mp4'),
    audioSrc: publicAssetUrl('assets/audio/library/city-of-stars.mp3'),
    poster: 'assets/visual/library/city-of-stars-performance.jpg',
    mediaType: 'video',
    title: 'City of Stars',
    pieceMeta: 'La La Land OST · Piano Cover · 03:49',
    trackTitle: 'City of Stars',
    trackMeta: 'La La Land · 钢琴演奏视频',
    captionTitle: '从短句的靠近与退场，听两轮声音怎样展开',
    captionMeta: '10 个聆听节点 · 听短句、听层次、听等待与收束',
    credit: 'CITY OF STARS · LA LA LAND OST',
    hasCues: true,
    cueDuration: 229.2,
    videoCrop: { position: 'center 50%' },
    openingLines: {
      mozart: '先记住最容易哼出的短句：它每次回来，是更靠近，还是多留了一会儿？',
      bach: '先分开听上面的旋律和下面的支撑：哪一层在变化，哪一层一直带路？',
      beethoven: '先比较开头和一分钟后：声音是不是更多、更响，也维持得更久？'
    },
    sourceNote: '当前使用用户提供的钢琴演奏视频和从该视频提取的独立音轨，发布版本已在演奏收尾处结束并移除原视频的平台推广尾页。10 个节点依据响度、频谱活动、声音密度、停顿和收束检测后人工复核；电影语境与当前演奏判断分开处理。'
  },
  'gentle-tuning': {
    src: 'assets/audio/gentle-tuning.wav',
    poster: 'assets/visual/gymnopedie-emotion-map.png',
    mediaType: 'audio',
    title: '调音室的夜晚',
    pieceMeta: '舒缓氛围 · 00:32 · 自由陪听',
    trackTitle: '调音室的夜晚',
    trackMeta: '舒缓氛围音乐 · 短篇试听',
    captionTitle: '让音乐家自由谈论这一段声音',
    captionMeta: '暂无预设节点 · 点击头像随时听取看法',
    credit: 'QUIET LISTENING SESSION',
    hasCues: false,
    sourceNote: '这段音乐暂未配置情绪时间点。用户仍可点击音乐家头像，或在右侧输入问题进行自由讨论。'
  },
  'moonlit-strings': {
    src: 'assets/audio/library/moonlit-strings.mp3',
    poster: 'assets/visual/listening-library-poster.svg',
    mediaType: 'audio',
    title: '月下弦歌',
    pieceMeta: '原创东方弦乐 · 00:54 · 五声音阶',
    trackTitle: '月下弦歌',
    trackMeta: '东方弦乐 · 原创演示曲',
    captionTitle: '听拨弦与留白之间如何互相回应',
    captionMeta: '自由陪听模式 · 点击音乐家头像继续讨论',
    credit: 'ORIGINAL LISTENING LIBRARY',
    hasCues: false,
    sourceNote: '原创演示曲《月下弦歌》使用五声音阶、低音长音与缓慢拨弦，适合讨论东方听觉、留白与呼吸。'
  },
  'rain-waltz': {
    src: 'assets/audio/library/rain-waltz.mp3',
    poster: 'assets/visual/listening-library-poster.svg',
    mediaType: 'audio',
    title: '雨后圆舞曲',
    pieceMeta: '原创钢琴圆舞曲 · 00:51 · 三拍子',
    trackTitle: '雨后圆舞曲',
    trackMeta: '钢琴圆舞曲 · 原创演示曲',
    captionTitle: '让三拍子的脚步带出新的画面',
    captionMeta: '自由陪听模式 · 适合讨论节奏与明暗变化',
    credit: 'ORIGINAL LISTENING LIBRARY',
    hasCues: false,
    sourceNote: '原创演示曲《雨后圆舞曲》以轻柔三拍和钢琴分解和弦构成，可用于讨论身体律动、场景与旋律方向。'
  },
  'chapel-light': {
    src: 'assets/audio/library/chapel-light.mp3',
    poster: 'assets/visual/listening-library-poster.svg',
    mediaType: 'audio',
    title: '教堂微光',
    pieceMeta: '原创管风琴氛围 · 01:00 · 长音和声',
    trackTitle: '教堂微光',
    trackMeta: '管风琴氛围 · 原创演示曲',
    captionTitle: '在长音与残响中等待空间慢慢展开',
    captionMeta: '自由陪听模式 · 适合讨论和声、秩序与信仰',
    credit: 'ORIGINAL LISTENING LIBRARY',
    hasCues: false,
    sourceNote: '原创演示曲《教堂微光》以持续和弦与空间残响为主，可用于讨论和声秩序、建筑感和精神体验。'
  },
  'night-train': {
    src: 'assets/audio/library/night-train.mp3',
    poster: 'assets/visual/listening-library-poster.svg',
    mediaType: 'audio',
    title: '夜行列车',
    pieceMeta: '原创轻节奏氛围 · 00:50 · 稳定脉冲',
    trackTitle: '夜行列车',
    trackMeta: '轻节奏氛围 · 原创演示曲',
    captionTitle: '跟随稳定脉冲感受时间向前流动',
    captionMeta: '自由陪听模式 · 适合讨论速度、记忆与旅途',
    credit: 'ORIGINAL LISTENING LIBRARY',
    hasCues: false,
    sourceNote: '原创演示曲《夜行列车》使用稳定低频脉冲与循环旋律，可用于讨论前进感、时间感和旅途记忆。'
  }
};

const trackOrder = ['river-flows-in-you', 'sonnet-piano', 'city-of-stars'];

const prototypeResponses = {
  'guan-pinghu': ['先听一个音怎样离开，不要只追着下一个音走。', '低音像落笔，余韵才是这一句真正展开的地方。'],
  'liu-dehai': ['把旋律拆成拨、挑和停顿，动作清楚了，情绪才不会糊成一片。', '这段不必弹得更满，先让每颗声音拥有自己的方向。'],
  'feng-zicun': ['旋律要靠气息穿过去，那些短小的转音像说话时的神态。', '先跟着这一口气走，再听节奏怎样把安静推成舞步。'],
  abing: ['它像夜路，脚步没有停，只是每一步都听得见自己。', '旋律不喊苦，所以那一点苦反而留得更久。'],
  'xian-xinghai': ['弱声不等于没有力量，持续前进本身就是意志。', '如果更多声音一层层加入，这段孤独也可能汇成共同的呼吸。'],
  chopin: ['旋律不要赶着抵达，稍微晚一点落下，心事才会浮出来。', '伴奏维持脚步，右手却像人在边走边改变主意。'],
  bach: ['可以先把声音分成上下两层，再听它们怎样互相托住。', '重复会帮你建立地图，细小变化则告诉你音乐正在往哪里走。'],
  mozart: ['先听旋律像不像一个人在换语气，同一句话也可以有不同表情。', '不必先懂乐理，先找最容易记住的旋律，再听它下一次怎样回来。'],
  beethoven: ['先比较这一刻与十秒前的重量，张力往往藏在这种变化里。', '重复不是原地踏步，每次回来都可能多一点力量，或少一点防备。'],
  'scott-joplin': ['三拍子让身体轻轻摆动，但重心被刻意放慢了。', '先跟着低音数拍，再听旋律如何离开稳定的格子。']
};

let selectedIds = [];
try { selectedIds = JSON.parse(localStorage.getItem('tuningCompanions') || '[]'); } catch {}
selectedIds = selectedIds.filter((id) => musicianCatalog[id]).slice(0, 3);
if (selectedIds.length < 3) selectedIds = ['mozart', 'bach', 'beethoven'];

const video = document.getElementById('performanceVideo');
const performanceViewport = document.getElementById('performanceViewport');
const listeningGuidePanel = document.getElementById('listeningGuidePanel');
const listeningGuideTime = document.getElementById('listeningGuideTime');
const listeningGuideTitle = document.getElementById('listeningGuideTitle');
const listeningGuideHint = document.getElementById('listeningGuideHint');
const listeningFocusList = document.getElementById('listeningFocusList');
const replayCueButton = document.getElementById('replayCueButton');
const cuePerspectiveStrip = document.getElementById('cuePerspectiveStrip');
const cuePerspectiveList = document.getElementById('cuePerspectiveList');
const libraryButton = document.getElementById('libraryButton');
const mediaLibrary = document.getElementById('mediaLibrary');
const libraryClose = document.getElementById('libraryClose');
const libraryGrid = document.getElementById('libraryGrid');
const libraryPrevious = document.getElementById('libraryPrevious');
const libraryNext = document.getElementById('libraryNext');
const listeningGuideButton = document.getElementById('listeningGuideButton');
const previousTrackButton = document.getElementById('previousTrackButton');
const nextTrackButton = document.getElementById('nextTrackButton');
const playButton = document.getElementById('playButton');
const seekBar = document.getElementById('seekBar');
const timeReadout = document.getElementById('timeReadout');
const liveStatus = document.getElementById('liveStatus');
const companions = document.getElementById('companions');
const messages = document.getElementById('messages');
const questionForm = document.getElementById('questionForm');
const questionInput = document.getElementById('questionInput');
const continueTalk = document.getElementById('continueTalk');
const restartButton = document.getElementById('restartButton');
const toast = document.getElementById('toast');
const cueTimeline = document.getElementById('cueTimeline');
const cueOverlay = document.getElementById('cueOverlay');
const cueOverlayLabel = document.getElementById('cueOverlayLabel');
const cueOverlayTitle = document.getElementById('cueOverlayTitle');
const cueOverlayHint = document.getElementById('cueOverlayHint');
const pieceTitle = document.getElementById('pieceTitle');
const pieceMeta = document.getElementById('pieceMeta');
const scoreCaptionTitle = document.getElementById('scoreCaptionTitle');
const scoreCaptionMeta = document.getElementById('scoreCaptionMeta');
const performanceCredit = document.getElementById('performanceCredit');
const trackTitle = document.getElementById('trackTitle');
const trackMeta = document.getElementById('trackMeta');
const sourceNote = document.getElementById('sourceNote');
const theatre = document.querySelector('.theatre');
const mobileViewButtons = [...document.querySelectorAll('.mobile-view-button[data-mobile-view]')];

let activeSpeaker = 0;
let selectedRespondentId = null;
let conversationId = null;
let previousTurn = [];
let pendingAnswerMode = 'auto';
let currentCue = null;
let renderedGuideCueId = null;
let animationFrame = 0;
let overlayTimer = 0;
let toastTimer = 0;

function setMobileView(view) {
  if (!theatre || !['stage', 'talk'].includes(view)) return;
  theatre.dataset.mobileView = view;
  mobileViewButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.mobileView === view));
  });
}

mobileViewButtons.forEach((button) => {
  button.addEventListener('click', () => setMobileView(button.dataset.mobileView));
});
let lastPlaybackTime = 0;
let currentTrackId = trackOrder[0];
let currentHasCues = false;
const productSessionId = sessionStorage.getItem('tuningProductSession') || crypto.randomUUID();
sessionStorage.setItem('tuningProductSession', productSessionId);
const viewedMusicians = new Set();
const recordedEvents = new Set();
const triggeredCues = new Set();
const lastSpokenAt = Object.fromEntries(selectedIds.map((id) => [id, -999]));
const cueSpeechCounts = Object.fromEntries(selectedIds.map((id) => [id, 0]));
const evidenceStore = new Map();

function trackEvent(eventName, metadata = {}, once = false) {
  if (once && recordedEvents.has(eventName)) return;
  if (once) recordedEvents.add(eventName);
  fetch(apiUrl('/api/events'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      session_id: productSessionId,
      conversation_id: conversationId,
      event_name: eventName,
      musician_id: selectedRespondentId,
      track_id: currentTrackId,
      metadata
    })
  }).catch(() => {});
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '00:00';
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

function escapeHtml(text) {
  return text.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function showToast(text) {
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.add('is-visible');
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

const listeningFocusLabels = {
  structure: '上下怎么配合',
  rhythm: '快慢与脚步',
  philosophy: '留下什么',
  poetic: '旋律怎么说话',
  spiritual: '余音',
  dramatic: '前后变化',
  strength: '轻重变化'
};

function renderListeningGuide(cue = null, force = false) {
  const guideId = cue?.id || `track-${currentTrackId}`;
  if (!force && renderedGuideCueId === guideId) return;
  renderedGuideCueId = guideId;
  if (cue) {
    listeningGuideTime.textContent = `现在听什么 · ${cue.timecode} · ${cue.emotion}`;
    listeningGuideTitle.textContent = cue.title;
    listeningGuideHint.textContent = cue.hint;
    listeningFocusList.replaceChildren(...cue.tags.slice(0, 3).map((tag) => {
      const item = document.createElement('span');
      item.textContent = listeningFocusLabels[tag] || tag;
      return item;
    }));
    cuePerspectiveList.replaceChildren(...selectedIds.map((musicianId) => {
      const card = document.createElement('button');
      const name = document.createElement('strong');
      const comment = document.createElement('span');
      card.className = 'cue-perspective-card';
      card.type = 'button';
      card.dataset.musicianId = musicianId;
      card.classList.toggle('is-selected', selectedRespondentId === musicianId);
      name.textContent = musicianDisplayName(musicianId);
      comment.textContent = cueComment(cue, musicianId);
      card.append(name, comment);
      card.addEventListener('click', () => setSelectedRespondent(musicianId));
      return card;
    }));
    cuePerspectiveStrip.hidden = false;
    return;
  }

  listeningGuideTime.textContent = `现在听什么 · ${formatTime(video.currentTime)} · 自由聆听`;
  listeningGuideTitle.textContent = '先找到一处让你停下来的声音';
  listeningGuideHint.textContent = '不用急着判断好不好听。先选择旋律、节奏或音色中的一个，跟着它听十秒。';
  listeningFocusList.replaceChildren(...['旋律', '节奏', '音色'].map((label) => {
    const item = document.createElement('span');
    item.textContent = label;
    return item;
  }));
  cuePerspectiveList.replaceChildren();
  cuePerspectiveStrip.hidden = true;
}

function setCueOverlayContent(cue) {
  cueOverlayLabel.textContent = `${cue.timecode} · ${cue.emotion}`;
  cueOverlayTitle.textContent = cue.title;
  cueOverlayHint.textContent = cue.hint;
}

function showCueOverlay(cue) {
  setCueOverlayContent(cue);
  renderListeningGuide(cue);
  cueOverlay.classList.add('is-visible');
  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => cueOverlay.classList.remove('is-visible'), 5200);
}

function setSpeaker(index) {
  activeSpeaker = ((index % selectedIds.length) + selectedIds.length) % selectedIds.length;
  [...companions.children].forEach((item, itemIndex) => item.classList.toggle('is-speaking', itemIndex === activeSpeaker));
}

function setSelectedRespondent(id) {
  selectedRespondentId = selectedRespondentId === id ? null : id;
  [...companions.children].forEach((item) => item.classList.toggle('is-selected', item.dataset.musicianId === selectedRespondentId));
  [...cuePerspectiveList.children].forEach((item) => item.classList.toggle('is-selected', item.dataset.musicianId === selectedRespondentId));
  questionInput.placeholder = selectedRespondentId
    ? `向${musicianDisplayName(selectedRespondentId)}提问…`
    : '问问他们，这一段让你想到什么？';
  showToast(selectedRespondentId ? `已选择${musicianDisplayName(selectedRespondentId)}` : '已取消指定回答人');
  if (selectedRespondentId) {
    viewedMusicians.add(selectedRespondentId);
    if (viewedMusicians.size >= 2) trackEvent('second_musician_view', { musicians: [...viewedMusicians] }, true);
  }
}

function chooseSpeaker(cue) {
  const minimumSpeechCount = Math.min(...selectedIds.map((id) => cueSpeechCounts[id] || 0));
  let bestIndex = 0;
  let bestScore = -Infinity;
  selectedIds.forEach((id, index) => {
    if ((cueSpeechCounts[id] || 0) !== minimumSpeechCount) return;
    const musician = musicianCatalog[id];
    const matchScore = cue.tags.filter((tag) => musician.tags.includes(tag)).length * 100;
    const restScore = Math.min(90, Math.max(0, video.currentTime - lastSpokenAt[id]));
    const score = matchScore + restScore;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function resetCueSpeakerRotation() {
  selectedIds.forEach((id) => {
    cueSpeechCounts[id] = 0;
    lastSpokenAt[id] = -999;
  });
  [...companions.children].forEach((item) => item.classList.remove('has-cue-comment'));
}

function cueComment(cue, musicianId, isReply = false) {
  const musician = musicianCatalog[musicianId];
  const tag = cue.tags.find((candidate) => musician.tags.includes(candidate));
  const line = cue.perspectives?.[musicianId] || cue.comments?.[tag] || cue.hint;
  return isReply ? `再补一个听法：${line}` : line;
}

function showCueCompanionComment(cue) {
  if (!cue || !companions.children.length) return;
  const speakerIndex = chooseSpeaker(cue);
  const musicianId = selectedIds[speakerIndex];
  const speaker = companions.children[speakerIndex];
  const bubble = speaker?.querySelector('.speech-bubble');
  if (!speaker || !bubble) return;

  [...companions.children].forEach((item) => item.classList.remove('has-cue-comment'));
  bubble.textContent = cueComment(cue, musicianId);
  speaker.classList.add('has-cue-comment');
  setSpeaker(speakerIndex);
  cueSpeechCounts[musicianId] = (cueSpeechCounts[musicianId] || 0) + 1;
  lastSpokenAt[musicianId] = video.currentTime;
}

function addMessage(index, text, options = {}) {
  const message = document.createElement('article');
  populateMessage(message, index, text, options);
  messages.appendChild(message);
  messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
  return message;
}

function populateMessage(message, index, text, options = {}) {
  const id = selectedIds[index % selectedIds.length];
  const musician = musicianCatalog[id];
  const answer = text || musician.line;
  const isLong = answer.length > 72;
  message.className = `message${options.cue ? ' is-cue' : ''}`;
  const evidenceId = options.evidence ? `evidence-${Date.now()}-${Math.random().toString(16).slice(2)}` : '';
  message.dataset.musicianId = id;
  if (options.messageId) message.dataset.messageId = options.messageId;
  const feedback = `<div class="feedback-menu"><button type="button" class="feedback-trigger" aria-expanded="false">评价回答</button><div class="feedback-options"><button type="button" class="feedback-option" data-feedback="helpful">有帮助</button><button type="button" class="feedback-option" data-feedback="not_helpful">没有帮助</button><button type="button" class="feedback-option" data-feedback="persona_mismatch">人物不像</button><button type="button" class="feedback-option" data-feedback="too_long">回答太长</button><button type="button" class="feedback-option" data-feedback="missed_question">没有回答问题</button><button type="button" class="feedback-option" data-feedback="historical_risk">历史信息可能有误</button></div></div>`;
  const actions = `${isLong ? '<button class="message-toggle" type="button" aria-expanded="false">展开完整回答</button>' : ''}${evidenceId ? `<button class="evidence" type="button" data-evidence-id="${evidenceId}">查看回答依据</button>` : ''}${options.loading ? '' : feedback}`;
  const playbackTime = Number.isFinite(options.playbackTime) ? options.playbackTime : video.currentTime;
  message.innerHTML = `<img src="${musician.image}" alt=""><div>${options.cue ? `<span class="cue-message-label">${options.cue.timecode} · ${options.cue.emotion}</span>` : ''}<div class="message-meta"><strong>${musicianDisplayName(id)}</strong><time>${formatTime(playbackTime)}</time></div><p class="${isLong ? 'is-collapsed' : ''}"></p>${actions ? `<div class="message-actions">${actions}</div>` : ''}</div>`;
  message.querySelector('p').textContent = answer;
  if (evidenceId) evidenceStore.set(evidenceId, options.evidence);
  messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
  return message;
}

function addUserMessage(text, playbackTime = video.currentTime) {
  const message = document.createElement('article');
  message.className = 'message is-user';
  message.innerHTML = `<div><div class="message-meta"><strong>你</strong><time>${formatTime(playbackTime)}</time></div><p></p></div>`;
  message.querySelector('p').textContent = text;
  messages.appendChild(message);
  messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
}

function loadingTextFor(question, musicianId) {
  if (/^(你们?好|大家好|hello|hi)[呀啊！!。\s]*$/i.test(question)) return '正在回应你的问候…';
  if (/谢谢|感谢/.test(question)) return '正在回应你的心意…';
  if (/改写|重写|怎么写|换一种/.test(question)) return '正在构思这一段的另一种走向…';
  if (/^我.{0,8}(难过|孤独|想念|疲惫|累|害怕|焦虑|不开心)/.test(question)) return '正在认真听你说…';
  const musicianLoading = {
    mozart: '正在寻找旋律里的转折…',
    beethoven: '正在追踪材料怎样变化…',
    bach: '正在分开听上面和下面的声音…'
  };
  if (/这段|这里|音乐|曲子|旋律|和声|节奏|低音|声部|音色|力度|小节/.test(question)) return musicianLoading[musicianId] || '正在重新听这一段…';
  return '正在组织回应…';
}

function addLoadingMessage(musicianId, question, playbackTime) {
  const index = Math.max(0, selectedIds.indexOf(musicianId));
  const message = addMessage(index, loadingTextFor(question, musicianId), { playbackTime });
  message.classList.add('is-loading');
  return message;
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function renderResponsesSequentially(responses, loadingMessages, context = {}) {
  for (let responseIndex = 0; responseIndex < responses.length; responseIndex += 1) {
    const item = responses[responseIndex];
    const index = selectedIds.indexOf(item.musician_id);
    if (index < 0) continue;
    if (responseIndex > 0) await wait(650);
    setSpeaker(index);
    const evidence = {
      basis_type: item.basis_type,
      source_ids: item.source_ids || [],
      retrieval: item.retrieval || [],
      segment: context.segment || null
    };
    const loadingMessage = loadingMessages.get(item.musician_id);
    if (loadingMessage) {
      populateMessage(loadingMessage, index, item.text, { evidence, messageId: item.message_id, playbackTime: context.playbackTime });
      loadingMessages.delete(item.musician_id);
    } else {
      addMessage(index, item.text, { evidence, messageId: item.message_id, playbackTime: context.playbackTime });
    }
  }
  loadingMessages.forEach((message) => message.remove());
}

function triggerCue(cue, manual = false) {
  currentCue = cue;
  renderListeningGuide(cue, true);
  [...companions.children].forEach((item) => item.classList.remove('has-cue-comment'));
  cueOverlay.classList.remove('is-visible');
  if (!manual) triggeredCues.add(cue.id);
}

function buildCueTimeline() {
  cueTimeline.querySelectorAll('.cue-dot').forEach((dot) => dot.remove());
  const duration = trackLibrary[currentTrackId]?.cueDuration || 204.2;
  currentListeningCues().forEach((cue) => {
    const button = document.createElement('button');
    button.className = 'cue-dot';
    button.type = 'button';
    button.style.left = `${cue.time / duration * 100}%`;
    button.dataset.cueId = cue.id;
    button.setAttribute('aria-label', `${cue.timecode} ${cue.emotion}：${cue.title}`);
    button.title = `${cue.timecode} · ${cue.title}`;
    button.addEventListener('click', () => {
      video.currentTime = cue.time;
      lastPlaybackTime = video.currentTime;
      triggerCue(cue, true);
      updateCueDots(video.currentTime);
      if (video.paused) updatePlayback();
    });
    cueTimeline.appendChild(button);
  });
}

let isCueTimelineDragging = false;

function seekFromCueTimeline(clientX) {
  const rect = cueTimeline.getBoundingClientRect();
  if (!rect.width) return;
  const progress = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const duration = Number.isFinite(video.duration) ? video.duration : (trackLibrary[currentTrackId]?.cueDuration || 204.2);
  const targetTime = progress * duration;
  video.currentTime = targetTime;
  lastPlaybackTime = targetTime;
  syncCueToTime(targetTime, { synchronizeTriggered: true });
  updatePlayback();
}

cueTimeline.addEventListener('pointerdown', (event) => {
  if (event.target.closest?.('.cue-dot')) return;
  isCueTimelineDragging = true;
  cueTimeline.classList.add('is-dragging');
  cueTimeline.setPointerCapture?.(event.pointerId);
  seekFromCueTimeline(event.clientX);
});

cueTimeline.addEventListener('pointermove', (event) => {
  if (!isCueTimelineDragging) return;
  seekFromCueTimeline(event.clientX);
});

function stopCueTimelineDragging(event) {
  if (!isCueTimelineDragging) return;
  isCueTimelineDragging = false;
  cueTimeline.classList.remove('is-dragging');
  if (event?.pointerId !== undefined && cueTimeline.hasPointerCapture?.(event.pointerId)) {
    cueTimeline.releasePointerCapture(event.pointerId);
  }
}

cueTimeline.addEventListener('pointerup', stopCueTimelineDragging);
cueTimeline.addEventListener('pointercancel', stopCueTimelineDragging);
cueTimeline.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const duration = Number.isFinite(video.duration) ? video.duration : (trackLibrary[currentTrackId]?.cueDuration || 204.2);
  let targetTime = video.currentTime;
  if (event.key === 'ArrowLeft') targetTime -= 5;
  if (event.key === 'ArrowRight') targetTime += 5;
  if (event.key === 'Home') targetTime = 0;
  if (event.key === 'End') targetTime = duration;
  targetTime = Math.min(duration, Math.max(0, targetTime));
  video.currentTime = targetTime;
  lastPlaybackTime = targetTime;
  syncCueToTime(targetTime, { synchronizeTriggered: true });
  updatePlayback();
});

function buildCompanions() {
  companions.replaceChildren();
  selectedIds.forEach((id, index) => {
    const musician = musicianCatalog[id];
    const item = document.createElement('div');
    item.className = 'companion';
    item.dataset.musicianId = id;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `选择${musicianDisplayName(id)}回答`);
    item.innerHTML = `<div class="speech-bubble">${musician.line}</div><img src="${musician.image}" alt="${musician.name}"><span class="companion-name">${musicianDisplayName(id)}</span>`;
    const select = () => {
      setSpeaker(index);
      setSelectedRespondent(id);
    };
    item.addEventListener('click', select);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
    companions.appendChild(item);
  });
}

function updateCueDots(current) {
  document.querySelectorAll('.cue-dot').forEach((dot) => {
    const cue = currentListeningCues().find((item) => item.id === dot.dataset.cueId);
    if (!cue) return;
    dot.classList.toggle('is-passed', current >= cue.time);
    dot.classList.toggle('is-active', currentCue?.id === cue.id && Math.abs(current - cue.time) < 7);
  });
}

function cueAtTime(current) {
  return [...currentListeningCues()].reverse().find((cue) => cue.time <= current) || null;
}

function syncCueToTime(current, { synchronizeTriggered = false } = {}) {
  const listeningCues = currentListeningCues();
  if (!currentHasCues || !listeningCues.length) {
    currentCue = null;
    renderListeningGuide(null, true);
    return;
  }

  if (synchronizeTriggered) {
    listeningCues.forEach((cue) => {
      if (cue.time <= current) triggeredCues.add(cue.id);
      else triggeredCues.delete(cue.id);
    });
  }

  const nextCurrentCue = cueAtTime(current);
  currentCue = nextCurrentCue;
  if (nextCurrentCue) {
    setCueOverlayContent(nextCurrentCue);
    renderListeningGuide(nextCurrentCue, true);
  } else {
    setCueOverlayContent(listeningCues[0]);
    renderListeningGuide(listeningCues[0], true);
    cueOverlay.classList.remove('is-visible');
  }
}

function updatePlayback() {
  const current = video.currentTime;
  const duration = Number.isFinite(video.duration) ? video.duration : 204.2;
  const listeningCues = currentListeningCues();
  seekBar.max = duration;
  seekBar.value = current;
  timeReadout.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  performanceViewport.style.setProperty('--video-progress', `${Math.min(100, current / duration * 100)}%`);
  cueTimeline.setAttribute('aria-valuemax', String(Math.round(duration)));
  cueTimeline.setAttribute('aria-valuenow', String(Math.round(current)));
  cueTimeline.setAttribute('aria-valuetext', `${formatTime(current)} / ${formatTime(duration)}`);

  if (currentHasCues && (current + .5 < lastPlaybackTime || current - lastPlaybackTime >= 4)) {
    syncCueToTime(current, { synchronizeTriggered: true });
  } else if (currentHasCues && current - lastPlaybackTime < 4) {
    listeningCues.forEach((cue) => {
      if (!triggeredCues.has(cue.id) && cue.time > lastPlaybackTime && cue.time <= current + .12) triggerCue(cue);
    });
  }

  const nextCue = currentHasCues ? listeningCues.find((cue) => cue.time > current) : null;
  if (!video.paused) liveStatus.textContent = currentHasCues ? (nextCue ? `下一点评 ${nextCue.timecode}` : '聆听结尾') : '音乐家正在聆听';
  updateCueDots(current);
  lastPlaybackTime = current;
  if (!video.paused) animationFrame = requestAnimationFrame(updatePlayback);
}

async function togglePlayback() {
  if (video.paused) {
    try { await video.play(); } catch { showToast('浏览器阻止了自动播放，请再点击一次。'); }
  } else video.pause();
}

function updatePlayButton() {
  const playing = !video.paused;
  playButton.classList.toggle('is-playing', playing);
  playButton.setAttribute('aria-label', playing ? '暂停音乐' : '播放音乐');
  if (!playing && video.currentTime) liveStatus.textContent = '已暂停';
  cancelAnimationFrame(animationFrame);
  updatePlayback();
}

function getSegmentContext(playbackTime = video.currentTime) {
  const track = trackLibrary[currentTrackId];
  const cue = currentHasCues ? cueAtTime(playbackTime) : null;
  return {
    piece_id: currentTrackId,
    title: track?.title || pieceTitle.textContent,
    composer: track?.pieceMeta || '',
    segment_id: cue?.id || `time-${Math.floor(playbackTime)}`,
    start_time: cue?.time ?? playbackTime,
    music_features: cue?.features || [],
    display_tags: cue?.tags || [],
    editor_note: cue ? `${cue.title}。${cue.hint}` : track?.captionTitle || ''
  };
}

function staticAnswer(musicianId) {
  const responses = prototypeResponses[musicianId] || [musicianCatalog[musicianId].line];
  const responseIndex = Math.abs(Math.floor(video.currentTime / 12)) % responses.length;
  return responses[responseIndex];
}

function renderStaticResponses(ids, playbackTime = video.currentTime) {
  ids.forEach((id) => {
    const index = selectedIds.indexOf(id);
    setSpeaker(Math.max(0, index));
    addMessage(Math.max(0, index), staticAnswer(id), { playbackTime });
  });
}

async function answerQuestion(question, options = {}) {
  const playbackTime = Number.isFinite(options.playbackTime) ? options.playbackTime : video.currentTime;
  const pieceId = options.pieceId || currentTrackId;
  const segmentContext = options.segmentContext || getSegmentContext(playbackTime);
  const answerMode = options.answerMode || 'auto';
  const selectedSmartIds = selectedIds.filter((id) => smartMusicianIds.has(id));
  const selectedStaticIds = selectedIds.filter((id) => !smartMusicianIds.has(id));
  const requestedGroupAnswer = answerMode === 'all' || /你们|三位|大家|都(?:来|说|回答|聊|谈|看看)/.test(question);
  const selectedId = options.ignoreSelection || requestedGroupAnswer ? null : selectedRespondentId;

  if (selectedId && !smartMusicianIds.has(selectedId)) {
    renderStaticResponses([selectedId], playbackTime);
    return;
  }

  if (selectedSmartIds.length === 0) {
    renderStaticResponses(requestedGroupAnswer ? selectedIds : [selectedId || selectedIds[activeSpeaker]], playbackTime);
    return;
  }

  const loadingIds = requestedGroupAnswer
    ? selectedSmartIds
    : [selectedId && smartMusicianIds.has(selectedId) ? selectedId : selectedSmartIds[activeSpeaker % selectedSmartIds.length]];
  const loadingMessages = new Map(loadingIds.filter(Boolean).map((musicianId) => [musicianId, addLoadingMessage(musicianId, question, playbackTime)]));
  questionInput.disabled = true;
  questionForm.querySelector('.send-button').disabled = true;

  try {
    await ensureBackendAvailable();
    const response = await fetch(apiUrl(options.continueDiscussion ? '/api/chat/continue' : '/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: question,
        selected_musician: selectedId && smartMusicianIds.has(selectedId) ? selectedId : null,
        available_musicians: selectedSmartIds,
        forced_musicians: requestedGroupAnswer ? selectedSmartIds : [],
        piece_id: pieceId,
        playback_time: playbackTime,
        segment_context: segmentContext,
        conversation_id: conversationId,
        previous_turn: previousTurn
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '回答生成失败');
    conversationId = result.conversation_id || conversationId;
    if (requestedGroupAnswer && selectedStaticIds.length > 0) renderStaticResponses(selectedStaticIds, playbackTime);

    if (!result.responses?.length) {
      loadingMessages.forEach((message) => message.remove());
      const fallbackId = selectedId || selectedSmartIds[0];
      addMessage(selectedIds.indexOf(fallbackId), '这个问题我不能替你下结论。不过如果你愿意，我们可以从正在听到的声音继续聊。', { playbackTime });
      return;
    }

    previousTurn = result.responses.map((item) => ({ musician_id: item.musician_id, text: item.text }));
    await renderResponsesSequentially(result.responses, loadingMessages, { playbackTime, segment: result.segment });
  } catch (error) {
    loadingMessages.forEach((message) => message.remove());
    const fallbackId = selectedId || selectedSmartIds[0];
    addMessage(
      Math.max(0, selectedIds.indexOf(fallbackId)),
      '本地后端没有运行，所以这次没有生成回答。请双击项目文件夹里的“启动知音.command”，看到页面重新打开后再问一次。',
      { playbackTime }
    );
    showToast(`本地后端未连接：${error.message}`);
  } finally {
    questionInput.disabled = false;
    questionForm.querySelector('.send-button').disabled = false;
    questionInput.focus();
  }
}

function setDisplayMode(guideMode) {
  listeningGuidePanel.classList.add('is-visible');
  cueOverlay.classList.remove('is-visible');
  cueOverlay.classList.add('is-suppressed');
  if (guideMode) renderListeningGuide(currentCue || (currentHasCues ? currentListeningCues()[0] : null), true);
}

document.querySelectorAll('.mode-button').forEach((button) => button.addEventListener('click', () => {
  if (button.disabled) return;
  document.querySelectorAll('.mode-button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  setDisplayMode(button.dataset.mode === 'listening-guide');
}));

function setLibrary(open) {
  mediaLibrary.classList.toggle('is-visible', open);
  mediaLibrary.setAttribute('aria-hidden', String(!open));
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) libraryClose.focus();
  else libraryButton.focus();
}

function resetDiscussionForTrack() {
  messages.replaceChildren();
  conversationId = null;
  previousTurn = [];
  selectedRespondentId = null;
  selectedIds.forEach((id, index) => {
    const bubble = companions.children[index]?.querySelector('.speech-bubble');
    if (bubble) bubble.textContent = musicianCatalog[id].line;
  });
  [...companions.children].forEach((item) => item.classList.remove('has-cue-comment'));
  requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
  setSpeaker(0);
  [...companions.children].forEach((item) => item.classList.remove('is-selected'));
  questionInput.placeholder = '问问他们，这一段让你想到什么？';
}

function updateLibrarySelection() {
  libraryGrid.querySelectorAll('.library-item').forEach((item) => item.classList.toggle('is-current', item.dataset.trackId === currentTrackId));
}

function switchRelativeTrack(direction) {
  const currentIndex = trackOrder.indexOf(currentTrackId);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (safeIndex + direction + trackOrder.length) % trackOrder.length;
  switchTrack(trackOrder[nextIndex]);
}

function scrollLibrary(direction) {
  libraryGrid.scrollLeft += direction * Math.max(240, libraryGrid.clientWidth * .86);
}

function switchTrack(trackId) {
  const track = trackLibrary[trackId];
  if (!track) return;
  if (recordedEvents.has('play_started') && trackId !== currentTrackId) trackEvent('listen_again_intent', { from_track: currentTrackId, to_track: trackId }, true);
  video.pause();
  currentTrackId = trackId;
  currentHasCues = track.hasCues;
  currentCue = null;
  lastPlaybackTime = 0;
  triggeredCues.clear();
  resetCueSpeakerRotation();
  cueOverlay.classList.remove('is-visible');
  performanceViewport.style.setProperty('--video-progress', '0%');
  performanceViewport.style.setProperty('--video-crop-position', track.videoCrop?.position || 'center 50%');
  video.src = track.src;
  video.poster = track.poster;
  video.dataset.mediaType = track.mediaType;
  video.setAttribute('aria-label', `${track.title} 演奏视频`);
  video.load();
  pieceTitle.textContent = track.title;
  pieceMeta.textContent = track.pieceMeta;
  scoreCaptionTitle.textContent = track.captionTitle;
  scoreCaptionMeta.textContent = track.captionMeta;
  performanceCredit.textContent = track.credit;
  trackTitle.textContent = track.trackTitle;
  trackMeta.textContent = track.trackMeta;
  sourceNote.textContent = track.sourceNote;
  cueTimeline.hidden = !currentHasCues;
  buildCueTimeline();
  listeningGuideButton.title = currentHasCues ? '查看当前节点的听觉重点' : '查看自由聆听提示';
  renderedGuideCueId = null;
  if (currentHasCues && currentListeningCues().length) setCueOverlayContent(currentListeningCues()[0]);
  renderListeningGuide(currentHasCues ? currentListeningCues()[0] : null, true);
  setDisplayMode(false);
  document.querySelectorAll('.mode-button').forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.mode === 'performance')));
  updateCueDots(0);
  updateLibrarySelection();
  resetDiscussionForTrack();
  updatePlayback();
  setLibrary(false);
  showToast(`已切换到《${track.title}》`);
}

libraryButton.addEventListener('click', () => setLibrary(true));
libraryClose.addEventListener('click', () => setLibrary(false));
libraryPrevious.addEventListener('click', () => scrollLibrary(-1));
libraryNext.addEventListener('click', () => scrollLibrary(1));
previousTrackButton.addEventListener('click', () => switchRelativeTrack(-1));
nextTrackButton.addEventListener('click', () => switchRelativeTrack(1));
mediaLibrary.addEventListener('click', (event) => {
  if (event.target === mediaLibrary) setLibrary(false);
});
libraryGrid.addEventListener('click', (event) => {
  const item = event.target.closest('.library-item');
  if (item) switchTrack(item.dataset.trackId);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && mediaLibrary.classList.contains('is-visible')) setLibrary(false);
  if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target instanceof Element ? event.target : null;
  const isEditing = target?.matches('input, textarea, select, [contenteditable="true"]');
  const isInteractive = target?.closest('button, a, [role="button"], [role="slider"]');
  if (isEditing || isInteractive || mediaLibrary.classList.contains('is-visible')) return;
  event.preventDefault();
  togglePlayback();
});

playButton.addEventListener('click', togglePlayback);
video.addEventListener('click', togglePlayback);
video.addEventListener('play', () => trackEvent('play_started', {}, true));
restartButton.addEventListener('click', async () => {
  video.currentTime = 0;
  triggeredCues.clear();
  resetCueSpeakerRotation();
  currentCue = null;
  lastPlaybackTime = 0;
  syncCueToTime(0);
  await video.play().catch(() => {});
  updatePlayback();
});
replayCueButton.addEventListener('click', async () => {
  const replayFrom = currentCue ? currentCue.time : video.currentTime;
  video.currentTime = Math.max(0, replayFrom - 6);
  lastPlaybackTime = video.currentTime;
  await video.play().catch(() => {});
  renderListeningGuide(currentCue, true);
  showToast('正在带着提示重听这一小段');
});
seekBar.addEventListener('input', () => {
  const targetTime = Number(seekBar.value);
  video.currentTime = targetTime;
  syncCueToTime(targetTime, { synchronizeTriggered: true });
  lastPlaybackTime = targetTime;
  updatePlayback();
});
video.addEventListener('play', updatePlayButton);
video.addEventListener('pause', updatePlayButton);
video.addEventListener('loadedmetadata', updatePlayback);
video.addEventListener('ended', updatePlayButton);

document.querySelectorAll('.prompt-chip').forEach((chip) => chip.addEventListener('click', () => {
  questionInput.value = chip.textContent;
  pendingAnswerMode = chip.dataset.answerMode || 'auto';
  questionInput.focus();
}));
questionInput.addEventListener('input', () => {
  const matchesQuickPrompt = [...document.querySelectorAll('.prompt-chip')]
    .some((chip) => chip.textContent === questionInput.value);
  if (!matchesQuickPrompt) pendingAnswerMode = 'auto';
});
questionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;
  const playbackTime = video.currentTime;
  const pieceId = currentTrackId;
  const segmentContext = getSegmentContext(playbackTime);
  questionInput.value = '';
  addUserMessage(question, playbackTime);
  setMobileView('talk');
  trackEvent('question_submitted', { question_length: question.length }, true);
  const answerMode = pendingAnswerMode;
  pendingAnswerMode = 'auto';
  await answerQuestion(question, { answerMode, playbackTime, pieceId, segmentContext });
});
continueTalk.addEventListener('click', async () => {
  trackEvent('group_discussion_started', {}, true);
  const question = '请继续讨论上一轮观点，回应彼此的差异，不要重复已经说过的内容。';
  const playbackTime = video.currentTime;
  const pieceId = currentTrackId;
  const segmentContext = getSegmentContext(playbackTime);
  addUserMessage('让他们继续讨论这一段', playbackTime);
  await answerQuestion(question, { answerMode: 'all', continueDiscussion: true, ignoreSelection: true, playbackTime, pieceId, segmentContext });
});
messages.addEventListener('click', (event) => {
  if (event.target.classList.contains('evidence')) {
    const evidence = evidenceStore.get(event.target.dataset.evidenceId);
    const sources = evidence?.source_ids?.length ? evidence.source_ids.join('、') : '本轮未引用历史资料编号';
    const headings = evidence?.retrieval?.slice(0, 2).map((item) => item.heading).filter(Boolean).join('、');
    const firstResult = evidence?.retrieval?.[0];
    const segment = evidence?.segment;
    const segmentLabel = segment
      ? `片段：${formatTime(segment.start_time)} ${segment.stage || segment.segment_id}`
      : '片段：未记录';
    const retrievalMethod = firstResult?.retrieval_method?.startsWith('vector:')
      ? `BGE 向量 Top${evidence.retrieval.length}`
      : firstResult?.retrieval_method === 'fts5_fallback' ? 'FTS5 降级召回' : '未记录召回方式';
    const score = Number.isFinite(firstResult?.score) ? ` · 首条相似度 ${firstResult.score.toFixed(3)}` : '';
    showToast(headings
      ? `${segmentLabel}；${retrievalMethod}${score}；命中：${headings}；资料：${sources}`
      : `${segmentLabel}；${retrievalMethod}${score}；资料：${sources}`);
  }
  if (event.target.classList.contains('message-toggle')) {
    const paragraph = event.target.closest('.message')?.querySelector('p');
    if (!paragraph) return;
    const expanded = event.target.getAttribute('aria-expanded') === 'true';
    paragraph.classList.toggle('is-collapsed', expanded);
    event.target.setAttribute('aria-expanded', String(!expanded));
    event.target.textContent = expanded ? '展开完整回答' : '收起回答';
  }
  if (event.target.classList.contains('feedback-trigger')) {
    const menu = event.target.closest('.feedback-menu');
    if (!menu) return;
    const shouldOpen = !menu.classList.contains('is-open');
    messages.querySelectorAll('.feedback-menu.is-open').forEach((openMenu) => {
      openMenu.classList.remove('is-open');
      openMenu.querySelector('.feedback-trigger')?.setAttribute('aria-expanded', 'false');
    });
    menu.classList.toggle('is-open', shouldOpen);
    event.target.setAttribute('aria-expanded', String(shouldOpen));
    if (shouldOpen) requestAnimationFrame(() => menu.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }
  if (event.target.classList.contains('feedback-option')) {
    const message = event.target.closest('.message');
    const menu = event.target.closest('.feedback-menu');
    fetch(apiUrl('/api/feedback'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: productSessionId,
        conversation_id: conversationId,
        message_id: message?.dataset.messageId || null,
        musician_id: message?.dataset.musicianId || null,
        feedback_type: event.target.dataset.feedback
      })
    }).then((response) => {
      if (!response.ok) throw new Error('反馈提交失败');
      menu.classList.add('is-sent');
      menu.classList.remove('is-open');
      menu.querySelector('.feedback-trigger').textContent = '已记录';
      menu.querySelector('.feedback-trigger').setAttribute('aria-expanded', 'false');
      showToast('谢谢，反馈已经记录。');
    }).catch(() => showToast('反馈暂时没有保存，请稍后再试。'));
  }
});

document.querySelector('.enter-fourth-scene')?.addEventListener('click', () => {
  sessionStorage.setItem('tuningLastListeningTrack', JSON.stringify({
    id: currentTrackId,
    currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
    duration: Number.isFinite(video.duration) ? video.duration : 0
  }));
  trackEvent('fourth_act_entered', {}, true);
});

trackEvent('session_started', {}, true);
buildCompanions();
switchTrack(trackOrder[0]);
updatePlayButton();
