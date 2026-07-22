import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/pricing", label: "Pricing" },
];

/** Shared marketing-site header — used by the landing hero and the pricing page. */
export default function PublicNav({ active }: { active?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    // mousedown (not click) — the button that opens the menu fires its own
    // click after this effect subscribes, and a same-tick "click" listener
    // would immediately treat that as an outside click and close it again.
    function onPointerDownOutside(e: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      setMenuOpen(false);
    }

    if (menuOpen) {
      document.addEventListener("keydown", onKey);
      document.addEventListener("mousedown", onPointerDownOutside);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDownOutside);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const goTo = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <nav className="relative z-20 flex items-center justify-between p-4 md:px-16 lg:px-24 xl:px-32 md:py-6 w-full">
      <Link to="/" aria-label="Mount Reality home" className="flex items-center gap-2.5 shrink-0">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-600 shadow-lg shrink-0">
          <Building2 className="h-4.5 w-4.5 text-primary-foreground" />
        </span>
        <span className="text-base font-bold tracking-tight text-foreground">
          Mount<span className="text-primary">Reality</span>
        </span>
      </Link>

      <div
        id="menu"
        ref={menuRef}
        className={[
          "max-md:fixed max-md:inset-0 max-md:z-30 max-md:flex max-md:flex-col max-md:items-center max-md:justify-center max-md:gap-8 max-md:bg-background/95 max-md:backdrop-blur max-md:transition-opacity max-md:duration-300",
          "flex items-center gap-8 font-medium text-foreground",
          menuOpen ? "max-md:opacity-100" : "max-md:pointer-events-none max-md:opacity-0",
        ].join(" ")}
        aria-hidden={!menuOpen}
      >
        {LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            onClick={() => setMenuOpen(false)}
            className={`transition-colors hover:text-primary ${active === link.label.toLowerCase() ? "text-primary" : ""}`}
          >
            {link.label}
          </Link>
        ))}

        <div className="flex flex-col items-center gap-3 md:hidden">
          <Button variant="outline" className="w-44" onClick={() => goTo("/login")}>
            Sign In
          </Button>
          <Button className="w-44" onClick={() => goTo("/signup")}>
            Get Started <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>

        <button
          onClick={() => setMenuOpen(false)}
          className="md:hidden absolute top-4 right-4 rounded-md bg-secondary p-2 text-foreground hover:bg-secondary/70 transition"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="hidden md:flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => goTo("/login")}>
          Sign In
        </Button>
        <Button size="sm" onClick={() => goTo("/signup")}>
          Get Started <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>

      <button
        onClick={() => setMenuOpen(true)}
        className="md:hidden rounded-md bg-secondary p-2 text-foreground hover:bg-secondary/70 transition"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
    </nav>
  );
}
