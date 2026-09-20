import { paymentServices } from "../data";

export function ServiceGrid() {
  return (
    <section className="neo-card bg-white p-4 sm:p-5">
      <div className="section-heading">
        <h2>Layanan pembayaran</h2>
      </div>

      <div className="service-grid">
        {paymentServices.map(({ label, icon: Icon, tone }) => (
          <button className="service-item" key={label} type="button">
            <span className={`service-icon ${tone}`}>
              <Icon size={22} strokeWidth={2.7} />
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
