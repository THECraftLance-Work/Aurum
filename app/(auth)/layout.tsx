import { WalletIcon, Building2, Briefcase } from "lucide-react";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-[1.1fr_1fr] bg-[var(--color-bg)]">
      {/* Left side: Editorial Brand & Statistics */}
      <div className="hidden lg:flex flex-col justify-between p-12 lg:p-12 bg-[#ec3013] text-white">
        <div>
          <img
            src="/APP_LOGO.png"
            alt="Aurum Real Estate"
            className="h-30 w-full object-cover"
          />
        </div>

        <div className="max-w-lg space-y-6">
          <div className="h-0.5 w-16 bg-white/60 mb-6" />
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.08] text-white">
            Bookings, payments and approvals in one ledger.
          </h1>
          <p className="text-base leading-relaxed text-white/90 font-normal">
            Internal platform for sales, channel partners, accounts and
            leadership. Every booking carries its payment trail, verification
            state and approver.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-10 pt-8 border-t border-white/30">
          <div>
            <div className=" flex flex-col font-heading font-extrabold text-2xl xl:text-3xl">
              <div>
                <WalletIcon />
              </div>
              ₹412 Cr
            </div>
            <div className="text-[11px] font-medium tracking-wider uppercase opacity-85 mt-1">
              Booked FY26
            </div>
          </div>
          <div>
            <div className="font-heading font-extrabold text-2xl xl:text-3xl">
              <Building2 />
              1,284
            </div>
            <div className="text-[11px] font-medium tracking-wider uppercase opacity-85 mt-1">
              Units sold
            </div>
          </div>
          <div>
            <Briefcase />
            <div className="font-heading font-extrabold text-2xl xl:text-3xl">
              9
            </div>
            <div className="text-[11px] font-medium tracking-wider uppercase opacity-85 mt-1">
              Live projects
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Interactive Auth View */}
      <div className="flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-[var(--color-bg)] min-h-screen">
        <div className="w-full max-w-md">
          {/* Logo badge above form for high visibility */}
          <div className="mb-20  flex justify-center lg:hidden">
            <img
              src="/APP_LOGO.png"
              alt="Aurum Real Estate"
              className="h-50 w-full object-cover"
            />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
