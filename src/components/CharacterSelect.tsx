'use client';

import { characters } from '@/data/characters';
import { useChat } from '@/context/ChatContext';
import Image from 'next/image';

export default function CharacterSelect() {
  const { selectCharacter } = useChat();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-[900px] w-full">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent mb-3">
            纸片人男友
          </h1>
          <p className="text-gray-500 text-sm md:text-base">
            选一个他，开始你的故事
          </p>
        </div>

        {/* 角色卡片网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          {characters.map((character) => (
            <button
              key={character.id}
              onClick={() => selectCharacter(character)}
              className="group bg-white/80 backdrop-blur-sm rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 text-left border border-pink-100/50 hover:border-pink-200"
            >
              <div className="flex items-start gap-4">
                {/* 头像 */}
                <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-pink-100 group-hover:ring-pink-300 transition-all">
                  <Image
                    src={character.avatar}
                    alt={character.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-1">
                    {character.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2 line-clamp-2">
                    {character.tagline}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {character.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs rounded-full bg-pink-50 text-pink-500 border border-pink-100"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          选择角色后将进入聊天界面 · 刷新页面对话会清空
        </p>
      </div>
    </div>
  );
}
