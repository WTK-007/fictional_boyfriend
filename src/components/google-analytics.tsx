import Script from 'next/script';

// Google Analytics 4 (gtag.js)
// NEXT_PUBLIC_GA_ID 未配置时 no-op,本地开发默认不污染生产 GA 数据
// strategy="afterInteractive" 是 GA 官方推荐:hydration 之后再加载,不阻塞首屏
export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
