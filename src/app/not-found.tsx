import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '页面走丢了',
};

export default function NotFound() {
  return (
    <main className="notfound-root">
      <div className="notfound-card">
        <p className="notfound-eyebrow">404 · Not Found</p>
        <h1 className="notfound-title">
          这封信
          <span className="notfound-title-script">寄错了地方</span>
        </h1>
        <p className="notfound-sub">
          你要找的页面不在屋檐下，可能它正在路上，也可能从未存在。
        </p>

        <div className="notfound-actions">
          <Link href="/" className="notfound-btn-primary">
            回到首页
          </Link>
        </div>

        <div className="notfound-contact">
          <p className="notfound-contact-text">遇到问题？联系我们</p>
          <a
            href="https://discord.gg/2pZwN7dp"
            target="_blank"
            rel="noopener noreferrer"
            className="notfound-discord"
          >
            <DiscordIcon />
            加入 Discord 社区
          </a>
        </div>
      </div>
    </main>
  );
}

function DiscordIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3a.07.07 0 0 0-.073.035 13.78 13.78 0 0 0-.61 1.249 18.27 18.27 0 0 0-5.487 0 12.62 12.62 0 0 0-.617-1.249.073.073 0 0 0-.073-.035 19.74 19.74 0 0 0-3.76 1.369.066.066 0 0 0-.03.027C2.533 8.045 1.78 11.616 2.146 15.146a.083.083 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.073.073 0 0 0 .079-.027c.462-.63.873-1.295 1.226-1.994a.07.07 0 0 0-.04-.099 13.1 13.1 0 0 1-1.872-.892.07.07 0 0 1-.007-.117c.126-.094.252-.193.371-.292a.07.07 0 0 1 .073-.01c3.927 1.793 8.18 1.793 12.061 0a.07.07 0 0 1 .074.01c.12.099.245.198.372.292a.07.07 0 0 1-.006.117c-.598.349-1.22.645-1.873.891a.07.07 0 0 0-.04.1c.36.699.772 1.364 1.225 1.993a.073.073 0 0 0 .079.028 19.84 19.84 0 0 0 6.002-3.03.07.07 0 0 0 .032-.054c.5-4.084-.838-7.625-3.548-10.75a.058.058 0 0 0-.03-.028zM8.02 13.0c-1.182 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.21 0 2.175 1.094 2.156 2.418 0 1.334-.955 2.42-2.156 2.42zm7.974 0c-1.182 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.21 0 2.175 1.094 2.156 2.418 0 1.334-.946 2.42-2.156 2.42z" />
    </svg>
  );
}
