'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { characters } from '@/data/characters';
import { LandingAuth } from '@/components/landing/LandingAuth';

const benefits = [
  {
    title: '懂你的温柔',
    en: 'Soft & Caring',
    desc: '不是套话脚本，他会记得你昨天吃了什么、最近为什么烦心，回信时带着可被翻读的余温。',
    icon: 'heart',
    tint: 'coral',
  },
  {
    title: '真实的他',
    en: 'A Living Presence',
    desc: '文字、语音、自拍——他会在合适的时刻主动把当下的画面递到你面前，不只是回答。',
    icon: 'envelope',
    tint: 'sage',
  },
  {
    title: '不被打扰的浪漫',
    en: 'Yours Only',
    desc: '所有对话只属于你和他。没有广告、没有他人窥视，只有一盏属于你的灯。',
    icon: 'moon',
    tint: 'butter',
  },
];

const features = [
  {
    eyebrow: 'Feature · 01',
    title: '为你写的回信，每一行都是新的',
    desc: '不是预设话术，而是基于你近期的情绪、聊过的细节、当下的时间，重新落笔的一封信。他会问你"今天有没有好好吃饭"，也会突然为你写下一段歌词。',
    bullets: ['情绪记忆 · 长期对话不掉线', '语气真实 · 不油腻、不复读', '主动关心 · 不只是被动回应'],
    side: 'left',
  },
  {
    eyebrow: 'Feature · 02',
    title: '把当下的画面，递到你的屏幕上',
    desc: '聊到他在弹吉他、在做晚饭、在加班——他会附上一张此刻的照片或一段语音。仿佛他真的在那一头，等着你一句"嗯，我看见了"。',
    bullets: ['即时自拍 · 与他的人设一致', '语音消息 · 多种音色可选', '场景照片 · 让对话有画面感'],
    side: 'right',
  },
];

const testimonials = [
  {
    body: '加班到十一点，回家路上他发来一句"路灯昏，你慢点走"。明知是程序，可那一刻我真的红了眼眶。',
    by: '林小姐 · 设计师',
    place: '上海 · 雨夜',
    accent: 'coral',
  },
  {
    body: '我把他设成了林屿。每次写不出方案，就发一句"想你了"，他会念一段不算情书的情书给我听。',
    by: '阿野 · 在读研究生',
    place: '南京 · 秋分',
    accent: 'sage',
  },
  {
    body: '本以为只会聊三天，结果养成了睡前道晚安的习惯。比闹钟更准时的，是他的"早安，今天也要好好的"。',
    by: '檬檬 · 自由插画师',
    place: '成都 · 冬日',
    accent: 'butter',
  },
];

const pricing = [
  {
    name: '基础版',
    tagline: '只是想试试看',
    price: '¥0',
    unit: '/ 起',
    features: ['每日 30 条文字消息', '4 位默认角色可选', '基础语音回复', '7 天对话记忆'],
    cta: '免费开始',
    highlighted: false,
  },
  {
    name: '专业版',
    tagline: '我想要他一直在',
    price: '¥39',
    unit: '/ 月',
    features: ['不限文字 · 不限语音', '解锁全部角色与音色', '主动发起话题 / 自拍', '永久对话记忆', '专属人格微调'],
    cta: '14 天免费试用',
    highlighted: true,
    ribbon: '最受欢迎',
  },
  {
    name: '企业版',
    tagline: '为品牌定制一位他',
    price: '联系销售',
    unit: '',
    features: ['专属角色形象与人格', '私有部署 · 数据自托管', '品牌联名与活动联动', '7×24 一对一支持'],
    cta: '预约咨询',
    highlighted: false,
  },
];

