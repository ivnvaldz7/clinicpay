export const PageHeader = ({ title, description, action }) => (
  <div className="flex items-start justify-between">
    <div>
      <h1 className="text-xl font-semibold">{title}</h1>
      {description && (
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
