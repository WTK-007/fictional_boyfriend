// 环境变量通过 `tsx --env-file=.env.local` 注入，见 package.json db:seed 脚本
import { db } from './index';
import { characters as charactersTable, type NewCharacter } from './schema';
import { characters as presetCharacters } from '../data/characters';

const CHARACTER_META: Record<
  string,
  { sortOrder: number; voiceStyle: string; imageStyle: string }
> = {
  'warm-boy': {
    sortOrder: 1,
    voiceStyle: '说话轻柔，喜欢用"嗯""好的呀"，会主动关心',
    imageStyle: '清新、暖色调、日系风格',
  },
  'cool-guy': {
    sortOrder: 2,
    voiceStyle: '话不多但每句都戳心，偶尔反差萌',
    imageStyle: '冷色调、简约、城市夜景',
  },
  sunshine: {
    sortOrder: 3,
    voiceStyle: '话多爱笑，经常"哈哈哈"，搞笑暖男',
    imageStyle: '明亮、活泼、日常抓拍感',
  },
  artsy: {
    sortOrder: 4,
    voiceStyle: '说话慢、喜欢用比喻、深夜感性',
    imageStyle: '暗色调、胶片感、文艺气息',
  },
};

async function seed() {
  const rows: NewCharacter[] = presetCharacters.map((c) => {
    const meta = CHARACTER_META[c.id];
    return {
      id: c.id,
      name: c.name,
      tagline: c.tagline,
      tags: c.tags,
      avatarUrl: c.avatar,
      speaker: c.speaker,
      systemPrompt: c.systemPrompt,
      appearance: c.appearance,
      voiceStyle: meta?.voiceStyle,
      imageStyle: meta?.imageStyle,
      sortOrder: meta?.sortOrder ?? 0,
      isActive: true,
    };
  });

  console.log(`Seeding ${rows.length} characters...`);

  for (const row of rows) {
    await db
      .insert(charactersTable)
      .values(row)
      .onConflictDoUpdate({
        target: charactersTable.id,
        set: {
          name: row.name,
          tagline: row.tagline,
          tags: row.tags,
          avatarUrl: row.avatarUrl,
          speaker: row.speaker,
          systemPrompt: row.systemPrompt,
          appearance: row.appearance,
          voiceStyle: row.voiceStyle,
          imageStyle: row.imageStyle,
          sortOrder: row.sortOrder,
          isActive: row.isActive,
          updatedAt: new Date(),
        },
      });
    console.log(`  ✓ ${row.id} - ${row.name}`);
  }

  console.log('Done.');
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
