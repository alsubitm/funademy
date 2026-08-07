export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="ltr" lang="en">
      {children}
    </div>
  );
}