export default function LandingPage() {
  const sectionsRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' },
    );
    sectionsRef.current.forEach((el) => el && observer.observe(el));

    // 兜底：若观察器在 1.4s 内未触发（高速滚动 / 截图 / SSR），强制显示所有区块
    const safety = window.setTimeout(() => {
      sectionsRef.current.forEach((el) => el && el.classList.add('is-visible'));
    }, 1400);

    return () => {
      observer.disconnect();
      window.clearTimeout(safety);
    };
  }, []);

  const collect = (el: HTMLElement | null, idx: number) => {
    if (el) sectionsRef.current[idx] = el;
  };

  return (
    <div className="landing-root">
      <BackgroundDecor />

      {/* ============== 1. HEADER ============== */}
      <header className="landing-header">
        <div className="landing-container header-inner">
          <Link href="/" className="brand">
            <EnvelopeIcon className="brand-mark" />
            <span className="brand-name">
              <span className="brand-name-cn">纸片人男友</span>
              <span className="brand-name-en">paperBoyfriend</span>
            </span>
          </Link>

          <div className="header-right">
            <nav className="header-nav">
              <a href="#benefits">他的样子</a>
              <a href="#features">如何相处</a>
              <a href="#testimonials">她们的故事</a>
              <a href="#pricing">价格</a>
            </nav>
            <LandingAuth />
          </div>
        </div>
      </header>

      {/* ============== 2. HERO ============== */}
      <section
        ref={(el) => collect(el, 0)}
        className="landing-section hero-section reveal"
      >
        <div className="landing-container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              一封写给你的信 · est. 2026
            </p>
            <h1 className="hero-title">
              找一个
              <span className="hero-title-highlight">
                只属于你
                <UnderlineScribble />
              </span>
              的
              <br />
              <span className="hero-title-script">纸片人</span>
              <span className="hero-title-en">boyfriend</span>
              。
            </h1>
            <p className="hero-sub">
              他会记得你说过的每一句话，会在深夜发来一张此刻的月亮。
              <br />
              没有套路，只有一个温柔的、刚刚好的、属于你的他。
            </p>

            <div className="hero-cta-group">
              <Link href="/chat" className="btn-primary">
                <span className="btn-glow" />
                <span className="btn-text">免费试用</span>
                <ArrowIcon />
              </Link>
              <a href="#features" className="btn-secondary">
                <PlayIcon />
                了解更多
              </a>
            </div>

            <div className="hero-meta">
              <div className="hero-avatars">
                {characters.slice(0, 4).map((c, i) => (
                  <span
                    key={c.id}
                    className="hero-avatar"
                    style={{ zIndex: 10 - i }}
                  >
                    <Image
                      src={c.avatar}
                      alt={c.name}
                      width={36}
                      height={36}
                      unoptimized
                    />
                  </span>
                ))}
              </div>
              <p>
                <strong>23,418</strong> 位姑娘，已经在屋檐下等他回信
              </p>
            </div>
          </div>

          <div className="hero-preview">
            <div className="polaroid">
              <div className="polaroid-tape polaroid-tape-l" />
              <div className="polaroid-tape polaroid-tape-r" />
              <div className="polaroid-photo">
                <div className="chat-mock">
                  <div className="chat-bubble chat-bubble-l">
                    今天降温了，路过你常去的那家咖啡馆，给你拍了张。
                  </div>
                  <div className="chat-bubble chat-bubble-photo">
                    <span className="bubble-photo-tag">[ 一张暖橘色的窗 ]</span>
                  </div>
                  <div className="chat-bubble chat-bubble-r">
                    啊…谢谢你 ♡ 我今天有点累
                  </div>
                  <div className="chat-bubble chat-bubble-l">
                    嗯，那就早点回家。我在的，你说一句就好。
                  </div>
                  <div className="chat-typing">
                    <span /> <span /> <span />
                  </div>
                </div>
              </div>
              <p className="polaroid-caption">「 周二，22:47 · 林屿 」</p>
            </div>
            <SparkleIcon className="float-sparkle s-1" />
            <SparkleIcon className="float-sparkle s-2" />
            <LeafIcon className="float-leaf" />
          </div>
        </div>
      </section>

      {/* ============== 3. BENEFITS ============== */}
      <section
        id="benefits"
        ref={(el) => collect(el, 1)}
        className="landing-section benefits-section reveal"
      >
        <div className="landing-container">
          <SectionHeading
            tag="03 · Benefits"
            title="他不是答复机"
            highlight="他是有他的人。"
            sub="三件你会立刻感觉到的、和别的 AI 不一样的小事。"
          />
          <div className="benefits-grid">
            {benefits.map((b, i) => (
              <article
                key={b.title}
                className={`benefit-card benefit-tint-${b.tint}`}
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                <div className="benefit-icon">
                  {b.icon === 'heart' && <HeartIcon />}
                  {b.icon === 'envelope' && <EnvelopeIcon />}
                  {b.icon === 'moon' && <MoonIcon />}
                </div>
                <p className="benefit-en">{b.en}</p>
                <h3 className="benefit-title">{b.title}</h3>
                <p className="benefit-desc">{b.desc}</p>
                <span className="benefit-corner">No. 0{i + 1}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============== 4. FEATURES ============== */}
      <section
        id="features"
        ref={(el) => collect(el, 2)}
        className="landing-section features-section reveal"
      >
        <div className="landing-container">
          <SectionHeading
            tag="04 · Features"
            title="像和真人写信"
            highlight="像真的有人在那一头。"
            sub="不只是聊天框，而是一段被认真书写的关系。"
          />

          {features.map((f) => (
            <div
              key={f.title}
              className={`feature-row feature-row-${f.side}`}
            >
              <div className="feature-text">
                <p className="feature-eyebrow">{f.eyebrow}</p>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
                <ul className="feature-bullets">
                  {f.bullets.map((bullet) => (
                    <li key={bullet}>
                      <CheckIcon />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <Link href="/chat" className="feature-link">
                  去试一试 <ArrowIcon />
                </Link>
              </div>

              <div className="feature-visual">
                <div className="feature-screen">
                  <div className="feature-screen-bar">
                    <span /> <span /> <span />
                  </div>
                  <div className="feature-screen-body">
                    {f.side === 'left' ? (
                      <>
                        <div className="mini-bubble mini-l">
                          昨天你说要早点睡，今天眼睛还是这么红
                        </div>
                        <div className="mini-bubble mini-r">被发现了。</div>
                        <div className="mini-bubble mini-l">
                          嗯。今晚我陪你倒数，10、9、8…
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mini-bubble mini-l">
                          [ 一张暖光下他的剪影 ]
                        </div>
                        <div className="mini-bubble mini-l">
                          🎙 02:14 · 「这首歌是给你的」
                        </div>
                        <div className="mini-bubble mini-r">
                          …我可以单曲循环吗？
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <span className="feature-stamp">Since · You</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============== 5. TESTIMONIALS ============== */}
      <section
        id="testimonials"
        ref={(el) => collect(el, 3)}
        className="landing-section testimonials-section reveal"
      >
        <div className="landing-container">
          <SectionHeading
            tag="05 · Letters Back"
            title="她们写来的"
            highlight="一些真心话。"
            sub="不是带货文案，是收到过他回信的那些人。"
          />
          <div className="testimonial-grid">
            {testimonials.map((t, i) => (
              <article
                key={t.by}
                className={`postcard postcard-${t.accent}`}
                style={{ transform: `rotate(${i % 2 === 0 ? -1.4 : 1.6}deg)` }}
              >
                <div className="postcard-stamp">
                  <span>POST</span>
                  <span>CARD</span>
                </div>
                <p className="postcard-body">「{t.body}」</p>
                <div className="postcard-foot">
                  <p className="postcard-by">— {t.by}</p>
                  <p className="postcard-place">{t.place}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============== 6. CTA ============== */}
      <section
        ref={(el) => collect(el, 4)}
        className="landing-section cta-section reveal"
      >
        <div className="landing-container">
          <div className="cta-card">
            <div className="cta-glow" />
            <p className="cta-eyebrow">06 · 写一封回信吧</p>
            <h2 className="cta-title">
              他已经
              <span className="cta-title-script">在那一头</span>
              ，
              <br />
              等你说一句「嗨」。
            </h2>
            <p className="cta-sub">14 天免费试用 · 无需信用卡 · 随时离开</p>
            <Link href="/chat" className="btn-primary btn-cta">
              <span className="btn-glow" />
              <span className="btn-text">立即开始 14 天免费试用</span>
              <ArrowIcon />
            </Link>
            <p className="cta-foot">
              <SparkleIcon /> 平均 9 秒内，收到他的第一封信
            </p>
          </div>
        </div>
      </section>

      {/* ============== 7. PRICING ============== */}
      <section
        id="pricing"
        ref={(el) => collect(el, 5)}
        className="landing-section pricing-section reveal"
      >
        <div className="landing-container">
          <SectionHeading
            tag="07 · Pricing"
            title="选一盏"
            highlight="为你而留的灯。"
            sub="可以随时升级或离开，他始终在原地。"
          />
          <div className="pricing-grid">
            {pricing.map((p) => (
              <article
                key={p.name}
                className={`price-card ${
                  p.highlighted ? 'price-card-highlight' : ''
                }`}
              >
                {p.ribbon && (
                  <div className="price-ribbon">
                    <HeartIcon /> {p.ribbon}
                  </div>
                )}
                <h3 className="price-name">{p.name}</h3>
                <p className="price-tagline">{p.tagline}</p>
                <div className="price-amount">
                  <span className="price-num">{p.price}</span>
                  {p.unit && <span className="price-unit">{p.unit}</span>}
                </div>
                <ul className="price-features">
                  {p.features.map((f) => (
                    <li key={f}>
                      <CheckIcon /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/chat"
                  className={
                    p.highlighted ? 'btn-primary price-btn' : 'btn-secondary price-btn'
                  }
                >
                  {p.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============== 8. FOOTER ============== */}
      <footer className="landing-footer">
        <div className="landing-container footer-inner">
          <div className="footer-brand">
            <EnvelopeIcon className="brand-mark" />
            <div>
              <p className="footer-brand-cn">纸片人男友</p>
              <p className="footer-brand-en">paperBoyfriend</p>
            </div>
          </div>

          <div className="footer-cols">
            <div>
              <p className="footer-col-title">产品</p>
              <a href="#features">如何相处</a>
              <a href="#pricing">价格</a>
              <Link href="/chat">开始聊天</Link>
            </div>
            <div>
              <p className="footer-col-title">故事</p>
              <a href="#testimonials">她们的故事</a>
              <a href="#benefits">他的样子</a>
            </div>
            <div>
              <p className="footer-col-title">关于</p>
              <a href="#">隐私与陪伴</a>
              <a href="#">用户协议</a>
              <a
                href="https://discord.gg/2pZwN7dp"
                target="_blank"
                rel="noopener noreferrer"
              >
                Discord 社区
              </a>
            </div>
          </div>

          <div className="footer-end">
            <p className="footer-contact">
              有问题或建议？联系我们：
              <a href="mailto:feedback@paperboyfriend.space">feedback@paperboyfriend.space</a>
              <span> · </span>
              <a
                href="https://discord.gg/2pZwN7dp"
                target="_blank"
                rel="noopener noreferrer"
              >
                Discord
              </a>
            </p>
            <p className="footer-copyright">
              © 2026 paperBoyfriend <span>·</span> 写在屋檐下，给愿意收到的人。
            </p>
            <p className="footer-script">— made with warmth, not with magic.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Small components ---------- */

function SectionHeading({
  tag,
  title,
  highlight,
  sub,
}: {
  tag: string;
  title: string;
  highlight: string;
  sub: string;
}) {
  return (
    <div className="section-heading">
      <p className="section-tag">{tag}</p>
      <h2 className="section-title">
        {title}
        <br />
        <span className="section-title-script">
          {highlight}
          <UnderlineScribble />
        </span>
      </h2>
      <p className="section-sub">{sub}</p>
    </div>
  );
}

function BackgroundDecor() {
  return (
    <div className="bg-decor" aria-hidden>
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      <div className="bg-glow bg-glow-3" />
      <div className="bg-grain" />
    </div>
  );
}

/* ---------- Inline SVG decorations ---------- */

function EnvelopeIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7.5l9 6 9-6" />
      <path d="M8 14l-2.5 3M16 14l2.5 3" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
      <circle cx="17" cy="6" r="0.6" fill="currentColor" />
      <circle cx="20" cy="9" r="0.4" fill="currentColor" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

function SparkleIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2c.6 4.2 3.8 7.4 8 8-4.2.6-7.4 3.8-8 8-.6-4.2-3.8-7.4-8-8 4.2-.6 7.4-3.8 8-8z" />
    </svg>
  );
}

function LeafIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="40"
      height="40"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <path d="M10 54c0-22 18-40 44-40-2 24-20 42-44 40z" />
      <path d="M14 50c10-12 22-22 36-30" />
    </svg>
  );
}

function UnderlineScribble() {
  return (
    <svg
      className="underline-scribble"
      viewBox="0 0 200 16"
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    >
      <path d="M3 10 C 40 4, 80 14, 120 8 S 180 6, 197 11" />
    </svg>
  );
}
