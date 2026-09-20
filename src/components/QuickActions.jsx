import { quickActions } from "../data";

export function QuickActions({ onAction }) {
  return (
    <section>
      <div className="grid grid-cols-4 gap-3 sm:gap-4">
        {quickActions.map(({ id, label, icon: Icon }) => (
          <button className="quick-action group" key={label} onClick={() => onAction?.(id)} type="button">
            <span className="quick-icon">
              <Icon size={22} strokeWidth={2.8} />
            </span>
            <span className="text-xs font-extrabold sm:text-sm">{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
