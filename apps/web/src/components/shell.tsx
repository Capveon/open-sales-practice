"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { publicBrand } from "@/lib/brand";
import { CapstoneArch } from "./capstone-arch";

type Me = {
  user: { name: string };
  settings: { appName: string; auth: string; voice: string };
};

function Mark({ size = 28 }: { size?: number }) {
  const brand = publicBrand();
  if (brand.mark === "arch") return <CapstoneArch size={size} />;
  return (
    <span
      className="nav__mark"
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const brand = publicBrand();
  const [me, setMe] = useState<Me | null>(null);
  const liveCall = /^\/call\/[^/]+$/.test(pathname ?? "");

  useEffect(() => {
    if (liveCall) return;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, [pathname, liveCall]);

  const clerk = me?.settings.auth === "clerk";
  const name = me?.settings.appName || brand.appName;

  if (liveCall) {
    return <div className="shell shell--call">{children}</div>;
  }

  return (
    <div className="shell">
      <header className="nav">
        <div className="nav__in">
          <Link href="/" className="nav__brand" aria-label={`${name} home`}>
            <Mark />
            <span className="nav__wordmark">{name}</span>
            <span className="nav__product">{brand.product}</span>
          </Link>
          <nav className="nav__groups" aria-label="Primary">
            <Link href="/" className="nav__trigger" aria-current={pathname === "/" ? "page" : undefined}>
              Roster
            </Link>
            <Link
              href="/leaderboard"
              className="nav__trigger"
              aria-current={pathname === "/leaderboard" ? "page" : undefined}
            >
              Leaderboard
            </Link>
          </nav>
          <div className="nav__right">
            {me ? <span className="nav__meta">{me.user.name}</span> : null}
            {clerk ? <UserButton /> : null}
          </div>
        </div>
      </header>
      {children}
      <footer className="ft">
        <div className="ft__in">
          <div>
            <div className="ft__wordmark">
              <Mark size={20} />
              {name}
            </div>
            <p className="ft__tagline">{brand.tagline}</p>
          </div>
          <p className="ft__legal">Open source under MIT.</p>
        </div>
      </footer>
    </div>
  );
}
