export default function PageHeader({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-[30px] font-semibold text-text-primary leading-tight">{title}</h1>
      {subtitle && <p className="text-base text-text-muted mt-1.5">{subtitle}</p>}
    </div>
  );
}
