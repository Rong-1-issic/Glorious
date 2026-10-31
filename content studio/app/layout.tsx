import "./globals.css";
export const metadata = {
  title: "content studio｜跨境内容工作台",
  description: "从消费者评论，到有据可循的品牌故事",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
