import { vendorInitials } from "@/lib/vendors";
import type { Vendor } from "@/lib/types";

export default function VendorLogo({
  vendor,
  size = 56,
}: {
  vendor: Pick<Vendor, "name" | "logo_url">;
  size?: number;
}) {
  const cls = "rounded-xl object-cover bg-[var(--tekhelet-soft)] shrink-0";
  if (vendor.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={vendor.logo_url}
        alt=""
        width={size}
        height={size}
        className={cls}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`${cls} grid place-items-center font-bold text-[var(--tekhelet)]`}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      aria-hidden
    >
      {vendorInitials(vendor.name || "S")}
    </div>
  );
}
