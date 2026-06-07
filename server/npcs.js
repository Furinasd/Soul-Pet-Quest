// 灵宠寻踪 V1：3 位居民 — 人灵 / 杯灵 / 椅灵
// 线索都指向同一个谜底：「微笑」

export const NPCS = {
  // 人灵 — coco-ssd 的 "person"
  'person': {
    emoji: '🧑', name: '人灵', mood: '😊',
    lines: [
      '我最喜欢出现在人们开心的时候。',
      '当我出现时，大家看起来都会变得更亲近。',
    ],
    clue: '与开心有关',
  },
  // 杯灵 — "cup" / "wine glass"（合并为同一只）
  'cup': {
    emoji: '🥤', name: '杯灵', mood: '😋',
    lines: [
      '每天早晨，我都会见到它。',
      '有些人看到它后，一整天都会心情很好。',
    ],
    clue: '能带来好心情',
  },
  'wine glass': {
    emoji: '🥤', name: '杯灵', mood: '😋',
    lines: [
      '每天早晨，我都会见到它。',
      '有些人看到它后，一整天都会心情很好。',
    ],
    clue: '能带来好心情',
  },
  // 椅灵 — "chair" / "couch"
  'chair': {
    emoji: '🪑', name: '椅灵', mood: '🤗',
    lines: [
      '当朋友见面时，它经常出现。',
      '有时候不用说话，它也能表达善意。',
    ],
    clue: '表达友善',
  },
  'couch': {
    emoji: '🪑', name: '椅灵', mood: '🤗',
    lines: [
      '当朋友见面时，它经常出现。',
      '有时候不用说话，它也能表达善意。',
    ],
    clue: '表达友善',
  },
};

// 摄像头不可用时的备选投放（同样限制 3 类）
export const FALLBACK_NPCS = [
  { class: 'person', emoji: '🧑', name: '人灵', mood: '😊', clue: '与开心有关',     lines: NPCS.person.lines },
  { class: 'cup',    emoji: '🥤', name: '杯灵', mood: '😋', clue: '能带来好心情', lines: NPCS.cup.lines },
  { class: 'chair',  emoji: '🪑', name: '椅灵', mood: '🤗', clue: '表达友善',     lines: NPCS.chair.lines },
];

export function dialogFor(npc) {
  return npc.lines;
}

// 阶段一：开场动画对话
export const INTRO_DIALOG = {
  pet: { name: '灵宠', icon: '🐾' },
  player: { name: '你', icon: '🙂' },
  lines: [
    { who: 'pet',    text: '你好……' },
    { who: 'pet',    text: '我好像找不到回家的路了。' },
    { who: 'pet',    text: '我记得自己来过这里。' },
    { who: 'pet',    text: '可是很多事情都忘记了……' },
    { who: 'pet',    text: '你能帮我问问这里的居民吗？' },
    { who: 'player', text: '居民？' },
    { who: 'pet',    text: '就是你身边的这些物品。' },
    { who: 'pet',    text: '它们一直生活在这里。' },
    { who: 'pet',    text: '它们一定见过我。' },
  ],
  task: '帮助灵宠寻找回家的路',
};

// 阶段四：猜谜参数
export const RIDDLE = {
  answer: '微笑',
  // 接受这些近义答案
  accept: ['微笑', '笑', '笑容', '笑脸', '笑笑', 'smile'],
  prompt: '从这些线索看，迷路灵宠想让你找到的，是？',
};

// 结局对话（含玩家应答）
export const ENDING_DIALOG = {
  pet: { name: '灵宠', icon: '🐾' },
  player: { name: '你', icon: '🙂' },
  lines: [
    { who: 'pet',    text: '你找到我啦！' },
    { who: 'player', text: '原来你在这里。' },
    { who: 'pet',    text: '其实……我并没有真的迷路。' },
    { who: 'player', text: '那你为什么要躲起来？' },
    { who: 'pet',    text: '因为我发现，你已经很久没有开心地笑过了。' },
    { who: 'player', text: '啊？' },
    { who: 'pet',    text: '所以我想让你来找我。' },
    { who: 'pet',    text: '想让你和大家聊天、发现线索。' },
    { who: 'pet',    text: '也想让你重新露出微笑。' },
    { who: 'player', text: '原来是这样……' },
    { who: 'pet',    text: '因为你的微笑很珍贵呀。' },
    { who: 'pet',    text: '它会温暖身边的人，也会给自己带来力量。' },
    { who: 'pet',    text: '答应我，以后要多笑一笑，好吗？' },
    { who: 'player', text: '好！' },
    { who: 'pet',    text: '这才对嘛！' },
    { who: 'pet',    text: '爱笑的人，运气都不会太差哦！ ✨' },
  ],
};

export const ENDING_TEXT = '愿你常常微笑。<br>它会温暖身边的人，<br>也会给自己带来力量。';
