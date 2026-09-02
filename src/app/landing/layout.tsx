import "./landing.css";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="lp-root">{children}</div>;
}
